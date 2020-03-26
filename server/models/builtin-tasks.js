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
        code: `import sys
import os
import json

from ivis import init

ivis = init()

es = ivis.elasticsearch
state = ivis.state

params= ivis.parameters
entities= ivis.entities

sig_set = entities['signalSets'][params['sigSet']]
ts = entities['signals'][params['sigSet']][params['ts']]
source = entities['signals'][params['sigSet']][params['source']]
interval = params['interval']

if state is None or state.get('aggs') is None:
  ns = sig_set['namespace']

  signals= []
  signals.append({
    "cid": "ts",
    "name": "Timestamp",
    "description": "Interval timestamp",
    "namespace": ns,
    "type": "date",
    "indexed": False,
    "settings": {}
  })
  signals.append({
    "cid": "min",
    "name": "min",
    "description": "min",
    "namespace": ns,
    "type": "double",
    "indexed": False,
    "settings": {}
  })
    signals.append({
    "cid": "avg",
    "name": "avg",
    "description": "avg",
    "namespace": ns,
    "type": "double",
    "indexed": False,
    "settings": {}
  })
  signals.append({
    "cid": "max",
    "name": "max",
    "description": "max",
    "namespace": ns,
    "type": "double",
    "indexed": False,
    "settings": {}
  })
  
  state = ivis.create_signal_set("aggs",ns,"aggregation", "aggregation", None, signals)
    
  ivis.store_state(state)

last = None
if state is not None and state.get('last') is not None:
  last = state['last']
  query_content = {
    "range" : {
      ts['field'] : {
        "gte" : last
      }
    }
  }
  
  es.delete_by_query(index=state['aggs']['index'], body={
    "query": { 
      "match": {
        state['aggs']['fields']['ts']: last
      }
    }}
  )
  
else:
  query_content = {'match_all': {}}

query = {
  'size': 0,
  'query': query_content,
  "aggs": {
    "stats": {
      "date_histogram": {
        "field": ts['field'],
        "interval": interval+"s"
      },
      "aggs": {
        "avg": {
          "avg": {
            "field": source['field']
          }
        },
        "max": {
          "max" : {
            "field": source['field']
          }
        },
        "min": {
          "min" : {
            "field": source['field']
          }
        }
      }
    }
  }
}

res = es.search(index=sig_set['index'], body=query)

for hit in res['aggregations']['stats']['buckets']:
  last = hit['key_as_string']
  doc = {
    state['aggs']['fields']['ts']: last,
    state['aggs']['fields']['min']: hit['min']['value'],
    state['aggs']['fields']['avg']: hit['avg']['value'],
    state['aggs']['fields']['max']: hit['max']['value']
  }
  res = es.index(index=state['aggs']['index'], doc_type='_doc', body=doc)

# Request to store state
state['last'] = last
ivis.store_state(state)`
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
}

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
