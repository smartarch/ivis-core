'use strict';

const knex = require('../lib/knex');
const {getVirtualNamespaceId} = require("../../shared/namespaces");
const {TaskSource, BuildState, TaskType} = require("../../shared/tasks");
const em = require('../lib/extension-manager');
const taskHandler = require('../lib/task-handler');

const aggregationTask = {
    name: 'aggregation',
    description: '',
    type: TaskType.PYTHON,
    settings: {
        params: [],
        code: `print('aggs')`
    },
};

const builtinTasks = [
    aggregationTask
];

/*
Sample builtin task:
'id': {
    name: 'XXX',
    params: []
}
 */

em.on('builtinTasks.add', addTasks);

async function checkExistence(tx, name) {
    return await tx('tasks').where({
        source: TaskSource.BUILTIN,
        name: name
    }).first();
}

async function addBuiltinTask(tx, builtinTask) {
    const task = {...builtinTask};
    task.source = TaskSource.BUILTIN;
    task.namespace = getVirtualNamespaceId();
    task.settings = JSON.stringify(task.settings);
    task.build_state= BuildState.UNINITIALIZED;
    await tx('tasks').insert(task);
}

async function updateBuiltinTask(tx, id, builtinTask) {
    const task = {...builtinTask};
    task.source = TaskSource.BUILTIN;
    task.namespace = getVirtualNamespaceId();
    task.settings = JSON.stringify(task.settings);
    await tx('tasks').where('id', id).update({...task, build_state: BuildState.UNINITIALIZED});
}

async function storeBuiltinTasks() {
    for (const task of builtinTasks) {
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

async function addTasks(tasks) {
    if (!Array.isArray(tasks)) {
        tasks = [tasks];
    }

    for (const task of tasks) {
        await knex.transaction(async tx => {
            await addBuiltinTask(tx, task);
        });
    }
}

async function list() {
    const tasks = await knex('tasks').where({source: TaskSource.BUILTIN});
    tasks.forEach(task => task.settings = JSON.parse(task.settings));
    return tasks;
}

module.exports.list = list;
module.exports.storeBuiltinTasks = storeBuiltinTasks;
