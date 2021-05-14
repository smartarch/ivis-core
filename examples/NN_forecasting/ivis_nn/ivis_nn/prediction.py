#!/usr/bin/env python3
import numpy as np
import tensorflow as tf
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


def get_windowed_dataset(prediction_parameters, dataframe):
    return tf.keras.preprocessing.timeseries_dataset_from_array(
        data=np.array(dataframe, dtype=np.float32),
        targets=None,
        sequence_length=prediction_parameters['input_width'],
        sequence_stride=1,
        shuffle=False)
