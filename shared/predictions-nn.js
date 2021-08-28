'use strict';
const React = require("react");

const NeuralNetworkArchitectures = {
    FEEDFORWARD: "feedforward",
    TEST: "none", // TODO (MT): remove
}

const NeuralNetworkArchitecturesList = Object.values(NeuralNetworkArchitectures);

const NeuralNetworkArchitecturesSpecs = {
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
    [NeuralNetworkArchitectures.TEST]: {
        label: "TODO",
        description: <div>
            <i>TODO</i><br/>
            Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Integer rutrum, orci vestibulum ullamcorper ultricies, lacus quam ultricies odio, vitae placerat pede sem sit amet enim. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?
        </div>,
        params: [{
            "id": "blocks",
            "label": "Number of blocks",
            "type": "tunable_integer",
        }],
        defaultParams: {
            blocks: 1,
        }
    }
};

module.exports = {
    NeuralNetworkArchitectures,
    NeuralNetworkArchitecturesList,
    NeuralNetworkArchitecturesSpecs,
};