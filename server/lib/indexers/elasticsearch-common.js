'use strict';

const elasticsearch = require('../elasticsearch');
const {SignalSource, getTypesBySource, SignalType} = require('../../../shared/signals');

// Gets the name of an index for a signal set
function getIndexName(sigSet) {
    return 'signal_set_' + sigSet.id;
}

const getFieldName = (fieldId) => 's' + fieldId;

const fieldTypes = {
    [SignalType.INTEGER]: 'integer',
    [SignalType.LONG]: 'long',
    [SignalType.FLOAT]: 'float',
    [SignalType.DOUBLE]: 'double',
    [SignalType.BOOLEAN]: 'boolean',
    [SignalType.KEYWORD]: 'keyword',
    [SignalType.TEXT]: 'text',
    [SignalType.DATE_TIME]: 'date'
};

async function createIndex(sigSet, signalByCidMap) {
    const indexName = getIndexName(sigSet);

    const properties = {};
    for (const fieldCid in signalByCidMap) {
        const field = signalByCidMap[fieldCid];
        // TODO similar to bellow in extendMapping, does it need to be raw?
        if (field.source === SignalSource.RAW) {
            properties[getFieldName(field.id)] = {type: fieldTypes[field.type]};
        }
    }

    await elasticsearch.indices.create({
        index: indexName,
        body: {
            mappings: {
                _doc: {
                    properties
                }
            }
        }
    });
}

async function extendMapping(sigSet, fields) {
    const indexName = getIndexName(sigSet);

    const properties = {};
    for (const fieldId in fields) {
        const fieldType = fields[fieldId];
        // TODO check if this is good way, just need ot have mapping for given type?
        if (fieldTypes[fieldType] != null) {
            properties[getFieldName(fieldId)] = {type: fieldTypes[fieldType]};
        }
    }

    await elasticsearch.indices.putMapping({
        index: indexName,
        type: '_doc',
        body: {
            properties
        }
    });
}

module.exports = {
    getIndexName,
    getFieldName,
    createIndex,
    extendMapping
};
