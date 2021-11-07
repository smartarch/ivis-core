"""
Function for selecting the NN architecture from known architectures.
"""
import tensorflow as tf
from .params_classes import TrainingParams
from .architectures.ModelFactory import ModelFactory
from .architectures.mlp import MLPFactory
from .architectures.lstm import LSTMFactory


def get_model_factory(training_parameters):
    """
    Create model factory based on `training_parameters`.

    Parameters
    ----------
    training_parameters : TrainingParams
        Training parameters.

    Returns
    -------
    model_factory : ModelFactory
    """
    if training_parameters.architecture == "mlp":
        return MLPFactory
    elif training_parameters.architecture == "lstm":
        return LSTMFactory
    else:
        raise ValueError(f"Unknown network architecture: '{training_parameters.architecture}'")


def get_optimizer(learning_rate):
    """
    Get an optimizer (``tf.keras.optimizers.Optimizer``) for the neural network.

    Parameters
    ----------
    learning_rate
        The learning rate for the optimizer.

    Returns
    -------
    optimizer : tensorflow.keras.optimizers.Optimizer
    """
    return tf.keras.optimizers.Adam(learning_rate)
