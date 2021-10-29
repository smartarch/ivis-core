# IVIS core time series forecasting using neural networks

Sublibrary of the library for tasks in IVIS project to support time series forecasting using neural networks.

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

#### TODO: RunParams

#### TODO: ModelFactory



## File structure



## Adding a new NN model architecture

