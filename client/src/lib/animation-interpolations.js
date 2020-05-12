function linear(left, right, ratio) {
    return left * (1 - ratio) + right * ratio;
}

const interpolFuncs = {
    linear: linear,
};

export {
    linear,

    interpolFuncs,
};
