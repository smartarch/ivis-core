from .RunParams import RunParams


class TrainingParams(RunParams):
    """Class representing the parameters needed inside the `run_training` function."""

    def __init__(self):
        super().__init__(None)

        self.split = {}  #: Fractions of the dataset to use as training, validation and test datasets. Should sum up to 1.
        self.batch_size = 32  #: Training batch size.
