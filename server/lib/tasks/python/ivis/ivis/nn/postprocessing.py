"""
Postprocessing of the data after generating the predictions.

Converts the predicted tensors into dataframes, performs denormalization, adds timestamps to the data.
"""

import numpy as np
import pandas as pd

from .common import get_aggregated_field
from .preprocessing import get_column_names
from .ParamsClasses import PredictionParams


def get_column_indices(normalization_coefficients, signals):
    """Returns the mapping from the names of the columns for signals and their index."""
    column_names = get_column_names(normalization_coefficients, signals)
    return {c: i for i, c in enumerate(column_names)}


def _postprocess_sample(sample, signals, normalization_coefficients, column_indices):
    """
    Apply postprocessing the to one predicted sample to denormalize the data, etc.

    Parameters
    ----------
    sample : numpy.ndarray
        Shape is [time, signals].
    signals : list[dict]
    normalization_coefficients : dict
    column_indices : dict

    Returns
    -------
    pandas.DataFrame
        The columns correspond to the `PredictionParams.target_signals`, row are time steps of the prediction (without timestamps).
    """

    dataframe = pd.DataFrame()

    def mean_std_denormalization(column, mean, std):
        data = sample[:, column_indices[column]]
        dataframe[column] = data * std + mean

    def min_max_denormalization(column, min_val, max_val):
        data = sample[:, column_indices[column]]
        dataframe[column] = data[column] * (max_val - min_val) + min_val

    def one_hot_decoding(column, values):
        values = values + ["unknown"]
        value_indices = [column_indices[f"{column}_{val}"] for val in values]

        data = []
        for row in sample:
            encoded = row[value_indices]
            most_probable = np.argmax(encoded)
            data.append(values[most_probable])
        dataframe[column] = data

    def postprocess_signal(column):
        coeffs = normalization_coefficients[column]

        if "min" in coeffs and "max" in coeffs:
            return min_max_denormalization(column, coeffs["min"], coeffs["max"])
        elif "mean" in coeffs and "std" in coeffs:
            return mean_std_denormalization(column, coeffs["mean"], coeffs["std"])
        elif "values" in coeffs:
            return one_hot_decoding(column, coeffs["values"])
        raise ValueError(f"Unknown target signal '{column}'.")

    for sig in signals:
        col = get_aggregated_field(sig)
        postprocess_signal(col)

    return dataframe


def _set_sample_ts(sample, start_ts, interval):
    """
    Update the sample's index to correspond to the timestamps of the predictions.

    Parameters
    ----------
    sample : pandas.DataFrame
        Shape is [time, signals]
    start_ts : int
        UNIX timestamp (ms).
    interval : int
        In milliseconds.

    Returns
    -------
    pandas.DataFrame
        The index is altered to correspond to the timestamps of the predictions.
    """
    row_count = sample.shape[0]
    end_ts = start_ts + row_count * interval
    timestamps = pd.RangeIndex(start_ts, end_ts, interval)
    sample.set_index(timestamps, inplace=True)
    return sample


def postprocess(prediction_parameters, data, last_ts):
    """
    Apply postprocessing the to a batch of predictions to denormalize the data, etc.

    Parameters
    ----------
    prediction_parameters : PredictionParams
    data : numpy.ndarray
        The shape of the array is [samples, time, signals].
    last_ts : list[int]
        The UNIX timestamp of the last record in each prediction input window. This is used to compute the timestamp of the prediction as ``last_ts + interval``.

    Returns
    -------
    list[pandas.DataFrame]
        Each dataframe in the list has the columns corresponding to the `PredictionParams.target_signals` and rows corresponding to the timestamps of the prediction.
    """
    signals = prediction_parameters.target_signals
    normalization_coefficients = prediction_parameters.normalization_coefficients
    column_indices = get_column_indices(prediction_parameters.normalization_coefficients, prediction_parameters.target_signals)
    interval = prediction_parameters.interval

    processed = []
    for index, sample in enumerate(data):
        sample = _postprocess_sample(sample, signals, normalization_coefficients, column_indices)
        start_ts = last_ts[index] + interval
        sample = _set_sample_ts(sample, start_ts, interval)
        processed.append(sample)
    return processed
