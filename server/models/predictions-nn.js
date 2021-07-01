'use strict';

const knex = require('../lib/knex');
const { enforce } = require('../lib/helpers');
const predictions = require('./signal-set-predictions');
const {JobState} = require("../../shared/jobs");
const {getBuiltinTask} = require("./builtin-tasks");
const jobs = require('./jobs');
const { PredictionTypes} = require('../../shared/predictions');

async function createNNModelTx(tx, context, sigSetId, params) {

    const signalSet = await tx('signal_sets').where('id', sigSetId).first();
    enforce(signalSet, `Signal set ${sigSetId} not found`);
    params.signal_set = signalSet.cid;

    const tsExists = await tx('signals').where({ set: sigSetId, cid: params.ts }).first();
    enforce(tsExists, `Timestamp signal not found in ${sigSetId}`);

    const namespace = signalSet.namespace;

    enforce(Number.isInteger(params.target_width), "Target width must be an integer");

    await enforceTasks();

    let prediction = {
        name: params.name || '',
        type: PredictionTypes.NN,
        set: sigSetId,
        ahead_count: params.target_width,
        future_count: 1, // TODO (MT): what is future_count?
        namespace: namespace,
    };

    // target signals – signals of the created prediction signal sets
    // TODO (MT): what to do with aggregated signals
    const targetSignals = [];
    for (const sig of params.target_signals) {
        const signal = await tx('signals').where('set', sigSetId).where('cid', sig.cid).first();

        enforce(signal, `Signal '${sig.cid}' not found in '${signalSet.cid}'`);

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
    prediction.signals = {
        main: targetSignals,
    }

    prediction.id = await predictions.registerPredictionModelTx(tx, context, prediction);

    const jobs = await createJobsTx(tx, context, signalSet, prediction, params);

    return { prediction, ...jobs };
}

async function enforceTasks() {
    const taskTraining = await getBuiltinTask('Neural Network Training');
    enforce(taskTraining, `Neural Network Training builtin task not found`);

    const taskPrediction = await getBuiltinTask('Neural Network Prediction');
    enforce(taskPrediction, `Neural Network Prediction builtin task not found`);
}

async function createJobsTx(tx, context, signalSet, prediction, params) {
    const trainingJobId = await createTrainingJobTx(tx, context, signalSet, prediction, params);
    const predictionJobId = await createPredictionJobTx(tx, context, signalSet, prediction);

    return { trainingJobId, predictionJobId };
}

function _generateJobName(signalSet, modelName, suffix) {
    return [signalSet.cid, modelName, PredictionTypes.NN, suffix].join('_');
}

async function createTrainingJobTx(tx, context, signalSet, prediction, jobParams) {
    const modelName = prediction.name;
    const jobName = _generateJobName(signalSet, modelName,"training");

    const task = await getBuiltinTask('Neural Network Training');

    const job = {
        name: jobName,
        description: `Neural Network Optimizer for '${signalSet.cid}', '${modelName}'`,
        namespace: signalSet.namespace,
        task: task.id,
        state: JobState.ENABLED,
        params: jobParams,
        signal_sets_triggers: null,
        trigger: null,
        min_gap: null,
        delay: null,
    }

    const jobId = await jobs.createTx(tx, context, job);
    await predictions.registerPredictionModelJobTx(tx, context, prediction.id, jobId);

    return jobId;
}

async function createPredictionJobTx(tx, context, signalSet, prediction) {
    const modelName = prediction.name;
    const jobName = _generateJobName(signalSet, modelName,"prediction");

    const task = await getBuiltinTask('Neural Network Prediction');

    const job = {
        name: jobName,
        description: `Neural Network Prediction for '${signalSet.cid}', '${modelName}'`,
        namespace: signalSet.namespace,
        task: task.id,
        state: JobState.DISABLED, // TODO (MT) enable job when training finishes
        params: {},
        signal_sets_triggers: [signalSet.id],
        trigger: null,
        min_gap: null,
        delay: null,
    }

    const jobId = await jobs.createTx(tx, context, job);
    await predictions.registerPredictionModelJobTx(tx, context, prediction.id, jobId);

    return jobId;
}

async function createNNModel(context, sigSetId, params) {
    return await knex.transaction(async tx => {
        return await createNNModelTx(tx, context, sigSetId, params);
    });
}

module.exports.create = createNNModel;
