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
    training_parameters : dict
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
    }
    train, val, test = ivis_nn.pre.make_datasets(columns, train_df, val_df, test_df, window_params)

    # example_window = tf.convert_to_tensor([
    #     [[11, 12, 13], [14, 15, 16], [17, 18, 19], [20, 21, 22]],
    #     [[21, 22, 23], [24, 25, 26], [27, 28, 29], [30, 31, 32]]
    # ])
    # i, t = w.split_window(example_window)
    # print(i)

    print(list(train.take(1).as_numpy_iterator()))

    # train, val, test = create_datasets(training_parameters, X, Y)

    # print(train)
    # print(list(train.as_numpy_iterator()))
    # print(val)
    # print(list(val.as_numpy_iterator()))

    # # sample neural network model
    # inputs = tf.keras.layers.Input(shape=[3, 1])
    # layer = tf.keras.layers.LSTM(1, return_sequences=True)(inputs)
    # model = tf.keras.Model(inputs=inputs, outputs=layer)

    # model.compile(optimizer=tf.optimizers.Adam(), loss=tf.losses.mse)
    # model.summary()
    # metrics_history = model.fit([[[1], [2], [3]]], [[[2], [3], [4]]])
    # print(metrics_history.history)

    # # save the model
    # model.save(model_save_path)

    return {
        "train_loss": 1.22,
        "test_loss": 3.4,
    }
