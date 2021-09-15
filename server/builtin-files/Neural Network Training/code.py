import requests
from ivis import ivis
from ivis.nn import run_training, save_data


run_training(ivis.params, save_data=save_data)

prediction_id = ivis.params["prediction_id"]
requests.post(f"{ivis._sandboxUrlBase}/{ivis._accessToken}/rest/predictions-nn-finished/{prediction_id}")  # TODO(MT): add support for API requests to helpers.py
