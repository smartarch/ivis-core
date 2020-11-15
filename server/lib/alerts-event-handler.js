'use strict';

const esEmitter = require('./indexers/elasticsearch').emitter;
const knex = require('./knex');
const { Alert } = require('./alerts-class');

const alerts = new Map();

async function init(){
    esEmitter.on('insert', cid => {setTimeout(() => handleSignalTrigger(cid), 3000)}); //time delay to compensate for slow ElasticSearch
    setInterval(purge, 60 * 60 * 1000);
}

async function handleSignalTrigger(cid){
    const alertIds = await knex.transaction(async tx => {
        const sigSetId = await tx('signal_sets').where('cid', cid).first('id');
        const tmp = [];
        (await tx('alerts').where('sigset', sigSetId.id).select('id')).forEach(item => tmp.push(item.id));
        return tmp;
    });

    alertIds.forEach(alert => {
        if (alerts.has(alert)) alerts.get(alert).execute();
        else {
            const aux = new Alert(alert);
            alerts.set(alert, aux);
            aux.execute();
        }
    });
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
