'use strict';

const JobState = {
    DISABLED: 0,
    ENABLED: 1,
    INVALID_PARAMS: 2
};
if (Object.freeze) {
    Object.freeze(JobState)
}

const RunStatus = {
    SUCCESS: 0,
    FAILED: 1,
    SCHEDULED: 2,
    RUNNING: 3,
    INITIALIZATION: 4
};

Object.freeze(RunStatus)

const HandlerMsgType = {
    BUILD: 0,
    RUN: 1,
    STOP: 2,
    DELETE_JOB: 3,
    DELETE_TASK: 4,
    SIGNAL_TRIGGER: 5,
    CREATE: 6,
    INIT: 7,
    ACCESS_TOKEN: 8
};
Object.freeze(HandlerMsgType)

const JobMsgType = {
    STORE_STATE: 'store_state',
    CREATE_SIGNALS: 'create_signals'
};

Object.freeze(JobMsgType)

module.exports = {
    JobState,
    RunStatus,
    HandlerMsgType,
    JobMsgType
};
