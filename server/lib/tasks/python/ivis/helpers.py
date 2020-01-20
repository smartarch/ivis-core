import json
import os
import sys
import select

from .exceptions import *

from elasticsearch import Elasticsearch


def init():
    """Initializes IVIS library"""
    # Check input availability
    r, w, e = select.select([sys.stdin], [], [], 5)
    if r:
        return Ivis()
    else:
        raise TimeoutException('No init data on standard input, ivis can\'t be initialized')


class Ivis:
    """Helper class for ivis tasks"""

    def __init__(self):
        self._data = json.loads(sys.stdin.readline())
        self._elasticsearch = Elasticsearch([{'host': self._data['es']['host'], 'port': int(self._data['es']['port'])}])
        self.state = self._data.get('state')
        self.parameters = self._data['params']
        self.entities = self._data['entities']

    @property
    def elasticsearch(self):
        return self._elasticsearch

    @staticmethod
    def _get_response_message():
        msg = json.loads(sys.stdin.readline())
        error = msg.get('error')
        if error:
            raise RequestException(error)
        return msg

    @staticmethod
    def _send_request_message(msg):
        os.write(3, (json.dumps(msg) + '\n').encode())

    @staticmethod
    def create_signal_set(cid, namespace, name=None, description=None, record_id_template=None, signals=None):
        if cid is None or namespace is None:
            raise RequestException('cid and namespace can\'t be None')

        msg = {
            'type': 'create_signals',
        }

        signal_set = {
            "cid": cid,
            "namespace": namespace
        }

        if name is not None:
            signal_set["name"] = name
        if description is not None:
            signal_set["description"] = description
        if record_id_template is not None:
            signal_set["record_id_template"] = record_id_template
        if signals is not None:
            signal_set['signals'] = signals

        msg['signalSets'] = signal_set

        Ivis._send_request_message(msg)
        return Ivis._get_response_message()

    @staticmethod
    def create_signal(self, cid, name, description,
                      signal_type, source, indexed,
                      settings, signal_set, namespace,
                      weight_list, weight_edit, **extra_keys):
        pass

    @staticmethod
    def store_state(state):
        msg = {
            "type": "store_state",
            "state": state
        }

        Ivis._send_request_message(msg)
        return Ivis._get_response_message()
