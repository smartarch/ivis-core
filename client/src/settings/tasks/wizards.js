'use strict';
import {TaskType} from "../../../../shared/tasks";

const WizardType = {
    BLANK: 'blank',
    BASIC: 'basic'
};

if (Object.freeze) {
    Object.freeze(WizardType)
}

const apiShowcaseFn = (data) => {
    data.settings = {
        params:
            [
                {
                    "id": "sigSet",
                    "help": "Signal set showcase",
                    "type": "signalSet",
                    "label": "Signal Set"
                },
                {
                    "id": "value",
                    "help": "showcase value",
                    "type": "string",
                    "label": "value"
                },
                {
                    "id": "value",
                    "label": "value",
                    "type": "signal",
                    "signalSetRef": "sigSet"
                },
                {
                    "id": "ts",
                    "label": "ts",
                    "type": "signal",
                    "signalSetRef": "sigSet"
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

print('Data:')
print(json.dumps(data, indent=2))
print()

state = data.get('state')

params= data['params']
entities= data['entities']

sigSet = params['sigSet']
value_sig = params['value']
ts_sig = params['ts']

#print('State:')
#print(json.dumps(state, indent=2))
#print()

#print('Params:')
#print(json.dumps(params, indent=2))
#print()

#print('Entities:')
#print(json.dumps(entities, indent=2))
#print()


if state is None or state.get('index') is None:
  ns = entities['signalSets'][sigSet]['namespace']

  msg = {}
  msg['type'] = 'sets'
  # Request new signal set creation 
  msg['sigSet'] = {
  "cid" : "api_set",
  "name" : "API test" ,
  "namespace": ns,
  "description" : "API test" ,
  }

  signals= []
  signals.append({
    "cid": "api_signal",
    "name": "showcase signal",
   "description": "api showcase signal",
   "namespace": ns,
    "type": "text",
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
  else:
    store_msg = {}
    store_msg["type"] = "store"
    store_msg["state"] = state
    ret = os.write(3,(json.dumps(store_msg) + '\\n').encode())


# FILES
#with open('../files/test.txt', 'r') as file: 
#  lines = file.readlines()
#  value = lines[0].strip()
#  print('File:')
#  print(value)
#  print()

# Elasticsearch reading
val_field = entities['signals'][sigSet][value_sig]['field']
ts_field = entities['signals'][sigSet][ts_sig]['field']

query = {
   'size': 1,
   '_source': val_field,
   'sort': [{ts_field: 'desc'}],
   'query': {
      "match_all": {}
   }
}

index = entities['signalSets'][sigSet]['index']
results = es.search(index=index, body=query)
value = results['hits']['hits'][0]['_source'][val_field] if results['hits']['total'] > 0 else 'not found'

print('ES reading:')
print(value)
print()



# Elasticsearch indexing
doc = {
  state['fields']['api_signal']: value
}
res = es.index(index=state['index'], doc_type='_doc', body=doc)


os.close(3)`
    };
};

const apiShowcase = {
    label: 'Api Showcase',
    wizard: apiShowcaseFn
};

const blank = {
    label: 'Blank',
    wizard: (data)=>{
        data.settings = {
            params: [],
            code: ''
        };
    }
};

const wizards = {};

wizards[TaskType.PYTHON] = {
    [WizardType.BLANK]: blank,
    [WizardType.BASIC]: apiShowcase
};
wizards[TaskType.NUMPY] = {
    ...wizards[TaskType.PYTHON]
};
wizards[TaskType.ENERGY_PLUS] = {
    ...wizards[TaskType.PYTHON]
};

if (Object.freeze) {
    Object.freeze(wizards);
}

function getWizardsForType(taskType) {
    return wizards[taskType] ? wizards[taskType] : null;
}

function getWizard(taskType, wizardType) {
    const wizardsForType = getWizardsForType(taskType);
    return wizardsForType ? wizardsForType[wizardType] : null;
}

export {
    WizardType,
    getWizard,
    getWizardsForType
};
