'use strict';

import React, {Component} from "react";
import {withErrorHandling} from "../../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {ScatterPlotBase} from "./ScatterPlotBase";

@withComponentMixins([
    withTranslation,
    withErrorHandling
])
export class ScatterPlot extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                X_sigCid: PropTypes.string.isRequired,
                Y_sigCid: PropTypes.string.isRequired,
                color: PropTypes.object.isRequired,
                label: PropTypes.string,
                enabled: PropTypes.bool,
                dotRadius: PropTypes.number, // default = props.dotRadius; used when dotSize_sigCid is not specified
                X_label: PropTypes.string,
                Y_label: PropTypes.string,
                regressions: PropTypes.arrayOf(PropTypes.shape({
                    type: PropTypes.string.isRequired,
                    color: PropTypes.object,
                    bandwidth: PropTypes.number    // for LOESS
                }))
            })).isRequired
        }).isRequired,

        maxDotCount: PropTypes.number, // set to negative number for unlimited
        dotRadius: PropTypes.number,
        highlightDotRadius: PropTypes.number, // radius multiplier

        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,

        withBrush: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withTransition: PropTypes.bool,
        withRegressionCoefficients: PropTypes.bool,
        withToolbar: PropTypes.bool,
        withSettings: PropTypes.bool,
        withAutoRefreshOnBrush: PropTypes.bool,

        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,
        zoomLevelStepFactor: PropTypes.number
    };

    static defaultProps = {
        withBrush: true,
        withTooltip: true,
        withTransition: true,
        withToolbar: true,
        withSettings: true,
        withAutoRefreshOnBrush: true,

        zoomLevelMin: 1,
        zoomLevelMax: 4,
        zoomLevelStepFactor: 1.5
    };

    render() {
        return <ScatterPlotBase {...this.props} />;
    }
}