"""
Simple feedforward model.
"""
import tensorflow as tf
from .ModelFactory import ModelFactory, ModelParams
from .residual_wrapper import with_residual_connection


class FeedforwardParams(ModelParams):

    def __init__(self, hyperparameters, training_parameters):
        super().__init__(hyperparameters, training_parameters)
        self.hidden_layers = []


class FeedforwardFactory(ModelFactory):

    @staticmethod
    def get_params_class():
        return FeedforwardParams

    @staticmethod
    def create_model(model_params: FeedforwardParams):
        hidden_layers = model_params.hidden_layers

        inputs = tf.keras.layers.Input(shape=model_params.input_shape)
        layer = tf.keras.layers.Flatten()(inputs)

        for size in hidden_layers:
            layer = tf.keras.layers.Dense(size)(layer)
            layer = tf.keras.layers.ReLU()(layer)

        outputs = tf.keras.layers.Dense(tf.math.reduce_prod(model_params.target_shape))(layer)
        outputs = tf.keras.layers.Reshape(model_params.target_shape)(outputs)

        return tf.keras.Model(inputs=inputs, outputs=outputs)


@with_residual_connection
class FeedforwardWithResidualFactory(FeedforwardFactory):
    pass
