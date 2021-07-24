from .Params import Params


class RunParams(Params):
    """Base class for TrainingParams and PredictionParams."""

    def __init__(self, copy_from=None):
        super().__init__()
        self.architecture = None  # the architecture of neural network
        self.input_signals = []  # The input signals and their types
        self.target_signals = []  # The target signals and their types, keep empty for autoregressive models
        self.aggregated = False  # Whether the queries should be aggregated
        self.interval = None  # Aggregation interval in milliseconds.
        self.normalization_coefficients = dict()  #: Normalization coefficients for the signals
        self.input_width = 0  # Number of time steps used for prediction.
        self.target_width = 0  # Number of predicted time steps.
        self.index = str()  # the ES index (signal set)
        self.ts_field = str()  # the ts field in the ES index

        if isinstance(copy_from, RunParams):
            self.architecture = copy_from.architecture
            self.input_signals = copy_from.input_signals
            self.target_signals = copy_from.target_signals
            self.aggregated = copy_from.aggregated
            self.interval = copy_from.interval
            self.normalization_coefficients = copy_from.normalization_coefficients
            self.input_width = copy_from.input_width
            self.target_width = copy_from.target_width
            self.index = copy_from.index
            self.ts_field = copy_from.ts_field

    def __str__(self):
        return "RunParams: " + str(self.__dict__)
