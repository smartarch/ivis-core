#!/usr/bin/env python3
import json
import sys
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

from ivis.nn.ParamsClasses.PredictionParams import PredictionParams
from ivis.nn import run_prediction
from ivis.nn.save import records_future, records_k_ahead


def save_data(prediction_parameters, dataframes):
    for k in range(prediction_parameters.target_width):
        for r in records_k_ahead(prediction_parameters, dataframes, k):
            print(r)
        print()

    for r in records_future(prediction_parameters, dataframes):
        print(r)
    print()


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] != "docs":
        with open('example_histogram/prediction_parameters.json') as params_file:
            params = PredictionParams().from_json(params_file.read())
        model_path = 'example_histogram/model.h5'
    else:
        with open('example_docs/prediction_parameters.json') as params_file:
            params = PredictionParams().from_json(params_file.read())
        model_path = 'example_docs/model.h5'
    _, predictions = run_prediction(params, model_path)
    print(predictions)
    print()

    save_data(params, predictions)
