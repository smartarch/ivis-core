import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name="ivis",
    version="0.0.2",
    author='Petr Siegl',
    author_email='p.siegl@email.cz',
    description='python library for tasks in IVIS-CORE project',
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
