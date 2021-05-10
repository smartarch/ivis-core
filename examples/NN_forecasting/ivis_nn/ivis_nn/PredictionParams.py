class PredictionParams:
    """Class representing the parameters for `run_training` function."""

    def __init__(self, training_params=None, normalization_coefficients=None):
        self.architecture = None            # the architecture of neural network
        self.index = None                   # the Elasticsearch index
        self.input_signals = []             # The input signals and their types
        self.target_signals = []            # The target signals and their types, keep empty for autoregressive models
        self.ts_field = None                # ES field of ts signal
        self.interval = None                # Aggregation interval in milliseconds.
        self.normalization_coeffs = dict()  # Normalization coefficients for the signals

        if training_params is not None:
            self.architecture = training_params['architecture']
            self.index = training_params['index']
            self.input_signals = training_params['input_signals']
            self.target_signals = training_params['target_signals']
            self.ts_field = training_params['ts_field']
            self.interval = training_params['interval']
        if normalization_coefficients is not None:
            self.normalization_coeffs = normalization_coefficients
