'use strict';

import {TaskSource} from "../../shared/tasks";
import {JobState} from "../../shared/jobs";
import {getBuiltinTask} from "../../client/src/lib/builtin-tasks";

const config = require('../lib/config');
const signalStorage = require('./signal-storage');
const indexer = require('../lib/indexers/' + config.indexer);
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const {enforce, filterObject} = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const {IndexingStatus, IndexMethod} = require('../../shared/signals');
const signals = require('./signals');
const signalSets = require('./signal-sets');
const jobs = require('./jobs');
const {SignalSetType} = require('../../shared/signal-sets');
const {parseCardinality, getFieldsetPrefix, resolveAbs} = require('../../shared/param-types-helpers');
const log = require('../lib/log');
const synchronized = require('../lib/synchronized');
const {SignalType, SignalSource} = require('../../shared/signals');
const moment = require('moment');

const handlebars = require('handlebars');

async function listDTAjax(context, sigSetId, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'signalSet', requiredOperations: ['view']}],
        params,
        builder => builder.from('adjacent_jobs')
            .innerJoin('signal_sets_owners', function () {
                this.on('signal_sets_owners.job', '=', 'adjacent_jobs.job').andOn('adjacent_jobs.set', '=', sigSetId);
            })
            .innerJoin('jobs', 'jobs.id', 'signal_sets_owners.job')
            .innerJoin('signal_sets', 'signal_sets.id', 'signal_sets_owners.set'),
        ['signal_sets.id', 'signal_sets.cid', 'signal_sets.name', 'signal_sets.description', 'signal_sets.indexing', 'signal_sets.created', 'jobs.id', 'job.params'],
        {
            mapFun: data => {
                data[4] = JSON.parse(data[4]);
                data[7] = JSON.parse(data[7]);
            }
        }
    );
}

async function createTx(tx, context, sigSetId, params) {
    const intervalInSecs = params.interval;
    const signalSet = tx('signal_sets').where('id', sigSetId).first();
    enforce(signalSet, `Signal set ${sigSetId} not found`);
    const task = getBuiltinTask('aggregation');
    enforce(task, `Aggregation task not found`);
    const job = {
        name: `aggregation_${intervalInSecs}s_${signalSet.cid}`,
        description: `Aggregation for signal set ${signalSet.name} with window ${intervalInSecs} s`,
        namespace: signalSet.namespace,
        task: task.id,
        taskSource: TaskSource.USER,
        state: JobState.ENABLED,
        params: {
            signalSet: sigSetId,
            interval: intervalInSecs
        },
        signal_sets_triggers: [sigSetId],
        trigger: null,
        min_gap: null,
        delay: null
    };

    const jobId = jobs.create(context, job);

    await tx('adjacent_jobs').insert({job: jobId, set: signalSet.id});

    return jobId;
}

async function create(context, entity) {
    return await knex.transaction(async tx => {
        return await createTx(tx, context, entity);
    });
}

async function remove(context, jobId) {
    await knex.transaction(async tx => {
        await jobs.remove(context, jobId);
    });
}

module.exports.hash = hash;
module.exports.listDTAjax = listDTAjax;
module.exports.create = create;
module.exports.createTx = createTx;
module.exports.remove = remove;
module.exports.listDTAjax = listDTAjax;


