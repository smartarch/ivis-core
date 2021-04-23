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
