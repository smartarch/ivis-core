import kerastuner as kt


class Hyperparameters:
    """Wrapper for KerasTuner to obtain the training and architecture hyperparameters."""

    def __init__(self, params, hp):
        """

        Parameters
        ----------
        params : dict
            Our parameters specification.
        hp : kt.HyperParameters
            The Keras Tuner HyperParameters instance.
        """
        self.params = params
        self.hp = hp

    def __getitem__(self, key):
        if key not in self.params:
            raise KeyError(key)
        param = self.params[key]
        if self._is_optimizable(param):
            optimizable_type = param["optimizable_type"]
            return self._get_item(key, param, optimizable_type)
        else:
            return self.hp.Fixed(key, param)

    @staticmethod
    def _is_optimizable(param):
        return (type(param) is dict  # JSON object
                and "optimizable_type" in param)

    def _get_item(self, key, param, optimizable_type):
        if optimizable_type == "float":
            return self._get_float(key, param)
        elif optimizable_type == "int":
            return self._get_int(key, param)
        elif optimizable_type == "enum":
            return self._get_enum(key, param)
        elif optimizable_type[:4] == "list":  # e.g. list_int
            return self._get_list(key, param, optimizable_type[5:])

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

    def _get_list(self, key, param, optimizable_type):
        min_count = param["min_count"]
        max_count = param["max_count"]
        result = []
        for i in range(self.hp.Int(key, min_count, max_count)):
            item = self._get_item(key + "_" + str(i), param, optimizable_type)
            result.append(item)
        return result
