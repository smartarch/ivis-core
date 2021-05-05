"""Code for optimizer"""
import ivis_nn
from ivis_nn.common import get_entities_signals, interval_string_to_milliseconds
from ivis_nn import es


def prepare_signal_parameters(parameters):
    """Prepare the automatic values of numerical/categorical data types for all signals in input and target."""
    entities_signals = get_entities_signals(parameters)

    for sig_params in parameters["inputSignals"] + parameters["targetSignals"]:
        signal = entities_signals[sig_params["cid"]]

        if sig_params["data_type"] == "auto":
            if signal["type"] in ["keyword", "boolean"]:
                sig_params["data_type"] = "categorical"
            elif signal["type"] in ["integer", "long", "float", "double"]:
                sig_params["data_type"] = "numerical"
            else:
                raise TypeError("Unsupported signal type: " + signal["type"])
    return parameters


def get_els_index(parameters):
    sig_set_cid = parameters["signalSet"]
    return parameters["entities"]["signalSets"][sig_set_cid]["index"]


def get_schema(signals, parameters, aggregated):
    """Convert the signals from parameters to schema for preprocessing in training."""
    entities_signals = get_entities_signals(parameters)
    schema = dict()
    for sig_params in signals:
        signal = entities_signals[sig_params["cid"]]

        properties = {
            "type": signal["type"],
            "data_type": sig_params["data_type"]
        }

        if "min" in sig_params and sig_params["min"] != "":
            properties["min"] = float(sig_params["min"])
        if "max" in sig_params and sig_params["max"] != "":
            properties["max"] = float(sig_params["max"])

        if aggregated and sig_params["data_type"] == "numerical":
            schema[f'{signal["field"]}_{sig_params["aggregation"]}'] = properties
        else:
            schema[signal["field"]] = properties
    return schema


def default_training_params(parameters, training_params_class=ivis_nn.TrainingParams):
    training_params = training_params_class()
    aggregated = parameters["timeInterval"]["aggregation"] != ""

    training_params.index = get_els_index(parameters)
    training_params.input_schema = get_schema(parameters["inputSignals"], parameters, aggregated)
    training_params.target_schema = get_schema(parameters["targetSignals"], parameters, aggregated)

    if aggregated:
        training_params.query_type = "histogram"
        training_params.query = es.get_histogram_query(parameters)
    else:
        training_params.query_type = "docs"
        training_params.query = es.get_docs_query(parameters)

    training_params.interval = interval_string_to_milliseconds(parameters["timeInterval"]["aggregation"]) if aggregated else None

    return training_params
