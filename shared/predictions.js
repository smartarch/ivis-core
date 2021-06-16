'use strict';

const PredictionTypes = {
    ARIMA: 'arima',
};

const OutputSignalTypes = {
    MAIN: 'main',
    EXTRA: 'extra',
    TS: 'ts'
};

const ArimaModelStates = {
    // Note: this also has to be defined in ARIMA's Python task
    UNKNOWN: 'unknown',
    TRAINING: 'training',
    ACTIVE: 'active',
    DEGRADED: 'degraded',
};

module.exports = {
    PredictionTypes,
    OutputSignalTypes,
    ArimaModelStates,
};
