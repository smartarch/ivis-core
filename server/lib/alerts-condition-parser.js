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
    if (typeof result === 'boolean') return result;
    else if (result.entries) return result.entries[result.entries.length - 1];
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
    scope.avg = (cid, length) => average(rest, cid, length);
    scope.var = (cid, length) => variance(rest, cid, length);
    scope.min = (cid, length) => minimum(rest, cid, length);
    scope.max = (cid, length) => maximum(rest, cid, length);
    scope.qnt = (cid, length, q) => quantile(rest, cid, length, q);

    return scope;
}

function lookBack(array, key, distance){
    if (distance >= array.length) distance = array.length - 1;
    return array[distance][key];
}

function average(array, key, length){
    if (length > array.length) length = array.length;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < length; i++) {
        if (array[i][key] !== null) {
            if (typeof array[i][key] !== 'number') throw new Error('Argument in avg function is not a number!');
            sum += array[i][key];
            count++;
        }
    }
    return sum / count;
}

function variance(array, key, length){
    if (length > array.length) length = array.length;
    const avg = average(array, key, length);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < length; i++) {
        if (array[i][key] !== null) {
            if (typeof array[i][key] !== 'number') throw new Error('Argument in var function is not a number!');
            sum += Math.pow(array[i][key] - avg, 2);
            count++;
        }
    }
    return sum / count;
}

function minimum(array, key, length){
    if (length > array.length) length = array.length;
    let min = null;
    for (let i = 0; i < length; i++) if (array[i][key] !== null && (min === null || array[i][key] < min)) min = array[i][key];
    return min;
}

function maximum(array, key, length){
    if (length > array.length) length = array.length;
    let max = null;
    for (let i = 0; i < length; i++) if (array[i][key] !== null && (max === null || array[i][key] > max)) max = array[i][key];
    return max;
}

function quantile(array, key, length, q){
    if (length > array.length) length = array.length;
    let values = [];
    for (let i = 0; i < length; i++) if (array[i][key] !== null) values.push(array[i][key]);
    let numeric = false;
    for (let i = 0; i < values.length; i++) if (typeof values[i] === 'number') numeric = true;
    if (numeric) values.sort((a, b) => a - b);
    else values.sort();
    const index = Math.ceil(values.length * q) - 1;
    return values[index < 0 ? 0 : index];
}

module.exports.evaluate = evaluate;
