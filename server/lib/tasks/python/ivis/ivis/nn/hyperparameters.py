import kerastuner as kt


class Hyperparameters:
    """Wrapper for KerasTuner to obtain the training and architecture hyperparameters."""

    def __init__(self, params, hp):
        """

        Parameters
        ----------
        params : dict
            Our parameters specification.
            If "optimizable_type" key is not present, the value is taken as fixed.
            Allowed "optimizable_type" values are:
                - "float": then "min", "max" are required, "default" and "sampling" are optional
                - "int": then "min", "max" are required, "default" and "sampling" are optional
                - "enum": then "values" array is required, "default" value is optional
                - "list" then either "count" (fixed) or "min_count" and "max_count" are required. The items
                         specifications are taken from the "items" array and should be in the same format. If
                         there are less items specifications than count, items specifications are repeated.
            See also https://keras.io/api/keras_tuner/hyperparameters/ for details on "sampling", etc.

        hp : kt.HyperParameters
            The Keras Tuner HyperParameters instance.
        """
        self.params = params
        self.hp = hp

    def __getitem__(self, key):
        if key not in self.params:
            raise KeyError(key)
        param = self.params[key]
        return self._get_item(key, param)

    @staticmethod
    def _is_optimizable(param):
        return (type(param) is dict  # JSON object
                and "optimizable_type" in param)

    def _get_item(self, key, param):
        if self._is_optimizable(param):
            return self._get_optimizable_item(key, param)
        else:
            return self.hp.Fixed(key, param)

    def _get_optimizable_item(self, key, param):
        optimizable_type = param["optimizable_type"]

        if optimizable_type == "float":
            return self._get_float(key, param)
        elif optimizable_type == "int":
            return self._get_int(key, param)
        elif optimizable_type == "enum":
            return self._get_enum(key, param)
        elif optimizable_type == "list":
            return self._get_list(key, param)

    def _get_float(self, key, param):
        min_value = param["min"]
        max_value = param["max"]
        default = param["default"] if "default" in param else None
        sampling = param["sampling"] if "sampling" in param else "linear"
        return self.hp.Float(key, min_value, max_value, default=default, sampling=sampling)

    def _get_int(self, key, param):
        min_value = param["min"]
        max_value = param["max"]
        default = param["default"] if "default" in param else None
        sampling = param["sampling"] if "sampling" in param else "linear"
        return self.hp.Int(key, min_value, max_value, default=default, sampling=sampling)

    def _get_enum(self, key, param):
        values = param["values"]
        default = param["default"] if "default" in param else None
        return self.hp.Choice(key, values, default=default)

    def _get_list(self, key, param):
        if "count" in param:
            count = self.hp.Fixed(key, param["count"])
        else:
            min_count = param["min_count"]
            max_count = param["max_count"]
            count = self.hp.Int(key, min_count, max_count)

        items_spec = param["items"]
        num_items = len(items_spec)

        result = []
        for i in range(count):
            item_spec = items_spec[i % num_items]
            item = self._get_item(key + "_" + str(i), item_spec)
            result.append(item)
        return result


def get_tuned_parameters(parameters, hp):
    """
    Creates a (shallow) copy of the parameters with all tunable values replaced with the found best value.

    Parameters
    ----------
    parameters : dict
        Original job parameters.
    hp : kt.HyperParameters
        Best found hyperparameters.

    Returns
    -------
    dict
        Parameters with the best found tunable values.
    """
    hyperparameters = Hyperparameters(parameters, hp)
    architecture_hyperparameters = Hyperparameters(parameters["architecture_params"], hp)

    tuned_params = _get_tuned_object(parameters, hyperparameters)
    tuned_params["architecture_params"] = _get_tuned_object(parameters["architecture_params"], architecture_hyperparameters)

    return tuned_params


def _get_tuned_object(original: dict, hyperparameters: Hyperparameters) -> dict:
    result = {}
    for key in original:
        value = original[key]
        if type(value) is dict and "optimizable_type" in value:
            value = hyperparameters[key]
        result[key] = value
    return result
