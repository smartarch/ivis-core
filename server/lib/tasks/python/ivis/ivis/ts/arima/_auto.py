import itertools
import logging
import math
import multiprocessing
import sys
import timeit
import typing

import pmdarima as pmd

logger = logging.getLogger(__name__)


def _set_as_limit(as_limit: int):
    """Tries to limit the address space of the current process by using the
    resource module. This is available only on some Unix-like platforms. This
    means that if the process attempts to allocate more memory, MemoryError
    exception will be raised.

    In case of failure, warning is logged using the logging module. No exception
    is raised.

    Args:
        as_limit (int): Limit of the process's address space in bytes.
    """
    try:
        import os
        import resource

        # we read the current address space limits of the process
        soft, hard = resource.getrlimit(resource.RLIMIT_AS)
        pid = os.getpid()

        logger.debug(f"Setting process's address space soft limit. pid={pid}")
        logger.debug(f"Old limits: soft={soft}, hard={hard}")

        resource.setrlimit(resource.RLIMIT_AS, (as_limit, hard))
        soft, hard = resource.getrlimit(resource.RLIMIT_AS)

        logger.debug(f"New limits: soft={soft}, hard={hard}")

    except:
        logger.warning("Failed to limit the process's address space. "
                       "Maybe platform that does not support the Python `resource` module is "
                       "being used?")


def _sort_orders(orders):
    """Sort a list of possible orders that are to be tried so that the simplest
    ones are at the beginning.
    """
    def weight(p, d, q, P, D, Q):
        """Assigns a weight to a given model order which accroding to which
        orders are sorted. It is only a simple heuristic that makes it so that
        the simplest models are sorted first.
        """
        cost = 0
        if P + D + Q:
            cost += 1000

        cost += p**2 + d**2 + q**2
        cost += P**3 + 2*d**3 + 3*q**3

        return cost

    orders = [(weight(*o), o) for o in orders]
    orders.sort()
    orders = [x[1] for x in orders]

    return orders


class _ModelsSelector:
    """Helper datastructure for selecting the best model according to a given
    criterion and keeping information about the ones that were found suboptimal.
    """

    supported_criteria = ['aic', 'aicc', 'bic', 'hqic', 'oob']

    def __init__(self, criterion='aic'):
        self.criterion = criterion

        self.best_model = None
        self.best_mse = math.inf
        self.best_crit = math.inf
        self.models_tried = {}

        self.count_success = 0
        self.count_failed = 0

        if criterion not in self.supported_criteria:
            raise ValueError(f"'{criterion}' is not a supported criterion.")

    def add(self, model):
        crit = self._read_model_crit(model)
        if not self.best_model or crit < self.best_crit:
            logger.info(
                f"Found a new best model {model.order} {model.seasonal_order} "
                f"{self.criterion}={crit}")
            self.best_model = model
            self.best_crit = crit
        self.count_success += 1

    def _read_model_crit(self, model):
        if self.criterion in self.supported_criteria:
            return eval(f"model.{self.criterion}()")
        else:
            raise ValueError


def _train_model(training_data,
                 order,
                 seasonal_order,
                 *arima_args,
                 **arima_kargs):
    model = pmd.ARIMA(order, seasonal_order,
                      suppress_warnings=True, *arima_args, **arima_kargs)
    model.fit(training_data)

    return model


def _train_model_safe(training_data,
                      order,
                      seasonal_order,
                      timeout,
                      as_limit,
                      *arima_args,
                      **arima_kargs):
    def f(training_data, order, seasonal_order, arima_args, arima_kargs, output):

        # only set the address space limit for the subprocess, so that we do not
        # mess with the limits of the parent process
        if as_limit:
            _set_as_limit(as_limit)

        try:
            model = _train_model(training_data, order,
                                 seasonal_order, *arima_args, **arima_kargs)
        except KeyboardInterrupt as e:
            logger.warning(f"Keyboard interrupt...")
            raise  # reraise the error so that the application gets stopped
        except MemoryError as e:
            logger.warning(f"Run out of memory: {repr(e)}")
            sys.exit(1)
        except Exception as e:
            logger.warning(
                f"Failed to train (S)ARIMA{order}{seasonal_order[0:3]}"
                f"{seasonal_order[3]}: {repr(e)}.")
            # raise
            sys.exit(1)

        # serialize the model into the proxy
        try:
            output.append(model)
        except Exception as e:
            logger.warning(f"Failed to return the trained model: {repr(e)}")
            sys.exit(1)  # we need to return non-zero exit code that marks that
            # the model was not returned succesfully

    # At the moment, list proxy is used to pass the model from the training
    # process to the parent process. That takes care of serializing and
    # deserializing the model using pickle. It might be more transparent to take
    # care of the serialization and deserialization by ourselves and to pass it
    # explicitly using shared memory between the processes.
    manager = multiprocessing.Manager()
    output = manager.list()
    process = multiprocessing.Process(target=f, args=(
        training_data, order, seasonal_order, arima_args, arima_kargs, output))

    process.start()
    successful = False

    if timeout:
        process.join(timeout)
    else:
        process.join()

    if process.exitcode == 0:
        successful = True
    elif process.exitcode == None:  # the process is still running, so we terminate
        process.terminate()
        process.join(3)

    if process.exitcode == None:  # if the process is still running, we kill it
        process.kill()
        process.join(3)

    if successful:  # process finished successfully
        try:
            model = output[0]
        except Exception as e:
            model = None
            logger.warning(f"Failed to deserialize trained model in the parent "
                           f"thread: {repr(e)}")
        return model
    else:
        return None


def _generate_grid(max_p,
                   max_d,
                   max_q,
                   max_P,
                   max_D,
                   max_Q,
                   m=0,
                   p=None,
                   d=None,
                   q=None,
                   P=None,
                   D=None,
                   Q=None):
    """Generates a lists of model orders that will be considered.
    """
    def list_range(start, end):
        return list(range(start, end+1))
    ps = list_range(0, max_p)
    ds = list_range(0, max_d)
    qs = list_range(0, max_q)
    Ps = list_range(0, max_P)
    Ds = list_range(0, max_D)
    Qs = list_range(0, max_Q)

    # if some parameter is set explicitely, we want to fix it
    if p:
        ps = [p]
    if d:
        ds = [d]
    if q:
        qs = [q]
    if P:
        Ps = [P]
    if D:
        Ds = [D]
    if Q:
        Qs = [Q]

    if m in [0, 1]:  # non-seasonal models
        Ps = [0]
        Ds = [0]
        Qs = [0]

    return ps, ds, qs, Ps, Ds, Qs


def auto_arima(x,
               max_p: int = 5,
               max_d: int = 2,
               max_q: int = 5,
               max_P: int = 2,
               max_D: int = 2,
               max_Q: int = 2,
               max_order: int = 5,
               m: int = 0,
               p: typing.Optional[int] = None,
               d: typing.Optional[int] = None,
               q: typing.Optional[int] = None,
               P: typing.Optional[int] = None,
               D: typing.Optional[int] = None,
               Q: typing.Optional[int] = None,
               # target limit of the address space in bytes
               as_limit: typing.Optional[int] = 8*1024*1024*1024,
               time_limit: typing.Optional[float] = None):
    """Find optimal order or ARIMA or SARIMA model using grid search.

    This function attemps to have an API similar to pmdarima.auto_arima. Unlike
    the aforementioned, it can limit the memory available during the training.
    In case a model needs more memory to train, its training fails but unlike
    pmdarima's implementation, it still returns the best model that was trained
    using the available memory.

    However, it does not offer nearly as much functionality and only implements
    model selection based on grid search that has to consider more models than
    the stepwise search used by default in pmdarima.auto_arima.

    Args:
        x (array-like): Training data
        max_p (int, optional): The maximum value of p. Defaults to 5.
        max_d (int, optional): The maximum value of d. Defaults to 2.
        max_q (int, optional): The maximum value of q. Defaults to 5.
        max_P (int, optional): The maximum value of P. Only relevant if m > 1. Defaults to 2.
        max_D (int, optional): The maximum value of D. Only relevant if m > 1. Defaults to 2.
        max_Q (int, optional): The maximum value of Q. Only relevant if m > 1. Defaults to 2.
        max_order (int, optional): Maximum value of p+q+P+Q. It is used to limit the number of models that are considered. If None, no such limit is applied. Defaults to 5.
        m (int, optional): Seasonal period, if m > 1, seasonal models with such period are considered. Defaults to 0.
        p (typing.Optional[int], optional): Value of p. If None, it is selected using grid search. Defaults to None.
        d (typing.Optional[int], optional): Value of d. If None, it is selected using a differencing test before grid search. Defaults to None.
        q (typing.Optional[int], optional): Value of q. If None, it is selected using grid search. Defaults to None.
        P (typing.Optional[int], optional): Value of P. If None, it is selected using grid search. Defaults to None.
        D (typing.Optional[int], optional): Value of D. If None, it is selected using a differencing test before grid search. Defaults to None.
        Q (typing.Optional[int], optional): Value of Q. If None, it is selected using grid search. Defaults to None.
        as_limit (typing.Optional[int], optional): A size of address space in bytes available to the subprocess used to train the model. Only works on UNIX-like platforms supporting resource submodule. Defaults to 8*1024*1024*1024.
        time_limit (typing.Optional[float], optional): Optional training time in seconds for the whole auto_arima. If set too low, suboptimal models may be returned. Defaults to None.

    Returns:
        [type]: A trained model
    """
    ps, ds, qs, Ps, Ds, Qs = _generate_grid(
        max_p, max_d, max_q, max_P, max_D, max_Q, m, p, d, q, P, D, Q)

    auto_start_time = timeit.default_timer()

    # determine d using a differencing test
    if len(ds) > 1:
        d = pmd.arima.ndiffs(x, max_d=ds[-1])
        ds = [d]

    # determine D using a differencing test
    if len(Ds) > 1 and m > 1:
        D = pmd.arima.nsdiffs(x, m=m, max_D=Ds[-1])
        Ds = [D]

    orders = itertools.product(ps, ds, qs, Ps, Ds, Qs)

    # start with non seasonal and less complex models
    orders = _sort_orders(orders)

    if max_order:
        # If max_order is not None, we only consider models where
        # p + q + P + Q <= max_order
        def should_include(order, max_order):
            p, _, q, P, _, Q = order
            return p + q + P + Q <= max_order

        orders = [order for order in orders if should_include(
            order, max_order)]

    successful_count = 0
    failed_count = 0
    all_count = 0

    models_manager = _ModelsSelector()

    for p, d, q, P, D, Q in orders:
        arima_args = []
        arima_kargs = {}
        order = (p, d, q)
        seasonal_order = (P, D, Q, m)

        models_left = len(orders) - (successful_count + failed_count)
        now = timeit.default_timer()

        if time_limit:
            time_per_model = (auto_start_time + time_limit - now) / models_left
            timeout = time_per_model
        else:
            timeout = None

        training_start_time = timeit.default_timer()
        model = _train_model_safe(
            x, order, seasonal_order, timeout=timeout, as_limit=as_limit, *arima_args, **arima_kargs)

        training_end_time = timeit.default_timer()
        took = training_end_time - training_start_time
        all_count += 1

        if model:
            successful_count += 1
            models_manager.add(model)  # add the last model

            logger.info(
                f"Training of {order}{seasonal_order} successful, "
                f"took {took:8.2f}s, {all_count}/{len(orders)} done. "
                f"AIC={model.aic()}.")
        else:
            failed_count += 1
            logger.info(
                f"Training of {order}{seasonal_order} failed, "
                f"took {took:8.2f}s, {all_count}/{len(orders)} done.")

        best = models_manager.best_model
        best_aic = models_manager.best_crit
    logger.info(f"The best model: {best} {best_aic}")
    auto_end_time = timeit.default_timer()
    took = auto_end_time - auto_start_time
    logger.info(f"Finished auto arima run: "
                f"successful={successful_count}, "
                f"failed={failed_count}, "
                f"total={len(orders)}, "
                f"took={took:4.2f}s")

    return best


if __name__ == '__main__':
    pass
