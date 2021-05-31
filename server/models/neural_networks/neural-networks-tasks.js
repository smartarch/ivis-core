'use strict';

const fs = require('fs');
const path = require('path');
const {  TaskType, PythonSubtypes} = require("../../../shared/tasks");

// training
const trainingPath = path.join(__dirname, 'training', 'task.py'); // relative path
const trainingCode = fs.readFileSync(trainingPath, 'utf-8');
const trainingParams = require('./training/params.json');

const trainingTask = {
    name: 'Neural Network Training',
    description: 'TODO', // TODO (MT)
    type: TaskType.PYTHON,
    settings: {
        params: trainingParams,
        code: trainingCode,
        subtype: PythonSubtypes.NEURAL_NETWORK,
    },
};

// prediction
const predictionPath = path.join(__dirname, 'prediction', 'prediction.py'); // relative path
const predictionCode = fs.readFileSync(predictionPath, 'utf-8');
const predictionParams = [];

const predictionTask = {
    name: 'Neural Network Prediction',
    description: 'TODO', // TODO (MT)
    type: TaskType.PYTHON,
    settings: {
        params: predictionParams,
        code: predictionCode,
        subtype: PythonSubtypes.NEURAL_NETWORK,
    },
};


const tasks = [trainingTask, predictionTask];

module.exports = {
    tasks,
}
