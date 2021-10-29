# IVIS core tasks package 

Library for tasks in IVIS project

## Install

*When installing IVIS using the prepared installation scripts, this library is installed automatically for use in the tasks in the IVIS instance.*

### Manual installation

Change to directory containing this README file and run:

```
python3 setup.py sdist bdist_wheel
```

### Local development install

To install the `ivis` package for local debugging (running it directly, not through IVIS), change to directory containing this README file and run:

```
pip install --editable .
```