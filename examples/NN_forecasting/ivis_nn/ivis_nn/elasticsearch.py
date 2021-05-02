import numpy as np
import pandas as pd

from .common import *


###########
# Queries #
###########

def get_time_interval_filter(parameters):
    time_interval = parameters['timeInterval']
    time_range = dict()
    if time_interval["start"] != "":
        time_range["gte"] = time_interval["start"]
    if time_interval["end"] != "":
        time_range["lte"] = time_interval["end"]

    cid_to_field, _ = get_signal_helpers(parameters)
    ts_field = cid_to_field(parameters["tsSigCid"])

    return {
        "range": {
            ts_field: time_range
        }
    }


def get_docs_query(parameters):
    """
    Creates a query for ES to return the docs (in their original form).

    Parameters
    ----------
    parameters : dict
        Parameters for query creation. Expected keys:
         - "entities": `ivis.entities`
         - "inputSignals", "targetSignals": `list`s of `dict`s with
            - "cid": signal cid

    Returns
    -------
    dict
        The generated ES query.
    """
    signals = parameters["inputSignals"] + parameters["targetSignals"]
    cid_to_field, sig_to_field = get_signal_helpers(parameters)
    ts_field = cid_to_field(parameters["tsSigCid"])

    return {
        'size': 10000,
        '_source': list(map(sig_to_field, signals)),
        'sort': [{ts_field: 'asc'}],
        'query': get_time_interval_filter(parameters)
    }


def get_histogram_query(parameters):
    """
    Creates a query for ES to return a date histogram aggregation.

    Parameters
    ----------
    parameters : dict
        Parameters for query creation. Expected keys:
         - "entities": `ivis.entities`
         - "inputSignals", "targetSignals": `list`s of `dict`s with
            - "cid": signal cid
            - "data_type": "numerical" or "categorical"
            - "aggregation": aggregation for Elasticsearch ("min", "max", "avg", ...)

    Returns
    -------
    dict
        The generated ES query.
    """
    signals = parameters["inputSignals"] + parameters["targetSignals"]
    cid_to_field, sig_to_field = get_signal_helpers(parameters)
    ts_field = cid_to_field(parameters["tsSigCid"])

    signal_aggs = dict()
    for sig in signals:
        field = sig_to_field(sig)

        if sig["data_type"] == 'categorical':
            signal_aggs[field] = {
                "terms": {
                    "field": field,
                    'size': 1
                }
            }
        else:  # 'numerical'
            signal_aggs[f"{field}_{sig['aggregation']}"] = {
                sig['aggregation']: {
                    "field": field
                }
            }
    # TODO: Is it necessary to add sort? -> possibly for size?

    aggregation_interval = parameters["timeInterval"]["aggregation"]

    return {
        "size": 0,
        "aggs": {
            "aggregated_data": {
                "date_histogram": {
                    "field": ts_field,
                    "interval": aggregation_interval,
                    "min_doc_count": 1
                },
                "aggs": signal_aggs
            }
        },
        "query": get_time_interval_filter(parameters)
    }


###########
# Results #
###########


def _parse_signal_values_from_docs(field, docs, data_type):
    """Returns the values of one signal as np array (vector)"""
    values = []
    for d in docs:
        values.append(d["_source"][field])
    return np.array(values,
                    dtype=np.float32 if data_type == "numerical" else np.str)


def _parse_signal_values_from_sort(docs):
    """Returns the values of the timestamp signal as np array (vector)"""
    values = []
    for d in docs:
        values.append(d["sort"][0])
    return np.array(values)


def _parse_signal_values_from_buckets(field, sig_props, buckets):
    """Returns the values of one signal as np array (vector)"""
    values = []
    for b in buckets:
        if sig_props["data_type"] == 'categorical':
            val = b[field]["buckets"][0]["key"]
        else:
            val = b[field]["value"]

        values.append(val)
    return np.array(values,
                    dtype=np.float32 if sig_props["data_type"] == "numerical" else np.str)


def _parse_signal_values_from_buckets_key(buckets):
    """Returns the values of the timestamp signal as np array (vector)"""
    values = []
    for b in buckets:
        values.append(b["key"])
    return np.array(values)


def _get_hits(data):
    return data["hits"]["hits"]


def _get_buckets(data):
    return data["aggregations"]["aggregated_data"]["buckets"]


def parse_docs(training_parameters, data):
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
    docs = _get_hits(data)
    schema = get_merged_schema(training_parameters)

    dataframe = pd.DataFrame()

    for sig in schema:
        sig_values = _parse_signal_values_from_docs(sig, docs, schema[sig]["data_type"])
        dataframe[sig] = sig_values
    dataframe["ts"] = _parse_signal_values_from_sort(docs)

    dataframe.set_index("ts", inplace=True)
    return dataframe


def parse_histogram(training_parameters, data):
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
    buckets = _get_buckets(data)
    schema = get_merged_schema(training_parameters)

    dataframe = pd.DataFrame()

    for sig in schema:
        sig_values = _parse_signal_values_from_buckets(sig, schema[sig], buckets)
        dataframe[sig] = sig_values
    dataframe["ts"] = _parse_signal_values_from_buckets_key(buckets)

    dataframe.set_index("ts", inplace=True)
    return dataframe


def parse_data(training_parameters, data):
    if training_parameters["query_type"] == "docs":
        return parse_docs(training_parameters, data)
    elif training_parameters["query_type"] == "histogram":
        return parse_histogram(training_parameters, data)
    else:
        raise Exception("Unknown query type")
