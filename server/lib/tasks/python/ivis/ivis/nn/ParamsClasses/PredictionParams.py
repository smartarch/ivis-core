from .ModelParams import ModelParams


class PredictionParams(ModelParams):
    """Class representing the parameters for `run_prediction` function."""

    def __init__(self, copy_from=None):
        """
        Parameters
        ----------
        copy_from : ivis.nn.ModelParams
        """
        super().__init__(copy_from)
        self.index = str()  # the ES index (signal set)
        self.ts_field = str()  # the ts field in the ES index
