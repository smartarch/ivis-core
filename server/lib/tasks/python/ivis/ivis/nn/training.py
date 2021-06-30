import tensorflow as tf
from . import preprocessing as pre
from . import model as nn_model


def run_training(training_parameters, dataframes):
    """
    Run the training of neural network with specified parameters and data.

    Parameters
    ----------
    training_parameters : ivis.nn.TrainingParams
        The parameters passed from Optimizer (converted to ``dict`` because they were serialized to JSON along the way).
        Before serialization, the parameters were a class derived from Optimizer.TrainingParams.
    dataframes : (pd.DataFrame, pd.DataFrame, pd.DataFrame)
        The training, validation and test data.

    Returns
    -------
    dict
        The computed losses, etc. for Optimizer.
    tf.keras.Model
        The neural network model (which can then be saved into IVIS).
    """

    # print("tensorflow version:", tf.__version__)

    train_df, val_df, test_df = dataframes

    input_width = training_parameters.input_width
    target_width = training_parameters.target_width
    input_column_names = pre.get_column_names(training_parameters.normalization_coefficients, training_parameters.input_signals)
    target_column_names = pre.get_column_names(training_parameters.normalization_coefficients, training_parameters.target_signals)

    window_generator_params = {
        "input_width": input_width,
        "target_width": target_width,
        "interval": training_parameters.interval,
        "input_column_names": input_column_names,
        "target_column_names": target_column_names,
    }
    train, val, test = pre.make_datasets(train_df, val_df, test_df, window_generator_params)

    # example = list(train.as_numpy_iterator())
    # for ex in example:
    #     print(ex[0])
    #     print(ex[1])

    input_shape = (input_width, len(input_column_names))
    target_shape = (target_width, len(target_column_names))

    # sample neural network model
    model = nn_model.get_model(training_parameters, input_shape, target_shape)

    # add residual connection - predict the difference
    targets_to_inputs_mapping = nn_model.get_targets_to_inputs_mapping(input_column_names, target_column_names)
    model = nn_model.wrap_with_residual_connection(model, targets_to_inputs_mapping)

    model.compile(
        optimizer=nn_model.get_optimizer(training_parameters),
        loss=tf.losses.mse
    )
    model.summary()

    fit_params = {
        "epochs": 3  # TODO
    }
    metrics_history = model.fit(train, **fit_params)
    print(metrics_history.history)

    return {
        "train_loss": 1.22,
        "test_loss": 3.4,
    }, model
