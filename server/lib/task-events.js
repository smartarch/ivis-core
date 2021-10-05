'use strict';

const events = require('events');

const emitter = new events.EventEmitter();

const EventTypes = {
    RUN_OUTPUT: 'output',
    INIT: 'init',
    STOP: 'stop',
    FAIL: 'fail',
    SUCCESS: 'success',
    ACCESS_TOKEN: 'access_token',
    ACCESS_TOKEN_REFRESH: 'access_token_refresh'
}

function getOutputEventType(runId) {
    return `run/${runId}/${EventTypes.RUN_OUTPUT}`
}

function getStopEventType(runId) {
    return `run/${runId}/${EventTypes.STOP}`;
}

function getFailEventType(runId) {
    return `run/${runId}/${EventTypes.FAIL}`;
}

function getSuccessEventType(runId) {
    return `run/${runId}/${EventTypes.SUCCESS}`;
}

module.exports = {
    EventTypes,
    getOutputEventType,
    getStopEventType,
    getFailEventType,
    getSuccessEventType,
    emitter
}
