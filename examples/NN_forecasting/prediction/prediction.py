#!/usr/bin/env python3
import numpy as np
import tensorflow as tf
from ivis import ivis
from ivis_nn import es


def load_data(prediction_parameters):
    """
    Generates the queries, runs them in Elasticsearch and parses the data.

    Parameters
    ----------
    prediction_parameters : dict (PredictionParams)

    Returns
    -------
    pd.DataFrame
    """
    index = prediction_parameters["index"]
    if prediction_parameters["interval"] is not None:
        aggregation_interval = f"{prediction_parameters['interval']}ms"
        query = es.get_histogram_query(prediction_parameters["input_signals"], prediction_parameters["ts_field"], aggregation_interval)  # TODO: time interval, size
        results = ivis.elasticsearch.search(index, query)
        return es.parse_histogram(prediction_parameters["input_signals"], results)
    else:
        query = es.get_docs_query(prediction_parameters["input_signals"], prediction_parameters["ts_field"])  # TODO: time interval, size
        results = ivis.elasticsearch.search(index, query)
        return es.parse_docs(prediction_parameters["input_signals"], results)


def run_prediction(prediction_parameters, data, model_path, log_callback):
    """
    Predicts future values using the given model and new data.

    Parameters
    ----------
    prediction_parameters : dict
        The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
        signals and their types.
    data : any
        The new data for making predictions, received from Elasticsearch.
    model_path : str
        Path to load the model from and save the model if it was updated.
    log_callback : callable
        Function to print to Job log.

    Returns
    -------
    bool
        Whether the model was updated and should be uploaded to IVIS server.
    any
        New predictions to be inserted into the signal set in Elasticsearch.
    """

    dataframe = load_data(prediction_parameters)
    print(dataframe)

    model = tf.keras.models.load_model(model_path)
    model.summary()

    return True, []
