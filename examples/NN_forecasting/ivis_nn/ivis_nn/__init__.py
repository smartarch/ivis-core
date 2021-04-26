from . import elasticsearch
from .TrainingParams import TrainingParams

es = elasticsearch

# The preprocessing module requires tensorflow,
# but the other parts of the library should be
# usable without it.
try:
    from . import preprocessing
    pre = preprocessing
finally:
    pass
