'use strict';

const knex = require('../lib/knex');
const { JobState } = require("../../shared/jobs");
const { getBuiltinTask } = require("./builtin-tasks");
const jobs = require('./jobs');
const log = require('../lib/log');
const { enforce } = require('../lib/helpers');
const predictions = require('./signal-set-predictions');
const { PredictionTypes, ArimaModelStates } = require('../../shared/predictions');
const { enforceEntityPermissionTx, enforceEntityPermission } = require('./shares');
const es = require('../lib/elasticsearch');

function _generateJobName(signalSetName, modelName, modelType, postfix = '') {
    if (postfix == '')
        return [signalSetName, modelName, modelType, postfix].join('_');
    else
        return [signalSetName, modelName, modelType].join('_');
}

async function createArimaModelTx(tx, context, sigSetId, params) {
    const ts = params.ts;

    const signalSet = await tx('signal_sets').where('id', sigSetId).first();
    enforce(signalSet, `Signal set ${sigSetId} not found`);

    const arimaTask = await getBuiltinTask('ARIMA');
    enforce(arimaTask, `ARIMA builtin task not found`);

    const tsExists = await tx('signals').where({ set: sigSetId, cid: ts }).first();
    enforce(tsExists, `Timestamp signal not found in ${sigSetId}`);

    const jobName = _generateJobName(signalSet.cid, params.name, PredictionTypes.ARIMA);
    const modelName = params.name;
    const namespace = signalSet.namespace;

    const ahead_count = parseInt(params.futurePredictions); // TODO: Rename

    const jobParams_org = {
        signalSet: signalSet.cid,
        sigSet: signalSet.cid,
        ts: ts,
    };

    const jobParams = { ...params, ...jobParams_org };

    const job = {
        name: jobName,
        description: `ARIMA for '${signalSet.cid}', '${modelName}'`,
        namespace: namespace,
        task: arimaTask.id,
        state: JobState.ENABLED,
        params: jobParams,
        signal_sets_triggers: [sigSetId],
        trigger: null,
        min_gap: null,
        delay: null,
    }

    let prediction = {
        name: params.name,
        description: params.description || null,
        type: PredictionTypes.ARIMA,
        set: sigSetId,
        ahead_count: ahead_count,  // generally, future should be equal to ahead but for
        future_count: ahead_count, // very high values you can consider future > ahead
        namespace: namespace
    };

    // source signal
    const signal = await tx('signals').where('namespace', namespace).where('cid', params.source).first();

    const signals = {
        main: [
            {
                cid: signal.cid,
                name: signal.name,
                description: signal.description,
                namespace: namespace,
                type: signal.type,
                indexed: signal.indexed,
                weight_list: 0
            }
        ]
    };

    prediction.signals = signals;

    const modelId = await predictions.registerPredictionModelTx(tx, context, prediction);

    const outputConfig = await predictions.getOutputConfigTx(tx, context, modelId);
    job.params.output_config = outputConfig;

    const jobId = await jobs.createTx(tx, context, job);
    await predictions.registerPredictionModelJobTx(tx, context, modelId, jobId);

    return { prediction, jobId };
}

async function createArimaModel(context, sigSetId, params) {
    return await knex.transaction(async tx => {
        return await createArimaModelTx(tx, context, sigSetId, params);
    });
}

async function createAndStart(context, sigSetId, params) {
    const { prediction, jobId } = await createArimaModel(context, sigSetId, params);

    // run the job
    jobs.run(context, jobId).catch(error => log.error('predictions-arima', error));
}

async function arimaCleanupTx(tx, context, predictionId) {
    // At the moment, no ARIMA specific cleanup on deletion is necessary.
}

/** Return a job state of a ARIMA job belonging to a given model instance
 *
 * @param {int} modelId ARIMA model id
 * @returns Stored job state
 */
async function getJobState(context, modelId) {
    enforceEntityPermission(context, 'prediction', modelId, 'view');

    const prediction = await predictions.getById(context, modelId);

    // check that it is indeed  ARIMA
    enforce(prediction.type === PredictionTypes.ARIMA, "Is not an ARIMA model.");

    // Get the id of the only job we use for ARIMA
    const predictionJob = await knex.transaction(async tx => {
        return await tx('predictions_jobs').where('prediction', modelId).first();
    });

    const jobId = predictionJob.job;
    enforceEntityPermission(context, 'job', jobId, 'view');

    try {
        // State may not exist yet
        const response = await es.search({
            index: 'jobs',
            body: {
                query: {
                    term: {
                        '_id': jobId
                    }
                }
            }
        });

        let state = response.hits.hits[0]['_source'].state;
        delete state.blob; // client is not interested in the base64 binary blob

        return state;
    } catch (error) {
        return {
            state: ArimaModelStates.UNKNOWN
        }
    }
}

module.exports.create = createAndStart;
module.exports.createTx = createArimaModelTx;
module.exports.getJobState = getJobState;
module.exports.arimaCleanupTx = arimaCleanupTx;