from typing import Any, List, Tuple

from elasticsearch import Elasticsearch
import numpy as np
import pendulum


# brackets are used for escaping
DATEFORMAT_PENDULUM = "YYYY-MM-DD[T]HH:mm:ss.SSS[Z]"
DATEFORMAT_ELASTIC = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"


def format_date(date: pendulum.DateTime):
    return date.format(DATEFORMAT_PENDULUM)


def parse_date(date: str) -> pendulum.DateTime:
    """Convert timestamp to pendulum.DateTime"""
    return pendulum.from_format(date, DATEFORMAT_PENDULUM)


def ivis_get_elasticsearch():
    from ivis import ivis
    return ivis.elasticsearch


def test_get_elasticsearch():
    return Elasticsearch()


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
                 end_inclusive: bool = False,
                 get_elasticsearch=ivis_get_elasticsearch):
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

        self.get_elasticsearch = get_elasticsearch

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

        es = self.get_elasticsearch()
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

    start_date = parse_date(first_ts)

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
                 end_inclusive: bool = False,
                 get_elasticsearch=ivis_get_elasticsearch):
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

        self.get_elasticsearch = get_elasticsearch

    def read(self, batch_size: int = 1000):
        return self._read_batch(batch_size)

    def read_all(self):
        timestamps, values = [], []
        while True:
            new_ts, new_vs = self.read()

            if not new_ts:
                break

            timestamps.extend(new_ts)
            values.extend(new_vs)

        return timestamps, values

    def _read_batch(self, buckets_count: int):
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

        def get_first_ts(es, start_ts):
            query = {
                'size': 1,  # we only need the first record that was found
                'sort': {
                    self.ts_field: 'asc'
                }
            }
            if not start_ts:
                query['query'] = {'match_all': {}}
            else:
                query['query'] = {}
                query['query']['range'] = {
                    self.ts_field: {
                        'gte': start_ts
                    }
                }
            results = es.search(index=self.index_name, body=query)

            # This will raise KeyError on empty time series
            return results['hits']['hits'][0]['_source'][self.ts_field]

        def _read_batch(es,
                        start_ts: str,
                        start_inclusive: bool = True,
                        end_ts: str = None,
                        end_inclusive: bool = False,
                        sample_interval: str = '1M',
                        agg_method: str = 'avg',
                        buckets_count: int = 1000):
            """Read a single batch"""

            # We estimate what segment of the time series do we filter to get
            # approximately the given buckets_count.
            if not start_ts:
                start_ts = get_first_ts(es, start_ts=None)
            approx_end_ts = estimate_end_ts(
                start_ts, sample_interval, buckets_count)

            if end_ts:
                end_ts = parse_date(end_ts)

                # Consider the earlier end timestamp
                if approx_end_ts > end_ts:
                    end_ts_final = format_date(end_ts)
                else:
                    end_ts_final = format_date(approx_end_ts)
            else:
                end_ts_final = format_date(approx_end_ts)

            # Although end_inclusive is only meant for the end_ts, in case we
            # use our estimated end timestamp, the inequality does not matter so
            # we can use the same one.
            end_ineq = 'lte' if end_inclusive else 'lt'

            start_ineq = 'gte' if start_inclusive else 'gt'

            # we are using the range query here to limit the number of buckets
            # that the Elasticsearch returns us, because an attempt to return
            # too many at once results in an error.
            query = {
                "query": {
                    "range": {
                        self.ts_field: {
                            start_ineq: start_ts,
                            end_ineq: end_ts_final
                        }
                    }
                },
                "size": 0,  # we aren't interested in records themselves
                "aggs": {
                    "by_sample": {
                        "date_histogram": {
                            "field": self.ts_field,
                            "interval": sample_interval,
                            "format": DATEFORMAT_ELASTIC,
                        },
                        "aggs": {
                            "resampled": {
                                agg_method: {
                                    "field": self.value_field
                                }
                            }
                        }
                    }
                }
            }

            values = []
            timestamps = []

            results = es.search(index=self.index_name, body=query)

            buckets = [x for x in results['aggregations']
                       ['by_sample']['buckets']]
            values = [x['resampled']['value'] for x in buckets]
            timestamps = [x['key_as_string'] for x in buckets]

            if timestamps:
                # Do not return the last (potentially incomplete) bucket
                timestamps.pop()
                values.pop()

            # In case there are any empty buckets, estimate their values using
            # linear interpolation
            linear_interp(values)

            return timestamps, values

        if not self.latest_ts:
            # first batch, so we can optionally skip some values in the time
            # series when start_ts is not None
            batch_start_ts = self.start_ts
            batch_start_inclusive = self.start_inclusive
        else:
            # subsequent batches, we always take only values belonging to not
            # yet returned buckets into account
            batch_start_ts = self.latest_ts
            batch_start_inclusive = True

        timestamps, values = _read_batch(self.get_elasticsearch(),
                                         start_ts=batch_start_ts,
                                         start_inclusive=batch_start_inclusive,
                                         end_ts=self.end_ts,
                                         end_inclusive=self.end_inclusive,
                                         sample_interval=self.agg_interval,
                                         agg_method=self.agg_method,
                                         buckets_count=buckets_count)

        if self.latest_ts and timestamps and self.latest_ts == timestamps[0]:
            # do not return the first timestamps if we have already returned it
            timestamps.pop(0)
            values.pop(0)

        if timestamps:
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
