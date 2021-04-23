

def get_merged_schema(training_parameters):
    input_schema = training_parameters["input_schema"]
    target_schema = training_parameters["target_schema"]
    schema = dict(input_schema)
    schema.update(target_schema)
    return schema
