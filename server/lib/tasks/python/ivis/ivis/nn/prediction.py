"""
Code for running the trained models for prediction.
"""
import os
import requests
import sys
from pathlib import Path
from uuid import uuid4
import numpy as np
import pandas as pd
import tensorflow as tf
from ivis import ivis
from . import load_data_elasticsearch as es, architecture
from .common import get_aggregated_field, print_divider
from .load_data import load_data
from .preprocessing import get_column_names, preprocess_using_coefficients
from .ParamsClasses import PredictionParams


def load_data_first(prediction_parameters):
    """
    Loads data for the first prediction.

    This loads the `prediction_parameters.input_width` latest records to create the latest prediction plus
    `prediction_parameters.target_width - 1` in order to seamlessly continue the predictions created by the
    training task.
    """
    size = prediction_parameters.input_width + prediction_parameters.target_width - 1
    return load_data(prediction_parameters, size=size)


def _get_last_prediction_ts():
    """Gets (from job state) the start of the last window used for prediction."""
    state = ivis.state
    if state is not None and "last_window_start" in state:
        return state["last_window_start"]
    else:
        return None


def _set_last_prediction_ts(ts):
    """Saves to job state the start of the last window used for prediction."""
    state = ivis.state or dict()
    state["last_window_start"] = ts
    ivis.store_state(state)


class NotEnoughDataError(Exception):
    def __str__(self):
        return "Not enough data."


def load_data_since(prediction_parameters, last_window_start):
    """
    Loads all data after a set timestamp.

    Parameters
    ----------
    prediction_parameters : PredictionParams
    last_window_start : int
        The timestamp of the first record in the last window used for prediction. All data strictly after this timestamp are returned.

    Returns
    -------
    pd.DataFrame
    """
    time_interval = {"start_exclusive": last_window_start}

    return load_data(prediction_parameters, time_interval)


def load_data_prediction(prediction_parameters):
    """
    Loads the data for prediction.

    Parameters
    ----------
    prediction_parameters : PredictionParams

    Returns
    -------
    pd.DataFrame
    """
    last_window_start = _get_last_prediction_ts()

    if last_window_start is not None:
        return load_data_since(prediction_parameters, last_window_start)
    else:
        return load_data_first(prediction_parameters)


def get_windowed_dataset(prediction_parameters, dataframe):
    if dataframe.shape[0] < prediction_parameters.input_width:
        raise NotEnoughDataError

    return tf.keras.preprocessing.timeseries_dataset_from_array(
        data=np.array(dataframe, dtype=np.float32),
        targets=None,
        sequence_length=prediction_parameters.input_width,
        sequence_stride=1,
        shuffle=False)


##################
# Postprocessing #
##################


def get_column_indices(normalization_coefficients, signals):
    column_names = get_column_names(normalization_coefficients, signals)
    return {c: i for i, c in enumerate(column_names)}


def _postprocess_sample(sample, signals, normalization_coefficients, column_indices):
    """
    Apply postprocessing the to one predicted sample to denormalize the data, etc.

    Parameters
    ----------
    normalization_coefficients : dict
    column_indices : dict
    sample : np.ndarray
        Shape is [time, signals]

    Returns
    -------
    pd.DataFrame
        The columns correspond to the `PredictionParams.target_signals`, row are time steps of the prediction (without timestamps).
    """

    dataframe = pd.DataFrame()

    def mean_std_denormalization(column, mean, std):
        data = sample[:, column_indices[column]]
        dataframe[column] = data * std + mean

    def min_max_denormalization(column, min_val, max_val):
        data = sample[:, column_indices[column]]
        dataframe[column] = data[column] * (max_val - min_val) + min_val

    def one_hot_decoding(column, values):
        values = values + ["unknown"]
        value_indices = [column_indices[f"{column}_{val}"] for val in values]

        data = []
        for row in sample:
            encoded = row[value_indices]
            most_probable = np.argmax(encoded)
            data.append(values[most_probable])
        dataframe[column] = data

    def postprocess_signal(column):
        coeffs = normalization_coefficients[column]

        if "min" in coeffs and "max" in coeffs:
            return min_max_denormalization(column, coeffs["min"], coeffs["max"])
        elif "mean" in coeffs and "std" in coeffs:
            return mean_std_denormalization(column, coeffs["mean"], coeffs["std"])
        elif "values" in coeffs:
            return one_hot_decoding(column, coeffs["values"])
        raise ValueError(f"Unknown target signal '{column}'.")

    for sig in signals:
        col = get_aggregated_field(sig)
        postprocess_signal(col)

    return dataframe


def _set_sample_ts(sample, start_ts, interval):
    """
    Update the sample's index to correspond to the timestamps of the predictions.

    Parameters
    ----------
    sample : pd.DataFrame
        Shape is [time, signals]
    start_ts : int
        UNIX timestamp (ms).
    interval : int
        In milliseconds.

    Returns
    -------
    pd.DataFrame
        The index is altered to correspond to the timestamps of the predictions.
    """
    row_count = sample.shape[0]
    end_ts = start_ts + row_count * interval
    timestamps = pd.RangeIndex(start_ts, end_ts, interval)
    sample.set_index(timestamps, inplace=True)
    return sample


def postprocess(prediction_parameters, data, last_ts):
    """
    Apply postprocessing the to a batch of predictions to denormalize the data, etc.

    Parameters
    ----------
    prediction_parameters : PredictionParams
    data : np.ndarray
        The shape of the array is [samples, time, signals]
    last_ts : int[]
        The UNIX timestamp of the last record in each prediction input window. This is used to compute the timestamp of the prediction as `last_ts + interval`.

    Returns
    -------
    list[pd.DataFrame]
        Each dataframe in the list has the columns corresponding to the `PredictionParams.target_signals` and rows corresponding to the timestamps of the prediction.
    """
    signals = prediction_parameters.target_signals
    normalization_coefficients = prediction_parameters.normalization_coefficients
    column_indices = get_column_indices(prediction_parameters.normalization_coefficients, prediction_parameters.target_signals)
    interval = prediction_parameters.interval

    processed = []
    for index, sample in enumerate(data):
        sample = _postprocess_sample(sample, signals, normalization_coefficients, column_indices)
        start_ts = last_ts[index] + interval
        sample = _set_sample_ts(sample, start_ts, interval)
        processed.append(sample)
    return processed


def load_model(model_factory=None):
    training_job = ivis.params["training_job"]
    model_file = ivis.params["model_file"]
    params_file = ivis.params["prediction_parameters_file"]
    tmp_folder = str(uuid4())

    # download the model from IVIS server
    print("Downloading model...")
    model_path = Path(tmp_folder) / "model.h5"
    os.makedirs(tmp_folder)
    with open(model_path, "wb") as file:
        model_response = ivis.get_job_file(training_job, model_file)
        file.write(model_response.content)

        if model_response.status_code != requests.codes.ok:
            print("Error: \n", model_response.text)
            model_response.raise_for_status()

    print("Loading TensorFlow model...")
    model = tf.keras.models.load_model(model_path)

    print("Cleaning temporary files...")
    try:
        os.remove(model_path)
        os.rmdir(tmp_folder)
    except OSError as e:
        print("Error while cleaning up temporary files:\n  %s - %s." % (e.filename, e.strerror))

    print("Downloading prediction parameters...")
    params_response = ivis.get_job_file(training_job, params_file)
    prediction_parameters = PredictionParams().from_json(params_response.text)

    if params_response.status_code != requests.codes.ok:
        print("Error: \n", params_response.text)
        params_response.raise_for_status()

    if model_factory is None:
        model_factory = architecture.get_model_factory(prediction_parameters)
    model = model_factory.update_loaded_model(model, prediction_parameters)

    print("Model loaded.")
    print_divider()
    return prediction_parameters, model


##################
# Run prediction #
##################


def run_prediction(prediction_parameters, model, save_data):
    """
    Predicts future values using the given model and new data.

    Parameters
    ----------
    prediction_parameters : PredictionParams
        The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
        signals and their types.
    model : tf.keras.Model
        The model to use for predictions.
    save_data : (PredictionParams, List[pd.DataFrame]) -> None
        Function to save the data.
    """

    print("Initializing...")
    print(f"Using TensorFlow (version {tf.__version__}).")

    print_divider()
    try:
        print("Loading data...")
        dataframe = load_data_prediction(prediction_parameters)
        print(f"Loaded {dataframe.shape[0]} records.")
        print("Processing data...")
        dataframe = preprocess_using_coefficients(prediction_parameters.normalization_coefficients, dataframe)
        last_ts = dataframe.index[prediction_parameters.input_width - 1:]

        dataset = get_windowed_dataset(prediction_parameters, dataframe)
        print("Data successfully loaded and processed.")

    except es.NoDataError:
        print("No data in the defined time range, can't continue.")
        raise es.NoDataError from None
    except NotEnoughDataError:
        print("Not enough new data since the last prediction, can't continue.")
        raise NotEnoughDataError from None

    print_divider()
    model.summary()

    print_divider()
    print("Computing predictions...")
    predicted = model.predict(dataset)

    predicted_dataframes = postprocess(prediction_parameters, predicted, last_ts)

    print_divider()
    print("Saving data...")
    save_data(prediction_parameters, predicted_dataframes)

    last_window_start = int(dataframe.index[-prediction_parameters.input_width])
    _set_last_prediction_ts(last_window_start)

    print("All done.")
