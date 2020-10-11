'use strict';

const knex = require('../lib/knex');
const { filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const shares = require('./shares');

const allowedKeys = new Set(['alert', 'type']);

async function listLogForAlert(context, params, alertId) {
    return await knex.transaction(async tx => {

        await shares.enforceEntityPermissionTx(tx, context, 'alert', alertId, 'view');

        return dtHelpers.ajaxListTx(tx, params, builder => builder.from('alerts_log').where('alert', alertId), [ 'type', 'time' ]);
    });
}

async function addEntry(context, entity) {
    return await knex.transaction(async tx => {

        await shares.enforceEntityPermissionTx(tx, context, 'alert', entity.alert, 'trigger');

        const filteredEntity = filterObject(entity, allowedKeys);

        const ids = await tx('alerts_log').insert(filteredEntity);
        const id = ids[0];

        return id;
    });
}

module.exports.listLogForAlert = listLogForAlert;
module.exports.addEntry = addEntry;
