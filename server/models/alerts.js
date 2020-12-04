'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');

const allowedKeys = new Set(['name', 'description', 'sigset', 'duration', 'delay', 'interval', 'condition', 'emails', 'phones', 'repeat', 'finalnotification', 'enabled', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'alert', id, 'view');

        const entity = await tx('alerts').where('id', id).first();
        entity.permissions = await shares.getPermissionsTx(tx, context, 'alert', id);

        return entity;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'alert', requiredOperations: ['view'] }],
        params,
        builder => builder.from('alerts').innerJoin('namespaces', 'namespaces.id', 'alerts.namespace'),
        [ 'alerts.id', 'alerts.name', 'alerts.description', 'alerts.enabled', 'alerts.created', 'namespaces.name' ]
    );
}

async function _validateAndPreprocess(tx, context, entity, isCreate) {
    await namespaceHelpers.validateEntity(tx, entity);
}

async function create(context, entity) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createAlert');

        await _validateAndPreprocess(tx, context, entity, true);

        const filteredEntity = filterObject(entity, allowedKeys);

        const ids = await tx('alerts').insert(filteredEntity);
        const id = ids[0];

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'alert', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'alert', entity.id, 'edit');

        const existing = await tx('alerts').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await _validateAndPreprocess(tx, context, entity, false);

        await namespaceHelpers.validateMove(context, entity, existing, 'alert', 'createAlert', 'delete');

        const filteredEntity = filterObject(entity, allowedKeys);

        await tx('alerts').where('id', entity.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'alert', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'alert', id, 'delete');

        await tx('alerts').where('id', id).del();
    });
}

module.exports.hash = hash;
module.exports.getById = getById;
module.exports.listDTAjax = listDTAjax;
module.exports.create = create;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
