"""
Code for hyperparameter optimizer.
"""
import os
from uuid import uuid4
from ivis import ivis
from . import elasticsearch as es, preprocessing as pre
from .ParamsClasses import TrainingParams, PredictionParams
from .common import interval_string_to_milliseconds, get_ts_field, get_entities_signals


def prepare_signal_parameters(signals, entities_signals, aggregated):
    """
    Go through the `input_signals` and `target_signals` and preprocess the signal properties for later use. Modifies the `signals` array.
    - Determine the automatic values of numerical/categorical data types for all signals in input and target.
    - Parse float values (min, max, ...).
    - Add field and type from entity information.
    """

    for signal in signals:
        entity = entities_signals[signal["cid"]]

        if signal["data_type"] == "auto":
            if entity["type"] in ["keyword", "boolean"]:
                signal["data_type"] = "categorical"
            elif entity["type"] in ["integer", "long", "float", "double"]:
                signal["data_type"] = "numerical"
            else:
                raise TypeError("Unsupported signal type: " + entity["type"])

        signal["type"] = entity["type"]
        signal["field"] = entity["field"]

        if "min" in signal:
            if signal["min"] != "":
                signal["min"] = float(signal["min"])
            else:
                del signal["min"]
        if "max" in signal:
            if signal["max"] != "":
                signal["max"] = float(signal["max"])
            else:
                del signal["max"]

        if not aggregated or signal["data_type"] != "numerical":
            del signal["aggregation"]


def get_els_index(parameters):
    sig_set_cid = parameters["signal_set"]
    return ivis.entities["signalSets"][sig_set_cid]["index"]


def is_aggregated(parameters):
    return parameters["aggregation"] != ""


def get_default_training_params(parameters, training_params_class=TrainingParams):
    training_params = training_params_class()
    aggregated = is_aggregated(parameters)

    entities_signals = get_entities_signals(parameters)
    prepare_signal_parameters(parameters["input_signals"], entities_signals, aggregated)
    prepare_signal_parameters(parameters["target_signals"], entities_signals, aggregated)

    training_params.index = get_els_index(parameters)
    training_params.input_signals = parameters["input_signals"]
    training_params.target_signals = parameters["target_signals"]
    training_params.input_width = parameters["input_width"]
    training_params.target_width = parameters["target_width"]

    training_params.aggregated = aggregated
    if aggregated:
        aggregation_interval = parameters["aggregation"]
        training_params.interval = interval_string_to_milliseconds(aggregation_interval)

    return training_params


def get_query_and_index(parameters):
    index = get_els_index(parameters)

    aggregated = is_aggregated(parameters)
    signals = parameters["input_signals"] + parameters["target_signals"]
    time_interval = parameters["time_interval"]
    size = parameters["size"] if "size" in parameters else 10000
    ts_field = get_ts_field(parameters)

    if aggregated:
        aggregation_interval = parameters["aggregation"]
        return es.get_histogram_query(signals, ts_field, aggregation_interval, time_interval, size), index
    else:
        return es.get_docs_query(signals, ts_field, time_interval, size), index


def parse_data(parameters, data):
    signals = parameters["input_signals"] + parameters["target_signals"]
    if is_aggregated(parameters):
        return es.parse_histogram(signals, data)
    else:
        return es.parse_docs(signals, data)


def load_data(parameters):
    query, index = get_query_and_index(parameters)
    data = ivis.elasticsearch.search(index=index, body=query)
    return parse_data(parameters, data)


def prepare_data(training_parameters, dataframe):
    train_df, val_df, test_df = pre.split_data(training_parameters, dataframe)

    norm_coeffs = pre.compute_normalization_coefficients(training_parameters, train_df)
    training_parameters.normalization_coefficients = norm_coeffs
    train_df, val_df, test_df = pre.preprocess_dataframes(norm_coeffs, train_df, val_df, test_df)

    return train_df, val_df, test_df


def _infer_interval_from_data(dataframe):
    return dataframe.index[-1] - dataframe.index[-2]  # difference between the last two records


def save_model(parameters, model, training_params, log_callback):
    save_folder = str(uuid4())

    # temporarily save to the file system
    log_callback("Saving model...")
    model.save(save_folder + "/model.h5")

    # save the prediction parameters
    prediction_parameters = PredictionParams(training_params)
    prediction_parameters.index = get_els_index(parameters)
    prediction_parameters.ts_field = get_ts_field(parameters)

    with open(save_folder + "/prediction_parameters.json", 'w') as file:
        print(prediction_parameters.to_json(), file=file)

    # upload the files to IVIS server
    log_callback("Uploading to IVIS...")
    with open(save_folder + "/model.h5", 'rb') as file:
        ivis.upload_file(file)
    with open(save_folder + "/prediction_parameters.json", 'r') as file:
        ivis.upload_file(file)

    # delete the temporary files
    log_callback("Cleaning up...")
    try:
        os.remove(save_folder + "/model.h5")
        os.remove(save_folder + "/prediction_parameters.json")
        os.rmdir(save_folder)
    except OSError as e:
        print("Error while cleaning up temporary files:\n  %s - %s." % (e.filename, e.strerror))
    log_callback("Model saved.")


def run_optimizer(parameters, run_training_callback, log_callback=print):
    """
    Runs the optimizer to try to find the best possible model for the data.

    Parameters
    ----------
    parameters : dict
        The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
        signals and their types in the `entities` value.
    run_training_callback : callable
        Function to run the training. Receives the current training parameters and data (as dataframes) and should
        return the computed losses and the model.
    log_callback : callable
        Function to print to Job log.
    """

    log_callback("Initializing...")

    # prepare the parameters
    training_params = get_default_training_params(parameters)

    training_params.architecture = "feedforward"  # TODO (MT)
    training_params.split = {"train": 0.7, "val": 0, "test": 0.3}

    # load the data
    try:
        log_callback("Loading data...")
        data = load_data(parameters)
        log_callback(f"Loaded {data.shape[0]} records.")
        log_callback("Processing data...")
        dataframes = prepare_data(training_params, data)
        log_callback("Data successfully loaded and processed.")
    except es.NoDataError:
        log_callback("No data in the defined time range, can't continue.")
        raise es.NoDataError from None

    if training_params.interval is None:
        training_params.interval = _infer_interval_from_data(data)

    # print(training_params)

    for i in range(1):

        # do some magic...

        log_callback(f"\nStarting iteration {i}.")
        training_result, model = run_training_callback(training_params, dataframes)
        log_callback(f"Result: {training_result['test_loss']}.")

        # decide whether the new model is better and should be saved
        should_save = True

        if should_save:
            save_model(parameters, model, training_params, log_callback)
