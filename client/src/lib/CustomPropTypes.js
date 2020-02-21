'use strict';

export function PropType_ArrayWithLengthAtLeast(length, required = false) {
    return function (props, propName, componentName) {
        if (props[propName] === undefined)
            if (!required)
                return;
        if (Array.isArray(props[propName])) {
            if (props[propName].length >= length)
                return;
            else
                return new Error(
                    'Invalid prop `' + propName + '` supplied to' +
                    ' `' + componentName + '`. Array must contain at least ' + length + ' elements.'
                );
        }
        else
            return new Error(
                'Invalid prop `' + propName + '` supplied to' +
                ' `' + componentName + '`. It must be an array with at least ' + length + ' elements.'
            );
    }
}

export function PropType_NumberInRange(min, max) {
    return function (props, propName, componentName) {
        if (!isNaN(props[propName])) {
            if (min !== undefined && props[propName] < min)
                return new Error(
                    'Invalid prop `' + propName + '` supplied to' +
                    ' `' + componentName + '`. Number must be greater than or equal to ' + min + '.'
                );
            if (max !== undefined && props[propName] > max)
                return new Error(
                    'Invalid prop `' + propName + '` supplied to' +
                    ' `' + componentName + '`. Number must be less than or equal to ' + max + '.'
                );
            return;
        }
        else
            return new Error(
                'Invalid prop `' + propName + '` supplied to' +
                ' `' + componentName + '`. It must be a number.'
            );
    }
}