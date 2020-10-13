'use strict';

const events = require('events');

const emitter = new events.EventEmitter();

const EventTypes = {
    RUN_OUTPUT: 'output',
    INIT: 'init'
}

module.exports = {
    EventTypes,
    emitter
}
