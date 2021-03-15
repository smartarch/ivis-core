#!/usr/bin/env python3
import numpy as np
import tensorflow as tf


def run_prediction(parameters, data, model_path, log_callback):
    """
    Predicts future values using the given model and new data.

    Parameters
    ----------
    parameters : dict
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

    model = tf.keras.models.load_model(model_path)
    model.summary()

    return True, []
