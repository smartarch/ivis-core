'use strict';

const knex = require('../lib/knex');
const {getVirtualNamespaceId} = require("../../shared/namespaces");
const {TaskSource, BuildState, TaskType} = require("../../shared/tasks");
const em = require('../lib/extension-manager');

const aggregationTask = {
    name: 'aggregation',
    description: 'Task used by aggregation feature for signal sets',
    type: TaskType.PYTHON,
    settings: {
        params: [{
            "id": "signalSet",
            "type": "signalSet",
            "label": "Signal Set",
            "help": "Signal set to aggregate"
        }, {
            "id": "ts",
            "type": "signal",
            "signalSetRef": "signalSet",
            "label": "Timestamp signal",
            "help": "Timestamp for aggregation"
        }, {
            "id": "interval",
            "type": "number",
            "label": "Interval",
            "help": "Bucket interval in seconds"
        }],
        code: `from ivis import ivis
        
es = ivis.elasticsearch
state = ivis.state
params= ivis.parameters
entities= ivis.entities
owned= ivis.owned

sig_set_cid = params['signalSet']
sig_set = entities['signalSets'][sig_set_cid]
ts = entities['signals'][sig_set_cid][params['ts']]
interval = params['interval']
#offset = params['offset']

if not owned:
  ns = sig_set['namespace']
    
  signals= []
  for cid, signal in entities['signals'][sig_set_cid].items():
    signals.append({
      "cid": signal['cid'],
      "name": signal['name'],
      "description": signal['description'],
      "namespace": signal['namespace'],
      "type": signal['type'],
      "indexed": signal['indexed'],
      "settings": signal['settings']
    })

  state = ivis.create_signal_set(
    f"aggregation_{interval}s_{sig_set_cid}",
    ns,
    f"aggregation_{interval}s_{sig_set_cid}",
    "aggregation with interval {interval}s for signal set {sig_set_cid}",
    None,
    signals)
    
  state['last'] = None
  ivis.store_state(state)
  
if state is not None and state.get('last') is not None:
  last = state['last']
  query_content = {
    "range" : {
      ts['field'] : {
        "gte" : last
      }
    }
  }
  
  es.delete_by_query(index=state['index'], body={
    "query": { 
      "match": {
        state['fields']['ts']: last
      }
    }}
  )
  
else:
  query_content = {'match_all': {}}
# interval is deprecated in the newer elasticsearch, instead fixed_interval should be used
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
        }
      }
    }
  }
}

res = es.search(index=sig_set['index'], body=query)

for hit in res['aggregations']['stats']['buckets']:
  last = hit['key_as_string']
  doc = {
    state['fields']['ts']: last,
    state['fields']['avg']: hit['avg']['value'],
  }
  res = es.index(index=state['index'], doc_type='_doc', body=doc)


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
