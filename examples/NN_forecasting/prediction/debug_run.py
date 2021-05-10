#!/usr/bin/env python3
import json
from ivis import ivis
# mock IVIS
class ESMock:
    def search(self, index, body):
        # print(json.dumps(body, indent=2))
        if "_source" in body:  # docs
            with open('docs.json') as file:
                return json.load(file)
        else:  # histogram
            with open('histogram.json') as file:
                return json.load(file)
ivis.elasticsearch = ESMock()

from prediction import *
import sys


def print_log(message):
    print(message)


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] != "docs":
        with open('example_prediction_params.json') as params_file:
            params = json.load(params_file)
    else:
        with open('example_prediction_params_docs.json') as params_file:
            params = json.load(params_file)
    _, predictions = run_prediction(params, [], "../training/models/example_h5.h5", print_log)
    print(predictions)
