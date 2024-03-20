'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash').hasher();
const {enforce, filterObject} = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const contextHelpers = require('../lib/context-helpers');
const shares = require('./shares');
const {RunStatus} = require('../../shared/jobs');
const {TaskSource} = require('../../shared/tasks');
const jobHandler = require('../lib/task-handler');
const signalSets = require('./signal-sets');
const allowedKeys = new Set(['name', 'description', 'task', 'params', 'state', 'trigger', 'min_gap', 'delay', 'namespace']);
const allowedKeysUpdate = new Set(['name', 'description', 'params', 'state', 'trigger', 'min_gap', 'delay', 'namespace']);
const {getVirtualNamespaceId} = require('../../shared/namespaces');

const columns = ['jobs.id', 'jobs.name', 'jobs.description', 'jobs.task', 'jobs.created', 'jobs.state', 'jobs.trigger', 'jobs.min_gap', 'jobs.delay', 'namespaces.name', 'tasks.name', 'tasks.source'];

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

function getQueryFun(taskSource) {
    if (!Array.isArray(taskSource)) {
        taskSource = [taskSource];
    }

    return builder => builder
        .from('jobs')
        .innerJoin('tasks', 'tasks.id', 'jobs.task')
        .whereIn('tasks.source', taskSource)
        .innerJoin('namespaces', 'namespaces.id', 'jobs.namespace')
}

/**
 * Return job with given id.
 * @param context the calling user's context
 * @param {number} id the primary key of the job
 * @param {boolean} includePermissions
 * @returns {Promise<Object>}
 */
async function getById(context, id, includePermissions = true) {
    return await knex.transaction(async tx => {
        const entity = await tx('jobs').where('id', id).first();

        if (entity && entity.namespace === getVirtualNamespaceId()) {
            shares.enforceGlobalPermission(context, 'viewSystemJobs');
        } else {
            await shares.enforceEntityPermissionTx(tx, context, 'job', id, 'view');
        }
        entity.params = JSON.parse(entity.params);
        if (includePermissions) {
            entity.permissions = await shares.getPermissionsTx(tx, context, 'job', id);
        }
        const triggs = await tx('job_triggers').select('signal_set').where('job', id);
        entity.signal_sets_triggers = triggs.map(trig => trig.signal_set);
        return entity;
    });
}

/**
 * Return job with given id plus parameters of the task specified job belongs to.
 * @param context the calling user's context
 * @param id the primary key of the job
 * @returns {Promise<Object>}
 */
async function getByIdWithTaskParams(context, id, includePermissions = true) {
    return await knex.transaction(async tx => {

        const job = await getById(context, id, includePermissions);

        let task = await tx('tasks').select('settings', 'source').where({id: job.task}).first();
        const settings = JSON.parse(task.settings);
        job.taskParams = settings.params;
        job.taskSource = task.source;
        return job;
    });
}

/**
 * Return run with given id.
 * @param context
 * @param jobId the primary key of the job
 * @param runId the primary key of the run
 * @returns {Promise<any>}
 */
async function getRunById(context, jobId, runId) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'job', jobId, 'view');
        return await tx('job_runs').where('job', jobId).where('id', runId).first();
    });
}

async function listByTaskDTAjax(context, taskId, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'job', requiredOperations: ['view']}],
        params,
        builder => builder
            .from('jobs')
            .where('task', taskId)
            .innerJoin('tasks', 'tasks.id', 'jobs.task')
            .innerJoin('namespaces', 'namespaces.id', 'jobs.namespace'),
        ['jobs.id', 'jobs.name', 'jobs.description', 'tasks.name', 'jobs.created', 'namespaces.name'],
        null
    );
}

async function listSystemDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'job', requiredOperations: ['view']}],
        params,
        getQueryFun(TaskSource.SYSTEM),
        columns
    );
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'job', requiredOperations: ['view']}],
        params,
        getQueryFun([TaskSource.BUILTIN, TaskSource.USER]),
        columns
    );
}

async function listRunsDTAjax(context, id, params) {
    return await knex.transaction(async tx => {
        const job = await tx('jobs').where('id', id).first();
        enforce(job != null, "Job doesn't exists")

        const columns = ['job_runs.id', 'job_runs.job', 'job_runs.started_at', 'job_runs.finished_at', 'job_runs.status']
        const queryFun =
            builder => builder
                .from('job_runs')
                .innerJoin('jobs', 'job_runs.job', 'jobs.id')
                .where({'jobs.id': id})
                .orderBy('job_runs.id', 'desc');

        await shares.enforceEntityPermissionTx(tx, context, 'job', id, 'view');

        return await dtHelpers.ajaxListWithPermissionsTx(
            tx,
            context,
            [{entityTypeId: 'job', requiredOperations: ['delete']}],
            params,
            queryFun,
            columns
        );
    });
}

async function listOwnedSignalSetsDTAjax(context, id, params) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'job', id, 'view');

        return await dtHelpers.ajaxListWithPermissionsTx(
            tx,
            context,
            [{entityTypeId: 'signalSet', requiredOperations: ['view']}],
            params,
            builder => builder
                .from('signal_sets_owners')
                .innerJoin('signal_sets', 'signal_sets_owners.set', 'signal_sets.id')
                .where({'signal_sets_owners.job': id})
                .orderBy('signal_sets.id', 'desc'),
            ['signal_sets_owners.set', 'signal_sets.name', 'signal_sets.description']
        );
    });
}

async function listRunningDTAjax(context, params) {
    return await knex.transaction(async tx => {
        //await shares.enforceEntityPermissionTx(tx, context, 'job', id, 'view');

        return await dtHelpers.ajaxListWithPermissionsTx(
            tx,
            context,
            [{entityTypeId: 'job', requiredOperations: ['execute']}],
            params,
            builder => builder
                .from('job_runs')
                .innerJoin('jobs', 'job_runs.job', 'jobs.id')
                .whereIn('job_runs.status', [RunStatus.RUNNING, RunStatus.SCHEDULED, RunStatus.INITIALIZATION])
                .orderBy('job_runs.id', 'desc'),
            ['job_runs.id', 'job_runs.job', 'jobs.name', 'job_runs.started_at', 'job_runs.status']
        );
    });
}

/**
 * Creates job.
 * @param context
 * @param job the job we want to create
 * @param {boolean} isSystemJobAllowed whether creation from system task is allowed on call
 * @returns {Promise<number>} id of the created job
 */
async function create(context, job, isSystemJobAllowed = false) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', job.namespace, 'createJob');
        await namespaceHelpers.validateEntity(tx, job);

        const task = await tx('tasks').where({id: job.task}).first();
        enforce(task != null && (isSystemJobAllowed || task.source !== TaskSource.SYSTEM), 'Task doesn\'t exists');

        const filteredEntity = filterObject(job, allowedKeys);
        filteredEntity.params = JSON.stringify(filteredEntity.params);

        filteredEntity.delay = parseTriggerStr(filteredEntity.delay);
        filteredEntity.min_gap = parseTriggerStr(filteredEntity.min_gap);
        filteredEntity.trigger = parseTriggerStr(filteredEntity.trigger);

        filteredEntity.owner = context.user.id;

        const ids = await tx('jobs').insert(filteredEntity);
        const id = ids[0];

        if (job.signal_sets_triggers) {
            await updateSetTriggersTx(tx, id, job.signal_sets_triggers);
        }

        await shares.rebuildPermissionsTx(tx, {entityTypeId: 'job', entityId: id});

        return id;
    });
}

/**
 * Parses trigger value input.
 * @param {string} triggerStr
 * @returns {number | null}
 */
function parseTriggerStr(triggerStr) {
    return parseInt(triggerStr) || null;
}

/**
 * Changes set triggers to specified ones.
 * @param tx
 * @param {number} id the primary key of the job
 * @param sets the array of the primary keys of sets to trigger on
 * @returns {Promise<void>}
 */
async function updateSetTriggersTx(tx, id, sets) {
    sets = sets.filter(s => s != null);
    await tx('job_triggers').where('job', id).whereNotIn('signal_set', sets).del();

    for (let i = 0; i < sets.length; i++) {
        const value = {job: id, signal_set: sets[i]};
        const exists = await tx('job_triggers').where(value).first();
        if (!exists) {
            await tx('job_triggers').insert(value);
        }
    }
}

/**
 * Update job. The job.id must match some existing one.
 * @param context
 * @param job the job that will override existing values
 * @returns {Promise<void>}
 */
async function updateWithConsistencyCheck(context, job) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'job', job.id, 'edit');

        const existing = await tx('jobs').where('id', job.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        existing.params = JSON.parse(existing.params);
        const existingHash = hash(existing);
        if (existingHash !== job.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await namespaceHelpers.validateEntity(tx, job);
        await namespaceHelpers.validateMove(context, job, existing, 'job', 'createJob', 'delete');


        const filteredEntity = filterObject(job, allowedKeysUpdate);
        filteredEntity.params = JSON.stringify(filteredEntity.params);
        filteredEntity.delay = parseTriggerStr(filteredEntity.delay);
        filteredEntity.min_gap = parseTriggerStr(filteredEntity.min_gap);
        filteredEntity.trigger = parseTriggerStr(filteredEntity.trigger);

        await tx('jobs').where('id', job.id).update(filteredEntity);

        if (job.signal_sets_triggers) {
            await updateSetTriggersTx(tx, job.id, job.signal_sets_triggers);
        }

        await shares.rebuildPermissionsTx(tx, {entityTypeId: 'job', entityId: job.id});
    });

}

/**
 * Remove job.
 * @param context
 * @param id the primary key of the job
 * @returns {Promise<void>}
 */
async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'job', id, 'delete');

        jobHandler.scheduleJobDelete(id);

        const owners = await tx('signal_sets_owners').where('job', id);
        for (let pair of owners) {
            await signalSets.removeById(contextHelpers.getAdminContext(), pair.set)
        }

        await tx('jobs').where('id', id).del();
    });
}

/**
 * Stop run if running and remove it run.
 * @param context
 * @param jobId the primary key of the job
 * @param runId the primary key of the run
 * @returns {Promise<void>}
 */
async function removeRun(context, jobId, runId) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'job', jobId, 'delete');

        await stop(context, runId);
        await tx('job_runs').where({id: runId, job: jobId}).del();
    });
}

async function removeAllRuns(context, jobId) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'job', jobId, 'delete');
        await tx('job_runs').where({job: jobId}).del();
    });
}

/**
 * Run job.
 * @param context
 * @param id the primary key of the job
 * @returns {Promise<number>} the primary key of the run
 */
async function run(context, id) {
    let runIds;
    let job;
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'job', id, 'execute');
        job = await tx('jobs').select('task').where({id: id}).first();
        runIds = await tx('job_runs').insert({job: id, status: RunStatus.INITIALIZATION, started_at: new Date()});
    });

    const runId = runIds[0];
    await jobHandler.scheduleRun(id, jobHandler.getTaskBuildOutputDir(job.task), runId);
    return runId;
}

/**
 * Stop run.
 * @param context
 * @param runId the primary key of the run
 * @returns {Promise<void>}
 */
async function stop(context, runId) {
    let id = null;
    await knex.transaction(async tx => {
        const run = await tx('job_runs').where('id', runId).first();
        if (run) {
            id = run.job;
            await shares.enforceEntityPermissionTx(tx, context, 'job', id, 'execute');
            await jobHandler.scheduleRunStop(id, runId);
        }
    });
}


module.exports.hash = hash;
module.exports.getById = getById;
module.exports.getByIdWithTaskParams = getByIdWithTaskParams;
module.exports.getRunById = getRunById;
module.exports.listDTAjax = listDTAjax;
module.exports.listSystemDTAjax = listSystemDTAjax;
module.exports.listRunsDTAjax = listRunsDTAjax;
module.exports.listOwnedSignalSetsDTAjax = listOwnedSignalSetsDTAjax;
module.exports.listRunningDTAjax = listRunningDTAjax;
module.exports.listByTaskDTAjax = listByTaskDTAjax;
module.exports.create = create;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
module.exports.removeRun = removeRun;
module.exports.removeAllRuns = removeAllRuns;
module.exports.run = run;
module.exports.stop = stop;


