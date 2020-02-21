'use strict';

import * as d3Array from "d3-array";
import * as d3Scale from "d3-scale";
import * as d3Color from "d3-color";

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

export function getColorScale(domain, colors) {
    if (!Array.isArray(colors) || colors.length === 0)
        throw new Error("colors parameter must be an array with at least one element");
    colors = colors.length === 1 ? [colors[0], colors[0]] : colors; // if we have only one color, duplicate it

    const [min, max] = domain;
    const step = (max - min) / (colors.length - 1);
    const subdividedDomain = colors.map((c, i) => i * step + min); // subdividedDomain contains a value from [min, max] for each color (domain and range of scaleLinear must have same length)
    return d3Scale.scaleLinear()
        .domain(subdividedDomain)
        .range(colors);
}

export function ModifyColorCopy(color, new_opacity) {
    color = d3Color.color(color);
    if (color === null)
        return undefined;
    if (new_opacity === undefined)
        new_opacity = color.opacity;
    return d3Color.rgb(color.r, color.g, color.b, new_opacity);
}