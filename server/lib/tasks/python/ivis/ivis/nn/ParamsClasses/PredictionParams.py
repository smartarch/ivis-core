from .RunParams import RunParams


class PredictionParams(RunParams):
    """Class representing the parameters for `run_prediction` function."""

    def __init__(self, copy_from=None, architecture_params=None):
        """
        Parameters
        ----------
        copy_from : RunParams
        """
        super().__init__(copy_from)

        self.architecture_params = architecture_params or {}  # tuned architecture parameters