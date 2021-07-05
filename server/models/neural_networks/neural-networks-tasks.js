'use strict';

const fs = require('fs');
const path = require('path');
const { TaskType, PythonSubtypes, TaskSource } = require("../../../shared/tasks");

// code and params are in the 'builtin-files' folder

const trainingTask = {
    name: 'Neural Network Training',
    description: 'TODO', // TODO (MT)
    type: TaskType.PYTHON,
    source: TaskSource.SYSTEM,
    settings: {
        subtype: PythonSubtypes.NEURAL_NETWORK,
    },
};

const predictionTask = {
    name: 'Neural Network Prediction',
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
}
