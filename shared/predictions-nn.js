'use strict';
const React = require("react");
const d3Format = require("d3-format");

const NeuralNetworkArchitectures = {
    LSTM: "lstm",
    MLP: "mlp",
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
    [NeuralNetworkArchitectures.MLP]: {
        label: "Multilayer Perceptron (MLP)",
        description: <div>
            The <i>multilayer perceptron</i> (also known as fully connected) neural network architecture is a feed-forward architecture which consists of a several layers of neurons. The neurons in successive layers are connected in a fully-connected manner meaning that each neuron in a layers is connected to all the outputs of neurons in the previous layer. There are no connections between the neurons in the same layer, and there are also no connections between layers which are not immediately successive. More details can be found in our <a href={"https://github.com/smartarch/ivis-core/wiki/Neural-Networks-Architectures#multilayer-perceptron-mlp"} target={"_blank"}>documentation</a>.
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
        }, {
            "id": "residual_connection",
            "label": "Predict differences",
            "help": "Adds a residual connection around the MLP network.",
            "type": "tunable_boolean",
        }],
        defaultParams: {
            hidden_layers: {
                min_count: 2,
                max_count: 5,
                items: [{
                    min: 8,
                    max: 64,
                    sampling: "linear",
                    default: 16,
                }]
            },
            residual_connection: {
                default: true,
            }
        }
    },
};

const NeuralNetworksCommonParams = [{
    "id": "learning_rate",
    "label": "Learning rate",
    "render": x => d3Format.format(".4r")(x)
}]
// if we want to add more parameters here, consider that they are rendered in both PredictionsCompare.js and Overview.js. In overview, the data are fetched for the trials, so only the optimized_parameters (currently only learning rate) are available. For that reason, we might need to distinguish whether the parameter is optimized or not in order to render it properly in Overview.js.

module.exports = {
    NeuralNetworkArchitectures,
    NeuralNetworkArchitecturesList,
    NeuralNetworkArchitecturesSpecs,
    NeuralNetworksCommonParams,
};