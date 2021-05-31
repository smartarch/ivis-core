from .ModelParams import ModelParams


class TrainingParams(ModelParams):
    """Class representing the parameters for `run_training` function."""

    def __init__(self):
        super().__init__(None)

        self.learning_rate = 0.001   # learning rate for the training
        self.split = dict()          # Fractions of the dataset to use as training, validation and test datasets. Should sum up to 1.
