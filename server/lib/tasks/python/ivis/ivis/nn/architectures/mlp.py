"""
Multilayer Perceptron (MLP) model.
"""
import tensorflow as tf
from .ModelFactory import ModelFactory, ModelParams
from .residual_wrapper import get_targets_to_inputs_mapping, wrap_model_with_residual_connection
from .. import preprocessing as pre


class MLPParams(ModelParams):

    def __init__(self, hyperparameters, training_parameters):
        super().__init__(hyperparameters, training_parameters)
        self.hidden_layers = hyperparameters["hidden_layers"]
        self.residual_connection = hyperparameters["residual_connection"]


class MLPFactory(ModelFactory):

    @staticmethod
    def get_params_class():
        return MLPParams

    @staticmethod
    def create_model(model_params: MLPParams):
        hidden_layers = model_params.hidden_layers

        inputs = tf.keras.layers.Input(shape=model_params.input_shape)
        layer = tf.keras.layers.Flatten()(inputs)

        for size in hidden_layers:
            layer = tf.keras.layers.Dense(size)(layer)
            layer = tf.keras.layers.ReLU()(layer)

        outputs = tf.keras.layers.Dense(tf.math.reduce_prod(model_params.target_shape))(layer)
        outputs = tf.keras.layers.Reshape(model_params.target_shape)(outputs)

        model = tf.keras.Model(inputs=inputs, outputs=outputs)

        if model_params.residual_connection:
            targets_to_inputs_mapping = get_targets_to_inputs_mapping(model_params.input_column_names,
                                                                      model_params.target_column_names)
            model = wrap_model_with_residual_connection(model, targets_to_inputs_mapping)

        return model

    @staticmethod
    def update_loaded_model(model, prediction_parameters):
        if prediction_parameters.architecture_params["residual_connection"]:
            input_column_names = pre.get_column_names(prediction_parameters.normalization_coefficients,
                                                      prediction_parameters.input_signals)
            target_column_names = pre.get_column_names(prediction_parameters.normalization_coefficients,
                                                       prediction_parameters.target_signals)
            targets_to_inputs_mapping = get_targets_to_inputs_mapping(input_column_names, target_column_names)
            return wrap_model_with_residual_connection(model, targets_to_inputs_mapping)
        else:
            return model
