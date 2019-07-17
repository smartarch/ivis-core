'use strict';

const moment = require('moment');


const SignalType = {
    INTEGER: 'integer',
    LONG: 'long',
    FLOAT: 'float',
    DOUBLE: 'double',
    BOOLEAN: 'boolean',
    KEYWORD: 'keyword',
    TEXT: 'text',
    DATE_TIME: 'date',
    PAINLESS: 'painless',
};

if (Object.freeze) {
    Object.freeze(SignalType);
}

const AllSignalTypes = new Set(Object.values(SignalType));

const SignalSource = {
    RAW: 'raw',
    DERIVED: 'derived',
    JOB: 'job'
};

const AllSignalSources = new Set(Object.values(SignalSource));

if (Object.freeze) {
    Object.freeze(SignalSource);
}

const typesMap = {
    [SignalSource.DERIVED]: [
        SignalType.PAINLESS,
        SignalType.DATE_TIME
    ],
    [SignalSource.RAW]: [
        SignalType.INTEGER,
        SignalType.LONG,
        SignalType.FLOAT,
        SignalType.DOUBLE,
        SignalType.BOOLEAN,
        SignalType.KEYWORD,
        SignalType.TEXT,
        SignalType.DATE_TIME
    ],
};

function getTypesBySource(source) {
    const types = typesMap[source];
    return types ? types : null;
}

const deserializeFromDb = {
    [SignalType.INTEGER]: x => x,
    [SignalType.LONG]: x => x,
    [SignalType.FLOAT]: x => x,
    [SignalType.DOUBLE]: x => x,
    [SignalType.BOOLEAN]: x => x,
    [SignalType.KEYWORD]: x => x,
    [SignalType.TEXT]: x => x,
    [SignalType.DATE_TIME]: x => moment.utc(x).toDate()
};

const serializeToDb = {
    [SignalType.INTEGER]: x => x,
    [SignalType.LONG]: x => x,
    [SignalType.FLOAT]: x => x,
    [SignalType.DOUBLE]: x => x,
    [SignalType.BOOLEAN]: x => x,
    [SignalType.KEYWORD]: x => x,
    [SignalType.TEXT]: x => x,
    [SignalType.DATE_TIME]: x => moment(x).format('YYYY-MM-DD HH:mm:ss.SSS')
};


const IndexingStatus = {
    READY: 0, // The index is in sync with the data
    REQUIRED: 1, // The index is out of sync with the data
    RUNNING: 2, // The index is currently being created, or indexer crashed during reindex
    SCHEDULED: 3, // The indexer is asked to update the index
};

const IndexMethod = {
    INCREMENTAL: 0,
    FULL: 1
};

module.exports = {
    SignalType,
    AllSignalTypes,
    AllSignalSources,
    getTypesBySource,
    SignalSource,
    IndexingStatus,
    IndexMethod,
    deserializeFromDb,
    serializeToDb
};
