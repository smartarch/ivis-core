# NDVI and Weather Data Based D-Value Estimation

This is the implementation of the D-value estimation algorithm utilizing XGBoost decision tree algorithm and a combination of remote sensing and weather data.

## Example Usage

The implementation is intended to be used with minimal effort. Most effort must be employed with the NDVI-data, but that will be touched later. To use the model to perform D-value predictions, an example call is given below:

    from d_values.predict import predict_field

    model_path = 'C:\\Git\\Tutkimus\\d-value-estimation\\models\\model.json'
    ndvi_path = 'C:\\Git\\Tutkimus\\d-value-estimation\\data\\fin\\9770128673\\20190418_NDVI.tif'
    season_start = '2019-04-18'
    cumulative_temp = 442.4
    cumulative_rain = 106.7
    focus_date = '2019-06-28'
    last_harvest = '2019-06-15'
    harvests_done = 1

    y_pred = predict_field(
        model_path=model_path,
        ndvi_path=ndvi_path,
        season_start=season_start,
        cumulative_temp=cumulative_temp,
        cumulative_rain=cumulative_rain,
        focus_date=focus_date,
        last_harvest=last_harvest,
        harvests_done=harvests_done
    )

The output of the model is a `M x N` NumPy matrix corresponding to the input NDVI data. The methods contain documentation and instruct on desired data formats and such. See the sources for more.

The implementation was tested in a fresh Python virtual environment.

## Bundled Data

The implementation comes with the following data.

 - Trained model `model.json` located under the folder `models`.
 - Example NDVI data `<YYYYMMDD>_NDVI.tif` located in the `data/fin/<BLOCK_ID>`.
 - Example Weather data `weather_data.csv` corresponding to fields located in the root of `data/fin`.

While model is the most essential, the example data can also be used to test the workings of the implementation.

## Installation

This implementation requires three main packages with their corresponding dependencies:

 - XGBoost
 - Scikit-learn
 - GDAL
 - NumPy

Run the following commands (assuming `conda` exists in the system as a package manager):

    conda install numpy gdal xgboost scikit-learn -c conda-forge

If an error about `xgboost` not getting found in the provided channels shows up (target machine has Windows), install it via `pip`:

    pip install xgboost

Lastly install the implementation by navigating to the folder where the implementation resides and calling:

    pip install .

## Data Preparation

### NDVI Data

Only data in need of explicit preparing is the NDVI data derived from Sentinel-2 sources for grass pastures. There a feq requirements for the data:

 - Data must contain the NDVI in the first channel, as Alpha and other channels are omitted in the implementation.
 - Data is expected to be cut with Shapefile corresponding to the field boundaries.
 - NODATA value is expected to be set to -999.

We do not provide means to get the data, but rather require it to be provided to us.

### Weather Information

The implementation also expects information about the cumulative temperatute and precipitation sums up to a given time (corresponding to the NDVI image date). These have to be calculated using the beginning date of the growing season.

### Harvest Information

Last thing required by the implementation is the information about harvests done thus far. Previous date and total number of harvests done until the desired time are required by the model.