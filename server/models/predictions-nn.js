'use strict';

const knex = require('../lib/knex');
const { enforce } = require('../lib/helpers');
const predictions = require('./signal-set-predictions');
const { PredictionTypes} = require('../../shared/predictions');

async function createNNModelTx(tx, context, sigSetId, params) {

    const signalSet = await tx('signal_sets').where('id', sigSetId).first();
    enforce(signalSet, `Signal set ${sigSetId} not found`);

    const tsExists = await tx('signals').where({ set: sigSetId, cid: params.tsSigCid }).first();
    enforce(tsExists, `Timestamp signal not found in ${sigSetId}`);

    const namespace = signalSet.namespace;

    let prediction = {
        name: params.name || '',
        type: PredictionTypes.NN,
        set: sigSetId,
        ahead_count: 1, // TODO (MT)
        future_count: 1,
        namespace: namespace
    };

    // target signals – signals of the created prediction signal sets
    // TODO (MT): what to do with aggregated signals
    const targetSignals = [];
    for (const sig of params.target_signals) {
        const signal = await tx('signals').where('namespace', namespace).where('cid', sig.cid).first();

        targetSignals.push({
            cid: signal.cid,
            name: signal.name,
            description: signal.description,
            namespace: namespace,
            type: signal.type,
            indexed: signal.indexed,
            weight_list: signal.weight_list
        });
    }

    await predictions.registerPredictionModelTx(tx, context, prediction, targetSignals);

    return { prediction };
}

async function createNNModel(context, sigSetId, params) {
    return await knex.transaction(async tx => {
        return await createNNModelTx(tx, context, sigSetId, params);
    });
}

module.exports.create = createNNModel;
