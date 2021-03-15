#!/usr/bin/env python3

class TrainingParams:
    def __init__(self):
        self.architecture = None    # the architecture of neural network
        self.queries = None         # the Elasticsearch queries to get the desired data
        self.inputSchema = dict()   # IDs of input signals and their types
        self.targetSchema = dict()  # IDs of predicted signals and their types


def run_optimizer(parameters, run_training_callback, finish_training_callback, log_callback):
    """
    Runs the optimizer to try to find the best possible model for the data.

    Parameters
    ----------
    parameters : dict
        The parameters from user parsed from the JSON parameters of the IVIS Job. It should also contain the signal set,
        signals and their types.
    run_training_callback : callable
        Function to run the Training task. Receives the current training parameters and should return the computed
        losses returned by the Training task.
    finish_training_callback : callable
        The only boolean argument passed to this function determines whether the trained model is the best one and
        should be saved to IVIS. This callback needs to pass the request to save the model to the Trainer Wrapper.
    log_callback : callable
        Function to print to Job log.
    """

    # prepare the parameters
    training_params = TrainingParams()
    training_params.architecture = "LSTM"

    for i in range(3):

        # do some magic...

        log_callback(f"Starting iteration {i}.")
        training_result = run_training_callback(training_params)
        log_callback(f"Result: {training_result['test_loss']}.")
        save_model = True
        finish_training_callback(save_model)
