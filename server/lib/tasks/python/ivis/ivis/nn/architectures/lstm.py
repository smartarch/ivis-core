"""
LSTM model.
"""
import tensorflow as tf
from .ModelFactory import ModelFactory, ModelParams


class LSTMParams(ModelParams):

    def __init__(self, hyperparameters, training_parameters):
        super().__init__(hyperparameters, training_parameters)
        self.lstm_layers = hyperparameters["lstm_layers"]


class LSTMFactory(ModelFactory):

    @staticmethod
    def get_params_class():
        return LSTMParams

    @staticmethod
    def create_model(model_params: LSTMParams):
        lstm_layers = model_params.lstm_layers

        inputs = tf.keras.layers.Input(shape=model_params.input_shape)
        layer = inputs

        for units in lstm_layers[:-1]:
            layer = tf.keras.layers.LSTM(units, return_sequences=True)(layer)
        for units in lstm_layers[-1:]:
            layer = tf.keras.layers.LSTM(units, return_sequences=False)(layer)

        outputs = tf.keras.layers.Dense(tf.math.reduce_prod(model_params.target_shape))(layer)
        outputs = tf.keras.layers.Reshape(model_params.target_shape)(outputs)

        return tf.keras.Model(inputs=inputs, outputs=outputs)
