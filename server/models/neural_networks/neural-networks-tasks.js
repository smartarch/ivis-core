'use strict';

const config = require('../../lib/config');
const { TaskType, PythonSubtypes, TaskSource } = require("../../../shared/tasks");

// code and params are in the 'builtin-files' folder

const NN_TRAINING_TASK_NAME = 'Neural Network Training';
const NN_TRAINING_TASK_DESCRIPTION = 'System task for training the neural networks prediction models.';
const trainingTask = {
    name: NN_TRAINING_TASK_NAME,
    description: NN_TRAINING_TASK_DESCRIPTION,
    type: TaskType.PYTHON,
    source: TaskSource.SYSTEM,
    settings: {
        subtype: PythonSubtypes.NEURAL_NETWORK,
    },
};

const NN_PREDICTION_TASK_NAME = 'Neural Network Prediction';
const NN_PREDICTION_TASK_DESCRIPTION = 'System task for predicting values using the neural networks prediction models.';
const predictionTask = {
    name: NN_PREDICTION_TASK_NAME,
    description: NN_PREDICTION_TASK_DESCRIPTION,
    type: TaskType.PYTHON,
    source: TaskSource.SYSTEM,
    settings: {
        params: [],
        subtype: PythonSubtypes.NEURAL_NETWORK,
    },
};


let tasks = [];
if (config.predictions && config.predictions.neural_network)
    tasks = [trainingTask, predictionTask];


module.exports = {
    tasks,
    NN_TRAINING_TASK_NAME,
    NN_PREDICTION_TASK_NAME,
}
