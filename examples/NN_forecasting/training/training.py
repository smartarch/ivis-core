#!/usr/bin/env python3
import numpy as np
import pandas as pd
import tensorflow as tf
import ivis_nn


def run_training(training_parameters, data, model_save_path):
    """
    Run the training of neural network with specified parameters and data.

    Parameters
    ----------
    training_parameters : dict (TrainingParams)
        The parameters passed from Optimizer (converted to ``dict`` because they were serialized to JSON along the way).
        Before serialization, the parameters were a class derived from Optimizer.TrainingParams.
    data : dict
        The data for training, received from Elasticsearch.
    model_save_path : str
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
    model.compile(
        optimizer=ivis_nn.model.get_optimizer(training_parameters),
        loss=tf.losses.mse
    )
    model.summary()

    fit_params = {
        "epochs": 1  # TODO
    }
    metrics_history = model.fit(train, **fit_params)
    print(metrics_history.history)

    # # save the model
    # model.save(model_save_path)

    return {
        "train_loss": 1.22,
        "test_loss": 3.4,
    }
