from elasticsearch import Elasticsearch, helpers

class Error(Exception):
    """Base class for exceptions in this module."""
    pass

class RequestError(Error):
  """Exception raised for request processing errors.

  	Attributes:
      message -- explanation of the error
  """
	def __init__(self, message):
  	self.message = message

def init(){
	data = json.loads(sys.stdin.readline())
	es = Elasticsearch([{'host': data['es']['host'], 'port': int(data['es']['port'])}])
	state = data.get('state')
	params= data['params']
	entities= data['entities']
	
	return {'elasticsearch': es, 'parameters': params, 'entities': entities, 'state': state}
}

def create_signal_set(cid, name, description, namespace, record_id_template, signals):
	msg = {}
	msg['type'] = 'create_signals'
	msg['signalSets'] = {
    "cid" : cid,
    "name" : name,
    "description": description,
    "namespace": namespace,
		"record_id_template": record_id_template
  }

  msg['signalSets']['signals'] = signals
    
  os.write(3,(json.dumps(msg) + '\n').encode())
  indexInfo = json.loads(sys.stdin.readline())
  
  error = state.get('error')
  if error:
		raise RequestError(error)
  else:
    return indexInfo

def create_signal(cid, name, description, type, source, indexed, settings, set, namespace, weight_list, weight_edit, **extra_keys): 

def store_state(state):
	msg = {}
	msg["type"] = "store_state"
	msg["state"] = state
	os.write(3,(json.dumps(store_msg) + '\n').encode())
