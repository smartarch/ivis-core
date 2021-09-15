#!/usr/bin/env python3
import json
import sys
from ivis import ivis
# mock IVIS
with open('example_entities.json') as entities_file:
    ivis.entities = json.load(entities_file)
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
ivis.upload_file = lambda f: print(f"Mocking upload of '{f.name}'")

from ivis.nn import run_training
from ivis.nn.save_data import records_future, records_k_ahead


def save_data(prediction_parameters, dataframes):
    for k in range(1, prediction_parameters.target_width + 1):
        for r in records_k_ahead(prediction_parameters, dataframes, k):
            print(r)
        print()

    for r in records_future(prediction_parameters, dataframes):
        print(r)
    print()


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] != "docs":
        with open('example_params.json') as params_file:
            params = json.load(params_file)
    else:
        with open('example_params_docs.json') as params_file:
            params = json.load(params_file)

    run_training(params, save_data=save_data)
