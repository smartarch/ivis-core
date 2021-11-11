#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import tensorflow as tf
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
ivis.state = {"last_window_start": 1620518400000}
ivis.store_state = lambda x: print("Saving state:", x)

from ivis.nn.params_classes import PredictionParams
from ivis.nn import run_prediction, architecture
from ivis.nn.save import records_future, records_k_ahead


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
        with open('example_histogram/prediction_parameters.json') as params_file:
            params = PredictionParams().from_json(params_file.read())
        model_path = Path('example_histogram') / 'model.h5'
        model = tf.keras.models.load_model(model_path)
    else:
        with open('example_docs/prediction_parameters.json') as params_file:
            params = PredictionParams().from_json(params_file.read())
        model_path = Path('example_docs') / 'model.h5'
        model = tf.keras.models.load_model(model_path)

    model_factory = architecture.get_model_factory(params)
    model = model_factory.update_loaded_model(model, params)

    run_prediction(params, model, save_data)
