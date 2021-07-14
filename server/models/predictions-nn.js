'use strict';

const knex = require('../lib/knex');
const { enforce } = require('../lib/helpers');
const predictions = require('./signal-set-predictions');
const {JobState} = require("../../shared/jobs");
const {getBuiltinTask} = require("./builtin-tasks");
const jobs = require('./jobs');
const {NN_TRAINING_TASK_NAME, NN_PREDICTION_TASK_NAME} = require("./neural_networks/neural-networks-tasks");
const { PredictionTypes} = require('../../shared/predictions');
const { enforceEntityPermission } = require('./shares');

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
    const aggregated = params.aggregation !== '';
    const targetSignals = [];
    for (const sig of params.target_signals) {
        const signal = await tx('signals').where('set', sigSetId).where('cid', sig.cid).first();

        enforce(signal, `Signal '${sig.cid}' not found in '${signalSet.cid}'`);

        // add signal with same cid (but only once)
        if (!targetSignals.some(s => s.cid === sig.cid)) {
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
        // add signal for predicted aggregated value (e.g. min, max, avg)
        if (aggregated) {
            targetSignals.push({
                cid: signal.cid + "_" + sig.aggregation,
                name: signal.name,
                description: signal.description,
                namespace: namespace,
                type: signal.type,
                indexed: signal.indexed,
                weight_list: signal.weight_list
            });
        }
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

async function startTrainingJob(context, jobId) {
    await jobs.run(context, jobId)
}

async function createNNModel(context, sigSetId, params) {
    const response = await knex.transaction(async tx => {
        return await createNNModelTx(tx, context, sigSetId, params);
    });

    if (params.start_training)
        await startTrainingJob(context, response.trainingJobId);

    return response;
}

async function getJobsIds(context, predictionId) {
    await enforceEntityPermission(context, 'prediction', predictionId, 'view');

    const prediction = await predictions.getById(context, predictionId);

    // check that it is NN
    enforce(prediction.type === PredictionTypes.NN, "Is not a Neural network model.");

    // Get the ids of the jobs
    const jobs = await knex.transaction(async tx => {
        return tx('predictions_jobs')
            .join('jobs', 'predictions_jobs.job', 'jobs.id')
            .join('tasks', 'jobs.task', 'tasks.id')
            .where('prediction', predictionId)
            .select('jobs.id', 'tasks.name');
    });

    const trainingJob = jobs.find(j => j.name === NN_TRAINING_TASK_NAME);
    enforce(trainingJob, 'Training job not found');
    const predictionJob = jobs.find(j => j.name === NN_PREDICTION_TASK_NAME);
    enforce(predictionJob, 'Prediction job not found');

    return {
        training: trainingJob.id,
        prediction: predictionJob.id,
    }
}

module.exports.create = createNNModel;
module.exports.getJobsIds = getJobsIds;
