import argparse
import numpy as np
from xgboost import XGBRegressor

from .data import build_features


def predict_field(
        model_path: str,
        ndvi_path: str,
        season_start: str,
        cumulative_temp: float,
        cumulative_rain: float,
        focus_date: str,
        last_harvest: str = None,
        harvests_done: int = 0):
    """Predict D-values for a field.

    Args:
        model_path: Path to the trained model.
        ndvi_path: Path to the cut-to-shape Sentinel-2 NDVI 
            data of a field. The NODATA value of the NDVI data 
            must be -999 or lower.
        season_start: The starting date of the growing season 
            in format YYYY-MM-DD.
        cumulative_temp: The cumulative temperature sum in 
            Celsius for the field and the date to be predicted.
        cumulative_rain: The cumulative rain sum in millimeters 
            for the field and the date to be predicted.
        focus_date: The date that is currently of interest in 
            format YYYY-MM-DD.
        last_harvest: The date the grass was last cut in format 
            YYYY-MM-DD. Optional.
        harvests_done: The number of harvests so far. Optional.

    Returns:
        ndarray: A NumPy matrix of predicted D-values. Values
            are shaped according to the input NDVI image with
            missing values (due to cut-outs) in similar places."""
    model = XGBRegressor()
    model.load_model(model_path)

    x = build_features(
        ndvi_path=ndvi_path,
        season_start=season_start,
        cumulative_temp=cumulative_temp,
        cumulative_rain=cumulative_rain,
        focus_date=focus_date,
        last_harvest=last_harvest,
        harvests_done=harvests_done
    )

    y_pred = np.ones((x.shape[0], x.shape[1]))*-1

    for i in range(x.shape[0]):
        for j in range(x.shape[1]):
            if x[i, j, 0] == -999:
                continue
            y_pred[i, j] = model.predict(x[i:i+1, j, 0:])

    return y_pred


def main():
    parser = argparse.ArgumentParser(description='D-value predictor for a field at a time period.')
    parser.add_argument(
        name='--model-path',
        help='Path to the trained model.',
        type=str)
    parser.add_argument(
        name='--ndvi-path',
        help='Path to the cut-to-shape Sentinel-2 NDVI data of a field.',
        type=str)
    parser.add_argument(
        name='--season-start',
        help='The starting date of the growing season in format YYYY-MM-DD.',
        type=str)
    parser.add_argument(
        name='--last-harvest',
        help='The date the grass was last cut in format YYYY-MM-DD. Defaults to None.',
        type=str,
        default=None)
    parser.add_argument(
        name='--harvests-done',
        help='The number of harvests so far. Defaults to 0.',
        type=int,
        default=0)
    parser.add_argument(
        name='--cumulative-temp',
        help='The cumulative temperature sum in Celsius for the field and the date to be predicted.',
        type=float)
    parser.add_argument(
        name='--cumulative-rain',
        help='The cumulative rain sum in millimeters for the field and the date to be predicted.',
        type=float)
    parser.add_argument(
        name='--output-path',
        help='Path where the prediction output is persisted. Prefer .npy as the format. Optional.',
        type=str,
        default=None)

    args = parser.parse_args()
    y_pred = predict_for_field(**args)
    if args['output-path'] is not None and '.npy' not in args['output-path'][-4:]:
        raise ValueError('The file must be persisted in NumPy format using .npy suffix!')
    np.save(args['output-path'], y_pred)


if __name__ == '__main__':
    main()
