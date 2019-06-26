"use strict";
const {TaskType, BuildState} = require('../../../shared/tasks');
const {JobState} = require('../../../shared/jobs');

exports.seed = (knex, Promise) => (async () => {
    const settings = [];
    settings.push({
        params: [
            {
                "id": "sigSet",
                "help": "Signal set for the sensors",
                "type": "signalSet",
                "label": "Signal Set"
            },
            {
                "id": "ts",
                "help": "Timestamp order is based on",
                "type": "signal",
                "label": "Timestamp",
                "cardinality": "1",
                "signalSetRef": "sigSet"
            },
            {
                "id": "source",
                "help": "Source of values",
                "type": "signal",
                "label": "Source of value",
                "cardinality": "1",
                "signalSetRef": "sigSet"
            },
            {
                "id": "window",
                "help": "Mean window",
                "type": "number",
                "label": "Mean window"
            }
        ],
        code:
            `import sys
import os
import json
from elasticsearch import Elasticsearch, helpers
from collections import deque

# Get parameters and set up elasticsearch
data = json.loads(sys.stdin.readline())
es = Elasticsearch([{'host': data['es']['host'], 'port': int(data['es']['port'])}])

state = data.get('state')

params= data['params']
entities= data['entities']

# Task parameters' values
# from params we get cid of signal/signal set and from according key in entities dictionary 
# we can access data for that entity (like es index or namespace)
source = entities.signals[params['source']]
sig_set = entities.signalSets[params['sigSet']]
ts = entities.signals[params['ts']]
window = int(params['window'])

values = []
if state is not None:
  values = state.get("values") if state.get("values") else []
queue = deque(values, maxlen=window)

if state is None or state.get('index') is None:
    ns = sig_set.namespace
  
    msg = {}
    msg['type'] = 'sets'
    # Request new signal set creation 
    msg['sigSet'] = {
    "cid" : "moving_average",
    "name" : "moving average" ,
    "namespace": ns,
    "description" : "moving average" ,
    "aggs" :  "0" 
    }

    signals= [] 
    signals.append({
        "cid": "mean",
        "name": "mean",
       "description": "mean",
       "namespace": ns,
        "type": "raw_double",
        "indexed": False,
        "settings": {}
    })
    msg['sigSet']['signals'] = signals

    ret = os.write(3,json.dumps(msg) + '\\n')
    state = json.loads(sys.stdin.readline())
    error = state.get('error')
    if error:
      sys.stderr.write(error+"\\n")
      sys.exit(1)
    
last = None
if state is not None and state.get('last') is not None:
  last = state['last']
  query_content = {
    "range" : {
      ts.field : {
        "gt" : last
      }
    }
  }
else:
  query_content = {'match_all': {}}

query = {
    'size': 10000,
    '_source': [source.field, ts.field],
    'sort': [{ts.field: 'asc'}],
    'query': query_content
}

results = helpers.scan(es,
                       preserve_order=True,
                       query=query,
                       index=sig_set.index
                       )

i = 0
for item in results:
  last = item["_source"][ts.field]
  val = item["_source"][source.field]
  if val is not None:
    queue.append(val)
  else:
    continue
  if i < (window-1):
    i += 1
  else:
    mean = sum(queue) / float(window)
    doc = {
      state['fields']['mean']: mean 
    }
    res = es.index(index=state['index'], doc_type='_doc', body=doc)

state["last"] = last
state["values"] = list(queue)
# Request to store state
msg = {}
msg["type"] = "store"
msg["state"] = state
ret = os.write(3,json.dumps(msg))
os.close(3)`
    });

    // Aggregation task
    settings.push({
        params: [
            {
                "id": "sigSet",
                "help": "Signal set for the sensors",
                "type": "signalSet",
                "label": "Signal Set"
            },
            {
                "id": "ts",
                "help": "Timestamp aggregation is based on",
                "type": "signal",
                "label": "Timestamp",
                "cardinality": "1",
                "signalSetRef": "sigSet"
            },
            {
                "id": "source",
                "help": "Source of values",
                "type": "signal",
                "label": "Source of value",
                "cardinality": "1",
                "signalSetRef": "sigSet"
            },
            {
                "id": "interval",
                "help": "interval in minutes",
                "type": "number",
                "label": "Interval in minutes"
            }
        ],
        code:
`import sys
import os
import json
from elasticsearch import Elasticsearch, helpers

# Get parameters and set up elasticsearch
data = json.loads(sys.stdin.readline())
es = Elasticsearch([{'host': data['es']['host'], 'port': int(data['es']['port'])}])

state = data.get('state')

params= data['params']
entities= data['entities']

source = entities.signals[params['source']]
sig_set = entities.signalSets[params['sigSet']]
ts = entities.signals[params['ts']]
interval = params['interval']

if state is None or state.get('index') is None:
    ns = sig_set.namespace
  
    msg = {}
    msg['type'] = 'sets'
    # Request new signal set creation 
    msg['sigSet'] = {
    "cid" : "aggs",
    "name" : "aggs" ,
    "namespace": ns,
    "description" : "aggs" ,
    "aggs" :  "0" 
    }
    

    signals= []
    signals.append({
        "cid": "ts",
        "name": "Timestamp",
       "description": "Interval timestamp",
       "namespace": ns,
        "type": "raw_date",
        "indexed": False,
        "settings": {}
    })
    signals.append({
        "cid": "min",
        "name": "min",
       "description": "min",
       "namespace": ns,
        "type": "raw_double",
        "indexed": False,
        "settings": {}
    })
    signals.append({
        "cid": "avg",
        "name": "avg",
       "description": "avg",
       "namespace": ns,
        "type": "raw_double",
        "indexed": False,
        "settings": {}
    })
    signals.append({
        "cid": "max",
        "name": "max",
       "description": "max",
       "namespace": ns,
        "type": "raw_double",
        "indexed": False,
        "settings": {}
    })
    msg['sigSet']['signals'] = signals

    ret = os.write(3,json.dumps(msg) + '\\n')
    state = json.loads(sys.stdin.readline())
    error = state.get('error')
    if error:
      sys.stderr.write(error+"\\n")
      sys.exit(1)

last = None
if state is not None and state.get('last') is not None:
  last = state['last']
  query_content = {
    "range" : {
      ts.field : {
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

query = {
    'size': 0,
    'query': query_content,
    "aggs": {
      "stats": {
        "date_histogram": {
          "field": ts.field,
          "interval": interval+"m"
        },
        "aggs": {
          "avg": {
            "avg": {
              "field": source.field
            }
          },
          "max": {
            "max" : {
              "field": source.field
            }
          },
          "min": {
            "min" : {
              "field": source.field
            }
          }
        }
      }
    }
  }

res = es.search(index=sig_set.index, body=query)

for hit in res['aggregations']['stats']['buckets']:
  last = hit['key_as_string']
  doc = {
    state['fields']['ts']: last,
    state['fields']['min']: hit['min']['value'],
    state['fields']['avg']: hit['avg']['value'],
    state['fields']['max']: hit['max']['value']
  }
  res = es.index(index=state['index'], doc_type='_doc', body=doc)

# Request to store state
msg={}
msg={"type": "store"}
state['last'] = last
msg["state"] = state
ret = os.write(3,json.dumps(msg))
os.close(3)`
    });


    await knex('tasks').insert({
        id: 1,
        name: 'Moving average',
        description: ' Moving average',
        type: TaskType.PYTHON,
        settings: JSON.stringify(settings[0]),
        build_state: BuildState.UNINITIALIZED,
        namespace: 1
    });

    await knex('tasks').insert({
        id: 2,
        name: 'Aggregation',
        description: 'Aggregation',
        type: TaskType.PYTHON,
        settings: JSON.stringify(settings[1]),
        build_state: BuildState.UNINITIALIZED,
        namespace: 1
    });

    const params1 = {
        sigSet: 'process1',
        ts: 'ts',
        source: 's1',
        window: 3
    };

    await knex('jobs').insert({
        id: 1,
        name: 'Mean1',
        description: 'Mean1',
        task: 1,
        state: JobState.ENABLED,
        params: JSON.stringify(params1),
        namespace: 1
    });

    const params2 = {
        sigSet: 'process2',
        ts: 'ts',
        source: 's2',
        interval: '60'
    };

    await knex('jobs').insert({
        id: 2,
        name: 'Aggs',
        description: 'Aggs',
        task: 2,
        state: JobState.ENABLED,
        params: JSON.stringify(params2),
        namespace: 1
    });

})();
