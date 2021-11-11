"""
Code for training of neural-network-based prediction models.

Prepares the parameters, manages the data loading and preprocessing, runs the hyperparameter tuner and network training, evaluates the model and generates predictions on the test set, saves the model to the IVIS server.
"""
import json
import shutil
import tensorflow as tf
import kerastuner as kt
from uuid import uuid4
from pathlib import Path
from ivis import ivis
from . import preprocessing as pre, architecture
from .load import load_data
from .params_classes import TrainingParams, PredictionParams
from .hyperparameters import Hyperparameters, get_tuned_parameters
from .common import interval_string_to_milliseconds, get_ts_field, get_entities_signals, print_divider, NoDataError, NotEnoughDataError
from .architectures.ModelFactory import ModelFactory
from .preprocessing import get_windowed_dataset
from .postprocessing import postprocess


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
            if signal["min"] is not None:
                signal["min"] = float(signal["min"])
            else:
                del signal["min"]
        if "max" in signal:
            if signal["max"] is not None:
                signal["max"] = float(signal["max"])
            else:
                del signal["max"]

        if not aggregated or signal["data_type"] != "numerical":
            del signal["aggregation"]


def get_els_index(parameters):
    """Returns the Elasticsearch index based on the job `parameters`."""
    sig_set_cid = parameters["signal_set"]
    return ivis.entities["signalSets"][sig_set_cid]["index"]


def get_default_training_parameters(parameters, training_parameters_class=TrainingParams):
    """
    Returns the default training parameters based on the job `parameters`.

    Parameters
    ----------
    parameters : dict
        The job parameters (`ivis.params`).
    training_parameters_class : type[TrainingParams]
        The default is `TrainingParams`.

    Returns
    -------
    training_parameters : TrainingParams
    """
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
    # if we want to tune the batch size: https://github.com/keras-team/keras-tuner/issues/122
    training_parameters.batch_size = parameters["batch_size"]

    training_parameters.architecture = parameters["architecture"]
    training_parameters.split = {"train": 0.7, "val": 0.2, "test": 0.1}

    training_parameters.aggregated = aggregated
    if aggregated:
        aggregation_interval = parameters["aggregation"]
        training_parameters.interval = interval_string_to_milliseconds(aggregation_interval)

    return training_parameters


#########################
# Load and prepare data #
#########################


def load_data_training(training_parameters, time_interval):
    """
    Loads data for training.

    Parameters
    ----------
    training_parameters : TrainingParams
    time_interval : dict
        Time interval to filter the queries. Allowed keys are ``"start"``, ``"start_exclusive"``, ``"end"``.

    Returns
    -------
    dataframe : pandas.DataFrame
        Dataframe of both inputs and targets. Columns are fields, rows are the patterns (indexed by timestamp).
    """
    print("Loading data...")
    data = load_data(training_parameters, time_interval=time_interval, include_targets=True)
    print(f"Loaded dataframe shape: {data.shape}.")
    return data


def prepare_data(training_parameters, dataframe):
    """
    Prepares (preprocesses) the training data and splits it to train, validation and test dataframes.

    Parameters
    ----------
    training_parameters : TrainingParams
    dataframe : pandas.DataFrame

    Returns
    -------
    train_df : pandas.DataFrame
    val_df : pandas.DataFrame
    test_df : pandas.DataFrame
    """
    print("Processing data...")
    train_df, val_df, test_df = pre.split_data(training_parameters, dataframe)

    norm_coeffs = pre.compute_normalization_coefficients(training_parameters, train_df)
    training_parameters.normalization_coefficients = norm_coeffs
    train_df, val_df, test_df = pre.preprocess_dataframes(norm_coeffs, train_df, val_df, test_df)

    return train_df, val_df, test_df


def prepare_datasets(training_parameters, dataframes):
    """
    Generate the windowed datasets from dataframes.

    Parameters
    ----------
    training_parameters : TrainingParams
    dataframes : tuple[pandas.DataFrame]
        Should contain exactly three datasets: train, validation, test.

    Returns
    -------
    train : tensorflow.data.Dataset
    val : tensorflow.data.Dataset
    test : tensorflow.data.Dataset
    """
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
        "batch_size": training_parameters.batch_size,
    }
    train, val, test = pre.make_datasets(train_df, val_df, test_df, window_generator_params)

    print("Datasets generated.")
    return train, val, test


def _infer_interval_from_data(dataframe):
    return int(dataframe.index[-1] - dataframe.index[-2])  # difference between the last two records


######################
# Evaluate the model #
######################


def evaluate(model, test_dataset):
    """Evaluates the `model` on the `test_dataset` and returns the computed loss (MSE)."""
    print("Evaluating model...")
    test_loss = model.evaluate(test_dataset, verbose=0)
    print(f"Test loss: {test_loss}")
    return test_loss


################################
# Save predictions on test set #
################################


def predict_and_save(model, test_dataframe, prediction_parameters, save_data):
    """Makes predictions for the test set and saves them to IVIS"""
    print("Computing predictions on test set...")

    # we can't use the test_dataset here as it also contains the target values, so the last records are not included as inputs there
    dataset = get_windowed_dataset(prediction_parameters, test_dataframe)

    predicted = model.predict(dataset)

    last_ts = test_dataframe.index[prediction_parameters.input_width - 1:]
    predicted_dataframes = postprocess(prediction_parameters, predicted, last_ts)

    print("Saving data...")
    if save_data is not None:
        save_data(prediction_parameters, predicted_dataframes)


##############
# Save model #
##############

TRAINING_LOGS = "training_logs"


def get_working_directory():
    """Returns the unique working directory for the training."""
    training_logs_dir = Path(TRAINING_LOGS)
    while True:
        working_directory = str(uuid4().hex)[:8]
        if not (training_logs_dir / working_directory).exists():
            return working_directory


def save_model(parameters, training_parameters, tuner, working_directory):
    """
    Saves the model to the IVIS server.

    Parameters
    ----------
    parameters : dict
        The job parameters (`ivis.params`).
    training_parameters : TrainingParams
    tuner : kerastuner.Tuner
    working_directory : str
        Working directory. Can be generated using `get_working_directory`.
    """
    save_folder = Path(TRAINING_LOGS) / working_directory

    model = tuner.get_best_models()[0]
    best_hyperparameters = tuner.get_best_hyperparameters()[0]
    tuned_parameters = get_tuned_parameters(parameters, best_hyperparameters)

    # temporarily save to the file system
    print("Saving model...")
    model.save(save_folder / "model.h5")

    # save the prediction parameters
    prediction_parameters = PredictionParams(training_parameters, tuned_parameters["architecture_params"])

    with open(save_folder / "prediction_parameters.json", 'w') as file:
        print(prediction_parameters.to_json(), file=file)

    # upload the files to IVIS server
    print("Uploading to IVIS...")
    with open(save_folder / "model.h5", 'rb') as file:
        ivis.upload_file(file)
    with open(save_folder / "prediction_parameters.json", 'r') as file:
        ivis.upload_file(file)

    print("Model saved.")


def save_training_results(parameters, tuner, test_loss, working_directory):
    """
    Saves the training results to the IVIS server so they can be later displayed to the user.

    Parameters
    ----------
    parameters : dict
        The job parameters (`ivis.params`).
    tuner : kerastuner.Tuner
    test_loss : float
    working_directory : str
        Working directory. Can be generated using `get_working_directory`.
    """
    save_folder = Path(TRAINING_LOGS) / working_directory

    # save the best hyperparameters
    best_hyperparameters = tuner.get_best_hyperparameters()[0]
    tuned_parameters = get_tuned_parameters(parameters, best_hyperparameters)

    # save results from all trials
    trials = tuner.oracle.get_best_trials(int(parameters.get("max_trials", 7)))
    trials_results = []

    for t in trials:
        # save only the tunable parameters (which have "optimizable_type") and all architecture parameters
        trial_optimized_parameters = get_tuned_parameters(parameters, t.hyperparameters, optimized_only=True)
        del trial_optimized_parameters["architecture_params"]
        trial_architecture_parameters = get_tuned_parameters(parameters, t.hyperparameters)["architecture_params"]

        trials_results.append({
            "optimized_parameters": trial_optimized_parameters,
            "architecture_params": trial_architecture_parameters,
            "val_loss": t.score,
        })

    # temporarily save to the file system
    print("Saving training results...")

    training_results = {
        "tuned_parameters": tuned_parameters,
        "test_loss": test_loss,
        "trials": trials_results,
    }

    with open(save_folder / "training_results.json", 'w') as file:
        print(json.dumps(training_results, indent=2), file=file)

    # upload the files to IVIS server
    print("Uploading to IVIS...")
    with open(save_folder / "training_results.json", 'r') as file:
        ivis.upload_file(file)

    print("Training results saved.")


def cleanup(working_directory):
    """Clean up the working directory."""
    print("Cleaning up...", end="")
    folder = Path(TRAINING_LOGS) / working_directory
    shutil.rmtree(folder)
    print("Done.")


##########################
# Run tuner and training #
##########################


def run_training(parameters, model_factory=None, save_data=None):
    """
    Runs the hyperparameter tuner to try to find the best possible model for the data.

    Parameters
    ----------
    parameters : dict
        The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
        signals and their types in the `entities` value.
    save_data : (RunParams, list[pandas.DataFrame]) -> None
        Function to save the predicted data for the test set. The default function does nothing. It is recommended to use the `save_data` function from `ivis.nn`.
    model_factory : ModelFactory
        Factory for creating the NN models.

    Returns
    -------
    tensorflow.keras.Model
        The found model.
    """

    print("Initializing...")
    print(f"Using TensorFlow (version {tf.__version__}).")

    # prepare the parameters
    training_parameters = get_default_training_parameters(parameters)
    time_interval = parameters["time_interval"]

    if model_factory is None:
        model_factory = architecture.get_model_factory(training_parameters)

    print("Parameters:")
    print(f"  Architecture: {training_parameters.architecture}")
    print(f"  Input signals: {len(training_parameters.input_signals)}, Target signals: {len(training_parameters.target_signals)}")
    print(f"  Observations (input_width): {training_parameters.input_width}, Predictions (target_width): {training_parameters.target_width}")
    print(f"  Aggregation interval (ms): {training_parameters.interval}")

    # load the data
    print_divider()
    try:
        data = load_data_training(training_parameters, time_interval)
        dataframes = prepare_data(training_parameters, data)
        train, val, test = prepare_datasets(training_parameters, dataframes)
        print("Data successfully loaded and processed.")
    except NoDataError:
        print("No data in the defined time range, can't continue.")
        raise NoDataError from None
    except NotEnoughDataError:
        print("Not enough data in the dataset to perform the training, can't continue.")
        raise NotEnoughDataError from None

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
    max_trials = int(parameters.get("max_trials", 7))
    executions_per_trial = int(parameters.get("executions_per_trial", 3))
    working_directory = get_working_directory()
    tuner = kt.BayesianOptimization(
        build_model,
        objective="val_loss",
        max_trials=max_trials,
        executions_per_trial=executions_per_trial,
        overwrite=True,
        directory=TRAINING_LOGS,
        project_name=working_directory
    )
    print("Done.")
    print_divider()
    tuner.search_space_summary()

    print_divider()
    print("Starting model search.")
    print(f"  Max trials: {max_trials}, executions per trial: {executions_per_trial}")
    print()

    callbacks = []
    if "early_stopping" in parameters and parameters["early_stopping"]:
        early_stopping_callback = tf.keras.callbacks.EarlyStopping(monitor='val_loss',
                                                                   patience=int(parameters.get("early_stopping_patience", 3)))
        callbacks.append(early_stopping_callback)

    fit_params = {
        "epochs": int(parameters.get("epochs", 50)),
        "callbacks": callbacks
    }

    tuner.search(train, **fit_params, validation_data=val, verbose=2)

    print_divider()
    print("Search finished.\n")
    tuner.results_summary(num_trials=1)

    print_divider()
    print("Best model:\n")
    best_model = tuner.get_best_models()[0]
    best_model.summary()

    print_divider()
    test_loss = evaluate(best_model, test)

    print_divider()
    save_model(parameters, training_parameters, tuner, working_directory)
    save_training_results(parameters, tuner, test_loss, working_directory)

    print_divider()
    predict_and_save(best_model, dataframes[2], training_parameters, save_data)

    if "cleanup" in parameters and parameters["cleanup"]:
        cleanup(working_directory)

    print("All done.")
