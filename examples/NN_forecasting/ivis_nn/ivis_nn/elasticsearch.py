import numpy as np
import pandas as pd

from .common import *


def _parse_signal_values_from_docs(field, docs):
    """Returns the values of one signal as np array (vector)"""
    values = []
    for d in docs:
        values.append(d["_source"][field])
    return np.array(values)


def _parse_signal_values_from_buckets(field, buckets):
    """Returns the values of one signal as np array (vector)"""
    values = []
    for b in buckets:
        values.append(b[field]["value"])
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
        sig_values = _parse_signal_values_from_docs(sig, docs)
        dataframe[sig] = sig_values

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
        sig_values = _parse_signal_values_from_buckets(sig, buckets)  # TODO: more than just avg aggregation
        dataframe[sig] = sig_values

    return dataframe


def parse_data(training_parameters, data):
    if training_parameters["query_type"] == "docs":
        return parse_docs(training_parameters, data)
    elif training_parameters["query_type"] == "histogram":
        return parse_histogram(training_parameters, data)
    else:
        raise Exception("Unknown query type")