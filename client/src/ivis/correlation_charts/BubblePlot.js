'use strict';

import React, {Component} from "react";
import {withErrorHandling} from "../../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {ScatterPlotBase} from "./ScatterPlotBase";
import {PropType_d3Color} from "../../lib/CustomPropTypes";

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
                X_sigCid: PropTypes.string.isRequired,
                Y_sigCid: PropTypes.string.isRequired,
                dotSize_sigCid: PropTypes.string.isRequired,
                colorContinuous_sigCid: PropTypes.string,
                colorDiscrete_sigCid: PropTypes.string,
                tsSigCid: PropTypes.string, // for use of TimeContext
                color: PropTypes.oneOfType([PropType_d3Color(), PropTypes.arrayOf(PropType_d3Color())]),
                label: PropTypes.string,
                enabled: PropTypes.bool,
                X_label: PropTypes.string,
                Y_label: PropTypes.string,
                Size_label: PropTypes.string,
                Color_label: PropTypes.string
            })).isRequired
        }).isRequired,

        maxDotCount: PropTypes.number, // set to negative number for unlimited; prop will get copied to state in constructor, changing it later will not update it, use setMaxDotCount method to update it
        minDotRadius: PropTypes.number,
        maxDotRadius: PropTypes.number,
        minDotRadiusValue: PropTypes.number,
        maxDotRadiusValue: PropTypes.number,
        colors: PropTypes.arrayOf(PropType_d3Color()), // if specified, uses same cScale for all signalSets that have color_sigCid and config.signalSets[*].color is not array
        highlightDotRadius: PropTypes.number, // radius multiplier
        updateColorOnZoom: PropTypes.bool,
        updateSizeOnZoom: PropTypes.bool,

        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,

        withBrush: PropTypes.bool,
        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool, // prop will get copied to state in constructor, changing it later will not update it, use setWithTooltip method to update it
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