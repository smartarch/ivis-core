"""
Code for saving the predictions into IVIS signal sets.
"""
from collections import defaultdict
import pandas as pd
from ivis import ivis
from .common import get_aggregated_field
from .ParamsClasses import PredictionParams


def _get_output_signal_cid(signal):
    """Returns the cid for an output signal, taking aggregations into account."""
    if "aggregation" in signal:
        return f'{signal["cid"]}_{signal["aggregation"]}'
    else:
        return signal["cid"]


def _get_sigset_cid(suffix):
    """Returns the cid of an owned signal set with defined suffix."""
    try:
        signal_sets = list(ivis.owned["signalSets"])
        return next(filter(lambda s: s.endswith(suffix), signal_sets))
    except StopIteration:
        raise KeyError(f"Signal set with suffix '{suffix}' not found.") from None


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
        records[agg]["ts"] = row.name  # unix ts (in ms)
        records[agg]["_id"] = str(row.name)[:-3] + "_" + agg  # unix ts (in s)
        yield records[agg]


def _row_to_record(prediction_parameters, row):
    """
    Produce the records for one row of predicted dataframe.

    Parameters
    ----------
    row : pandas.Series
        One row of pandas.DataFrame.
    prediction_parameters : PredictionParams

    Yields
    ------
    dict
        Record(s) for the dataframe row.
    """
    record = {
        "ts": row.name,  # unix ts (in ms)
        "_id": str(row.name)[:-3]  # unix ts (in s)
    }

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
    dataframes : list[pandas.DataFrame]
        Predicted dataframes.
    k : int
        The k-th row of each dataframe is returned, ``1 <= k <= prediction_parameters.target_width``.
    prediction_parameters : PredictionParams

    Yields
    ------
    dict
        Record(s) to be saved.
    """
    assert 1 <= k <= prediction_parameters.target_width
    for sample in dataframes:
        yield from _row_to_record(prediction_parameters, sample.iloc[k - 1])


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
    set_cid = _get_sigset_cid(f"{k}ahead")
    ivis.insert_records(set_cid, records_k_ahead(prediction_parameters, dataframes, k))


def _save_future(prediction_parameters, dataframes):
    set_cid = _get_sigset_cid("future")
    ivis.clear_records(set_cid)
    ivis.insert_records(set_cid, records_future(prediction_parameters, dataframes))


def save_data(prediction_parameters, dataframes):
    """
    Saves the predicted data into the IVIS signal sets.

    Parameters
    ----------
    prediction_parameters : PredictionParams

    dataframes : list[pandas.DataFrame]
        The data to be saved. Each dataframe in the list must have the columns corresponding to the `PredictionParams.target_signals` and rows corresponding to the timestamps of the prediction. There must be `prediction_parameters.target_width` dataframes, on for each 'k ahead' signal set.
    """
    for k in range(1, prediction_parameters.target_width + 1):
        print(f"Saving '{k}ahead' signal set...", end='')
        _save_k_ahead(prediction_parameters, dataframes, k)
        print("Done.")

    print("Saving 'future' signal set...", end='')
    _save_future(prediction_parameters, dataframes)
    print("Done.")
