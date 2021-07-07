'use strict';

const fs = require('fs');
const path = require('path');
const { TaskType, PythonSubtypes, TaskSource } = require("../../../shared/tasks");

// code and params are in the 'builtin-files' folder

const NN_TRAINING_TASK_NAME = 'Neural Network Training';
const trainingTask = {
    name: NN_TRAINING_TASK_NAME,
    description: 'TODO', // TODO (MT)
    type: TaskType.PYTHON,
    source: TaskSource.SYSTEM,
    settings: {
        subtype: PythonSubtypes.NEURAL_NETWORK,
    },
};

const NN_PREDICTION_TASK_NAME = 'Neural Network Prediction';
const predictionTask = {
    name: NN_PREDICTION_TASK_NAME,
    description: 'TODO', // TODO (MT)
    type: TaskType.PYTHON,
    source: TaskSource.SYSTEM,
    settings: {
        params: [],
        subtype: PythonSubtypes.NEURAL_NETWORK,
    },
};


const tasks = [trainingTask, predictionTask];

module.exports = {
    tasks,
    NN_TRAINING_TASK_NAME,
    NN_PREDICTION_TASK_NAME,
}
