import sys
import os
import json
from datetime import datetime, timedelta

import requests
import subprocess
import pathlib
from elasticsearch import Elasticsearch, helpers
    
from eppy import modeleditor
from eppy.modeleditor import IDF
idd_file = "/usr/local/Energy+.idd"
IDF.setiddname(idd_file)

from io import StringIO
import time
    
# Get parameters and set up elasticsearch
data = json.loads(sys.stdin.readline())
es = Elasticsearch([{'host': data['es']['host'], 'port': int(data['es']['port'])}], timeout=120)

state = data.get('state')
if state is None:
  state= {}

params= data['params']
entities= data['entities']

# BODY ==================================================================
api_url_base = 'https://deksoft.eu/api'
api_url_login = f'{api_url_base}/login'
api_url_file = f'{api_url_base}/meteo-file'

occ = params['occ']
mod = params['mod']

username = ''
password = ''
 
current_date = datetime.now()
 
login_result = requests.post(api_url_login, data = {'username':username, 'password': password})
acc_info = login_result.json()

acc_key = acc_info['accessKey']
key_param = f'access_key={acc_key}'

url_epw = api_url_epw_file = f'{api_url_file}?{key_param}&action=epw'
epw_result = requests.get(url_epw, timeout=90)


if epw_result.status_code != 200 :
  sys.stderr.write(f"Weather file couldn't be downloaded, code {epw_result.status_code}")
  exit(1)

model_dir = f'occ{occ}_mod{mod}'
os.makedirs(f'{model_dir}', exist_ok=True)
with open(f'{model_dir}/weather.epw', 'wb') as f:
  f.write(epw_result.content)

start = time.time()
if state is None or state.get('index') is None:
  ns = 1

  msg = {}
  msg['type'] = 'sets'
  # Request new signal set creation 
  msg['sigSet'] = {
  "cid" : f"energy_plus_{mod}_{occ}",
  "name" : f"EnergyPlus mod{mod} occ{occ}" ,
  "namespace": ns,
  "description" : f"EnergyPlus calculation for mod {mod} and occ {occ}" ,
  "aggs" :  "0" 
  }

  signals= []
  signals.append({
    "cid": "date",
    "name": "date",
   "description": "date and time",
   "namespace": ns,
    "type": "date",
    "indexed": False,
    "settings": {}
  })
  signals.append({
    "cid": "temperature",
    "name": "temperature",
    "description": "Mean Air Temperature [C]",
    "namespace": ns,
    "type": "double",
    "indexed": False,
    "settings": {}
  })
  signals.append({
    "cid": "humidity",
    "name": "humidity",
   "description": "Air Relative Humidity [%]",
   "namespace": ns,
    "type": "double",
    "indexed": False,
    "settings": {}
  })
  signals.append({
    "cid": "co2",
    "name": "co2",
   "description": "Air CO2 Concentration [ppm]",
   "namespace": ns,
    "type": "double",
    "indexed": False,
    "settings": {}
  })
  msg['sigSet']['signals'] = signals

  ret = os.write(3,(json.dumps(msg) + '\n').encode())
  state = json.loads(sys.stdin.readline())
  
  error = state.get('error')
  if error:
    sys.stderr.write(error+"\n")
    sys.exit(1)
else: 
  #clean up before calculation
  es.delete_by_query(index=state['index'],request_timeout=60,body={"query" :{
    "match_all": {}
# Possible incremental delete
#    "range" : {
#      state['fields']['date']: {
#        "gte": current_date.date()
#      }
#    }
  }})

url = f'{api_url_file}?{key_param}&action=idf&occ={occ}&mod={mod}'
idf_result = requests.get(url, timeout=90)

if idf_result.status_code != 200 :
  sys.stderr.write(f"IDF file couldn't be downloaded, code {idf_result.status_code}")
  exit(1)

# Edit idf file date
idf = IDF(StringIO(idf_result.text))
period =  idf.idfobjects["RunPeriod"][0]

last =  state.get('last_run') or {}
# Part of incremental update
#period.Begin_Day_of_Month = last.get('day') or 1
#period.Begin_Month = last.get('month') or 1
#period.Begin_Year = last.get('year') or current_date.year

period.Begin_Day_of_Month =   1
period.Begin_Month =   11
period.Begin_Year =   current_date.year

# last run will be used in possible incremental implementation, next start will be -1 day?
state['last_run']= {}
to_date = current_date + timedelta(days=1)
state['last_run']['day'] = period.End_Day_of_Month =  to_date.day
state['last_run']['month'] = period.End_Month =  to_date.month
state['last_run']['year'] = period.End_Year = to_date.year

# Save to file
idf.saveas(f'{model_dir}/input.idf')
subprocess.run(['/usr/local/energyplus', '-w', r'weather.epw', 'input.idf'],cwd=f'{model_dir}')

# Generator for computed values
def iterResults():
  if not pathlib.Path(f'{model_dir}/eplusout.eso').exists():
    sys.stderr.write(f"File eplusout.eso not found.")
    exit(1)
    
  with open(f'{model_dir}/eplusout.eso', 'r') as f:
    # Skip dictionary segment
    while True:
      line = f.readline()
      if not line:
        sys.stderr.write(f"File eplusout.eso is not in corrrect format.")
        exit(1)
      else:
        line=line.strip()
      
      if line=='End of Data Dictionary':
        break;
        
    # Get values
    doc_source=None
    date=None
    while True:
      line = f.readline()
      
      if not line:
        break
      
      line=line.strip()
      if line=='End of Data':
        break;
      
      line_data = line.split(',')
      if line_data[0]=='2':
         # new data block

        if doc_source is not None:
          yield {
            "_index": state['index'],
            "_type": '_doc',
            "_id":  date,
            "_source": doc_source
          }

          
        ## VALUES IN ORDER
        #Day of Simulation[]
        month= '{:02d}'.format(int(line_data[2]))#Month[]
        day = '{:02d}'.format(int(line_data[3])) #Day of Month[]
        #DST Indicator[1=yes 0=no]
        hour='{:02d}'.format(int(line_data[5])-1)#Hour[]  #-1 is here because for some reason (DST?) hours start on 1 not 0 
        start_min=line_data[6]#StartMinute[]
        end_min=line_data[7]#EndMinute[]
        #DayType
        
        #custom values
        min = '{:02d}'.format(int((float(start_min) + float(end_min)) / 2)) # TODO separate seconds
        year = current_date.year
        date=f'{year}-{month}-{day}T{hour}:{min}:00.000Z'
        doc_source = {
          state['fields']['date']: date
        }
         
      elif line_data[0]=='118': #Temperature
        doc_source[state['fields']['temperature']]= line_data[1]
      elif line_data[0]=='205': #Humidity
        doc_source[state['fields']['humidity']]= line_data[1]
      elif line_data[0]=='206': #CO2
        doc_source[state['fields']['co2']]= line_data[1]

helpers.bulk(es, iterResults())

msg = {}
msg["type"] = "store"
msg["state"] = state
ret = os.write(3,(json.dumps(msg).encode()))
os.close(3)
