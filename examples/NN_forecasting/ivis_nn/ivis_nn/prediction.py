#!/usr/bin/env python3
from ivis import ivis
from ivis_nn import es


def load_data(prediction_parameters):
    """
    Generates the queries, runs them in Elasticsearch and parses the data.

    Parameters
    ----------
    prediction_parameters : dict (PredictionParams)

    Returns
    -------
    pd.DataFrame
    """
    index = prediction_parameters["index"]
    # TODO: handle data for multiple predictions at the same time
    input_width = prediction_parameters["input_width"]
    if prediction_parameters["interval"] is not None:
        aggregation_interval = f"{prediction_parameters['interval']}ms"
        query = es.get_histogram_query(prediction_parameters["input_signals"], prediction_parameters["ts_field"], aggregation_interval, size=input_width)  # TODO: time interval
        results = ivis.elasticsearch.search(index, query)
        return es.parse_histogram(prediction_parameters["input_signals"], results)
    else:
        query = es.get_docs_query(prediction_parameters["input_signals"], prediction_parameters["ts_field"], size=input_width)  # TODO: time interval
        results = ivis.elasticsearch.search(index, query)
        return es.parse_docs(prediction_parameters["input_signals"], results)

