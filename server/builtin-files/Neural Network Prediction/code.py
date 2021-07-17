from ivis.nn import run_prediction, save_data, load_model

params, model = load_model()
_, predictions = run_prediction(params, model)
save_data(params, predictions)
