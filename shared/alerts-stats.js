'use strict';

// look back
function past(array, key, distance){
    if (distance >= array.length) distance = array.length - 1;
    return array[distance][key];
}

// average
function avg(array, key, length){
    if (length > array.length) length = array.length;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < length; i++) {
        if (array[i][key] !== null) {
            if (typeof array[i][key] !== 'number') throw new Error('Argument in avg function is not a number!');
            sum += array[i][key];
            count++;
        }
    }
    return sum / count;
}

//variance
function vari(array, key, length){
    if (length > array.length) length = array.length;
    let aver;
    try {
        aver = avg(array, key, length);
    }
    catch (error) {
        if (error.message === 'Argument in avg function is not a number!') throw new Error('Argument in vari function is not a number!');
        else throw error;
    }
    let sum = 0;
    let count = 0;
    for (let i = 0; i < length; i++) {
        if (array[i][key] !== null) {
            if (typeof array[i][key] !== 'number') throw new Error('Argument in vari function is not a number!');
            sum += Math.pow(array[i][key] - aver, 2);
            count++;
        }
    }
    return sum / count;
}

// minimum
function min(array, key, length){
    if (length > array.length) length = array.length;
    let min = null;
    for (let i = 0; i < length; i++) if (array[i][key] !== null && (min === null || array[i][key] < min)) min = array[i][key];
    return min;
}

// maximum
function max(array, key, length){
    if (length > array.length) length = array.length;
    let max = null;
    for (let i = 0; i < length; i++) if (array[i][key] !== null && (max === null || array[i][key] > max)) max = array[i][key];
    return max;
}

// quantile
function qnt(array, key, length, q){
    if (length > array.length) length = array.length;
    let values = [];
    for (let i = 0; i < length; i++) if (array[i][key] !== null) values.push(array[i][key]);
    let numeric = false;
    for (let i = 0; i < values.length; i++) if (typeof values[i] === 'number') numeric = true;
    if (numeric) values.sort((a, b) => a - b);
    else values.sort();
    const index = Math.ceil(values.length * q) - 1;
    return values[index < 0 ? 0 : index];
}

module.exports = {
    past,
    avg,
    vari,
    min,
    max,
    qnt
};
