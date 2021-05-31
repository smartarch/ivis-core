from .Params import Params


class ModelParams(Params):
    """Base class for TrainingParams and PredictionParams."""

    def __init__(self, copy_from=None):
        super().__init__()
        self.architecture = None  # the architecture of neural network
        self.input_signals = []  # The input signals and their types
        self.target_signals = []  # The target signals and their types, keep empty for autoregressive models
        self.interval = None  # Aggregation interval in milliseconds.
        self.normalization_coefficients = dict()  #: Normalization coefficients for the signals
        self.input_width = 0  # Number of time steps used for prediction.
        self.target_width = 0  # Number of predicted time steps.

        if isinstance(copy_from, ModelParams):
            self.architecture = copy_from.architecture
            self.input_signals = copy_from.input_signals
            self.target_signals = copy_from.target_signals
            self.interval = copy_from.interval
            self.normalization_coefficients = copy_from.normalization_coefficients
            self.input_width = copy_from.input_width
            self.target_width = copy_from.target_width

    def __str__(self):
        return "ModelParams: " + str(self.__dict__)
