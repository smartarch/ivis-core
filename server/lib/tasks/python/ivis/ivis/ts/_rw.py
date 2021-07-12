import abc
import logging
from typing import Any, List, Tuple

import elasticsearch as es
import elasticsearch.helpers as esh
import elasticsearch_dsl as dsl
import numpy as np
import pendulum
from ivis import ivis

# brackets are used for escaping
DATEFORMAT_PENDULUM = "YYYY-MM-DD[T]HH:mm:ss.SSS[Z]"
DATEFORMAT_ELASTIC = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"


def format_date(date: pendulum.DateTime):
    return date.format(DATEFORMAT_PENDULUM)


def parse_date(date: str) -> pendulum.DateTime:
    """Convert timestamp to pendulum.DateTime"""
    return pendulum.from_format(date, DATEFORMAT_PENDULUM)


class UniTsReader:
    """Helper class for reading univariate time series data from IVIS
    """

    def __init__(self,
                 index_name: str,
                 ts_field: str,
                 value_field: str,
                 start_ts='',
                 end_ts='',
                 start_inclusive: bool = True,
                 end_inclusive: bool = False):
        """[summary]

        Args:
            index_name (str): Elasticsearch index name
            ts_field (str): Elasticsearch field holding timestamps
            value_field (str): Elasticsearch field holding the selected signal
            start_ts (str, optional): Start timestamp. Defaults to ''.
            end_ts (str, optional): End timestamp. Defaults to ''.
            start_inclusive (bool, optional): Is starting ts inclusive? Defaults to True.
            end_inclusive (bool, optional): Is end ts inclusive? Defaults to False.
        """
        self.index_name = index_name
        self.ts_field = ts_field
        self.value_field = value_field

        self.start_ts = start_ts
        self.end_ts = end_ts

        self.start_inclusive = start_inclusive
        self.end_inclusive = end_inclusive

    def read(self, batch_size: int = 10000) -> Tuple[List[Any], List[Any]]:
        """Read a next batch of at most batch_size values. batch_size has to be
        less than or equal to Elasticsearch's index.max_result_window which is
        10000 by default.

        Args:
            batch_size (int, optional): Size of the batch. Defaults to 10000.

        Returns:
            Tuple[List[Any], List[Any]]: (timestamps, values)
        """
        return self._read(batch_size)

    def read_all(self) -> Tuple[List[Any], List[Any]]:
        """Read all available data

        Returns:
            Tuple[List[Any], List[Any]]: (timestamps, values)
        """
        timestamps, values = [], []
        while True:
            new_ts, new_val = self.read()

            timestamps.extend(new_ts)
            values.extend(new_val)

            if not new_ts:
                break

        return timestamps, values

    def _read(self, batch_size=10000) -> Tuple[List[Any], List[Any]]:
        def _build_query(ts_field, start_ts=None, end_ts=None, start_inclusive=True, end_inclusive=False):
            body = {
                'query': {
                    'match_all': {}
                },
                'size': batch_size,
                'sort': {
                    ts_field: 'asc'
                }
            }

            # convert match_all to range query if any boundary is specified
            if start_ts or end_ts:
                body['query'].pop('match_all')
                body['query']['range'] = {ts_field: {}}

            if start_ts:
                if start_inclusive:
                    start_type = 'gte'
                else:
                    start_type = 'gt'
                body['query']['range'][ts_field][start_type] = start_ts

            if end_ts:
                if end_inclusive:
                    end_type = 'lte'
                else:
                    end_type = 'lt'
                body['query']['range'][ts_field][end_type] = end_ts

            return body

        body = _build_query(self.ts_field,
                            start_ts=self.start_ts,
                            end_ts=self.end_ts,
                            start_inclusive=self.start_inclusive,
                            end_inclusive=self.end_inclusive)

        es = ivis.elasticsearch
        res = es.search(index=self.index_name, body=body)

        records = [hit['_source'] for hit in res['hits']['hits']]

        timestamps = [record[self.ts_field] for record in records]
        values = [record[self.value_field] for record in records]

        if len(timestamps):
            # in the next batch, we want to get elements right after
            # the latest one
            self.start_ts = timestamps[-1]

            # don't read the last element twice
            self.start_inclusive = False

        # convert string timestamps to pendulum.DateTime
        timestamps = [parse_date(x) for x in timestamps]

        return timestamps, values


def estimate_end_ts(first_ts, interval, buckets_count):
    """Estimate end date, such that if you split data between start_ts and end_ts
    with a given interval, you get at least (and not significantly more than)
    buckets_count buckets.

    Warning: This is only approximate estimation and end_ts doesn't coincide
    with a respective bucket end! Last bucket should therefore be ignored,
    because it might not include all the observations."""

    start_date = pendulum.from_format(first_ts, DATEFORMAT_PENDULUM)

    markers = {  # Note: These are upper bounds, that's why the values are wrong!
        'y': pendulum.duration(days=366),
        'q': pendulum.duration(days=93),
        'M': pendulum.duration(days=31),
        'w': pendulum.duration(days=8),
        'd': pendulum.duration(hours=26),
        'h': pendulum.duration(minutes=61),
        'm': pendulum.duration(minutes=1),
        's': pendulum.duration(seconds=1),
    }

    num = ''
    mark = ''

    for s in interval:
        if s.isdigit():
            num += s
        else:
            mark += s

    num = int(num)
    delta = markers[mark]

    return start_date + num * buckets_count * delta


class UniTsAggReader:
    """Helper class for reading univariate time series data from IVIS. Unlike
    UniTsReader, here we do not read the raw data directly but compute some
    aggregation (e.g. daily averages) using Elasticsearch date_histogram.
    """

    def __init__(self,
                 index_name: str,
                 ts_field: str,
                 value_field: str,
                 agg_interval: str,
                 agg_method: str = 'avg',
                 start_ts: str = '',
                 end_ts: str = '',
                 start_inclusive: bool = True,
                 end_inclusive: bool = False):
        self.index_name = index_name
        self.ts_field = ts_field
        self.value_field = value_field

        self.agg_method = agg_method
        self.agg_interval = agg_interval

        self.latest_ts = None

        self.start_ts = start_ts
        self.end_ts = end_ts
        self.start_inclusive = start_inclusive
        self.end_inclusive = end_inclusive

    def read_all(self):
        return self.read()

    def read(self):
        def linear_interp(data):  # interpolation of empty buckets
            # there should be no empty buckets on both sides
            for i in range(len(data)):
                if data[i] == None:  # empty bucket
                    # find first non empty bucket
                    j = -1
                    for k in range(i+1, len(data)):
                        if data[k] != None:
                            j = k
                            break
                    # interpolate values between i (inc.) and j (exc.)
                    left = data[i-1]
                    right = data[j]
                    step = (right-left)/(j-i+1)

                    for m in range(i, j):
                        data[m] = data[m - 1] + step

        def get_first_ts(es, index_name, ts_name, start_ts):
            query = {
                'size': 1,  # we only need the first record that was found
                'sort': {
                    ts_name: 'asc'
                }
            }
            if not start_ts:
                query['query'] = {'match_all': {}}
            else:
                query['query'] = {}
                query['query']['range'] = {
                    ts_name: {
                        'gte': start_ts
                    }
                }
            results = es.search(index=index_name, body=query)

            # This will raise KeyError on empty time series
            return results['hits']['hits'][0]['_source'][ts_name]

        def _read_batch(es,
                        index_name: str,
                        ts_name: str,
                        value_name: str,
                        start_ts: str,
                        sample_interval: str,
                        agg_method: str,
                        buckets_count: int):
            """Read a single batch"""

            approx_end_ts = estimate_end_ts(
                start_ts, sample_interval, buckets_count)
            # we are using the range query here to limit the number of buckets
            # that the Elasticsearch returns us, because an attempt to return
            # too many at once results in an error.
            query = {
                "query": {
                    "range": {
                        ts_name: {
                            "gte": start_ts,
                            "lt": approx_end_ts
                        }
                    }
                },
                "size": 0,  # we aren't interested in records themselves
                "aggs": {
                    "by_sample": {
                        "date_histogram": {
                            "field": ts_name,
                            "interval": sample_interval,
                            "format": DATEFORMAT_ELASTIC,
                        },
                        "aggs": {
                            "resampled": {
                                agg_method: {
                                    "field": value_name
                                }
                            }
                        }
                    }
                }
            }

            values = []
            timestamps = []

            results = es.search(index=index_name, body=query)

            buckets = [x for x in results['aggregations']
                       ['by_sample']['buckets']]
            values = [x['resampled']['value'] for x in buckets]
            timestamps = [x['key_as_string'] for x in buckets]

            return timestamps, values

        def _read_resampled(es,
                            index_name: str,
                            ts_name: str,
                            value_name: str,
                            start_ts=None,  # first timestamp, inclusive
                            sample_interval='1M',
                            agg_method='avg'):
            buckets = 100  # approximate count of buckets to get in one request

            first_ts = get_first_ts(es, index_name, ts_name, start_ts)

            values = []
            timestamps = []

            while True:
                nts, nvs = _read_batch(es, index_name, ts_name, value_name,
                                       first_ts, sample_interval, agg_method, buckets)
                if len(nts) > 1:
                    # we overlap the last bucket with a new one to fix alignment issues
                    first_ts = nts[-1]

                    # do not read the last (potentially incomplete) bucket
                    nvs.pop()
                    nts.pop()

                    values.extend(nvs)
                    timestamps.extend(nts)
                else:  # len(nts) <= 1
                    # do not read the last (potentially incomplete) bucket
                    break

            linear_interp(values)

            return timestamps, values

        timestamps, values = _read_resampled(ivis.elasticsearch,
                                             self.index_name,
                                             self.ts_field,
                                             self.value_field,
                                             self.latest_ts,
                                             sample_interval=self.agg_interval,
                                             agg_method=self.agg_method)

        if self.latest_ts and self.latest_ts == timestamps[0]:
            # do not return the first timestamps if we have already returned it
            timestamps.pop(0)
            values.pop(0)

        if len(timestamps) > 0:
            latest_timestamp = timestamps[-1]
            self.latest_ts = latest_timestamp

        return timestamps, values


def estimate_delta(timestamps: List[pendulum.DateTime], sample_size=1000):
    """Estimates the period of timeseries from a sequence of consecutive
    timestamps. It only takes the first sample_size timestamps into account."""
    # timestamps is of [pendulum.DateTime]
    last_ts = timestamps[-1]
    # Only take sample_size timestamps into account. We are taking a median here
    # to compensate for *a few* potential missing values.

    # Default value of 1000 might be a bit of a overkill, but it should still be
    # reasonably fast to process. We on the other hand don't want to unnecessarily
    # go through all the data to find the exact median, because we presume the
    # data to be evenly spaced, except for a few potential missing values.
    timestamps = timestamps[:sample_size]

    # convert timestamps to floats for a bit
    timestamps = [x.float_timestamp for x in timestamps]
    # take difference between each two following timestamps
    zipped = zip(timestamps[1:], timestamps[:-1])
    differences = [x[0] - x[1] for x in zipped]

    # Taking the median should help us deal with the situation when there are
    # some missing values.
    median = np.median(differences)

    # convert back to pendulum
    delta_time = pendulum.duration(seconds=median)
    return TsDelta(last_ts, delta_time)


def logical_delta(interval: str):
    """Translate Elasticsearch interval into pendulum.Duration"""
    intervals = {
        'ms': pendulum.Duration(milliseconds=1),
        's': pendulum.Duration(seconds=1),
        'm': pendulum.Duration(minutes=1),
        'h': pendulum.Duration(hours=1),
        'd': pendulum.Duration(days=1),
        'M': pendulum.duration(months=1),
        'q': pendulum.duration(months=3),
        'y': pendulum.duration(years=1)
    }

    # Note: This also parses some weird things like '1M0' (like '10M')
    # it might be better to explicitly check the format and raise exception?
    num = ''.join([x for x in interval if x.isdigit()])
    marker = ''.join([x for x in interval if not x.isdigit()])

    try:
        return int(num) * intervals[marker]
    except KeyError:
        raise ValueError(f"'{interval}' is not a valid interval.")


class TsDelta:  # invent future timestamps
    def __init__(self, last_ts, delta_time: pendulum.Duration):
        self.valid = False
        self.last_ts = last_ts
        self.delta_time = delta_time

    def _next_ts(self):
        return self.last_ts + self.delta_time

    def peek(self):  # preview next timestamp
        return self._next_ts()

    def read(self):  # read (and consume) next timestamp
        self.last_ts = self._next_ts()
        return self.last_ts

    def set_latest(self, latest_ts):
        self.last_ts = latest_ts

    def copy(self):
        return TsDelta(self.last_ts, self.delta_time)
