'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const shares = require('./shares');
const interoperableErrors = require('../../shared/interoperable-errors');

const dtHelpers = require('../lib/dt-helpers');
const hashKeys = new Set(['id', 'service', 'name', 'description', 'preset_type', 'specification_values']);
const allowedKeys = new Set(['service', 'name', 'description', 'preset_type', 'specification_values']);

const hasher = require('node-object-hash')();
const {enforce, filterObject} = require('../lib/helpers');
const {getCredDescByType, getPresetDescsByType, getProxyByType} = require('./cloud_config/service');
const {getPresetDescsById} = require('./cloud_services');


function hash(entity) {
    return hasher.hash(filterObject(entity, hashKeys));
}

async function listDTAjax(context, params, serviceId) {
    return await dtHelpers.ajaxList(
        params,
        builder => builder
            .from('presets')
            .where('presets.service', serviceId),
        ['presets.id', 'presets.service', 'presets.name', 'presets.description']
    );
}


async function _getByTx(tx, context, key, value, extraColumns = []) {
    const columns = ['id', 'service', 'name', 'description', 'preset_type', 'specification_values', ...extraColumns];

    const preset = await tx('presets').select(columns).where(key, value).first();

    return preset;
}


async function _getBy(context, key, value, extraColumns = []) {
    return await knex.transaction(async tx => {
        return await _getByTx(tx, context, key, value, extraColumns);
    });
}

async function getById(context, id) {
    return await _getBy(context, 'id', id);
}

async function remove(context, presetId) {
    enforce(presetId !== 1, 'local preset cannot be deleted');

    await knex.transaction(async tx => {
        const existing = await tx('presets').where('id', presetId).first();
        if (!existing) {
            shares.throwPermissionDenied();
        }

        // TODO: permissions
        // await shares.enforceEntityPermissionTx(tx, context, 'namespace', existing.namespace, 'manageCloud');

        await tx('presets').where('id', presetId).del();
    });
}

async function updateWithConsistencyCheck(context, preset) {
    // the `preset` object DOES NOT correspond with the schema of presets!
    // the `preset.specification_values` is of the type object, whereas a string is stored in the db
    await knex.transaction(async tx => {
        const existing = await tx('presets').where('id', preset.id).first();
        if (!existing) {
            shares.throwPermissionDenied();
        }

        const existingHash = hash(existing);
        if (existingHash !== preset.originalHash) {
            throw new interoperableErrors.ChangedError();
        }
        // TODO: permissions
        /*
               await shares.enforceEntityPermissionTx(tx, context, 'namespace', preset.namespace, 'manageCloud');
        */
        await _validateAndPreprocess(tx, context, preset);

        await tx('presets').where('id', preset.id).update(filterObject(preset, allowedKeys));
    });
}


/**
 * preset entity:
 * {
 *     service: integer id,
 *     name: string,
 *     description: string,
 *     preset_type: string,
 *     specification_values: object (at least {})
 * }
 */

/**
 * besides validation, the function converts specification_values object to its JSON.stringified version
 * @param entity containing the keys mentioned above this documentation
 * @private
 */
async function _validateAndPreprocess(tx, context, preset) {

    if (!preset.name || preset.name.trim().length === 0) {
        throw new Error("Name cannot be empty");
    }

    if (!preset.description || preset.description.trim().length === 0) {
        throw new Error("Description cannot be empty");
    }

    if (!preset.service) {
        throw new Error("Malformed form");
    }

    const allDescriptions = await (getPresetDescsById(context, preset.service).catch(err => null));

    if (!allDescriptions) {
        throw new Error("Invalid service!");
    }

    const thisPresetDescription = allDescriptions[preset.preset_type];
    if (!thisPresetDescription) {
        throw new Error("Invalid preset type!");
    }

    if (!preset.specification_values && !thisPresetDescription.fields.empty())
        throw new Error("Specification values missing!");

    for (const {name, label} of thisPresetDescription.fields) {
        const value = preset.specification_values[name];
        if (!value || value.trim().length === 0)
            throw new Error(label + " must not be empty!");
    }

    preset.specification_values = JSON.stringify(preset.specification_values);
}

async function createTx(tx, context, preset) {
    let id;

    // TODO permissions
    //await shares.enforceEntityPermissionTx(tx, context, 'namespace', user.namespace, 'manageUsers');

    await _validateAndPreprocess(tx, context, preset, true);

    const ids = await tx('presets').insert(filterObject(preset, new Set(['name', 'service', 'description', 'preset_type', 'specification_values'])));
    id = ids[0];

    // TODO permissions
    //await shares.rebuildPermissionsTx(tx, { presetId: id });

    return id;
}

async function create(context, preset) {
    return await knex.transaction(async tx => {
        return await createTx(tx, context, preset);
    });
}

async function serverValidate(context, data) {
    const result = {};
    const serviceError = {service: {}};

    if (!(data.service instanceof Number) && !data.service) {
        return serviceError;
    }

    const presetSpecifications = await (getPresetDescsById(context, data.service).catch(err => null));

    if (!presetSpecifications) {
        return serviceError;
    }
    const thisPresetSpecification = presetSpecifications[data.preset_type];

    if (!thisPresetSpecification) {
        return {preset_type: {}}
    }

    // TODO: maybe specialize this according to the field description structure (needs to be defined)
    for (const fieldDescription of thisPresetSpecification.fields) {
        if (data[fieldDescription.name] && data[fieldDescription.name].toString().length !== 0)
            result[fieldDescription.name] = {};
    }

    return result;
}


module.exports.listDTAjax = listDTAjax;
module.exports.getById = getById;
module.exports.hash = hash;
module.exports.remove = remove;
module.exports.create = create;
module.exports.serverValidate = serverValidate;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;