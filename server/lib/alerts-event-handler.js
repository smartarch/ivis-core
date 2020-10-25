'use strict';

const esEmitter = require('./indexers/elasticsearch').emitter;
const knex = require('./knex');

async function init(){
    esEmitter.on('insert', handleSignalTrigger);
}

async function addLogEntry(alertId, type){
    await knex('alerts_log').insert({alert: alertId, type: type});
}

async function handleSignalTrigger(cid){
    const alerts = await knex.transaction(async tx =>{
        const sigSetId = await tx('signal_sets').where('cid', cid).first('id');
        const alertsIds = await tx('alerts').where('sigset', sigSetId.id);
        return alertsIds;
    });

    alerts.forEach((alert) => addLogEntry(alert.id, 'condition'));
}

module.exports.init = init;
