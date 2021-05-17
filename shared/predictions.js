'use strict';

const PredictionTypes = {
    ARIMA: 'arima',
    // NAIVE: 'naive',
    NN: 'neural_network',
};

const OutputSignalTypes = {
    MAIN: 'main',
    EXTRA: 'extra',
    TS: 'ts'
};

module.exports = {
    PredictionTypes,
    OutputSignalTypes
};