import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name="ivis_nn",
    version="0.0.1",
    author='Michal Töpfer',
    author_email='michal.topfer@gmail.com',
    description='python library for training neural networks for time series forecasting in IVIS-CORE project',
    long_description=long_description,
    long_description_content_type="text/markdown",
    url='https://github.com/smartarch/ivis-core',
    keywords=['ivis'],
    packages=setuptools.find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.6',
)
