#!/usr/bin/env python3
from training import *
from ivis_nn.ParamsClasses.TrainingParams import TrainingParams
import json
import sys

# histogram query is default
# start with argument "docs" to use docs query
if __name__ == "__main__":

    if len(sys.argv) < 2 or sys.argv[1] != "docs":
        with open('example_training_params.json') as params_file:
            params = TrainingParams().from_json(params_file.read())
        with open('histogram.json') as results_file:
            results = json.load(results_file)
        model_save_path = "../prediction/example_histogram/"
    else:
        with open('example_training_params_docs.json') as params_file:
            params = TrainingParams().from_json(params_file.read())
        with open('docs.json') as results_file:
            results = json.load(results_file)
        model_save_path = "../prediction/example_docs/"

    run_training(params, results, model_save_path)
