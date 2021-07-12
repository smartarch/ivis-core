#!/usr/bin/env python3

import base64
import io
import json
import logging
from typing import Tuple

import ivis.ts as ts
import ivis.ts.arima as ar
import joblib
import pendulum
import pmdarima as pmd
from ivis import ivis

# pendulum formatting string, brackets are used for escaping
DATEFORMAT = "YYYY-MM-DD[T]HH:mm:ss.SSS[Z]"


def ensure_date(timestamps):
    if timestamps and isinstance(timestamps[0], str):
        timestamps = [ts.parse_date(x) for x in timestamps]
    return timestamps


class ModelState:
    UNKNOWN = 'unknown'
    TRAINING = 'training'
    ACTIVE = 'active'
    DEGRADED = 'degraded'

    def __new__(cls):
        raise NotImplementedError


class Params:
    """Helper class for parsing the task parameters
    """

    def __init__(self, params):
        self._params = params

    def source_index_field_name(self, signal_cid) -> str:
        return ivis.entities['signals'][self._params['sigSet']][signal_cid]['field']

    @property
    def source_index_name(self) -> str:
        return ivis.entities['signalSets'][self._params['sigSet']]['index']

    @property
    def min_training_ts(self) -> str:
        """Return the first timestamp that will be used by the model. This can be
        used to ignore data that is too old so that the model ignores it altogether"""
        return ''  # TODO: From params

    @property
    def max_training_ts(self) -> str:
        """Return the first timestamp that should not be used as training data and
        validation data during the first run. This is needed when working with large
        signal set that may not fit into the memory."""
        return ''  # TODO: From params

    @property
    def training_portion(self) -> float:
        """Return what portion of the first batch is used for training the model."""
        return float(self._params['trainingPortion']) if 'trainingPortion' in self._params else 0.75

    @property
    def is_autoarima(self) -> bool:
        def is_true(string):
            return True if string == 'True' or string == 'true' or string == True else False
        return is_true(self._params['autoarima'])

    @property
    def is_seasonal(self):
        return self._params['isSeasonal']

    @property
    def arima_order(self) -> Tuple[int, int, int]:
        """ARIMA order, e.g. (5,0,1). Only applicable when not using autoarima."""
        p = int(self._params['p'])
        d = int(self._params['d'])
        q = int(self._params['q'])
        return (p, d, q)

    @property
    def seasonal_m(self) -> int:
        if self.is_seasonal:
            return int(self._params['seasonality_m'])
        else:
            return 1

    @property
    def seasonal_order(self) -> Tuple[int, int, int]:
        """Seasonal order, e.g. (5,0,1). Only applicable when not using autoarima."""
        if self.is_seasonal:
            P = int(self._params['seasonal_P'])
            D = int(self._params['seasonal_D'])
            Q = int(self._params['seasonal_Q'])

            return (P, D, Q)

        else:
            return (0, 0, 0)

    @property
    def ahead_count(self) -> int:
        return int(self._params['futurePredictions'])

    @property
    def is_aggregated(self) -> bool:
        return 'useAggregation' in self._params and self._params['useAggregation']

    @property
    def ts_cid(self) -> str:
        return 'ts'

    @property
    def value_cid(self) -> str:
        # ARIMA always has exactly one main signal
        return self._params['output_config']['signals']['main'][0]['cid']

    @property
    def ts_field(self) -> str:
        return self.source_index_field_name(self.ts_cid)

    @property
    def value_field(self) -> str:
        return self.source_index_field_name(self.value_cid)

    @property
    def aggregation_interval(self) -> str:
        return self._params['bucketSize']


output_config = ivis.params['output_config']

print(f"ivis.entities: {json.dumps(ivis.entities, indent=4)}")
print(f"output_config: {json.dumps(output_config, indent=4)}")


class ModelWrapper:
    """Wraps around our ARIMA model and adds handling of timestamps."""

    def __init__(self, trained_model: ar.ArimaPredictor, delta, model_info):
        self.trained_model = trained_model
        self.delta = delta
        self._model_info = model_info

    def predict(self, count: int):
        delta = self.delta.copy()
        timestamps = [delta.read() for _ in range(count)]

        predictions = self.trained_model.forecast(count)

        return timestamps, predictions

    def append1(self, timestamp, observation):
        """Add a single new observation."""

        if isinstance(timestamp, str):
            timestamp = ts.parse_date(timestamp)

        # check whether the new timestamp is approximately at the expected
        # datetime, e.g. that there was not a skipped observation
        diff = (timestamp - self.delta.last_ts) / self.delta.delta_time

        if diff > 1.5:
            # there are some skipped values, since we already have a trained
            # model, we can try to fill it with its own prediction

            # ideally, this should not happen, data should be regular or
            # preprocessed

            while True:
                diff = (timestamp - self.delta.last_ts) / self.delta.delta_time
                expected = self.delta.copy().read()
                if diff <= 1.5:
                    break
                logging.warning(
                    f"Missing observation, expected {expected}, got {timestamp} instead.")

                prediction = self.trained_model.predict(1)[0]
                self.trained_model.append([prediction])
                self.delta.set_latest(expected)

        # FIXME
        if isinstance(self.trained_model, ar.ArimaPredictor):
            self.trained_model.append([observation])
        else:
            self.trained_model = self.trained_model.append([observation])

        # We will now update timestamp estimator with real observation's
        # timestamp. This should help the real sensors and the model stay in
        # sync. Otherwise, even small timestamp errors would accumulate given
        # enough time.
        self.delta.set_latest(timestamp)

    def append_predict(self, timestamps, observations):
        pred_ts = []
        pred_values = []
        for t, o in zip(timestamps, observations):
            self.append1(t, o)
            timestamp, prediction = self.predict(1)

            # append new observation to the model
            pred_ts.append(timestamp[0])
            # create a new one-ahead prediction
            pred_values.append(prediction[0])

        return pred_ts, pred_values

    @property
    def model_info(self) -> str:
        """Return a description of the fitted model

        Returns:
            str: Model info
        """
        return self._model_info


def write_predictions(params, timestamps, values):
    ts_cid = params.ts_cid
    value_cid = params.value_cid

    with ts.PredictionsWriter(output_config) as writer:
        writer.clear_future()
        for ahead, (t, v) in enumerate(zip(timestamps, values), start=1):
            record = {
                ts_cid: t,
                value_cid: v
            }
            writer.write(record, ahead)


def create_data_reader(params):
    # Creates two readers, one for the first batch of data (training and
    # validation) that will be read at once. The other for all remaining and
    # future data
    index_name = params.source_index_name
    ts_field = params.ts_field
    value_field = params.value_field

    # first ts that is not potentially part of the training data
    split_ts = params.max_training_ts

    if not params.is_aggregated:
        reader = ts.UniTsReader(index_name, ts_field,
                                value_field, end_ts=split_ts)
        logging.info(
            f"Created a normal reader index={index_name}; split_ts={split_ts}")
    else:
        # ex.
        interval = params.aggregation_interval
        reader = ts.UniTsAggReader(index_name, ts_field,
                                   value_field, interval, end_ts=split_ts)
        logging.info(
            f"Created an aggregated reader index={index_name}; interval={interval}; split_ts={split_ts}")

    return reader


def train_model(params) -> ModelWrapper:
    train_percentage = params.training_portion
    autoarima = params.is_autoarima

    # create readers and writers
    reader_train = create_data_reader(params)

    # load training data
    timestamps, values = reader_train.read_all()

    # convert signal values from str to float
    values = list(map(float, values))

    # split into training and the first batch of validation
    ts_train, ts_test = pmd.model_selection.train_test_split(
        timestamps, train_size=train_percentage)
    val_train, val_test = pmd.model_selection.train_test_split(
        values, train_size=train_percentage)

    # TODO: might be removed if we handle the conversion in all the readers
    ts_train = ensure_date(ts_train)
    ts_test = ensure_date(ts_test)

    # note that we don't use timestamps of the test data - we will rather try
    # to guess these timestamps the same way we will have to when actually
    # predicting the future values

    logging.info(f"Training model on dataset of size {len(val_train)}")
    logging.info(f"Validating model on dataset of size {len(val_test)}")

    # train model
    if autoarima:
        logging.info(f"Training model with pmdarima.auto_arima")
        m = params.seasonal_m if params.is_seasonal else 1  # 1 means non-seasonal

        # For higher seasonality, we use our imlementation of auto_arima, that
        # is slower, but does not crash when some of the models that are tried
        # to fit takes too much memory
        if m > 12:
            model = ar.auto_arima(val_train, m=m)
        else:
            model = pmd.auto_arima(val_train, m=m)
    else:
        order = params.arima_order
        seasonal_order = params.seasonal_order
        seasonal_m = params.seasonal_m

        seasonal_order = (*seasonal_order, seasonal_m)
        logging.info(
            f"Training model of order {order}{seasonal_order}{seasonal_m}")
        model = pmd.ARIMA(order=order, seasonal_order=seasonal_order)
        model.fit(val_train)

    model_info = {
        'order': model.order,
        'seasonal_order': model.seasonal_order,
        'params': list(model.params()),  # ar, ma, etc...
    }

    # convert to custom predictor if possible
    if not params.is_seasonal:
        # use our custom ARIMA implementation
        model = ar.ArimaPredictor(model, val_train)
    else:
        model = model.arima_res_  # use the statsmodels SARIMA implementation

    # TODO: TsDeltaLogical instead if working with aggregation
    if params.is_aggregated:
        # when working with aggregations, user has specified a period which we
        # can use
        delta = ts.estimate_delta(ts_train)  # FIXME
    else:
        # otherwise we have to estimate the period from the training data
        delta = ts.estimate_delta(ts_train)

    wrapped_model = ModelWrapper(model, delta, model_info)

    # Add test data into the model and predict one-ahead at the same time
    process_new_observations(wrapped_model, ts_test, val_test)

    # Remove the boundary from the reader and reuse it to read the following
    # values
    reader_future = reader_train
    reader_future.end_ts = ''

    return wrapped_model, reader_future


def process_new_observations(wrapped_model, timestamps, observations):
    logging.info(f"Processing {len(observations)} new observations.")

    params = Params(ivis.params)
    ahead_count = params.ahead_count

    for t, o in zip(timestamps, observations):
        wrapped_model.append1(t, o)

        timestamps_pred, predictions = wrapped_model.predict(ahead_count)
        write_predictions(params, timestamps_pred, predictions)


def dumps(obj) -> str:
    """Serialize an object as base64 encoded string
    """

    # Joblib is used here because it is the recommended method of serialization
    # according to the pmdarima documentation. However, since Python 3.8+, it
    # appears that even the Python's native pickle implementation could be
    # sufficient https://joblib.readthedocs.io/en/latest/persistence.html
    stream = io.BytesIO()
    joblib.dump(obj, stream, compress=('xz', 6))
    blob = base64.b64encode(stream.getvalue()).decode('ascii')

    return blob


def loads(string: str):
    """Deserialize an object from base64 encoded string
    """
    blob = base64.b64decode(string)
    stream = io.BytesIO(blob)

    return joblib.load(stream)


# TODO: Storing the model into a file might be a better option in the future
# when IVIS has more stable File API. However, ARIMA models should typically
# be rather small so the potential overhead of base64 and elasticsearch
# does not appear to be a problem at the moment
def store_model(wrapped_model, reader, model_state=ModelState.UNKNOWN):
    # blob contains objects that cannot be directly serialized into JSON
    blob = dumps({
        'wrapped_model': wrapped_model,
        'reader': reader
    })

    state = {
        'blob': blob,
        # JSON object describing the given model
        'model_info': wrapped_model.model_info,
        'state': model_state,
    }

    ivis.store_state(state)


def load_model(state):
    blob = loads(state['blob'])

    return blob['wrapped_model'], blob['reader']


def set_training_state():
    state = {
        'state': ModelState.TRAINING
    }
    ivis.store_state(state)


def main(state):
    es = ivis.elasticsearch
    params = Params(ivis.params)
    entities = ivis.entities

    set_training_state()

    # Parse params, decide what to do
    if state is None:  # job is running for the first time
        # train new model
        model, reader = train_model(params)
        store_model(model, reader, model_state=ModelState.ACTIVE)
    else:
        # load existing model
        model, reader = load_model(state)

        # read new observations
        timestamps, values = reader.read()

        values = list(map(float, values))

        process_new_observations(model, timestamps, values)

        # store the updated model and reader
        store_model(model, reader, model_state=ModelState.ACTIVE)


if __name__ == "__main__":
    import sys
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    print(f"ivis.params {json.dumps(ivis.params, indent=4)}")

    old_state = ivis.state

    try:
        main(old_state)
    except Exception as e:
        new_state = {
            'state': ModelState.DEGRADED,
        }

        # ideally, we also want to remember model_info and blob if they were
        # already stored
        if 'model_info' in old_state:
            new_state['model_info'] = old_state['model_info']
        if 'blob' in old_state:
            new_state['blob'] = old_state['blob']

        ivis.store_state(new_state)
        raise e  # raise the exception again so that it is visible in the job run log
