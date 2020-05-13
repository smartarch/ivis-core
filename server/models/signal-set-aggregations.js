'use strict';

const {JobState} = require("../../shared/jobs");
const {getBuiltinTask} = require("./builtin-tasks");

const log = require('../lib/log');
const knex = require('../lib/knex');
const {enforce} = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const jobs = require('./jobs');
const interoperableErrors = require('../../shared/interoperable-errors');
const {isSignalSetAggregationIntervalValid} = require('../../shared/validators');

async function listDTAjax(context, sigSetId, params) {
    //return
    const res = await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'job', requiredOperations: ['view']}],
        params,
        builder => builder.from('aggregation_jobs')
            .innerJoin('jobs', function () {
                this.on('aggregation_jobs.job', '=', 'jobs.id').andOn('aggregation_jobs.set', '=', sigSetId);
            })
            .leftJoin('signal_sets_owners', 'signal_sets_owners.job', 'jobs.id')
            .leftJoin('signal_sets', 'signal_sets.id', 'signal_sets_owners.set'),
        ['signal_sets.id', 'signal_sets.cid', 'signal_sets.name', 'signal_sets.description', 'signal_sets.state', 'signal_sets.created', 'jobs.id', 'jobs.params'],
        {
            mapFun: data => {
                data[4] = JSON.parse(data[4]);
                data[7] = JSON.parse(data[7]);
            }
        }
    );
    return res;
}

async function createTx(tx, context, sigSetId, params) {
    const intervalStr = params.interval;
    const ts = params.ts;

    const signalSet = await tx('signal_sets').where('id', sigSetId).first();
    enforce(signalSet, `Signal set ${sigSetId} not found`);

    const task = await getBuiltinTask('aggregation');
    enforce(task, `Aggregation task not found`);

    const tsExists = tx('signals').where({set: sigSetId, cid: ts}).first();
    enforce(tsExists, `Timestamp signal not found in ${sigSetId}`);

    enforce(isSignalSetAggregationIntervalValid(intervalStr), 'Interval must be a positive integer and have a unit.');

    function getJobName() {
        return `aggregation_${intervalStr}s_${signalSet.cid}`;
    }

    const jobParams = {
        signalSet: signalSet.cid,
        offset: params.offset,
        ts: ts,
        interval: intervalStr
    };

    const exists = await tx('jobs').innerJoin('aggregation_jobs', 'jobs.id', 'aggregation_jobs.job').where('name', getJobName()).first();
    if (exists) {
        throw new interoperableErrors.ServerValidationError(`Aggregation for given interval ${intervalStr}s already exists.`);
    }

    const job = {
        name: getJobName(),
        description: `Aggregation for signal set ${signalSet.name} with bucket interval ${intervalStr} s`,
        namespace: signalSet.namespace,
        task: task.id,
        state: JobState.ENABLED,
        params: jobParams,
        signal_sets_triggers: [sigSetId],
        trigger: null,
        min_gap: null,
        delay: null
    };
    const jobId = await jobs.create(context, job);

    await tx('aggregation_jobs').insert({job: jobId, set: signalSet.id});

    jobs.run(context, jobId).catch(error => log.error('signal-set-aggregations', error));

    return jobId;
}

async function create(context, sigSetId, params) {
    return await knex.transaction(async tx => {
        return await createTx(tx, context, sigSetId, params);
    });
}

module.exports.create = create;
module.exports.createTx = createTx;
module.exports.listDTAjax = listDTAjax;


