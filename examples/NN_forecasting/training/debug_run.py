#!/usr/bin/env python3
from training import *
import json
import sys

# histogram query is default
# start with argument "docs" to use docs query
if __name__ == "__main__":

    if len(sys.argv) < 2 or sys.argv[1] != "docs":
        with open('example_training_params.json') as params_file:
            params = json.load(params_file)
        with open('histogram.json') as results_file:
            results = json.load(results_file)
    else:
        with open('example_training_params_docs.json') as params_file:
            params = json.load(params_file)
        with open('docs.json') as results_file:
            results = json.load(results_file)

    run_training(params, results, "./models/")
