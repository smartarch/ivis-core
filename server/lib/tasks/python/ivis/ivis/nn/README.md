# IVIS core time series forecasting using neural networks

Module of the library for tasks in IVIS project to support time series forecasting using neural networks.

The rest of this file assumes that the reader is familiar with [Tasks and Jobs concepts](https://github.com/smartarch/ivis-core/wiki/Tasks-and-Jobs) in IVIS.

## Install

See [Readme.md](../../README.md) in root directory of the `ivis` package.

## Usage

The functionality of this library is accessible from tasks in IVIS by importing the `ivis.nn` package. The `run_training`, `load_model`, `run_prediction` and `save_data` functions are available.

For an example of usage of the functions, see the implementation of the tasks for supporting neural networks predictions (the end-user documentation for the neural networks predictions is available on the [wiki](https://github.com/smartarch/ivis-core/wiki/Neural-Networks)):

* [Training task](/server/builtin-files/Neural%20Network%20Training/code.py)
* [Prediction task](/server/builtin-files/Neural%20Network%20Prediction/code.py)

### The training and predictions tasks

The library is designed primarily for use in the training and prediction tasks for the neural-networks-based predictions. 

It is expected that the training job is run once when the new prediction is created. The training job saves the trained model and the additional data needed for generating predictions (`PredictionParams`) as files on the IVIS server. This is done in the `run_training` function.

The training job is run every time new predictions are requested. By default, this is done every time new data arrive to the original signal set. The training job downloads the model from the IVIS server (using the `load_model` function) and then generates the predictions and saves them (using the `run_prediction` and `save_data` functions).

### `run_training`

Runs the hyperparameter tuner to try to find the best possible model for the data.

#### Parameters

* parameters : `dict`
  * The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
    signals and their types in the `entities` value.
* save_data : `(RunParams, List[pandas.DataFrame]) -> None`
  * Function to save the predicted data for the test set.
  * The `ivis.nn.save_data` function can be passed in.
* model_factory : `ModelFactory`
  * Factory for creating the NN models.

#### Returns

* `tensorflow.keras.Model`
  * The found model.

### `load_model`

Loads the model from the IVIS server.

The model is loaded based on the training job id (`ivis.params["training_job"]`) and its file name (`ivis.params["model_file"]`). The prediction parameters file (with name `ivis.params["prediction_parameters_file"]`) is also downloaded from the same job.

#### Parameters

* model_factory : `ModelFactory`
  * The factory which was used to create the model. It's `update_loaded_model` method is applied to the file loaded from the IVIS server. If no model factory is supplied, it is selected based on the `PredictionParams.architecture`.

#### Returns

* parameters : `PredictionParams`
  * Additional parameters needed for generating the predictions.
* model : `tensorflow.keras.Model`
  * The loaded model.

### `run_prediction`

Predicts future values using the given model and new data.

#### Parameters

* prediction_parameters : `PredictionParams`
  * The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set, signals and their types.
* model : `tensorflow.keras.Model`
  * The model to use for predictions.
* save_data : `(RunParams, list[pandas.DataFrame]) -> None`
  * Function to save the data.
  * The `ivis.nn.save_data` function can be passed in.

### `save_data`

Saves the predicted data into the IVIS signal sets.

#### Parameters

* prediction_parameters : `PredictionParams`
  * Additional parameters used for generating the predictions.
* dataframes : `list[pandas.DataFrame]`
  * The data to be saved. Each dataframe in the list must have the columns corresponding to the `PredictionParams.target_signals` and rows corresponding to the timestamps of the prediction. There must be `prediction_parameters.target_width` dataframes, on for each 'k ahead' signal set.
  
### Classes

#### RunParams – TrainingParams, PredictionParams

For holding the extra parameters needed for training the network and generating predictions (such as the list of signals, network architecture, hyperparameters, etc.), we created the `TrainingParams` and `PredictionParams` with common base class `RunParams`.

The parameters (instance variables of the class) are described in the class definitions in [`RunParams.py`](params_classes/run_params.py), [`TrainingParams.py`](params_classes/training_params.py) and [`PredictionParams.py`](params_classes/prediction_params.py).

#### ModelFactory

The [`ModelFactory`](architectures/ModelFactory.py) is an abstract class which serves as a base class for creating neural networks. It is described in more detail in tutorial on [adding new architectures](architectures/AddingArchitecture.md).

## File structure

The project is structured into following files:

* [`training.py`](training.py)
  * Code for training of neural-network-based prediction models. Prepares the parameters, manages the data loading and preprocessing, runs the hyperparameter tuner and network training, evaluates the model and generates predictions on the test set, saves the model to the IVIS server.
* [`prediction.py`](prediction.py)
  * Code for using the trained models to generate prediction. Manages the data loading and preprocessing, loads the model from IVIS server, generates the prediction and saves them to the signal sets on server.
* [`common.py`](common.py)
  * Common function for the whole `nn` submodule.
* [`load.py`](load.py)
  * Code for loading data from server.
* [`load_elasticsearch.py`](load_elasticsearch.py)
  * Elasticsearch queries generation and results parsing.
* [`preprocessing.py`](preprocessing.py)
  * Preprocessing of the data before training and prediction. Includes data normalization and generating the windowed datasets.
* [`hyperparameter.py`](hyperparameters.py)
  * Wrapper for KerasTuner to obtain the training and architecture hyperparameters.
* [`architecture.py`](architecture.py)
  * Function for selecting the NN architecture from known architectures.
* [`architectures` folder](architectures)
  * Contains the ModelFactory abstract class and its implementations for supported architectures ([LSTM](architectures/lstm.py), [MLP](architectures/mlp.py)).
  * [`ModelFactory.py`](architectures/ModelFactory.py)
    * Abstract class for factories for creating the NN models based on the hyperparameters. See TODO for details.
  * [`residual_wrapper.py`](architectures/residual_wrapper.py)
    * Functions to alter the model to add a residual connection around the whole model (used by the MLP architecture).
* [`postprocessing.py`](postprocessing.py)
  * Postprocessing of the data after generating the predictions. Converts the predicted tensors into dataframes, performs denormalization, adds timestamps to the data.
* [`save.py`](save.py)
  * Code for saving the predictions into IVIS signal sets.
* [`params_classes` folder](params_classes)
  * Implementations of [`RunParams`](params_classes/run_params.py), [`TrainingParams`](params_classes/training_params.py) and [`PredictionParams`](params_classes/prediction_params.py) (see [RunParams – TrainingParams, PredictionParams](#RunParams-–-TrainingParams,-PredictionParams)).


## Adding a new NN model architecture

See [AddingArchitecture.md](architectures/AddingArchitecture.md).
