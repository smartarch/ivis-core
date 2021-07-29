"""
Code for Neural Network training.
"""
import shutil
import tensorflow as tf
import kerastuner as kt
from uuid import uuid4
from pathlib import Path
from ivis import ivis
from . import load_data_elasticsearch as es, preprocessing as pre, architecture
from .load_data import load_data
from .ParamsClasses import TrainingParams, PredictionParams
from .hyperparameters import Hyperparameters
from .common import interval_string_to_milliseconds, get_ts_field, get_entities_signals, print_divider
from .architectures.ModelFactory import ModelFactory


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

TRAINING_LOGS = "training_logs"


def get_working_directory():
    training_logs_dir = Path(TRAINING_LOGS)
    while True:
        working_directory = str(uuid4().hex)[:8]
        if not (training_logs_dir / working_directory).exists():
            return working_directory


def save_model(model, training_parameters, working_directory):
    save_folder = Path(TRAINING_LOGS) / working_directory

    # temporarily save to the file system
    print("Saving model...")
    model.save(save_folder / "model.h5")

    # save the prediction parameters
    prediction_parameters = PredictionParams(training_parameters)

    with open(save_folder / "prediction_parameters.json", 'w') as file:
        print(prediction_parameters.to_json(), file=file)

    # upload the files to IVIS server
    print("Uploading to IVIS...")
    with open(save_folder / "model.h5", 'rb') as file:
        ivis.upload_file(file)
    with open(save_folder / "prediction_parameters.json", 'r') as file:
        ivis.upload_file(file)

    print("Model saved.")


def cleanup(working_directory):
    print("Cleaning up...", end="")
    folder = Path(TRAINING_LOGS) / working_directory
    shutil.rmtree(folder)
    print("Done.")


##########################
# Run tuner and training #
##########################


def run_training(parameters, model_factory=None):
    """
    Runs the hyperparameter tuner to try to find the best possible model for the data.

    Parameters
    ----------
    parameters : dict
        The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
        signals and their types in the `entities` value.
    model_factory : ModelFactory
        Factory for creating the NN models.
    """

    print("Initializing...")
    print(f"Using TensorFlow (version {tf.__version__}).")

    # prepare the parameters
    training_parameters = get_default_training_parameters(parameters)
    time_interval = parameters["time_interval"]

    training_parameters.architecture = "feedforward"  # TODO (MT)
    training_parameters.split = {"train": 0.7, "val": 0.2, "test": 0.1}

    if model_factory is None:
        model_factory = architecture.get_model_factory(training_parameters)

    # load the data
    print_divider()
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

    def build_model(hp: kt.HyperParameters):
        """Function for creating a model in each iteration of hyperparameter optimization using Keras Tuner"""
        hyperparameters = Hyperparameters(parameters, hp)
        architecture_hyperparameters = Hyperparameters(parameters["architecture_params"], hp)

        model_params_class = model_factory.get_params_class()
        model_params = model_params_class(architecture_hyperparameters, training_parameters)
        model = model_factory.create_model(model_params)

        learning_rate = hyperparameters["learning_rate"]

        model.compile(
            optimizer=architecture.get_optimizer(learning_rate),
            loss=tf.losses.mse
        )

        return model

    print_divider()
    print("Preparing hyperparameters tuner...", end="")
    working_directory = get_working_directory()
    tuner = kt.BayesianOptimization(
        build_model,
        objective="val_loss",
        max_trials=3,  # TODO(MT)
        executions_per_trial=2,  # TODO(MT)
        overwrite=True,
        directory=TRAINING_LOGS,
        project_name=working_directory
    )
    print("Done.")
    print_divider()
    tuner.search_space_summary()

    print_divider()
    print("Starting model search.\n")
    early_stopping_callback = tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=3)  # TODO(MT): patience
    fit_params = {
        "epochs": 50,  # TODO(MT)
        "callbacks": [early_stopping_callback]
    }
    tuner.search(train, **fit_params, validation_data=val, verbose=2)

    print_divider()
    print("Search finished.\n")
    tuner.results_summary(num_trials=1)

    print_divider()
    print("Best model:\n")
    best_model = tuner.get_best_models()[0]
    best_model.summary()
    # TODO(MT) evaluate model on test set

    print_divider()
    save_model(best_model, training_parameters, working_directory)

    if "cleanup" in parameters and parameters["cleanup"]:
        cleanup(working_directory)
