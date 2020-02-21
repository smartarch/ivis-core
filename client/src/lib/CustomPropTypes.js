'use strict';

import * as d3Color from "d3-color";

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

export function PropType_d3Color() {
    return function (props, propName, componentName) {
        const val = props[propName];
        if (d3Color.color(val) === null)
            return new Error(
                'Invalid prop `' + propName + '` supplied to' +
                ' `' + componentName + '`. It must be a d3 color. See https://github.com/d3/d3-color#color for more information.'
            );
    }
}