"""
Code for loading data.
"""
import pandas as pd
from ivis import ivis

from . import load_data_elasticsearch as es
from .ParamsClasses import ModelParams


def get_query_and_index(model_parameters, time_interval, include_targets, single):
    index = model_parameters.index
    size = model_parameters.input_width if single else 10000
    signals = model_parameters.input_signals
    if include_targets:
        signals += model_parameters.target_signals

    if model_parameters.aggregated:
        return _get_query_aggregated(model_parameters, signals, time_interval, size), index
    else:
        return _get_query_original(model_parameters, signals, time_interval, size), index


def _get_query_aggregated(model_parameters, signals, time_interval, size):
    aggregation_interval = f"{model_parameters.interval}ms"
    query = es.get_histogram_query(signals, model_parameters.ts_field,
                                   aggregation_interval, time_interval=time_interval, size=size)
    return query


def _get_query_original(model_parameters, signals, time_interval, size):
    query = es.get_docs_query(signals, model_parameters.ts_field,
                              time_interval=time_interval, size=size)
    return query


def parse_data(model_parameters, data, include_targets=False):
    signals = model_parameters.input_signals
    if include_targets:
        signals += model_parameters.target_signals

    if model_parameters.aggregated:
        return es.parse_histogram(signals, data)
    else:
        return es.parse_docs(signals, data)


def load_data(model_parameters, time_interval=None, include_targets=False, single=False):
    """
    Loads the data.

    Parameters
    ----------
    model_parameters : ModelParams
    time_interval : dict
        Time interval to filter the queries. Allowed keys are "start", "start_exclusive", "end".
    include_targets : bool
        If true, load both input and target signals; if false, load only the input signals.
    single : bool
        Load data for a single prediction (`model_parameters.input_width` records)

    Returns
    -------
    pd.DataFrame
    """
    if time_interval is None:
        time_interval = dict()

    query, index = get_query_and_index(model_parameters, time_interval, include_targets, single)
    data = ivis.elasticsearch.search(index=index, body=query)
    return parse_data(model_parameters, data, include_targets)
