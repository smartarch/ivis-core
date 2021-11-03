from abc import ABC, abstractmethod
from .. import preprocessing as pre
from ..hyperparameters import Hyperparameters
from ..ParamsClasses import TrainingParams, PredictionParams


class ModelParams(ABC):
    """Base class for model parameters."""

    @abstractmethod
    def __init__(self, hyperparameters, training_parameters):
        """

        Parameters
        ----------
        hyperparameters : Hyperparameters
        training_parameters : TrainingParams
        """

        # compute the input and target shapes
        self.input_column_names = pre.get_column_names(training_parameters.normalization_coefficients,
                                                       training_parameters.input_signals)
        self.target_column_names = pre.get_column_names(training_parameters.normalization_coefficients,
                                                        training_parameters.target_signals)
        self.input_shape = (training_parameters.input_width, len(self.input_column_names))
        self.target_shape = (training_parameters.target_width, len(self.target_column_names))


class ModelFactory(ABC):
    """Base class for creating neural network models."""

    @staticmethod
    @abstractmethod
    def get_params_class():
        """
        Returns the corresponding architecture parameters class.

        Returns
        -------
        type
            The corresponding model parameters class, i.e. a class derived from ModelParams. Note that this should return the class itself, not an instance of it.
        """
        return ModelParams

    @staticmethod
    @abstractmethod
    def create_model(model_params):
        """
        Construct a new TensorFlow model based on the model parameters.

        Parameters
        ----------
        model_params : ModelParams
            An instance of the model parameters (i.e. instance of the class derived from ModelParams which was returned by the `get_params_class` method) with the current set of hyperparameters.

        Returns
        -------
        tensorflow.keras.Model
            A new TensorFlow model based on the model hyperparameters. It should not be compiled yet.
        """
        return

    @staticmethod
    def update_loaded_model(model, prediction_parameters):
        """
        Can be used if the model needs to be altered after loading it from file in the prediction task.

        Parameters
        ----------
        model : tensorflow.keras.Model
            The model loaded from the server.
        prediction_parameters : PredictionParams
            The prediction parameters.

        Returns
        -------
        tensorflow.keras.Model
            Updated model.
        """
        return model
