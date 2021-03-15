#!/usr/bin/env python3
from prediction import *


def print_log(message):
    print(message)


if __name__ == "__main__":
    _, predictions = run_prediction({}, [], "../training/models/example_h5.h5", print_log)
    print(predictions)
