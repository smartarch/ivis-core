class TrainingParams:
    """Class representing the parameters for `run_training` function."""

    def __init__(self):
        self.architecture = None    # the architecture of neural network
        self.query = None           # the Elasticsearch query to get the desired data
        self.query_type = None      # type of the ES query ("docs" | "histogram")
        self.index = None           # the Elasticsearch index
        self.input_schema = dict()   # ES fields of input signals and their types
        self.target_schema = dict()  # ES fields of predicted signals and their types, keep empty for autoregressive models
        self.split = dict()         # Fractions of the dataset to use as training, validation and test datasets. Should sum up to 1.
        # self.ts_field = None         # ES field of ts signal TODO: is this useful?

    def __str__(self):
        return \
            "Training parameters" + "\n" + \
            "Architecture: " + str(self.architecture) + "\n" + \
            "Query: " + "\n" + \
            str(self.query) + "\n" + \
            "Query type: " + str(self.query_type) + \
            "Index: " + str(self.index) + "\n" + \
            "Input schema:" + "\n" + \
            str(self.input_schema) + "\n" + \
            "Target schema:" + "\n" + \
            str(self.target_schema) + \
            "Split:" + "\n" + \
            str(self.split)
