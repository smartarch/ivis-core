"""
Code for loading data.
"""
from ivis import ivis

from . import load_elasticsearch as es
from .params_classes import RunParams


def _get_query_and_index(run_parameters, time_interval, include_targets, size):
    """Get both the query and the ES index."""
    index = run_parameters.index
    if size is None:
        size = 10000
    signals = run_parameters.input_signals
    if include_targets:
        signals = signals + run_parameters.target_signals

    if run_parameters.aggregated:
        return _get_query_aggregated(run_parameters, signals, time_interval, size), index
    else:
        return _get_query_original(run_parameters, signals, time_interval, size), index


def _get_query_aggregated(run_parameters, signals, time_interval, size):
    """Get the query for aggregated data."""
    aggregation_interval = f"{run_parameters.interval}ms"
    return es.get_histogram_query(
        signals,
        run_parameters.ts_field,
        aggregation_interval,
        time_interval=time_interval,
        size=size,
    )


def _get_query_original(run_parameters, signals, time_interval, size):
    """Get the query for not aggregated data."""
    return es.get_docs_query(signals, run_parameters.ts_field,
                             time_interval=time_interval, size=size)


def _parse_data(run_parameters, data, include_targets=False):
    signals = run_parameters.input_signals
    if include_targets:
        signals = signals + run_parameters.target_signals

    if run_parameters.aggregated:
        return es.parse_histogram(signals, data)
    else:
        return es.parse_docs(signals, data)


def load_data(run_parameters, time_interval=None, include_targets=False, size=None):
    """
    Loads the data.

    Parameters
    ----------
    run_parameters : RunParams
    time_interval : dict
        Time interval to filter the queries. Allowed keys are ``"start"``, ``"start_exclusive"``, ``"end"``.
    include_targets : bool
        If ``True``, load both input and target signals; if ``False``, load only the input signals.
    size : int
        The number of records to load. Defaults to 10000.

    Returns
    -------
    data : pandas.DataFrame
        Dataframe of both inputs and targets. Columns are fields, rows are the patterns (indexed by timestamp).
    """
    if time_interval is None:
        time_interval = {}

    query, index = _get_query_and_index(run_parameters, time_interval, include_targets, size)
    data = ivis.elasticsearch.search(index=index, body=query)
    return _parse_data(run_parameters, data, include_targets)
