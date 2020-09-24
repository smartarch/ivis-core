import os
import numpy as np
import gdal
import gdalconst
from datetime import datetime


def read_ndvi_array(ndvi_path: str):
    """Read the NDVI data as an array of valid data.

    Invalid (i.e. NODATA) values are filtered out with all 
    possible additional bands such as alpha channels.

    Args:
        ndvi_path: Path to the cut-to-shape Sentinel-2 NDVI 
            data of a field. The NODATA value of the NDVI data 
            must be -999.

    Returns:
        ndarray: An M x N shaped array of NDVI values."""

    if not os.path.isfile(ndvi_path):
        raise FileNotFoundError(f'No NDVI file in the given path: {ndvi_path}')

    ndvi_raster = gdal.Open(ndvi_path, gdalconst.GA_ReadOnly)
    ndvi_array = ndvi_raster.ReadAsArray()

    if len(ndvi_array.shape) > 2:
        ndvi_array = ndvi_array[0, ::]

    return ndvi_array


def calculate_growth_days(season_start: str, focus_date: str, last_harvest: str):
    """Calculate the difference between the previous harvest and
    the focus date in days.

    Args:
        season_start: The starting date of the growing season 
            in format YYYY-MM-DD.
        focus_date: The date that is currently of interest in 
            format YYYY-MM-DD.
        last_harvest: The date the grass was last cut in format 
            YYYY-MM-DD.

    Returns:
        The difference in days.
    """
    fmt = "%Y-%m-%d"
    if last_harvest is None:
        before = datetime.strptime(season_start, fmt)
    else:
        before = datetime.strptime(last_harvest, fmt)
    after = datetime.strptime(focus_date, fmt)
    return (after-before).days


def build_features(
        ndvi_path: str,
        season_start: str,
        cumulative_temp: float,
        cumulative_rain: float,
        focus_date: str,
        last_harvest: str = None,
        harvests_done: int = 0):
    """Build the input data features for the model.

    Args:
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
        ndarray: A NumPy matrix of built data features. Values
            are shaped according to the input NDVI image with
            missing values (due to cut-outs) in similar places."""

    ndvi_array = read_ndvi_array(ndvi_path=ndvi_path)

    x = np.zeros((ndvi_array.flatten().size, 5))
    x[:, 0] = ndvi_array.flatten()
    x[:, 1] = cumulative_temp
    x[:, 2] = cumulative_rain
    x[:, 3] = calculate_growth_days(season_start, last_harvest, focus_date)
    x[:, 4] = harvests_done + 1

    x.resize(*ndvi_array.shape, 5)

    return x
