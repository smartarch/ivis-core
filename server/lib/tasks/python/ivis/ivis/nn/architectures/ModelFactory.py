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
        return ModelParams

    @staticmethod
    @abstractmethod
    def create_model(model_params):
        """

        Parameters
        ----------
        model_params : ModelParams

        Returns
        -------
        tensorflow.keras.Model
        """
        return

    @staticmethod
    def update_loaded_model(model, prediction_parameters):
        """
        Can be used if the model needs to be altered after loading it from file in the prediction task.

        Parameters
        ----------
        model : tensorflow.keras.Model
        prediction_parameters : PredictionParams

        Returns
        -------
        tensorflow.keras.Model
        """
        return model
