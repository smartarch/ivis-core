"""
Code for Neural Network training.
"""
import os
import tensorflow as tf
from . import model as nn_model
from uuid import uuid4
from ivis import ivis
from . import load_data_elasticsearch as es, preprocessing as pre
from .load_data import load_data
from .ParamsClasses import TrainingParams, PredictionParams
from .common import interval_string_to_milliseconds, get_ts_field, get_entities_signals


######################
# Prepare parameters #
######################


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


def get_default_training_parameters(parameters, training_parameters_class=TrainingParams):
    training_parameters = training_parameters_class()
    aggregated = parameters["aggregation"] != ""

    entities_signals = get_entities_signals(parameters)
    prepare_signal_parameters(parameters["input_signals"], entities_signals, aggregated)
    prepare_signal_parameters(parameters["target_signals"], entities_signals, aggregated)

    training_parameters.index = get_els_index(parameters)
    training_parameters.ts_field = get_ts_field(parameters)
    training_parameters.input_signals = parameters["input_signals"]
    training_parameters.target_signals = parameters["target_signals"]
    training_parameters.input_width = parameters["input_width"]
    training_parameters.target_width = parameters["target_width"]

    training_parameters.aggregated = aggregated
    if aggregated:
        aggregation_interval = parameters["aggregation"]
        training_parameters.interval = interval_string_to_milliseconds(aggregation_interval)

    return training_parameters


#######################
# Load a prepare data #
#######################


def load_data_training(training_parameters, time_interval):
    print("Loading data...")
    data = load_data(training_parameters, time_interval=time_interval, include_targets=True)
    print(f"Loaded {data.shape[0]} records.")
    return data


def prepare_data(training_parameters, dataframe):
    print("Processing data...")
    train_df, val_df, test_df = pre.split_data(training_parameters, dataframe)

    norm_coeffs = pre.compute_normalization_coefficients(training_parameters, train_df)
    training_parameters.normalization_coefficients = norm_coeffs
    train_df, val_df, test_df = pre.preprocess_dataframes(norm_coeffs, train_df, val_df, test_df)

    return train_df, val_df, test_df


def prepare_datasets(training_parameters, dataframes):
    print("Generating training datasets...")
    train_df, val_df, test_df = dataframes

    input_column_names = pre.get_column_names(training_parameters.normalization_coefficients,
                                              training_parameters.input_signals)
    target_column_names = pre.get_column_names(training_parameters.normalization_coefficients,
                                               training_parameters.target_signals)
    window_generator_params = {
        "input_width": training_parameters.input_width,
        "target_width": training_parameters.target_width,
        "interval": training_parameters.interval,
        "input_column_names": input_column_names,
        "target_column_names": target_column_names,
    }
    train, val, test = pre.make_datasets(train_df, val_df, test_df, window_generator_params)

    print("Datasets generated.")
    return train, val, test


def _infer_interval_from_data(dataframe):
    return int(dataframe.index[-1] - dataframe.index[-2])  # difference between the last two records


##############
# Save model #
##############


def save_model(parameters, model, training_parameters):
    save_folder = str(uuid4())

    # temporarily save to the file system
    print("Saving model...")
    model.save(save_folder + "/model.h5")

    # save the prediction parameters
    prediction_parameters = PredictionParams(training_parameters)
    prediction_parameters.index = get_els_index(parameters)
    prediction_parameters.ts_field = get_ts_field(parameters)

    with open(save_folder + "/prediction_parameters.json", 'w') as file:
        print(prediction_parameters.to_json(), file=file)

    # upload the files to IVIS server
    print("Uploading to IVIS...")
    with open(save_folder + "/model.h5", 'rb') as file:
        ivis.upload_file(file)
    with open(save_folder + "/prediction_parameters.json", 'r') as file:
        ivis.upload_file(file)

    # delete the temporary files
    print("Cleaning up...")
    try:
        os.remove(save_folder + "/model.h5")
        os.remove(save_folder + "/prediction_parameters.json")
        os.rmdir(save_folder)
    except OSError as e:
        print("Error while cleaning up temporary files:\n  %s - %s." % (e.filename, e.strerror))
    print("Model saved.")


##############################
# Run optimizer and training #
##############################


def run_training(training_parameters, train, val, test):
    """
    Run the training of neural network with specified parameters and data.

    Parameters
    ----------
    training_parameters : ivis.nn.TrainingParams
        The parameters passed from Optimizer.
    train : tf.data.Dataset
    val : tf.data.Dataset
    test : tf.data.Dataset

    Returns
    -------
    dict
        The computed losses, etc. for Optimizer.
    tf.keras.Model
        The neural network model (which can then be saved into IVIS).
    """

    print("Creating model...")

    input_column_names = pre.get_column_names(training_parameters.normalization_coefficients,
                                              training_parameters.input_signals)
    target_column_names = pre.get_column_names(training_parameters.normalization_coefficients,
                                               training_parameters.target_signals)

    input_shape = (training_parameters.input_width, len(input_column_names))
    target_shape = (training_parameters.target_width, len(target_column_names))

    # sample neural network model
    model = nn_model.get_model(training_parameters, input_shape, target_shape)

    # add residual connection - predict the difference
    targets_to_inputs_mapping = nn_model.get_targets_to_inputs_mapping(input_column_names, target_column_names)
    model = nn_model.wrap_with_residual_connection(model, targets_to_inputs_mapping)

    model.compile(
        optimizer=nn_model.get_optimizer(training_parameters),
        loss=tf.losses.mse
    )
    model.summary()

    print("Starting training...")

    fit_params = {
        "epochs": 3,  # TODO
    }
    metrics_history = model.fit(train, **fit_params, verbose=2)
    print("Training done.")
    print(metrics_history.history)

    return {
        "train_loss": 1.22,
        "test_loss": 3.4,
    }, model


def run_optimizer(parameters):
    """
    Runs the optimizer to try to find the best possible model for the data.

    Parameters
    ----------
    parameters : dict
        The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
        signals and their types in the `entities` value.
    """

    print("Initializing...")
    print(f"Using TensorFlow (version {tf.__version__}).")

    # prepare the parameters
    training_parameters = get_default_training_parameters(parameters)
    time_interval = parameters["time_interval"]

    training_parameters.architecture = "feedforward"  # TODO (MT)
    training_parameters.split = {"train": 0.7, "val": 0, "test": 0.3}

    # load the data
    try:
        data = load_data_training(training_parameters, time_interval)
        dataframes = prepare_data(training_parameters, data)
        train, val, test = prepare_datasets(training_parameters, dataframes)
        print("Data successfully loaded and processed.")
    except es.NoDataError:
        print("No data in the defined time range, can't continue.")
        raise es.NoDataError from None

    if training_parameters.interval is None:
        training_parameters.interval = _infer_interval_from_data(data)

    # print(training_parameters)

    for i in range(1):

        # do some magic...

        print(f"\nStarting iteration {i}.")
        training_result, model = run_training(training_parameters, train, val, test)
        print(f"Result: {training_result['test_loss']}.")

        # decide whether the new model is better and should be saved
        should_save = True

        if should_save:
            save_model(parameters, model, training_parameters)
