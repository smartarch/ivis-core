'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const shares = require('./shares');
const interoperableErrors = require('../../shared/interoperable-errors');

const dtHelpers = require('../lib/dt-helpers');
const hashKeys = new Set(['id', 'service', 'name', 'description', 'preset_type', 'specification_values']);
const allowedKeys = new Set(['service', 'name', 'description', 'preset_type', 'specification_values']);

const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');

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

async function create(context, preset) {
    return await knex.transaction(async tx => {
        return await createTx(tx, context, preset);
    });
}

async function createTx(tx, context, preset) {
    let id;

    await _validateAndPreprocess(tx, preset, true);

    const ids = await tx('preset').insert(filterObject(preset, allowedKeys));
    id = ids[0];

    // await shares.rebuildPermissionsTx(tx, { presetId: id });

    return id;
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
async function _validateAndPreprocess(tx, entity, isCreate) {
    // TODO: check that entity.service is valid id of a service
    if(!entity.name || entity.name.trim() === '')
        throw new Error("Name cannot be empty");
    if(!entity.description)
        entity.description = '';
    // TODO: real check of the preset type
    if(!entity.preset_type || entity.preset_type.trim() === '')
        throw new Error("Invalid preset type");
    if(!entity.specification_values || !(entity.specification_values instanceof Object))
        entity.specification_values = {};

    entity.specification_values = JSON.stringify(entity.specification_values);
}

async function remove(context, presetId) {
    enforce(presetId !== 1, 'local preset cannot be deleted');

    await knex.transaction(async tx => {
        const existing = await tx('users').where('id', userId).first();
        if (!existing) {
            shares.throwPermissionDenied();
        }

        // TODO: permissions
        // await shares.enforceEntityPermissionTx(tx, context, 'namespace', existing.namespace, 'manageCloud');

        await tx('presets').where('id', presetId).del();
    });
}


module.exports.listDTAjax = listDTAjax;
module.exports.getById = getById;
module.exports.hash = hash;
module.exports.remove = remove;
module.exports.create = create;