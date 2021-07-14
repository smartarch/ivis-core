"""
Code for saving the predictions.
"""
from collections import defaultdict
import pandas as pd
from .common import get_aggregated_field
from ivis import ivis


def _get_output_signal_cid(signal):
    """Returns the cid for an output signal, taking aggregations into account."""
    if "aggregation" in signal:
        return f'{signal["cid"]}_{signal["aggregation"]}'
    else:
        return signal["cid"]


def _row_to_aggregated_records(prediction_parameters, row):
    """For aggregated signals, produce records with original signal cid and values for all the aggregations (each value has to be in a separate record, but they all have the same timestamp)."""
    records = defaultdict(dict)

    for sig in prediction_parameters.target_signals:
        if "aggregation" in sig:
            agg = sig["aggregation"]
            cid = sig["cid"]
            field = get_aggregated_field(sig)
            value = row[field]
            records[agg][cid] = value

    for agg in records:
        records[agg]["ts"] = row.name
        yield records[agg]


def _row_to_record(prediction_parameters, row):
    """
    Produce the records for one row of predicted dataframe.

    Parameters
    ----------
    row : pd.Series
        One row of pd.DataFrame.
    prediction_parameters : ivis.nn.PredictionParams

    Yields
    ------
    dict
        Record(s) for the dataframe row.
    """
    record = dict()
    record["ts"] = row.name  # TODO(MT): do we need to convert the UNIX timestamp to ISO?

    for sig in prediction_parameters.target_signals:
        cid = _get_output_signal_cid(sig)
        field = get_aggregated_field(sig)
        value = row[field]
        record[cid] = value

    yield record
    yield from _row_to_aggregated_records(prediction_parameters, row)


def records_k_ahead(prediction_parameters, dataframes, k):
    """
    Get records for the 'k ahead' signal set.

    Parameters
    ----------
    dataframes : list[pd.DataFrame]
        Predicted dataframes.
    k : int
        The (k - 1)th row of each dataframe is returned.
    prediction_parameters : ivis.nn.PredictionParams

    Yields
    ------
    dict
        Record(s) to be saved.
    """
    for sample in dataframes:
        yield from _row_to_record(prediction_parameters, sample.iloc[k])


def records_future(prediction_parameters, dataframes):
    """
    Get records for the 'future' signal set.

    Parameters
    ----------
    dataframes : list[pd.DataFrame]
        Predicted dataframes.
    prediction_parameters : ivis.nn.PredictionParams

    Yields
    ------
    dict
        Record(s) to be saved.
    """
    last_sample = dataframes[-1]
    for row_idx in range(last_sample.shape[0]):
        yield from _row_to_record(prediction_parameters, last_sample.iloc[row_idx])


def _save_k_ahead(prediction_parameters, dataframes, k):
    set_cid = None  # TODO (MT)
    ivis.insert_records(set_cid, records_k_ahead(prediction_parameters, dataframes, k))


def _save_future(prediction_parameters, dataframes):
    set_cid = None  # TODO (MT)
    ivis.clear_records(set_cid)
    ivis.insert_records(set_cid, records_future(prediction_parameters, dataframes))


def save_data(prediction_parameters, dataframes):
    for k in range(prediction_parameters.target_width):
        _save_k_ahead(prediction_parameters, dataframes, k)
    _save_future(prediction_parameters, dataframes)
