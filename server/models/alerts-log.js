'use strict';

const knex = require('../lib/knex');
const { filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const shares = require('./shares');
const { sendEmail } = require('../lib/mailer');
const moment = require('moment');

const allowedKeys = new Set(['alert', 'type']);

async function listLogForAlert(context, params, alertId) {
    return await knex.transaction(async tx => {

        await shares.enforceEntityPermissionTx(tx, context, 'alert', alertId, 'view');

        return await dtHelpers.ajaxListTx(tx, params, builder => builder.from('alerts_log').where('alert', alertId), [ 'type', 'time' ]);
    });
}

async function addEntry(context, entity) {
    return await knex.transaction(async tx => {

        await shares.enforceEntityPermissionTx(tx, context, 'alert', entity.alert, 'trigger');

        const filteredEntity = filterObject(entity, allowedKeys);

        const ids = await tx('alerts_log').insert(filteredEntity);
        const id = ids[0];

        if (entity.type === 'test') {
            const alert = await tx('alerts').where('id', entity.alert).first();
            if (alert) {
                const addresses = alert.emails.split(/\r?\n/);
                const subject = `Alert ${alert.name} was manually triggered (tested)`;
                const text = `Alert ${alert.name} was manually triggered (tested).\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${alert.description}\nCondition:\n${alert.condition}`;
                await sendEmail('IVIS Alert', addresses, subject, text);
            }
        }

        return id;
    });
}

module.exports.listLogForAlert = listLogForAlert;
module.exports.addEntry = addEntry;
