"""
Preprocessing of the data before training and prediction. Includes data normalization and generating the windowed datasets.
"""
import numpy as np
import pandas as pd
import tensorflow as tf
from .common import get_aggregated_field, NotEnoughDataError
from .params_classes import TrainingParams, PredictionParams


def split_data(training_parameters, dataframe):
    """Returns three datasets for train, validation, test as DataFrames."""
    split = training_parameters.split
    n = dataframe.shape[0]  # number of records
    train_size = int(np.floor(n * split["train"]))
    val_size = int(np.floor(n * split["val"]))
    # test_size = N - train_size - val_size
    return \
        dataframe.iloc[:train_size, :], \
        dataframe.iloc[train_size:train_size + val_size, :], \
        dataframe.iloc[train_size + val_size:, :]


def one_hot_encoding(dataframe, column, values):
    """
    Apply one-hot encoding to a column. Modifies the original dataframe!

    Parameters
    ----------
    dataframe : pandas.DataFrame
        Original dataframe. It gets modified!
    column : str
        Column name.
    values : list[str]
        List of unique values, ordered by the desired one-hot indices.

    Returns
    -------
    dataframe : pandas.DataFrame
        Modified dataframe.
    """

    index = dataframe.columns.get_loc(column)

    for val in values:
        dataframe.insert(index, f"{column}_{val}", (dataframe[column] == val).astype(int))
        index += 1
    dataframe.insert(index, f"{column}_unknown", (~dataframe[column].isin(values)).astype(int))

    dataframe.drop(columns=[column], inplace=True)
    return dataframe


def compute_normalization_coefficients(training_parameters, train_df):
    """
    Computes the normalization coefficients which can later be applied by `preprocess_using_coefficients`.

    Parameters
    ----------
    training_parameters : TrainingParams
    train_df : pandas.DataFrame

    Returns
    -------
    normalization_coefficients : dict
        The computed coefficients for normalization.
    """

    normalization_coefficients = {}

    def mean_std(column):
        mean = train_df[column].mean()
        std = train_df[column].std()

        normalization_coefficients[column] = {
            "mean": float(mean),
            "std": float(std)
        }

    def min_max(column, properties):
        min_val = properties["min"] if "min" in properties else train_df[column].min()
        max_val = properties["max"] if "max" in properties else train_df[column].max()

        normalization_coefficients[column] = {
            "min": float(min_val),
            "max": float(max_val)
        }

    def one_hot(column):
        values = list(train_df[column].unique())

        normalization_coefficients[column] = {
            "values": values
        }

    def compute_coefficients(column, properties):
        if properties["data_type"] == "categorical":
            one_hot(column)
        elif "min" in properties or "max" in properties:
            min_max(column, properties)
        else:
            mean_std(column)

    for signal in training_parameters.input_signals + training_parameters.target_signals:
        column_name = get_aggregated_field(signal)
        if column_name not in normalization_coefficients:
            compute_coefficients(column_name, signal)

    return normalization_coefficients


def preprocess_using_coefficients(normalization_coefficients, dataframe):
    """Apply preprocessing (normalization, ...) based on the `normalization_coefficients` to the dataframes."""
    dataframe = dataframe.copy()

    def mean_std_normalization(column, mean, std):
        """maps the column values to ensure mean = 0, std = 1"""
        dataframe[column] = (dataframe[column] - mean) / std

    def min_max_normalization(column, min_val, max_val):
        """maps the column's values into [0, 1] range"""
        dataframe[column] = (dataframe[column] - min_val) / (max_val - min_val)

    def apply_one_hot_encoding(column, values):
        nonlocal dataframe
        dataframe = one_hot_encoding(dataframe, column, values)

    def preprocess_feature(column):
        if column in normalization_coefficients:
            coeffs = normalization_coefficients[column]

            if "min" in coeffs and "max" in coeffs:
                min_max_normalization(column, coeffs["min"], coeffs["max"])
            elif "mean" in coeffs and "std" in coeffs:
                mean_std_normalization(column, coeffs["mean"], coeffs["std"])
            elif "values" in coeffs:
                apply_one_hot_encoding(column, coeffs["values"])

    for col in dataframe:
        preprocess_feature(col)

    return dataframe


def preprocess_dataframes(normalization_coefficients, *dataframes):
    """Preprocess multiple dataframes using the `preprocess_using_coefficients` function."""
    return (preprocess_using_coefficients(normalization_coefficients, d) for d in dataframes)


def get_column_names_for_signal(normalization_coefficients, signal):
    """
    Returns the names of the columns produced for a given signal.

    For most signals, only one name is returned. Multiple columns are produced only for one-hot-encoded signals
    """
    column_names = []
    column = get_aggregated_field(signal)

    if "values" in normalization_coefficients[column]:
        for value in normalization_coefficients[column]["values"] + ["unknown"]:
            column_names.append(f"{column}_{value}")
    else:
        column_names.append(column)

    return column_names


def get_column_names(normalization_coefficients, signals):
    """
    Takes the list of signal definitions (`TrainingParams.input_signals` or `TrainingParams.target_signals`) and returns
    the names of columns generated by preprocessing.
    """
    column_names = []

    for signal in signals:
        column_names.extend(get_column_names_for_signal(normalization_coefficients, signal))

    return column_names


class WindowGenerator:
    """
    Time series window dataset generator
    (inspired by https://www.tensorflow.org/tutorials/structured_data/time_series#data_windowing)

    For list of records in time::

        [ #, #, #, #, #, #, #, #, #, #, #, #, # ]
         | input_width | offset | target_width |
         |               width                 |
    """

    def __init__(self, dataframe, input_column_names, target_column_names, input_width, target_width, offset=0,
                 interval=None, batch_size=32, shuffle=False):
        """
        Parameters
        ----------
        dataframe : pandas.DataFrame
            Dataframe used to construct the dataset from.
        input_column_names : list[str]
            The names of the input columns. These can be constructed using the `get_column_names` function.
        target_column_names : list[str]
            The names of the target columns. These can be constructed using the `get_column_names` function.
        input_width : int
            The number of time steps used as inputs.
        target_width : int
            The number of time steps used as targets.
        offset : int
            The number of time steps between the inputs and the targets. Defaults to 0.
        interval : int or None
            Optional. Aggregation interval in milliseconds.
        batch_size : int
            Size of the training batch. Defaults to 32.
        shuffle : bool
            Shuffle the dataset. Defaults to ``False``.
        """
        self.input_width = input_width
        self.target_width = target_width
        self.offset = offset

        self.dataframe = dataframe
        self.column_indices = {name: i for i, name in enumerate(dataframe.columns)}
        self.interval = interval  # aggregation interval, used for splitting by missing values

        # features schema
        if not target_column_names:  # target_schema is empty -> same as input_schema
            target_column_names = input_column_names

        self.input_columns = [self.column_indices[name] for name in input_column_names]
        self.target_columns = [self.column_indices[name] for name in target_column_names]

        # window parameters
        self.width = input_width + offset + target_width
        self.input_slice = slice(0, input_width)
        self.target_start = input_width + offset
        self.target_slice = slice(self.target_start, self.target_start + target_width)

        # dataset parameters
        self.batch_size = batch_size
        self.shuffle = shuffle

    def __str__(self):
        return '\n'.join([
            f'Total window width: {self.width}',
            f'Input indices: {np.arange(self.width)[self.input_slice]}',
            f'Target indices: {np.arange(self.width)[self.target_slice]}'])

    def split_window(self, batch):
        """Splits one window into `inputs` and `targets`."""
        inputs = batch[:, self.input_slice, :]  # slice along the time axis
        inputs = tf.gather(inputs, self.input_columns, axis=2)  # select features
        inputs.set_shape([None, self.input_width, None])

        targets = batch[:, self.target_slice, :]  # slice along the time axis
        targets = tf.gather(targets, self.target_columns, axis=2)  # select features
        targets.set_shape([None, self.target_width, None])

        return inputs, targets

    def split_by_interval_discontinuities(self, df):
        """
        Split the dataframe into several dataframes by missing data.
        If there is a missing data point in the data (the two consecutive data
        points have bigger time difference than the desired aggregation interval),
        the dataframe is split. Returns a list of dataframes.
        """
        if self.interval is None:
            return [df]

        index = df.index.to_numpy()
        is_discontinuous = np.concatenate((
            np.array([False]),
            index[1:] - index[:-1] > self.interval
        ))  # difference between timestamps is bigger than it should be
        groups = is_discontinuous.cumsum()
        grouped = df.groupby(groups)
        return [d for _, d in grouped]

    def make_dataset(self, dataframe=None):
        """
        Creates a windowed dataset from a dataframe.

        Parameters
        ----------
        dataframe : pandas.DataFrame
            The dataframe from which to make windows. If equal to `None`, the `self.dataframe` is used. The dataframe must have the same columns as `self.dataframe`.

        Returns
        -------
        dataset : tensorflow.data.Dataset
        """
        if dataframe is None:
            dataframe = self.dataframe
        assert list(dataframe.columns) == list(self.dataframe.columns)
        if dataframe.empty:
            return None

        dataframes = self.split_by_interval_discontinuities(dataframe)
        dataset = None
        for df in dataframes:
            data = np.array(df, dtype=np.float32)
            ds = tf.keras.preprocessing.timeseries_dataset_from_array(
                data=data,
                targets=None,
                sequence_length=self.width,
                sequence_stride=1,
                shuffle=self.shuffle,
                batch_size=self.batch_size, )
            ds = ds.unbatch()
            dataset = ds if dataset is None else dataset.concatenate(ds)

        dataset = dataset.batch(self.batch_size)
        dataset = dataset.map(self.split_window)

        return dataset


def make_datasets(train_df, val_df, test_df, window_generator_params):
    """
    Convert the pd.DataFrame to windowed tf.data.Dataset.

    Parameters
    ----------
    train_df : pandas.DataFrame
    val_df : pandas.DataFrame
    test_df : pandas.DataFrame
    window_generator_params : dict
        Parameters for the constructor of `WindowGenerator`.

    Returns
    -------
    train : tensorflow.data.Dataset
        Training dataset.
    validation : tensorflow.data.Dataset
        Validation dataset.
    test : tensorflow.data.Dataset
        Testing dataset.
    """
    window = WindowGenerator(train_df, **window_generator_params)
    train = window.make_dataset(train_df)
    val = window.make_dataset(val_df)
    test = window.make_dataset(test_df)
    return train, val, test


def get_windowed_dataset(prediction_parameters, dataframe):
    """
    Creates the windowed dataset for one dataframe based on the prediction parameters. This is intended for use during prediction; during training, use the `WindowGenerator`.

    Parameters
    ----------
    prediction_parameters : PredictionParams
        The prediction parameters.
    dataframe : pandas.DataFrame
        The data to use to create the dataset.

    Returns
    -------
    dataset : tensorflow.data.Dataset
    """
    if dataframe.shape[0] < prediction_parameters.input_width:
        raise NotEnoughDataError

    return tf.keras.preprocessing.timeseries_dataset_from_array(
        data=np.array(dataframe, dtype=np.float32),
        targets=None,
        sequence_length=prediction_parameters.input_width,
        sequence_stride=1,
        shuffle=False)
