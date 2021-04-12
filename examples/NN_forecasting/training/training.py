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
        Dataframe of both inputs and targets. Columns are fields, rows are the training patterns (docs from ES).
    """
    docs = get_hits(data)
    input_schema = training_parameters["input_schema"]
    target_schema = training_parameters["target_schema"]
    # merge the schemas
    schema = dict(input_schema)
    schema.update(target_schema)

    dataframe = pd.DataFrame()

    for sig in schema:
        sig_values = parse_signal_values_from_docs(sig, docs)
        dataframe[sig] = sig_values

    return dataframe


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
    pd.DataFrame
        Dataframe of both inputs and targets. Columns are fields, rows are the training patterns (buckets from ES).
    """
    buckets = get_buckets(data)
    input_schema = training_parameters["input_schema"]
    target_schema = training_parameters["target_schema"]
    # merge the schemas
    schema = dict(input_schema)
    schema.update(target_schema)

    dataframe = pd.DataFrame()

    for sig in schema:
        sig_values = parse_signal_values_from_buckets(sig, buckets)  # TODO: more than just avg aggregation
        dataframe[sig] = sig_values

    return dataframe


def parse_els_data(training_parameters, data):
    if training_parameters["query_type"] == "docs":
        return parse_els_docs(training_parameters, data)
    elif training_parameters["query_type"] == "histogram":
        return parse_els_histogram(training_parameters, data)
    else:
        raise Exception("Unknown query type")


#################
# Preprocessing #
#################


def split_data(training_parameters, dataframe):
    """Returns three datasets for train, val, test"""
    split = training_parameters["split"]
    n = dataframe.shape[0]  # number of records
    train_size = int(np.floor(n * split["train"]))
    val_size = int(np.floor(n * split["val"]))
    # test_size = N - train_size - val_size
    return \
        dataframe.iloc[:train_size, :], \
        dataframe.iloc[train_size:train_size + val_size, :], \
        dataframe.iloc[train_size + val_size:, :]


class WindowGenerator:
    """
    Time series window dataset generator
    (inspired by https://www.tensorflow.org/tutorials/structured_data/time_series#data_windowing)

    [ #, #, #, #, #, #, #, #, #, #, #, #, # ]
     | input_width | offset | target_width |
     |               width                 |
    """
    def __init__(self, input_width, target_width, offset, dataframe, input_schema, target_schema=None):
        self.input_width = input_width
        self.target_width = target_width
        self.offset = offset

        self.dataframe = dataframe
        self.column_indices = {name: i for i, name in enumerate(dataframe.columns)}

        input_column_names = input_schema.keys()
        target_column_names = input_column_names
        if target_schema is not None and target_schema:
            target_column_names = target_schema.keys()

        self.input_columns = [self.column_indices[name] for name in input_column_names]
        self.target_columns = [self.column_indices[name] for name in target_column_names]

        # window parameters
        self.width = input_width + offset + target_width
        self.input_slice = slice(0, input_width)
        self.target_start = input_width + offset
        self.target_slice = slice(self.target_start, self.target_start + target_width)

    def __str__(self):
        return '\n'.join([
            f'Total window width: {self.width}',
            f'Input indices: {np.arange(self.width)[self.input_slice]}',
            f'Target indices: {np.arange(self.width)[self.target_slice]}'])

    def split_window(self, batch):
        inputs = batch[:, self.input_slice, :]  # slice along the time axis
        inputs = tf.gather(inputs, self.input_columns, axis=2)  # select features
        inputs.set_shape([None, self.input_width, None])

        targets = batch[:, self.target_slice, :]  # slice along the time axis
        targets = tf.gather(targets, self.target_columns, axis=2)  # select features
        targets.set_shape([None, self.target_width, None])

        return inputs, targets

    def make_dataset(self, dataframe=None):
        """
        Creates a windowed dataset from a dataframe.

        Parameters
        ----------
        dataframe : pd.DataFrame
            The dataframe from which to make windows. If equal to `None`, the `self.dataframe` is used. The dataframe must have the same columns as `self.dataframe`.

        Returns
        -------
        tf.data.Dataset
        """
        if dataframe is None:
            dataframe = self.dataframe
        assert list(dataframe.columns) == list(self.dataframe.columns)
        if dataframe.empty:
            return None

        data = np.array(dataframe, dtype=np.float32)
        ds = tf.keras.preprocessing.timeseries_dataset_from_array(
            data=data,
            targets=None,
            sequence_length=self.width,
            sequence_stride=1,
            shuffle=False,
            batch_size=32, )  # TODO: batch size, shuffle

        ds = ds.map(self.split_window)

        return ds


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

    dataframe = parse_els_data(training_parameters, data)
    train_d, val_d, test_d = split_data(training_parameters, dataframe)

    window = WindowGenerator(3, 1, 0, dataframe, training_parameters["input_schema"], training_parameters["target_schema"])
    train = window.make_dataset()
    val = window.make_dataset(val_d)
    test = window.make_dataset(test_d)

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
