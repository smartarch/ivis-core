"""
Common function for the whole `nn` submodule.
"""
from ivis import ivis


def get_entities_signals(parameters):
    """
    Returns the signals for ``parameters["signal_set"]`` signal set from ``ivis.entities``.

    Parameters
    ----------
    parameters : dict
        The parameters of the job.

    Returns
    -------
    signals : dict
        The signals, keys in the dictionary are the cids of the signals.

    """
    sig_set_cid = parameters["signal_set"]
    return ivis.entities["signals"][sig_set_cid]


def get_ts_field(parameters):
    """
    Returns the timestamp signal's Elasticsearch field identifier. This uses ``parameters["signal_set"]`` as signal set identifier and ``parameters["ts"]`` as timestamp signal cid.

    Parameters
    ----------
    parameters : dict
        The parameters of the job.

    Returns
    -------
    field : str
        The ES field identifier of the timestamp signal.
    """
    entities_signals = get_entities_signals(parameters)
    cid = parameters["ts"]
    return entities_signals[cid]["field"]


def get_aggregated_field(signal):
    """Returns the field identifier (for ES) for a signal, taking aggregations into account."""
    if "aggregation" in signal:
        return f'{signal["field"]}_{signal["aggregation"]}'
    else:
        return signal["field"]


def interval_string_to_milliseconds(interval: str):
    """
    Convert interval string to milliseconds. The format of interval strings can be found in the Elasticsearch documentation: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html#fixed_intervals.
    """
    if interval.endswith("ms"):
        return int(interval[:-2])
    elif interval.endswith("s"):
        return int(interval[:-1]) * 1000
    elif interval.endswith("m"):
        return int(interval[:-1]) * 60 * 1000
    elif interval.endswith("h"):
        return int(interval[:-1]) * 60 * 60 * 1000
    elif interval.endswith("d"):
        return int(interval[:-1]) * 24 * 60 * 60 * 1000
    else:
        raise ValueError("Invalid interval unit")


def print_divider(length=10):
    """
    Prints several ``#`` characters surrounded by newlines as a divider in the job run log.

    Parameters
    ----------
    length : int
        The number of characters which should be printed. Defaults to 10.
    """
    print()
    print("#" * length)
    print()


class NotEnoughDataError(Exception):
    """Raised when there is not enough data for running the training or prediction."""
    def __str__(self):
        return "Not enough data."


class NoDataError(Exception):
    def __str__(self):
        return "No data."
