'use strict';

const math = require('mathjs');
const knex = require('./knex');
const dataModel = require('../models/signal-sets');
const adminContext = require('./context-helpers').getAdminContext();

async function evaluate(condition, sigSetId, sortSigId){
    let result;
    try {
        const scope = await setupScope(sigSetId, sortSigId);
        result = math.evaluate(condition, scope);
    }
    catch(error){
        return error.message;
    }
    if(typeof result === 'boolean') return result;
    else return 'NotBoolError';
}

async function setupScope(sigSetId, sortSigId){
    const sigSetCid = (await knex('signal_sets').where('id', sigSetId).first('cid')).cid;
    const signals = [];
    (await knex('signals').where('set', sigSetId).select('cid')).forEach(item => signals.push(item.cid));

    const query = [
        {
            params: { withId: true },
            sigSetCid: sigSetCid,
            docs:{
                signals: signals,
                limit: 1,
                sort: [
                    {
                        order: 'desc'
                    }
                ]
            }
        }
    ];
    if (sortSigId) query[0].docs.sort[0].sigCid = (await knex('signals').where('id', sortSigId).first('cid')).cid;
    else query[0].docs.sort[0].field = 'id';

    const results = await dataModel.query(adminContext, query);
    const latest = results[0].docs[0];
    const scope = {};
    Object.keys(latest).forEach(key => scope['$' + key] = latest[key])
    return scope;
}

module.exports.evaluate = evaluate;
