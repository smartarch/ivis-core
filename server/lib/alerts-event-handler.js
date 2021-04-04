'use strict';

const esEmitter = require('./indexers/elasticsearch').emitter;
const knex = require('./knex');
const { Alert } = require('./alerts-class');
const log = require('./log');

const alerts = new Map();

async function init(){
    log.info('Alerts', 'Initializing...');
    const tmp = await knex('alerts').select();
    for (let i = 0; i < tmp.length; i++) {
        const aux = new Alert(tmp[i]);
        await aux.init();
        alerts.set(tmp[i].id, aux);
    }

    esEmitter.on('insert', cid => {setTimeout(() => handleSignalTrigger(cid), 3000)}); //time delay to compensate for slow ElasticSearch
    log.info('Alerts', 'Initialized');
}

async function handleSignalTrigger(cid){
    const alertIds = await knex('alerts').innerJoin('signal_sets', 'alerts.sigset', 'signal_sets.id').where('signal_sets.cid', cid).select('alerts.id');
    for (let i = 0; i < alertIds.length; i++) await alerts.get(alertIds[i].id).execute();
}

async function handleCreateTx(tx, id){
    const newAlert = await tx('alerts').where('id', id).first();
    const aux = new Alert(newAlert);
    aux.init();
    alerts.set(newAlert.id, aux);
}

async function handleUpdateTx(tx, id){
    const updatedAlert = await tx('alerts').where('id', id).first();
    alerts.get(updatedAlert.id).update(updatedAlert);
}

async function handleDelete(id){
    alerts.get(id).terminate();
    alerts.delete(id);
}

module.exports.init = init;
module.exports.handleCreateTx = handleCreateTx;
module.exports.handleUpdateTx = handleUpdateTx;
module.exports.handleDelete = handleDelete;
