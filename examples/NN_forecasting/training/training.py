#!/usr/bin/env python3
import numpy as np
# import tensorflow as tf


def parse_signal_values(field, docs):
    """Returns the values of one signal as np array (vector)"""
    values = []
    for d in docs:
        values.append(d["_source"][field])
    return np.array(values)


def preprocess_signal_values(values, sig_type):  # TODO
    """
    Preprocess the signal values (apply normalization, one-hot encoding for categorical signals, ...).

    Parameters
    ----------
    values : ndarray
        Vector of values.
    sig_type : str
        Type of the signal.

    Returns
    -------
    ndarray
        The preprocessed values as rows of a vector/matrix.
    """
    return values.reshape(-1, 1)


def get_hits(data):
    return data["hits"]["hits"]


def parse_els_docs(training_parameters, data):
    docs = get_hits(data)
    input_schema = training_parameters["inputSchema"]
    target_schema = training_parameters["targetSchema"]

    inputValues = [] 
    for sig, sig_type in input_schema.items():
        sig_values = parse_signal_values(sig, docs)
        sig_values = preprocess_signal_values(sig_values, sig_type)
        inputValues.append(sig_values)
    X = np.hstack(inputValues)

    targetValues = []
    for sig, sig_type in target_schema.items():
        sig_values = parse_signal_values(sig, docs)
        sig_values = preprocess_signal_values(sig_values, sig_type)
        targetValues.append(sig_values)
    Y = np.hstack(targetValues)

    return X, Y


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

    X, Y = parse_els_docs(training_parameters, data)
    print(X)
    print(Y)

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
