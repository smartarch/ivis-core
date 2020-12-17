'use strict';

const math = require('mathjs');
const knex = require('./knex');
const dataModel = require('../models/signal-sets');
const adminContext = require('./context-helpers').getAdminContext();
const config = require('./config');

async function evaluate(condition, sigSetId){
    let result;
    try {
        const scope = await setupScope(sigSetId);
        result = math.evaluate(condition, scope);
    }
    catch(error){
        return error.message;
    }
    if(typeof result === 'boolean') return result;
    else return 'NotBoolError';
}

async function setupScope(sigSetId){
    const sigSetCid = (await knex('signal_sets').where('id', sigSetId).first('cid')).cid;
    const signals = [];
    (await knex('signals').where('set', sigSetId).select('cid')).forEach(item => signals.push(item.cid));

    const query = [
        {
            params: { withId: true },
            sigSetCid: sigSetCid,
            docs:{
                signals: signals,
                limit: config.alerts.maxResultsWindow,
                sort: [
                    {
                        field: 'id',
                        order: 'desc'
                    }
                ]
            }
        }
    ];

    const results = await dataModel.query(adminContext, query);
    const latest = results[0].docs[0];
    const scope = {};
    Object.keys(latest).forEach(key => scope['$' + key] = latest[key])

    const rest = results[0].docs;
    scope.past = (cid, distance) => lookBack(rest, cid, distance);

    return scope;
}

function lookBack(array, key, distance){
    let index = distance;
    if(distance >= array.length) index = array.length - 1;
    return array[index][key];
}

module.exports.evaluate = evaluate;
