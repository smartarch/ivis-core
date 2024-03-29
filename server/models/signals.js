'use strict';

const em = require('../lib/extension-manager');
const config = require('../lib/config');
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const signalStorage = require('./signal-storage');
const indexer = require('../lib/indexers/' + config.indexer);
const {IndexingStatus, getTypesBySource, SignalSource, AllSignalSources} = require('../../shared/signals');
const {enforce, filterObject} = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const {SignalSetType} = require('../../shared/signal-sets');
const entitySettings = require('../lib/entity-settings');

const {allowedKeysUpdate, allowedKeysCreate} = require('../lib/signal-helpers');

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', id, 'view');
        const entity = await tx('signals').where('id', id).first();
        entity.settings = JSON.parse(entity.settings);
        entity.permissions = await shares.getPermissionsTx(tx, context, 'signal', id);
        return entity;
    });
}

async function getBySigSetId(context, sigSetId) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', sigSetId, 'view');
        const output = await tx('signals').where('set', sigSetId);
        return output;
    });
}

async function listVisibleForXXXTx(tx, context, sigSetId, weightCol, onlyWithQueryPerm) {
    const entityType = entitySettings.getEntityType('signal');

    const rows = await tx('signals')
        .leftJoin(entityType.permissionsTable, {
            [entityType.permissionsTable + '.entity']: 'signals.id',
            [entityType.permissionsTable + '.user']: context.user.id
        }).groupBy('signals.id')
        .where('set', sigSetId).whereNotNull(weightCol)
        .orderBy(weightCol, 'asc')
        .select([
            'signals.id',
            'signals.cid',
            'signals.name',
            'signals.description',
            'signals.type',
            'signals.source',
            'signals.indexed',
            'signals.namespace',
            knex.raw(`GROUP_CONCAT(${entityType.permissionsTable + '.operation'} SEPARATOR \';\') as permissions`)
        ]);

    if (onlyWithQueryPerm) {
        const sigs = [];

        for (const row of rows) {
            row.permissions = row.permissions ? row.permissions.split(';') : [];
            row.permissions = shares.filterPermissionsByRestrictedAccessHandler(context, 'signal', row.id, row.permissions, 'signals.listVisibleForXXXTx');
            if (row.permissions.includes('query')) {
                sigs.push(row);
            }
        }

        return sigs;
    } else {
        return rows;
    }
}


async function listVisibleForListTx(tx, context, sigSetId) {
    await shares.enforceEntityPermissionTx(tx, context, 'signalSet', sigSetId, 'query');
    return await listVisibleForXXXTx(tx, context, sigSetId, 'weight_list', true);
}

async function listVisibleForList(context, sigSetId) {
    return await knex.transaction(async tx => {
        return await listVisibleForListTx(tx, context, sigSetId);
    });
}

async function listVisibleForEditTx(tx, context, sigSetId, onlyWithQueryPerm) {
    await shares.enforceEntityPermissionTx(tx, context, 'signalSet', sigSetId, ['insertRecord', 'editRecord']);
    return await listVisibleForXXXTx(tx, context, sigSetId, 'weight_edit', onlyWithQueryPerm);
}

async function listVisibleForEdit(context, sigSetId, onlyWithQueryPerm) {
    return await knex.transaction(async tx => {
        return await listVisibleForEditTx(tx, context, sigSetId, onlyWithQueryPerm);
    });
}

async function listByCidDTAjax(context, signalSetCid, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{
            entityTypeId: 'signal',
            requiredOperations: ['view']
        }],
        params,
        builder => builder
            .from('signals')
            .innerJoin('signal_sets', 'signal_sets.id', 'signals.set')
            .where('signal_sets.cid', signalSetCid)
            .innerJoin('namespaces', 'namespaces.id', 'signals.namespace'),
        [
            'signals.id', 'signals.cid', 'signals.name', 'signals.description', 'signals.type', 'signals.created', 'namespaces.name',
            // This also requires changes in the client because it has to look up permissions in another key
            // ...em.get('models.signals.extraKeys', []).map(key => 'signals.' + key)
        ]
    );
}

async function listDTAjax(context, signalSetId, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{
            entityTypeId: 'signal',
            requiredOperations: ['view']
        }],
        params,
        builder => builder
            .from('signals')
            .where('set', signalSetId)
            .innerJoin('namespaces', 'namespaces.id', 'signals.namespace'),
        [
            'signals.id', 'signals.cid', 'signals.name', 'signals.description', 'signals.type', 'signals.source', 'signals.indexed', 'signals.created', 'namespaces.name',
            // This also requires changes in the client because it has to look up permissions in another key
            // ...em.get('models.signals.extraKeys', []).map(key => 'signals.' + key)
        ]
    );
}

async function serverValidate(context, signalSetId, data) {
    const result = {};

    if (data.cid) {
        await shares.enforceEntityPermission(context, 'signalSet', signalSetId, 'createSignal');

        const query = knex('signals').where({
            cid: data.cid,
            set: signalSetId
        });

        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const signal = await query.first();

        result.cid = {};
        result.cid.exists = !!signal;
    }

    return result;
}

async function _validateAndPreprocess(context, tx, entity, isCreate) {
    await namespaceHelpers.validateEntity(tx, entity);

    enforce(entity.source != null && AllSignalSources.has(entity.source), 'Unknown source type');
    enforce(getTypesBySource(entity.source).includes(entity.type), `Unknown signal type "${entity.type}"`);

    if (entity.source === SignalSource.DERIVED) {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', entity.set, 'manageScripts');
    }

    const existingWithCidQuery = tx('signals').where({
        cid: entity.cid,
        set: entity.set
    });
    if (!isCreate) {
        existingWithCidQuery.whereNot('id', entity.id);
    }

    const existingWithCid = await existingWithCidQuery.first();
    enforce(!existingWithCid, `Signal's machine name (cid) '${entity.cid}' is already used for another signal.`);

    entity.settings = JSON.stringify(entity.settings);
}


async function create(context, signalSetId, entity) {
    return await knex.transaction(async tx => {
        return await createTx(tx, context, signalSetId, entity);
    });
}

async function createTx(tx, context, signalSetId, entity) {
    await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createSignal');
    await shares.enforceEntityPermissionTx(tx, context, 'signalSet', signalSetId, 'createSignal');

    entity.set = signalSetId;
    await _validateAndPreprocess(context, tx, entity, true);

    const signalSet = await tx('signal_sets').where('id', signalSetId).first();

    const filteredEntity = filterObject(entity, allowedKeysCreate);
    const ids = await tx('signals').insert(filteredEntity);
    const id = ids[0];

    await shares.rebuildPermissionsTx(tx, {
        entityTypeId: 'signal',
        entityId: id
    });

    const fieldAdditions = {
        [id]: entity.type
    };


    if (entity.source === SignalSource.JOB) {
        await indexer.onExtendSchema(signalSet, fieldAdditions);
    } else if (entity.source === SignalSource.RAW) {
        if (signalSet.type === SignalSetType.NORMAL) {
            await signalStorage.extendSchema(signalSet, fieldAdditions);
        } else {
            throw new Error("Raw signals aren't supported on computed signal sets");
        }
    }

    return id;
}


async function updateSignalSetStatus(tx, signalSet, result) {
    if (result.reindexRequired) {
        const state = JSON.parse(signalSet.state);
        state.indexing.status = IndexingStatus.REQUIRED;
        await tx('signal_sets').where('id', signalSet.id).update('state', JSON.stringify(state));
    }
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', entity.id, 'edit');

        const existing = await tx('signals').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        existing.settings = JSON.parse(existing.settings);

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        entity.set = existing.set;
        await _validateAndPreprocess(context, tx, entity, false);

        await namespaceHelpers.validateMove(context, entity, existing, 'signal', 'createSignal', 'delete');

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        await tx('signals').where('id', entity.id).update(filteredEntity);

        if (existing.indexed !== entity.indexed) {
            const signalSet = await tx('signal_sets').where('id', existing.set).first();
            const state = JSON.parse(signalSet.state);
            state.indexing.status = IndexingStatus.REQUIRED;
            await tx('signal_sets').where('id', signalSet.id).update('state', JSON.stringify(state));
        }

        await shares.rebuildPermissionsTx(tx, {
            entityTypeId: 'signal',
            entityId: entity.id
        });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', id, 'delete');

        const existing = await tx('signals').where('id', id).first();

        const signalSet = await tx('signal_sets').where('id', existing.set).first();

        if (getTypesBySource(SignalSource.RAW).includes(existing.type)) {
            await updateSignalSetStatus(tx, signalSet, await signalStorage.removeField(signalSet, existing.id));
        }

        await tx('signals').where('id', id).del();
    });
}


module.exports.hash = hash;
module.exports.getById = getById;
module.exports.getBySigSetId = getBySigSetId;
module.exports.listDTAjax = listDTAjax;
module.exports.listByCidDTAjax = listByCidDTAjax;
module.exports.create = create;
module.exports.createTx = createTx;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
module.exports.serverValidate = serverValidate;
module.exports.listVisibleForListTx = listVisibleForListTx;
module.exports.listVisibleForList = listVisibleForList;
module.exports.listVisibleForEditTx = listVisibleForEditTx;
module.exports.listVisibleForEdit = listVisibleForEdit;
