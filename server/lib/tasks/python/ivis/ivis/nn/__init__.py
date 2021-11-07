"""
Module of the library for tasks in IVIS project to support time series forecasting using neural networks.
"""
from .training import run_training
from .prediction import run_prediction, load_model
from .save import save_data
