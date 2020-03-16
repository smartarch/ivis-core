'use strict';

import React, {Component} from "react";
import {withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {ScatterPlotBase} from "./ScatterPlotBase";
import {PropType_d3Color_Required} from "../lib/CustomPropTypes";
import {dotShapeNames} from "./dot_shapes";

@withComponentMixins([
    withTranslation,
    withErrorHandling
], ["setMaxDotCount", "setWithTooltip", "getLimits", "setLimits"])
export class BubblePlot extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                x_sigCid: PropTypes.string.isRequired,
                y_sigCid: PropTypes.string.isRequired,
                dotSize_sigCid: PropTypes.string.isRequired,
                colorContinuous_sigCid: PropTypes.string,
                colorDiscrete_sigCid: PropTypes.string,
                tsSigCid: PropTypes.string, // for use of TimeContext
                label_sigCid: PropTypes.string,
                color: PropTypes.oneOfType([PropType_d3Color_Required(), PropTypes.arrayOf(PropType_d3Color_Required())]),
                dotShape: PropTypes.oneOf(dotShapeNames), // default = ScatterPlotBase.dotShape
                dotGlobalShape: PropTypes.oneOf(dotShapeNames), // default = ScatterPlotBase.dotGlobalShape
                label: PropTypes.string,
                enabled: PropTypes.bool,
                x_label: PropTypes.string,
                y_label: PropTypes.string,
                dotSize_label: PropTypes.string,
                color_label: PropTypes.string,
                regressions: PropTypes.arrayOf(PropTypes.shape({
                    type: PropTypes.string.isRequired,
                    color: PropTypes.oneOfType([PropType_d3Color_Required(), PropTypes.arrayOf(PropType_d3Color_Required())]),
                    createRegressionForEachColor: PropTypes.bool, // default: false
                    bandwidth: PropTypes.number    // for LOESS
                }))
            })).isRequired
        }).isRequired,

        maxDotCount: PropTypes.number, // set to negative number for unlimited; prop will get copied to state in constructor, changing it later will not update it, use setMaxDotCount method to update it
        minDotSize: PropTypes.number,
        maxDotSize: PropTypes.number,
        minDotSizeValue: PropTypes.number,
        maxDotSizeValue: PropTypes.number,
        colors: PropTypes.arrayOf(PropType_d3Color_Required()), // if specified, uses same cScale for all signalSets that have color_sigCid and config.signalSets[*].color is not array
        minColorValue: PropTypes.number,
        maxColorValue: PropTypes.number,
        colorValues: PropTypes.array,
        highlightDotSize: PropTypes.number, // radius multiplier
        xAxisExtentFromSampledData: PropTypes.bool, // whether xExtent should be [min, max] of the whole signal or only of the returned docs
        yAxisExtentFromSampledData: PropTypes.bool,
        updateColorOnZoom: PropTypes.bool,
        updateSizeOnZoom: PropTypes.bool,
        xAxisTicksCount: PropTypes.number,
        xAxisTicksFormat: PropTypes.func,
        yAxisTicksCount: PropTypes.number,
        yAxisTicksFormat: PropTypes.func,

        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,

        withBrush: PropTypes.bool,
        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool, // prop will get copied to state in constructor, changing it later will not update it, use setWithTooltip method to update it
        withZoom: PropTypes.bool,
        withTransition: PropTypes.bool,
        withToolbar: PropTypes.bool,
        withSettings: PropTypes.bool,
        withAutoRefreshOnBrush: PropTypes.bool,

        xMin: PropTypes.number, // props (limits) will get copied to state in constructor, changing it later will not update it, use setLimits method to update it (and combine it with getLimits if you need to update just one of them)
        xMax: PropTypes.number,
        yMin: PropTypes.number,
        yMax: PropTypes.number,

        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,
        zoomLevelStepFactor: PropTypes.number
    };

    static defaultProps = { }; // defaults set in ScatterPlotBase

    setLimits(xMin, xMax, yMin, yMax) {
        this.scatterPlotBase.setLimits(xMin, xMax, yMin, yMax);
    }
    getLimits() { return this.scatterPlotBase.getLimits(); }
    setMaxDotCount(newValue) {
        this.scatterPlotBase.setMaxDotCount(newValue);
    }
    setWithTooltip(newValue) {
        this.scatterPlotBase.setWithTooltip(newValue);
    }

    render() {
        return (
                <ScatterPlotBase ref={node => this.scatterPlotBase = node} {...this.props} />
        );
    }
}