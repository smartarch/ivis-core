# Adding new architecture

The current version of the library supports two architectures of neural networks: [Long Short-Term Memory (LSTM)](lstm.py) and [Multilayer Perceptron (MLP)](mlp.py)). General information about the architectures and their hyperparameters is available in the [end-user documentation](https://github.com/smartarch/ivis-core/wiki/Neural-Networks-Architectures). 

**The documentation also contains description of the [input and output format](https://github.com/smartarch/ivis-core/wiki/Neural-Networks-Architectures#the-inputs-and-outputs-of-the-models) of the models and a list of other architectures considered for future implementation, so we recommended reading it before continuing with this tutorial.**

## Hyperparameters

The first step when creating a new architecture is to think about its hyperparameters. These are for example the number of hidden layers, the number of neurons in the hidden layer, and so on. Furthermore, some of the parameters for the training of the network are hyperparameter and can be tuned, such as the learning rate.

To optimize the hyperparameters, we use the [KerasTuner](https://github.com/keras-team/keras-tuner) library with our own abstraction implemented on top of that in [`hyperparameters.py`](../hyperparameters.py). When using our [`run_training`](../README.md#run_training) function, the `Hyperparameters` object is created from the `"architecture_params"` key in the parameters of the job. All the fields of the `"architecture_params"` are accessible from the `Hyperparameters` object using square brackets and the same key, e.g., `hyperparameters["hidden_layers"]`.

Several types of tunable hyperparameters are available. The type is set by setting `"optimizable_type"` to one of the following values:

* `"float"`: then `"min"`, `"max"` are required, `"default"` and `"sampling"` are optional
* `"int"`: then `"min"`, `"max"` are required, `"default"` and `"sampling"` are optional
* `"bool"`: then `"default"` is optional
* `"enum"`: then `"values"` array is required, `"default"` value is optional
* `"list"` then either `"count"` (fixed) or `"min_count"` and `"max_count"` are required. The items specifications are taken from the `"items"` array and should be in the same format. If there are fewer items specifications than count, items specifications are repeated.

Furthermore, if the `"optimizable_type"` key is not present, the value of the object is returned as is. 
See also <https://keras.io/api/keras_tuner/hyperparameters/> for details on `"sampling"`, etc.

For example, the architecture parameters in the parameters of the job can look like this:
```json
{
  "architecture_params": {
    "hidden_layers": {
      "optimizable_type": "list",
      "min_count": 1,
      "max_count": 2,
      "items": [
        {
          "optimizable_type": "int",
          "min": 8,
          "max": 16
        }
      ]
    },
    "residual_connection": true
  }
}
```
That will create a `hyperparameters` object with two keys: `"hidden_layers"` and `"residual_connection"`. The value obtained from `hyperparameters["hidden_layers"]` will be a list of integers (with both the number of items and their value optimized by the tuner). The value of `hyperparameters["residual_connection"]` will always be `True`.  

## ModelParams and ModelFactory

We use the factory pattern for generating the NN models. For each architecture, a factory has to be created which is derived from the `ModelFactory` class. We also provide the `ModelParams` class which can be used as an abstraction of the hyperparameters of the architectures.

The base classes are defined in [`ModelFactory.py`]. We recommended looking into [`lstm.py`](lstm.py) or [`mlp.py`](mlp.py) while reading this section for an example of the implementation.

### ModelParams

The `ModelParams` class is used as a base class for storing the hyperparameters of the architecture in order to make the implementation of the factory easier. The expected usage is to create a derived class specific for each architecture. This class will contain all the necessary hyperparameters to construct the model as its instance variables. The model factory will get an instance of this derived class with the current set of hyperparameters as a parameter when creating a new model.

In the initialization, the `ModelParams` will get the `hyperparameters` object (created from the `"architecture_params"` of the job) and the `training_parameters` object. These can be used to obtain the current values of the hyperparameters and save them to the instance variables. To access the hyperparameters, use the square bracket notation (as if it were a dictionary). Apart from the instance variables created by the user, the `input_shape` and `target_shape` variables are available with the shapes of the input and output tensors of the model.

An example of the implementation can be found in [`mlp.py`](mlp.py) – the `MLPParams` class. We can see that the `super().__init__` is called and then, the `hidden_layers` and `residual_connection` instance variables are created from the hyperparameters.

### ModelFactory

For each architecture, a factory must be defined that creates the models based on the hyperparameters. We provide the abstract base class `ModelFactory` from which the factory should be derived. There are three important methods of the factory, all implemented as static methods of the factory class: `get_params_class`, `create_model`, and `update_loaded_model`.

#### get_params_class

Returns the corresponding architecture parameters class. This method is used to link the `ModelParams` subclass, described in the previous section, with the factory. 

For example, for the MLP, the `get_params_class` method returns `MLPParams`.

#### create_model

This is the method which creates the new TensorFlow model based on the hyperparameters specified through an instance of a `ModelParams` subclass. More precisely, the `model_params` parameter is an instance of the class returned from the `get_params_class` (which should be derived from the `ModelParams`). 

During the tuning process, the tuner provides new values of the hyperparameters, which are then wrapped in the `ModelParams` subclass and passed to this method. The model returned from this method is then compiled and trained, so one should not compile it here.

We again take the implementation of [MLP](mlp.py) as an example. The `create_model` method gets an instance of `MLPParams` and constructs the feedforward neural network. The `model_params.input_shape` (which was defined in tha `ModelParams` base class) is used as the shape of the `Input` layer. Then, based on the list `model_params.hidden_layers` (defined in `MLPParams`), the hidden layers are added. The `model_params.target_shape` is then used to construct the output layer. If residual connection should be added, the `create_model` method uses our `wrap_model_with_residual_connection` function to create a residual connection around the whole model.

#### update_loaded_model

This is an optional method that is used when the model is loaded from the server for generating the predictions. Some information about the model, such as the residual connection in the MLP example, cannot be saved directly into the TensorFlow model and has to be recreated when the model is loaded from the server. This function does precisely that.

The `update_loaded_model` method is called when the model has been loaded from the server with the model and `PredictionParams` as parameters. It can alter the model before the predictions are generated.

The default implementation just returns the model without any changes.

We will continue with describing the [MLP](mlp.py) example implementation. As stated earlier, the residual connection cannot be saved directly into the TensorFlow model. We thus use the `update_loaded_model` method to recreate the residual connection manually.

## Register the factory

In [`architecture.py`](../architecture.py), there is a `get_model_factory` function which is used to select the correct factory based on the architecture specified in the model parameters. This function is used if no factory is passed as a parameter to the `run_training` function (which is the case in our implementation of [Neural Network Training task](/server/builtin-files/Neural%20Network%20Training/code.py)).

To allow automatic use of the factory, it must be added to this function. Otherwise, it can only be used by directly passing it to the `run_training` function.

## Connection with the IVIS server

Up until now, we have only talked about adding the support for the new architecture to the `ivis.nn` library. The usual way new prediction models are created is through the user interface of the IVIS instance. To allow using the new architecture in the user interface, a specification of the hyperparameters must be provided.

This is done in the [predictions-nn.js](/shared/predictions-nn.js) file. The `NeuralNetworkArchitectures` object contains the list of the implemented architectures with their identifiers. In the `NeuralNetworkArchitecturesSpecs`, the specification must be provided. The specification consists of a `label`, `description`, `params` (the hyperparameters of the architecture), and the `defaultParams` (the default values of the hyperparameters).

For `params`, any parameter type defined in [`ParamTypes.js`](/client/src/settings/ParamTypes.js) (the default parameter types available for tasks and templates, their documentation can be found [here](https://github.com/smartarch/ivis-core/wiki/Template-Parameters)) or [`ParamTypesTunable.js`](/client/src/settings/ParamTypesTunable.js) (specific parameters for use with the tuner, see below) can be used.

Again, we recommend looking at the already implemented architectures for reference.

### Tunable parameter types

The value of the tunable hyperparameters is automatically optimized for the best model accuracy by the hyperparameter tuner. For these settings, the user can select whether they want to specify the value directly (*Fixed*) or let the tuner find it (*Tuned*). When *Tuned* option is selected, restrictions (e.g., minimum and maximum for numbers) of the value have to be specified.

We provide the following tunable parameter types:

* `tunable_integer`, `tunable_float` – The numeric types, the minimum and maximum have to be specified by the user. 
* `tunable_boolean`
* `tunable_list` – It is necessary to specify the type of the items in the list using the `child` field. This can again be any parameter specification (normal or tunable). The `itemLabel` field can be used to make the user interface more descriptive, such as calling the items in the list `"layers"`. The user can then set either a fixed number of items or tuned number of items in the list and the properties of the items in the list.

We recommend looking also at the [end-user documentation](https://github.com/smartarch/ivis-core/wiki/Neural-Networks-Add-Model#tunable-settings-and-parameters) of the tunable parameter types for more information. These parameter types are then transformed into the corresponding hyperparameter `"optimizable_type"`s described [earlier](#hyperparameters).

## Summary

When adding a new architecture, one has to

1. think about the hyperparameters,
2. implement the `ModelParams` subclass,
3. implement the `ModelFactory` subclass,
4. register the factory in [`architecture.py`](../architecture.py),
5. (optionally) provide the hyperparameter specification for the user interface. 
