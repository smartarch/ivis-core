from ivis import ivis
from ivis.nn import run_prediction, save_data

model_path = 'example_docs/model.h5'  # TODO(MT)
_, predictions = run_prediction(ivis.params, model_path)
save_data(ivis.params, predictions)
