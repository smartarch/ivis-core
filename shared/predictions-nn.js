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
            "type": "fieldset",
            "cardinality": "0..n",
            "children": [{
                "id": "units",
                "label": "Neurons",
                "type": "integer",
            }],
        }],
        defaultParams: {
            hidden_layers: [],
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