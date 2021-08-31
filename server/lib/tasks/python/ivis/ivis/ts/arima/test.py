import unittest

import auto
import pmdarima

dataset = pmdarima.datasets.load_airpassengers()

# Note: Tests here currently do not have a very high coverage and do not tell us
# much more than that the function does not crash in the simplest example.


class TestAutoArima(unittest.TestCase):
    def test_can_train_a_model(self):
        model = auto.auto_arima(dataset)
        self.assertTrue(model)

    def test_can_set_max_p(self):
        for p in range(2):
            model = auto.auto_arima(dataset, max_p=p)
            self.assertLessEqual(model.order[0], p)

    def test_can_set_max_d(self):
        for d in range(2):
            model = auto.auto_arima(dataset, max_d=d)
            self.assertLessEqual(model.order[1], d)

    def test_can_set_max_q(self):
        for q in range(2):
            model = auto.auto_arima(dataset, max_q=q)
            self.assertLessEqual(model.order[2], q)


if __name__ == "__main__":
    unittest.main()
