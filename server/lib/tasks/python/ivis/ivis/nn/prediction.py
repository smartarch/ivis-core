"""
Code for using the trained models to generate prediction.

Manages the data loading and preprocessing, loads the model from IVIS server, generates the prediction and saves them to the signal sets on server.
"""
import os
import requests
from pathlib import Path
from uuid import uuid4
import pandas as pd
import tensorflow as tf
from ivis import ivis

from . import load_elasticsearch as es, architecture
from .common import print_divider, NotEnoughDataError
from .load import load_data
from .postprocessing import postprocess
from .preprocessing import preprocess_using_coefficients, get_windowed_dataset
from .ParamsClasses import PredictionParams
from .architecture import ModelFactory


#########################
# Load and prepare data #
#########################


def load_data_first(prediction_parameters):
    """
    Loads data for the first prediction.

    This loads the `prediction_parameters.input_width` latest records to create the latest prediction plus
    ``prediction_parameters.target_width - 1`` in order to seamlessly continue the predictions created by the
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
    dataframe : pandas.DataFrame
        The loaded data.
    """
    print(f"(since {last_window_start})")
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
    dataframe : pandas.DataFrame
        The loaded data.
    """
    last_window_start = _get_last_prediction_ts()

    if last_window_start is not None:
        return load_data_since(prediction_parameters, last_window_start)
    else:
        return load_data_first(prediction_parameters)


##################
# Load the model #
##################


def load_model(model_factory=None):
    """
    Loads the model from the IVIS server.

    The model is loaded based on the training job id (`ivis.params["training_job"]`) and its file name (`ivis.params["model_file"]`). The prediction parameters file (with name `ivis.params["prediction_parameters_file"]`) is also downloaded from the same job.

    Parameters
    ----------
    model_factory : ModelFactory
        The factory which was used to create the model. It's `update_loaded_model` method is applied to the file loaded from the IVIS server. If no model factory is supplied, it is selected based on the `PredictionParams.architecture`.

    Returns
    -------
    parameters : PredictionParams
        Additional parameters needed for generating the predictions.
    model : tensorflow.keras.Model
        The loaded model.
    """

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
    model : tensorflow.keras.Model
        The model to use for predictions.
    save_data : (PredictionParams, list[pandas.DataFrame]) -> None
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
    print(f"({len(predicted_dataframes)} prediction window{'s' if len(predicted_dataframes) > 1 else ''})")
    save_data(prediction_parameters, predicted_dataframes)

    last_window_start = int(dataframe.index[-prediction_parameters.input_width])
    _set_last_prediction_ts(last_window_start)

    print("All done.")
