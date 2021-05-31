#!/usr/bin/env python3
from ivis import ivis
from ivis.nn import run_optimizer, run_training


def print_log(message):
    print(message)


run_optimizer(ivis.params, run_training, print_log)
