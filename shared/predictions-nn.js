'use strict';
const React = require("react");

const NeuralNetworkArchitectures = {
    LSTM: "lstm",
    FEEDFORWARD: "feedforward",
}

const NeuralNetworkArchitecturesList = Object.values(NeuralNetworkArchitectures);

const NeuralNetworkArchitecturesSpecs = {
    [NeuralNetworkArchitectures.LSTM]: {
        label: "LSTM (Long Short-Term Memory)",
        description: <div>
            The <i>LSTM</i> is one of the most common recurrent neural network architectures. This is currently our recommended architecture for creating the predictions. More details can be found in our <a href={"https://github.com/smartarch/ivis-core/wiki/Neural-Networks-Architectures#long-short-term-memory-lstm"} target={"_blank"}>documentation</a>.
        </div>,
        params: [{
            "id": "lstm_layers",
            "label": "LSTM layers",
            "itemLabel": "Layer",
            "type": "tunable_list",
            "child": {
                "id": "units",
                "label": "Units",
                "type": "tunable_integer",
            },
        }],
        defaultParams: {
            lstm_layers: {
                min_count: 1,
                max_count: 2,
                items: [{
                    min: 32,
                    max: 128,
                    sampling: "linear",
                    default: 32,
                }]
            },
        }
    },
    [NeuralNetworkArchitectures.FEEDFORWARD]: {
        label: "Fully connected (multilayer perceptron)",
        description: <div>
            The <i>multilayer perceptron</i> (also known as fully connected) neural network architecture is a feed-forward architecture which consists of a several layers of neurons. The neurons in successive layers are connected in a fully-connected manner meaning that each neuron in a layers is connected to all the outputs of neurons in the previous layer. There are no connections between the neurons in the same layer, and there are also no connections between layers which are not immediately successive.
        </div>,
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
};

module.exports = {
    NeuralNetworkArchitectures,
    NeuralNetworkArchitecturesList,
    NeuralNetworkArchitecturesSpecs,
};