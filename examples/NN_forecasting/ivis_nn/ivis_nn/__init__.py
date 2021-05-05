# The elasticsearch submodule can be used without TensorFlow.
from ivis_nn.TrainingParams.TrainingParams import TrainingParams
from . import elasticsearch
es = elasticsearch

# The rest of the modules require TensorFlow.
# We don't want the import to result in an
# exception if TensorFlow is not installed.
try:
    from . import preprocessing
    pre = preprocessing
    from . import model
finally:
    pass
