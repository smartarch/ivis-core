#!/usr/bin/env python3

import unittest

from elasticsearch import Elasticsearch

from _rw import (UniTsAggReader, UniTsReader, format_date,
                 test_get_elasticsearch)

test_index_name = "test_ivis_ts_unittest"


def generate_data(count: int = 100):
    import pendulum
    start_ts = pendulum.datetime(2000, 1, 1)
    delta = pendulum.duration(days=1)

    timestamps = [start_ts+i*delta for i in range(count)]
    values = [x**2 for x in range(count)]

    output = []

    for ts, val in zip(timestamps, values):
        output.append({
            'ts': format_date(ts),
            'value': val,
        })

    return output


def cleanup_test_data():
    es = Elasticsearch()

    try:  # index might already exist
        es.indices.delete(test_index_name)
    except Exception:
        pass


def upload_test_data():
    es = Elasticsearch()

    cleanup_test_data()  # delete the index in case it already exists

    es.indices.create(test_index_name)

    for record in generate_data():
        es.index(index=test_index_name, doc_type='_doc', body=record)
    es.indices.refresh(index=test_index_name)


# This test suite requires that Elasticsearch 6 is running on the localhost and
# does not require additional configration.
class TestUniTsReader(unittest.TestCase):
    def test_read_all_runs(self):
        upload_test_data()

        reader = UniTsReader(
            test_index_name, 'ts', 'value',
            get_elasticsearch=test_get_elasticsearch)
        reader.read_all()

        cleanup_test_data()

# This test suite requires that Elasticsearch 6 is running on the localhost and
# does not require additional configration.


class TestUniTsAggReader(unittest.TestCase):
    def test_read_all_runs(self):
        upload_test_data()

        reader = UniTsAggReader(
            test_index_name, 'ts', 'value', '1M', get_elasticsearch=test_get_elasticsearch)
        reader.read_all()

        cleanup_test_data()


if __name__ == "__main__":
    unittest.main()
