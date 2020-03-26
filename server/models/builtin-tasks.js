'use strict';

const knex = require('../lib/knex');
const {getVirtualNamespaceId} = require("../../shared/namespaces");
const {TaskSource, BuildState, TaskType} = require("../../shared/tasks");
const em = require('../lib/extension-manager');

const aggregationTask = {
    name: 'aggregation',
    description: '',
    type: TaskType.PYTHON,
    settings: {
        params: [{
            "id": "signalSet",
            "help": "Signal set to aggregate",
            "type": "signalSet",
            "label": "Signal Set"
        },{
            "id": "interval",
            "help": "Bucket interval in seconds",
            "type": "number",
            "label": "Interval"
        }],
        code: `print('aggs')`
    },
};

/**
 * All default builtin tasks
 */
const builtinTasks = [
    aggregationTask
];


em.on('builtinTasks.add', addTasks);

async function getBuiltinTask(name) {
    return await knex.transaction(async tx => {
        return await checkExistence(tx, name)
    });
};

/**
 * Check if builtin in task with fiven name alredy exists
 * @param tx
 * @param name
 * @return {Promise<any>} undefined if not found, found task otherwise
 */
async function checkExistence(tx, name) {
    return await tx('tasks').where({
        source: TaskSource.BUILTIN,
        name: name
    }).first();
}

/**
 * Store given task as a builtin task to system
 * @param tx
 * @param builtinTask task to add
 * @return {Promise<void>}
 */
async function addBuiltinTask(tx, builtinTask) {
    const task = {...builtinTask};
    task.source = TaskSource.BUILTIN;
    task.namespace = getVirtualNamespaceId();
    task.settings = JSON.stringify(task.settings);
    task.build_state = BuildState.UNINITIALIZED;
    await tx('tasks').insert(task);
}

/**
 * Update existing task
 * @param tx
 * @param id of existing task
 * @param builtinTask columns being updated
 * @return {Promise<void>}
 */
async function updateBuiltinTask(tx, id, builtinTask) {
    const task = {...builtinTask};
    task.source = TaskSource.BUILTIN;
    task.namespace = getVirtualNamespaceId();
    task.settings = JSON.stringify(task.settings);
    await tx('tasks').where('id', id).update({...task, build_state: BuildState.UNINITIALIZED});
}

/**
 * Check if all default builtin tasks are in the system / set them to default state
 * @return {Promise<void>}
 */
async function storeBuiltinTasks() {
    await addTasks(builtinTasks);
}

/**
 * Add given tasks as builtin tasks
 * @param tasks
 * @return {Promise<void>}
 */
async function addTasks(tasks) {
    if (!Array.isArray(tasks)) {
        tasks = [tasks];
    }

    for (const task of tasks) {
        await knex.transaction(async tx => {
            const exists = await checkExistence(tx, task.name);
            if (!exists) {
                await addBuiltinTask(tx, task);
            } else {
                await updateBuiltinTask(tx, exists.id, task);
            }
        });
    }
}

/**
 * List all builtin tasks currently in the system
 * @return {Promise<any>}
 */
async function list() {
    const tasks = await knex('tasks').where({source: TaskSource.BUILTIN});
    tasks.forEach(task => task.settings = JSON.parse(task.settings));
    return tasks;
}

module.exports.list = list;
module.exports.storeBuiltinTasks = storeBuiltinTasks;
module.exports.getBuiltinTask = getBuiltinTask;
