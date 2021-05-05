import tensorflow as tf


#################################################
# Create tf.keras.Model based on TrainingParams #
#################################################


def feedforward_model(training_parameters, input_shape, target_shape):
    """
    Feedforward neural network.

    Parameters
    ----------
    training_parameters : dict, JSON from TrainingParams
        TODO: expected parameters ("hidden_sizes")
    input_shape : tuple
    target_shape : tuple

    Returns
    -------
    tf.keras.Model
    """
    hidden_sizes = []
    if "hidden_sizes" in training_parameters:
        hidden_sizes = training_parameters["hidden_sizes"]

    inputs = tf.keras.layers.Input(shape=input_shape)
    layer = tf.keras.layers.Flatten()(inputs)

    for size in hidden_sizes:
        layer = tf.keras.layers.Dense(size)(layer)
        layer = tf.keras.layers.ReLU()(layer)

    outputs = tf.keras.layers.Dense(tf.math.reduce_prod(target_shape))(layer)
    outputs = tf.keras.layers.Reshape(target_shape)(outputs)

    return tf.keras.Model(inputs=inputs, outputs=outputs)


def get_model(training_parameters, input_shape, target_shape):
    """
    Create new TensorFlow network model based on `training_parameters`.

    Parameters
    ----------
    training_parameters : dict, JSON from TrainingParams
    input_shape : tuple
    target_shape : tuple

    Returns
    -------
    tf.keras.Model
    """
    if training_parameters["architecture"] == "feedforward":
        return feedforward_model(training_parameters, input_shape, target_shape)
    else:
        raise ValueError(f"Unknown network architecture: '{training_parameters['architecture']}'")


################################################################
# Create tf.keras.optimizers.Optimizer based on TrainingParams #
################################################################


def get_optimizer(training_parameters):
    return tf.keras.optimizers.Adam()  # TODO: learning_rate
