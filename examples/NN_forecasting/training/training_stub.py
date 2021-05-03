#!/usr/bin/env python3
import numpy as np
import pandas as pd
import tensorflow as tf

train_data = pd.DataFrame([
    [ 1,  2,  3,  6],
    [-1, -2, -3, -6],
    [ 0,  0,  0,  0],
    [ 1, -1,  1,  1],
])

X = train_data.loc[:, 0:2].to_numpy()
Y = train_data.loc[:, 3].to_numpy().reshape(-1, 1)

# sample neural network model
inputs = tf.keras.layers.Input(shape=[3])
layer = tf.keras.layers.Dense(1)(inputs)
model = tf.keras.Model(inputs=inputs, outputs=layer)

model.compile(optimizer=tf.optimizers.Adam(learning_rate=0.1), loss=tf.losses.mse)
model.summary()

metrics_history = model.fit([X], [Y], epochs=5)
print(metrics_history.history)

test_data = np.array([[1, 2, 3]])
print(model([test_data]))
