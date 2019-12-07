'use strict';


const WizardType = {
    BLANK: 'blank',
    BASIC: 'basic'
};

if (Object.freeze) {
    Object.freeze(WizardType)
}

const wizards = new Map();
wizards.set(WizardType.BASIC, (data) => {
    data.settings = {
        params: [],
        code:
`import sys
import os
import json
from elasticsearch import Elasticsearch

# Get parameters and set up elasticsearch
data = json.loads(sys.stdin.readline())
es = Elasticsearch([{'host': data['es']['host'], 'port': int(data['es']['port'])}])

state = data.get('state')

params= data['params']
entities= data['entities']

sig_set = entities['signalSets'][params['sigSet']]

if state is None or state.get('index') is None:
    ns = sig_set['namespace']

    msg = {}
    msg['type'] = 'sets'
    # Request new signal set creation 
    msg['sigSet'] = {
    "cid" : "test",
    "name" : "test" ,
    "description" : "test" ,
    "namespace" : ns,
    "aggs" :  "0" 
    }

    signals= [] 
    signals.append({
        "cid": "test",
        "name": "test",
       "description": "test",
       "namespace": ns,
        "type": 'raw_double',
        "indexed": False,
        "settings": {}
    })
    msg['sigSet']['signals'] = signals

    ret = os.write(3,(json.dumps(msg) + '\\n').encode())
    state = json.loads(sys.stdin.readline())
    error = state.get('error')
    if error:
      sys.stderr.write(error+"\\n")
      sys.exit(1)

doc = {
    state['fields']['test']: 55
}

res = es.index(index=state['index'], doc_type='_doc', body=doc)

# Request to store config
msg={}
msg['type'] = 'store'
msg['state'] = state
ret = os.write(3,(json.dumps(msg).encode()))
os.close(3)`
    };
});

if (Object.freeze) {
    Object.freeze(wizards);
}

module.exports = {
    wizards,
    WizardType
};
