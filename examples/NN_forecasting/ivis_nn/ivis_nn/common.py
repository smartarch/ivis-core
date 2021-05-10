from ivis import ivis


def get_entities_signals(parameters):
    sig_set_cid = parameters["signalSet"]
    return ivis.entities["signals"][sig_set_cid]


def get_ts_field(parameters):
    entities_signals = get_entities_signals(parameters)
    cid = parameters["tsSigCid"]
    return entities_signals[cid]["field"]


def interval_string_to_milliseconds(interval: str):
    """Convert interval string (https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html#fixed_intervals) to milliseconds"""
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
