'use strict';

const knex = require('../lib/knex');
const path = require('path');
const fs = require('fs-extra-promise');
const {getVirtualNamespaceId} = require("../../shared/namespaces");
const {TaskSource, BuildState, TaskType, PYTHON_BUILTIN_CODE_FILE_NAME} = require("../../shared/tasks");
const em = require('../lib/extension-manager');
const arima = require('./arima/arima.js');
const neural_networks = require('./neural_networks/neural-networks-tasks');

// code is loaded from file

const aggregationTask = {
    name: 'aggregation',
    description: 'Task used by aggregation feature for signal sets',
    type: TaskType.PYTHON,
    settings: {
        builtin_reinitOnUpdate: true,
        params: [{
            "id": "signalSet",
            "type": "signalSet",
            "label": "Signal Set",
            "help": "Signal set to aggregate",
            "includeSignals": true
        }, {
            "id": "ts",
            "type": "signal",
            "signalSetRef": "signalSet",
            "label": "Timestamp signal",
            "help": "Timestamp for aggregation"
        }, {
            "id": "offset",
            "type": "string",
            "label": "Offset",
            "help": "Since when should aggregation be done"
        }, {
            "id": "interval",
            "type": "string",
            "label": "Interval",
            "help": "Bucket interval"
        }],
    },
};

const rmseTask = {
    name: 'RMSE',
    description: '',
    type: TaskType.PYTHON,
    settings: {
        params: [
            {
                "id": "obs_index",
                "type": "signalSet",
                "label": "Observations Signal Set",
                "help": "",
                "includeSignals": true
            },
            {
                "id": "ts_field",
                "type": "signal",
                "signalSetRef": "obs_index",
                "label": "Timestamp signal",
                "help": ""
            },
            {
                "id": "value_field",
                "type": "signal",
                "signalSetRef": "obs_index",
                "label": "Value signal",
                "help": ""
            },
            {
                "id": "pred_index",
                "type": "signalSet",
                "label": "Predictions Signal Set",
                "help": "",
                "includeSignals": true
            },
        ],
        code: `
from ivis import ivis
import ivis_ts as ts

es = ivis.elasticsearch
state = ivis.state
cfg = ivis.params
entities= ivis.entities

#cfg['ts_field'] = 'ts'
#cfg['value_field'] = 's1'

cfg['ts_start'] = '2017-01-01'
cfg['ts_end'] = '2018-01-01'

# obs reader
obs_reader = ts.TsReader(cfg['obs_index'], cfg['ts_field'], cfg['value_field'], from_ts=cfg['ts_start'], to_ts=['ts_end'])
obs_reader = ts.DummyReader(obs_reader.read())
# pred reader
pred_reader = ts.TsReader(cfg['pred_index'], 'ts', 'predicted_value', from_ts=cfg['ts_start'], to_ts=['ts_end'])
pred_reader = ts.DummyReader(pred_reader.read())

# RMSE
rmse = ts.RMSE(obs_reader, pred_reader)
value = rmse.calculate()

print(value)
`,
    }
}

const flattenTask = {
    name: 'Flatten',
    description: 'Task will combine specified signals into single signal set and resolve conflicts on the same time point with the chosen method',
    type: TaskType.PYTHON,
    settings: {
        builtin_reinitOnUpdate: true,
        params: [
            {
                "id": "resolutionMethod",
                "type": "option",
                "label": "Resolution method",
                "help": "Conflict resolution method",
                "options": [
                    {
                        "key": "avg",
                        "label": "Avarage"
                    },
                    {
                        "key": "min",
                        "label": "Minimum"
                    },
                    {
                        "key": "max",
                        "label": "Maximum"
                    }
                ]
            },
            {
                "id": "sets",
                "label": "Signal sets",
                "help": "Signal sets to flatten",
                "type": "fieldset",
                "cardinality": "2..n",
                "children": [
                    {
                        "id": "cid",
                        "label": "Signal set",
                        "type": "signalSet"
                    },
                    {
                        "id": "ts",
                        "type": "signal",
                        "label": "Timestamp",
                        "cardinality": "1",
                        "signalSetRef": "cid"
                    },
                    {
                        "id": "signals",
                        "type": "signal",
                        "label": "Signals",
                        "cardinality": "1..n",
                        "signalSetRef": "cid"
                    }
                ]
            },
            {
                "id": "signalSet",
                "label": "New signal set properties",
                "help": "Resulting signal set",
                "type": "fieldset",
                "cardinality": "1",
                "children": [
                    {
                        "id": "cid",
                        "label": "CID",
                        "type": "string",
                        "isRequired": true
                    },
                    {
                        "id": "namespace",
                        "label": "Namespace",
                        "help": "id of namespace",
                        "type": "number"
                    },
                    {
                        "id": "name",
                        "label": "Name",
                        "type": "string"
                    },
                    {
                        "id": "description",
                        "label": "Description",
                        "type": "string"
                    }
                ]
            }
        ],
    },
};

const arimaTask = arima.arimaTask;

/**
 * All default builtin tasks
 */
const builtinTasks = [
    aggregationTask,
    flattenTask,
    arimaTask,
    rmseTask,
    ...neural_networks.tasks,
];

em.on('builtinTasks.add', addTasks);

async function getBuiltinTask(name) {
    return await knex.transaction(async tx => {
        return await checkExistence(tx, name)
    });
}

/**
 * Check if builtin in task with given name already exists
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
async function updateBuiltinTask(tx, id, builtinTask, reinit = false) {
    const task = {...builtinTask};
    task.source = TaskSource.BUILTIN;
    task.namespace = getVirtualNamespaceId();
    task.settings = JSON.stringify(task.settings);
    if (reinit) {
        task.build_state = BuildState.UNINITIALIZED;
    }
    await tx('tasks').where('id', id).update(task);
}

/**
 * Check if all default builtin tasks are in the system / set them to default state
 * @return {Promise<void>}
 */
async function storeBuiltinTasks() {
    const tasks = [];
    for (const builtinTask of builtinTasks) {
        const task = {...builtinTask}
        if (builtinTask.settings.code == null) {
            // WARN mutating defaults
            builtinTask.settings.code = await getCodeForBuiltinTask(builtinTask.name);
        }
    }
    await addTasks(tasks);
}

async function getCodeForBuiltinTask(taskName) {
    const builtinCodeFile = path.join(__dirname, '..', 'builtin-files', taskName, PYTHON_BUILTIN_CODE_FILE_NAME);
    const hasCode = await fs.existsAsync(builtinCodeFile);
    if (hasCode) {
        return await fs.readFileAsync(builtinCodeFile, 'utf-8')
    }
    return '';
}

/**
 * Add given tasks as builtin tasks
 * @param tasks
 * @return {Promise<void>}
 */
async function addTasks(tasks,) {
    if (!Array.isArray(tasks)) {
        tasks = [tasks];
    }

    for (const task of tasks) {
        await knex.transaction(async tx => {
            const exists = await checkExistence(tx, task.name);
            if (!exists) {
                await addBuiltinTask(tx, task);
            } else {
                const reinit = (task.settings.builtin_reinitOnUpdate === true)
                delete task.settings.builtin_reinitOnUpdate;
                await updateBuiltinTask(tx, exists.id, task, reinit);
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
