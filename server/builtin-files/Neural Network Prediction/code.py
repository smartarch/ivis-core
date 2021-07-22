from ivis.nn import run_prediction, save_data, load_model

params, model = load_model()
run_prediction(params, model, save_data)
