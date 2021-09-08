"""
Functions for creating NN models.
"""
import tensorflow as tf
from .ParamsClasses import TrainingParams
from .architectures.ModelFactory import ModelFactory
from .architectures.feedforward import FeedforwardFactory, FeedforwardWithResidualFactory
from .architectures.lstm import LSTMFactory


def get_model_factory(training_parameters):
    """
    Create model factory based on `training_parameters`.

    Parameters
    ----------
    training_parameters : TrainingParams

    Returns
    -------
    ModelFactory
    """
    if training_parameters.architecture == "feedforward":
        return FeedforwardFactory
    elif training_parameters.architecture == "feedforward_residual":
        return FeedforwardWithResidualFactory
    elif training_parameters.architecture == "lstm":
        return LSTMFactory
    else:
        raise ValueError(f"Unknown network architecture: '{training_parameters.architecture}'")


def get_optimizer(learning_rate):
    """
    Get an optimizer (tf.keras.optimizers.Optimizer) for the neural network.

    Parameters
    ----------
    learning_rate

    Returns
    -------
    tf.keras.optimizers.Optimizer
    """
    return tf.keras.optimizers.Adam(learning_rate)
