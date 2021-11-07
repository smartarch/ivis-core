from .run_params import RunParams


class PredictionParams(RunParams):
    """Class representing the parameters for `run_prediction` function."""

    def __init__(self, copy_from=None, architecture_params=None):
        """
        Parameters
        ----------
        copy_from : RunParams, optional
            If specified, all parameters are copied from the `copy_from` object.
        architecture_params : dict
            The tuned architecture hyperparameters. They might be needed when loading the model from the server.
        """

        super().__init__(copy_from)

        self.architecture_params = architecture_params or {}  #: tuned architecture parameters
