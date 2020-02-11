'use strict';

import * as d3Array from "d3-array";

/**
 * Adds margin to extent in format of d3.extent()
 */
export function extentWithMargin(extent, margin_percentage) {
    const diff = extent[1] - extent[0];
    const margin = diff * margin_percentage;
    return [extent[0] - margin, extent[1] + margin];
}

export function getExtent(setsData, valueof) {
    const min = d3Array.min(setsData, function(data) {
        return d3Array.min(data, valueof);
    });
    const max = d3Array.max(setsData, function(data) {
        return d3Array.max(data, valueof);
    });
    return [min, max];
}

export function isInExtent(value, extent) {
    return value >= extent[0] && value <= extent[1];
}

export function isSignalVisible(sigConf) {
    return (!('enabled' in sigConf) || sigConf.enabled);
}

/**
 * Computes Euclidean distance of two points
 * @param point1 object in format {x,y}
 * @param point2 object in format {x,y}
 */
export function distance(point1, point2) {
    return Math.hypot(point1.x - point2.x, point1.y - point2.y);
}

export function roundTo(num, decimals = 2) {
    const pow10 = Math.pow(10, decimals);
    return Math.round(num * pow10) / pow10;
}