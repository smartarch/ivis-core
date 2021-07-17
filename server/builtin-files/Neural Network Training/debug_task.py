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

from ivis.nn import run_optimizer, run_training


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] != "docs":
        with open('example_params.json') as params_file:
            params = json.load(params_file)
    else:
        with open('example_params_docs.json') as params_file:
            params = json.load(params_file)

    run_optimizer(params, run_training)
