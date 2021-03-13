'use strict';

const esEmitter = require('./indexers/elasticsearch').emitter;
const knex = require('./knex');
const { Alert } = require('./alerts-class');

const alerts = new Map();

async function init(){
    const tmp = await knex('alerts').select('id', 'state', 'state_changed', 'delay', 'duration');
    for (let i = 0; i < tmp.length; i++) {
        const aux = new Alert(tmp[i].id);
        await aux.setupTimers(tmp[i].state, tmp[i].state_changed, tmp[i].delay, tmp[i].duration);
        alerts.set(tmp[i].id, aux);
    }

    esEmitter.on('insert', cid => {setTimeout(() => handleSignalTrigger(cid), 3000)}); //time delay to compensate for slow ElasticSearch
    setInterval(purge, 60 * 60 * 1000);
}

async function handleSignalTrigger(cid){
    const alertIds = await knex('alerts').innerJoin('signal_sets', 'alerts.sigset', 'signal_sets.id').where('signal_sets.cid', cid).select('alerts.id');
    for (let i = 0; i < alertIds.length; i++) {
        if (alerts.has(alertIds[i].id)) alerts.get(alertIds[i].id).execute();
        else {
            const aux = new Alert(alertIds[i].id);
            await aux.execute();
            alerts.set(alertIds[i].id, aux);
        }
    }
}

async function purge(){
    await knex.transaction(async tx => {
        const ids = [];
        for (let key of alerts.keys()) {
            const tmp = await tx('alerts').where('id', key).first('id');
            if (!tmp) ids.push(key);
        }
        ids.forEach(item => {
            alerts.get(item).terminate();
            alerts.delete(item);
        });
    });
}

module.exports.init = init;
