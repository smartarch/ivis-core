#!/usr/bin/env python3
from optimizer import *
import json


def run_training(training_params):
    return {
        "train_loss": 1.22,
        "test_loss": 3.4,
    }


def finish_training(save_model):
    pass


def print_log(message):
    print(message)


if __name__ == "__main__":
    with open('example_params.json') as params_file:
        params = json.load(params_file)
    run_optimizer(params, run_training, finish_training, print_log)
