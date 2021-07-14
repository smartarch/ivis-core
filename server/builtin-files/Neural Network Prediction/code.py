from ivis.nn import run_prediction, save_data
from ivis.nn.ParamsClasses import PredictionParams

model_path = 'model.h5'  # TODO(MT)
with open('prediction_parameters.json') as params_file:
    params = PredictionParams().from_json(params_file.read())
_, predictions = run_prediction(params, model_path)
save_data(params, predictions)
