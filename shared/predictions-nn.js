'use strict';

const NeuralNetworkArchitectures = {
    FEEDFORWARD: "feedforward",
    TEST: "none", // TODO (MT): remove
}

const NeuralNetworkArchitecturesList = Object.values(NeuralNetworkArchitectures);

const NeuralNetworkArchitecturesSpecs = {
    [NeuralNetworkArchitectures.FEEDFORWARD]: {
        label: "Feedforward",
        params: [{
            "id": "hidden_layers",
            "label": "Hidden layers",
            "itemLabel": "Layer",
            "type": "tunable_list",
            "child": {
                "id": "units",
                "label": "Neurons",
                "type": "tunable_integer",
            },
        }],
        defaultParams: {
            hidden_layers: {
                min_count: 1,
                max_count: 2,
                items: [{
                    min: 8,
                    max: 16,
                    sampling: "linear",
                    default: 8,
                }, 8]
            },
        }
    },
    [NeuralNetworkArchitectures.TEST]: {
        label: "Test",
        params: [{
            "id": "test_field",
            "label": "Test field",
            "type": "fieldset",
            "cardinality": "0..n",
            "children": [{
                "id": "units",
                "label": "Test string",
                "type": "string",
            }],
        },{
            "id": "second_test",
            "label": "Second test",
            "type": "string",
        }],
    }
};

module.exports = {
    NeuralNetworkArchitectures,
    NeuralNetworkArchitecturesList,
    NeuralNetworkArchitecturesSpecs,
};