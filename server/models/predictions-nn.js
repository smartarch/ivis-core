'use strict';

const knex = require('../lib/knex');
const { enforce } = require('../lib/helpers');
const predictions = require('./signal-set-predictions');
const { PredictionTypes} = require('../../shared/predictions');

async function createNNModelTx(tx, context, sigSetId, params) {

    const signalSet = await tx('signal_sets').where('id', sigSetId).first();
    enforce(signalSet, `Signal set ${sigSetId} not found`);

    const namespace = signalSet.namespace;

    let prediction = {
        name: params.name,
        type: PredictionTypes.NN,
        set: sigSetId,
        ahead_count: 1, // TODO
        future_count: 1,
        namespace: namespace
    };

    await predictions.registerPredictionModelTx(tx, context, prediction, [], []);

    return { prediction };
}

async function createNNModel(context, sigSetId, params) {
    return await knex.transaction(async tx => {
        return await createNNModelTx(tx, context, sigSetId, params);
    });
}

module.exports.create = createNNModel;
