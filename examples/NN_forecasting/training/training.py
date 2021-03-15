#!/usr/bin/env python3
import numpy as np
import tensorflow as tf


def run_training(training_parameters, data, model_save_path):
    """
    Run the training of neural network with specified parameters and data.

    Parameters
    ----------
    training_parameters : dict
        The parameters passed from Optimizer (converted to ``dict`` because they were serialized to JSON along the way).
        Before serialization, the parameters were a class derived from Optimizer.TrainingParams.
    data : any
        The data for training, received from Elasticsearch.
    model_save_path : str
        Path to save the trained model.

    Returns
    -------
    dict
        The computed losses, etc. This should be returned back to the Optimizer.

    """

    # sample neural network model
    inputs = tf.keras.layers.Input(shape=[3, 1])
    layer = tf.keras.layers.LSTM(1, return_sequences=True)(inputs)
    model = tf.keras.Model(inputs=inputs, outputs=layer)

    model.compile(optimizer=tf.optimizers.Adam(), loss=tf.losses.mse)
    model.summary()
    metrics_history = model.fit([[[1], [2], [3]]], [[[2], [3], [4]]])
    print(metrics_history.history)

    # save the model
    model.save(model_save_path)

    return {
        "train_loss": 1.22,
        "test_loss": 3.4,
    }
