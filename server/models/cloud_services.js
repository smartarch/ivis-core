'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const shares = require('./shares');
const interoperableErrors = require('../../shared/interoperable-errors');

const dtHelpers = require('../lib/dt-helpers');
const hashKeys = new Set(['id', 'name', 'created', 'service_type', 'credential_values']);
const hasher = require('node-object-hash')();
const { filterObject } = require('../lib/helpers');

const { getCredDescByType, getPresetDescsByType, getProxyByType } = require('./cloud_config/service');

function hash(entity) {
    return hasher.hash(filterObject(entity, hashKeys));
}

async function listTypesDTAjax(context, serviceId) {
    const presetDescriptions = await getPresetDescsById(context, serviceId);
    const keys = Object.keys(presetDescriptions);
    return {
        recordsTotal: keys.length,
        recordsFiltered: keys.length,
        data:  keys.map(key => [key, presetDescriptions[key].description])
    };
}

async function _getByTx(tx, context, key, value, extraColumns = []) {
    const columns = ['id', 'name', 'created', 'service_type', 'credential_values', ...extraColumns];

    const service = await tx('cloud_services').select(columns).where(key, value).first();

    return service;
}

async function serverValidate(context, data) {
    const result = {};

    const credentialDescription = getCredDescByType((await getById(context, data.id)).service_type);

    for (const fieldDescription of credentialDescription.fields) {
        if(data[fieldDescription.name] && data[fieldDescription.name].toString().length != 0)
            result[fieldDescription.name] = {};
    }

    return result;
}

async function _getBy(context, key, value, extraColumns = []) {
    return await knex.transaction(async tx => {
        return await _getByTx(tx, context, key, value, extraColumns);
    });
}


async function listDTAjax(context, params) {
    return await dtHelpers.ajaxList(
        params,
        builder => builder
            .from('cloud_services'),
        ['cloud_services.id', 'cloud_services.name']
    );
}

async function getById(context, id) {
    return await _getBy(context, 'id', id);
}

async function getCredDescById(context, id) {
    return getCredDescByType((await getById(context, id)).service_type);
}

async function _getFieldDescsById(context, id)
{
    const service = await _getBy(context, 'id', id);
    return getCredDescByType(service.service_type).fields.map(fieldDesc => { return {name: fieldDesc.name, type: fieldDesc.type}; } );
}

async function updateWithConsistencyCheck(context, service) {
    // the `service` object DOES NOT correspond with the schema of cloud_services!
    // the `service` object merely contains modified values of FIELDS
        // note: FIELDS are part of the credentials_description column value (stringified JSON)
    // thus only credentials_description will actually be modified
    await knex.transaction(async tx => {
        const existing = await tx('cloud_services').where('id', service.id).first();
        if (!existing) {
            shares.throwPermissionDenied();
        }

        const existingHash = hash(existing);
        if (existingHash !== service.originalHash) {
            throw new interoperableErrors.ChangedError();
        }
 // TODO: permissions
 /*
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', service.namespace, 'manageCloud');
*/
        await _validateAndPreprocess(tx, service);
        const result = JSON.parse((await getById(tx, service.id)).credential_values);
        const credentialsDescription = await getCredDescById(tx, service.id);
        // actual modification of the credentials_description column's value
        for (let i = 0; i < credentialsDescription.fields.length; i++) {
            // if received data modify a field 'X',
                // write changes to the value of field 'X' using the received data
            let fieldName = credentialsDescription.fields[i].name;
            if(service[fieldName])
                result[fieldName] = service[fieldName];
        }

        await tx('cloud_services').where('id', service.id).update({credential_values: JSON.stringify(result)});
    });
}

async function _validateAndPreprocess(tx, entity) {

    const fields = await _getFieldDescsById(tx, entity.id);

    // TODO: specialize this more
    for (const {name, type} of fields) {
        if(type === "text")
        {
            if(!entity[name] || entity[name].length === 0)
                throw new Error("No fields shall be empty!");
        }
    }
}

async function getPresetDescsById(context, id) {
    return getPresetDescsByType((await getById(context, id)).service_type);
}

async function getCredentialsById(context, id) {
    return JSON.parse((await getById(context, id)).credential_values);
}

async function _getProxyById(context, id) {
    return getProxyByType((await getById(context, id)).service_type);
}

async function getByProxy(context, id, operation, body) {
    const proxy = await _getProxyById(context, id);

    if(!proxy[operation] || !proxy[operation] instanceof Function)
        return null;

    return await proxy[operation](await getCredentialsById(context, id), body);
}

module.exports.listDTAjax = listDTAjax;
module.exports.getById = getById;
module.exports.serverValidate = serverValidate;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.hash = hash;
module.exports.getCredDescById = getCredDescById;
module.exports.listTypesDTAjax = listTypesDTAjax;
module.exports.getPresetDescsById = getPresetDescsById;
module.exports.getCredentialsById = getCredentialsById;
module.exports.getByProxy = getByProxy;