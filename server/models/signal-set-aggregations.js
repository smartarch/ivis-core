'use strict';

const {JobState} ="../../shared/jobs";
const {getBuiltinTask} ="../../client/src/lib/builtin-tasks";

const knex = require('../lib/knex');
const {enforce} = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const jobs = require('./jobs');


async function listDTAjax(context, sigSetId, params) {
    //return
    const res = await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'signalSet', requiredOperations: ['view']}],
        params,
        builder => builder.from('adjacent_jobs')
            .innerJoin('signal_sets_owners', function () {
                this.on('signal_sets_owners.job', '=', 'adjacent_jobs.job').andOn('adjacent_jobs.set', '=', sigSetId);
            })
            .innerJoin('jobs', 'jobs.id', 'signal_sets_owners.job')
            .innerJoin('signal_sets', 'signal_sets.id', 'signal_sets_owners.set'),
        ['signal_sets.id', 'signal_sets.cid', 'signal_sets.name', 'signal_sets.description', 'signal_sets.indexing', 'signal_sets.created', 'jobs.id', 'jobs.params'],
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
    const intervalInSecs = params.interval;
    const signalSet = tx('signal_sets').where('id', sigSetId).first();
    enforce(signalSet, `Signal set ${sigSetId} not found`);
    const task = getBuiltinTask('aggregation');
    enforce(task, `Aggregation task not found`);

    function getJobName() {
        return `aggregation_${intervalInSecs}s_${signalSet.cid}`;
    }

    const jobParams = {
        signalSet: sigSetId,
        interval: intervalInSecs
    };

    // TODO ambiguous, name can be shared should inner join on adjecent jobs, after testing, or param check
    //const exists = tx('jobs').where('params', JSON.stringify(jobParams)).first();
    const exists = tx('jobs').where('name', getJobName()).first();
    enforce(!exists, `Aggregation for bucket interval ${intervalInSecs} exists`);

    const job = {
        name: getJobName(),
        description: `Aggregation for signal set ${signalSet.name} with bucket interval ${intervalInSecs} s`,
        namespace: signalSet.namespace,
        task: task.id,
        state: JobState.ENABLED,
        params: jobParams,
        signal_sets_triggers: [sigSetId],
        trigger: null,
        min_gap: null,
        delay: null
    };
    const jobId = jobs.create(context, job);

    await tx('adjacent_jobs').insert({job: jobId, set: signalSet.id});

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


