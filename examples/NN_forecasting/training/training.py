#!/usr/bin/env python3
import numpy as np
import pandas as pd
import tensorflow as tf

#################################
# Parsing Elasticsearch results #
#################################


def parse_signal_values_from_docs(field, docs):
    """Returns the values of one signal as np array (vector)"""
    values = []
    for d in docs:
        values.append(d["_source"][field])
    return np.array(values)


def parse_signal_values_from_buckets(field, buckets):
    """Returns the values of one signal as np array (vector)"""
    values = []
    for b in buckets:
        values.append(b[field]["value"])
    return np.array(values)


def get_hits(data):
    return data["hits"]["hits"]


def get_buckets(data):
    return data["aggregations"]["aggregated_data"]["buckets"]


def parse_els_docs(training_parameters, data):
    """
    Parse the docs data from Elasticsearch.

    Parameters
    ----------
    training_parameters : dict
    data : dict
        JSON response from Elasticsearch parsed to dict

    Returns
    -------
    (pd.DataFrame, pd.DataFrame)
        Inputs and targets. Columns are fields, rows are docs.
    """
    docs = get_hits(data)
    input_schema = training_parameters["inputSchema"]
    target_schema = training_parameters["targetSchema"]

    X = pd.DataFrame()
    for sig in input_schema:
        sig_values = parse_signal_values_from_docs(sig, docs)
        X[sig] = sig_values

    Y = pd.DataFrame()
    for sig in target_schema:
        sig_values = parse_signal_values_from_docs(sig, docs)
        Y[sig] = sig_values

    return X, Y


def parse_els_histogram(training_parameters, data):
    """
    Parse the date histogram data from Elasticsearch.

    Parameters
    ----------
    training_parameters : dict
    data : dict
        JSON response from Elasticsearch parsed to dict

    Returns
    -------
    (pd.DataFrame, pd.DataFrame)
        Inputs and targets. Columns are fields, rows are buckets.
    """
    buckets = get_buckets(data)
    input_schema = training_parameters["inputSchema"]
    target_schema = training_parameters["targetSchema"]

    X = pd.DataFrame()
    for sig in input_schema:
        sig_values = parse_signal_values_from_buckets(sig, buckets)  # TODO: more than just avg aggregation
        X[sig] = sig_values

    Y = pd.DataFrame()
    for sig in target_schema:
        sig_values = parse_signal_values_from_buckets(sig, buckets)
        Y[sig] = sig_values

    return X, Y


def parse_els_data(training_parameters, data):
    if training_parameters["query_type"] == "docs":
        return parse_els_histogram(training_parameters, data)
    elif training_parameters["query_type"] == "histogram":
        return parse_els_histogram(training_parameters, data)
    else:
        raise Exception("Unknown query type")


#################
# Preprocessing #
#################


def split_data(training_parameters, X, Y):
    """Returns three tuples (X, Y) for train, val, test"""
    split = training_parameters["split"]
    N = X.shape[0]  # number of records
    train_size = int(np.floor(N * split["train"]))
    val_size = int(np.floor(N * split["val"]))
    # test_size = N - train_size - val_size
    return \
        (X.iloc[:train_size, :], Y.iloc[:train_size, :]), \
        (X.iloc[train_size:train_size + val_size, :], Y.iloc[train_size:train_size + val_size, :]), \
        (X.iloc[train_size + val_size:, :], Y.iloc[train_size + val_size:, :])


def dataframes_to_dataset(X_Y_tuple):
    X, Y = X_Y_tuple
    X = X.to_dict(orient="series")
    Y = Y.to_dict(orient="series")
    return tf.data.Dataset.from_tensor_slices((X, Y))


def create_datasets(training_parameters, X, Y):
    """
    Splits the DataFrames X, Y into train, val and test Datasets

    Returns
    -------
    (tf.data.Dataset, tf.data.Dataset, tf.data.Dataset)
        train, val, test
    """
    return (dataframes_to_dataset(frames) for frames in split_data(training_parameters, X, Y))


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
    np.ndarray
        The preprocessed values as rows of a vector/matrix.
    """
    return values.reshape(-1, 1)


########
# Main #
########


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

    X, Y = parse_els_data(training_parameters, data)

    train, val, test = create_datasets(training_parameters, X, Y)

    print(train)
    print(list(train.as_numpy_iterator()))
    print(val)
    print(list(val.as_numpy_iterator()))

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
