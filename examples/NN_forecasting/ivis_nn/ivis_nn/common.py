def get_entities_signals(parameters):
    sig_set_cid = parameters["signalSet"]
    return parameters["entities"]["signals"][sig_set_cid]


def get_signal_helpers(parameters):
    entities_signals = get_entities_signals(parameters)

    def cid_to_field(cid):
        return entities_signals[cid]["field"]

    def sig_to_field(sig):
        return cid_to_field(sig["cid"])

    return cid_to_field, sig_to_field


def get_merged_schema(training_parameters):
    input_schema = training_parameters["input_schema"]
    target_schema = training_parameters["target_schema"]
    schema = dict(input_schema)
    schema.update(target_schema)
    return schema


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
