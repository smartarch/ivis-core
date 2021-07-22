"""
Code for running the trained models for prediction.
"""
import os
import time
from uuid import uuid4
import numpy as np
import pandas as pd
import tensorflow as tf
from ivis import ivis
from .common import get_aggregated_field
from . import elasticsearch as es
from .preprocessing import get_column_names, preprocess_using_coefficients
from .ParamsClasses import PredictionParams


def load_data(prediction_parameters):
    """
    Loads data for one step of the prediction. Generates the queries, runs them in Elasticsearch and parses the data.

    Parameters
    ----------
    prediction_parameters : ivis.nn.PredictionParams

    Returns
    -------
    pd.DataFrame
    """
    index = prediction_parameters.index
    input_width = prediction_parameters.input_width

    if prediction_parameters.aggregated:
        aggregation_interval = f"{prediction_parameters.interval}ms"
        query = es.get_histogram_query(prediction_parameters.input_signals, prediction_parameters.ts_field, aggregation_interval, size=input_width)
        results = ivis.elasticsearch.search(index=index, body=query)
        return es.parse_histogram(prediction_parameters.input_signals, results)
    else:
        query = es.get_docs_query(prediction_parameters.input_signals, prediction_parameters.ts_field, size=input_width)
        results = ivis.elasticsearch.search(index=index, body=query)
        return es.parse_docs(prediction_parameters.input_signals, results)


# TODO (MT): see comment to `load_data_multiple`
def _get_last_prediction_ts():
    state = ivis.state
    if "last_prediction_ts" in state:
        return state["last_prediction_ts"]
    else:
        return None


def _set_last_prediction_ts(ts):
    state = ivis.state if ivis.state else dict()
    state["last_prediction_ts"] = ts
    ivis.store_state(state)


def _intervals_since_last_prediction(interval):
    last_prediction = _get_last_prediction_ts()
    if last_prediction is None:
        return 1  # first time predicting – we want to predict just one sample
    now = int(time.time() * 1000)  # ts in ms
    return (now - last_prediction) // interval


def _get_time_interval(prediction_parameters):
    last_prediction = _get_last_prediction_ts()
    if last_prediction is not None:
        start_ts = last_prediction - prediction_parameters.interval * (prediction_parameters.input_width - 1)
        return {"start_exclusive": start_ts}


class NotEnoughDataError(Exception):
    def __str__(self):
        return "Not enough data."


# TODO (MT): this is currently unused. Think about whether it is useful.
def load_data_multiple(prediction_parameters):
    """
    Generates the queries, runs them in Elasticsearch and parses the data.

    Parameters
    ----------
    prediction_parameters : ivis.nn.PredictionParams

    Returns
    -------
    pd.DataFrame
    """
    index = prediction_parameters.index
    input_width = prediction_parameters.input_width

    if prediction_parameters.aggregated:
        intervals_since_last_prediction = _intervals_since_last_prediction(prediction_parameters.interval)
        if intervals_since_last_prediction < 1:
            raise NotEnoughDataError
        size = intervals_since_last_prediction + input_width - 1
        time_interval = _get_time_interval(prediction_parameters)
        aggregation_interval = f"{prediction_parameters.interval}ms"

        query = es.get_histogram_query(prediction_parameters.input_signals, prediction_parameters.ts_field, aggregation_interval, size=size, time_interval=time_interval)
        results = ivis.elasticsearch.search(index=index, body=query)
        return es.parse_histogram(prediction_parameters.input_signals, results)

    else:
        query = es.get_docs_query(prediction_parameters.input_signals, prediction_parameters.ts_field, size=input_width)
        results = ivis.elasticsearch.search(index=index, body=query)
        return es.parse_docs(prediction_parameters.input_signals, results)


def get_windowed_dataset(prediction_parameters, dataframe):
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
        values += ["unknown"]
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


def load_model(log_callback=print):
    training_job = ivis.params["training_job"]
    model_file = ivis.params["model_file"]
    params_file = ivis.params["prediction_parameters_file"]
    tmp_folder = str(uuid4())

    # download the model from IVIS server
    log_callback("Downloading model...")
    model_path = tmp_folder + "/model.h5"
    os.makedirs(tmp_folder)
    with open(model_path, "wb") as file:
        model_response = ivis.get_job_file(training_job, model_file)
        file.write(model_response.content)

    log_callback("Loading TensorFlow model...")
    model = tf.keras.models.load_model(model_path)

    log_callback("Cleaning temporary files...")
    try:
        os.remove(model_path)
        os.rmdir(tmp_folder)
    except OSError as e:
        print("Error while cleaning up temporary files:\n  %s - %s." % (e.filename, e.strerror))

    log_callback("Downloading prediction parameters...")
    params_response = ivis.get_job_file(training_job, params_file)
    prediction_parameters = PredictionParams().from_json(params_response.text)

    log_callback("Model loaded.")
    return prediction_parameters, model


##################
# Run prediction #
##################


def run_prediction(prediction_parameters, model, log_callback=print):
    """
    Predicts future values using the given model and new data.

    Parameters
    ----------
    prediction_parameters : PredictionParams
        The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
        signals and their types.
    model : tf.keras.Model
        The model to use for predictions.
    log_callback : callable
        Function to print to Job log.

    Returns
    -------
    bool
        Whether the model was updated and should be uploaded to IVIS server. TODO (MT): this is probably unnecessary as we can simply save the model back to the file from which it was loaded
    any
        New predictions to be inserted into the signal set in Elasticsearch.
    """

    log_callback("Initializing...")

    try:
        log_callback("Loading data...")
        dataframe = load_data(prediction_parameters)
        log_callback(f"Loaded {dataframe.shape[0]} records.")
        log_callback("Processing data...")
        dataframe = preprocess_using_coefficients(prediction_parameters.normalization_coefficients, dataframe)
        last_ts = dataframe.index[prediction_parameters.input_width - 1:]

        dataset = get_windowed_dataset(prediction_parameters, dataframe)
        log_callback("Data successfully loaded and processed.")

    except es.NoDataError:
        log_callback("No data in the defined time range, can't continue.")
        raise es.NoDataError from None
    except NotEnoughDataError:  # TODO (MT): see comment to `load_data_multiple`
        log_callback("Not enough new data since the last prediction, can't continue.")
        raise NotEnoughDataError from None

    log_callback("Loading model...")
    model.summary(print_fn=log_callback)

    log_callback("Computing predictions...")
    predicted = model.predict(dataset)

    predicted_dataframes = postprocess(prediction_parameters, predicted, last_ts)

    log_callback("Saving data...")
    return True, predicted_dataframes
