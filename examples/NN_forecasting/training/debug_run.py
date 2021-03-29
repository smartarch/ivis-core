#!/usr/bin/env python3
from training import *
import json

if __name__ == "__main__":
    with open('example_training_params.json') as params_file:
        params = json.load(params_file)
    with open('docs.json') as results_file:
        results = json.load(results_file)
    run_training(params, results, "./models/example_h5.h5")
