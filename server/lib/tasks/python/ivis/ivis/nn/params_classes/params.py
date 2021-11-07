import json


class Params:
    """Base class for holding any parameters. Provides functionality to import and export parameters to JSON."""

    def to_json(self):
        return json.dumps(self.__dict__, indent=2)

    def from_json(self, data: str):
        self.__dict__.update(json.loads(data))
        return self
