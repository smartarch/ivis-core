#!/usr/bin/env python3
import json

import numpy as np
import pandas as pd
import tensorflow as tf
import ivis_nn
from ivis_nn.PredictionParams import PredictionParams


def run_training(training_parameters, data, model_save_folder):
    """
    Run the training of neural network with specified parameters and data.

    Parameters
    ----------
    training_parameters : dict (TrainingParams)
        The parameters passed from Optimizer (converted to ``dict`` because they were serialized to JSON along the way).
        Before serialization, the parameters were a class derived from Optimizer.TrainingParams.
    data : dict
        The data for training, received from Elasticsearch.
    model_save_folder : str
        Path to save the trained model.

    Returns
    -------
    dict
        The computed losses, etc. This should be returned back to the Optimizer.

    """

    dataframe = ivis_nn.es.parse_data(training_parameters, data)
    train_df, val_df, test_df = ivis_nn.pre.split_data(training_parameters, dataframe)
    train_df, val_df, test_df, norm_coeffs, columns = ivis_nn.pre.preprocess_dataframes(training_parameters, train_df, val_df, test_df)

    window_params = {
        "input_width": 3,
        "target_width": 1,
        "interval": training_parameters["interval"]
    }
    train, val, test = ivis_nn.pre.make_datasets(columns, train_df, val_df, test_df, window_params)

    # example = list(train.as_numpy_iterator())
    # for ex in example:
    #     print(ex[0])
    #     print(ex[1])

    input_shape = (window_params["input_width"], len(columns[0]))
    target_shape = (window_params["target_width"], len(columns[1]))

    # sample neural network model
    model = ivis_nn.model.get_model(training_parameters, input_shape, target_shape)

    # add residual connection - predict the difference
    targets_to_inputs_mapping = ivis_nn.model.get_targets_to_inputs_mapping(*columns)
    model = ivis_nn.model.wrap_with_residual_connection(model, targets_to_inputs_mapping)

    model.compile(
        optimizer=ivis_nn.model.get_optimizer(training_parameters),
        loss=tf.losses.mse
    )
    model.summary()

    fit_params = {
        "epochs": 3  # TODO
    }
    metrics_history = model.fit(train, **fit_params)
    print(metrics_history.history)

    # # save the model
    # model.save(model_save_folder + "model.h5")
    # save the prediction parameters
    prediction_parameters = PredictionParams(training_parameters, norm_coeffs)
    print(json.dumps(prediction_parameters.__dict__, indent=2))  # TODO: save to file

    return {
        "train_loss": 1.22,
        "test_loss": 3.4,
    }
