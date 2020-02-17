'use strict';

import React, {Component} from "react";
import {withErrorHandling} from "../../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {ScatterPlotBase} from "./ScatterPlotBase";
import {PropTypeArrayWithLengthAtLeast} from "../common";


@withComponentMixins([
    withTranslation,
    withErrorHandling
])
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
                color: PropTypes.oneOfType([PropTypes.object, PropTypeArrayWithLengthAtLeast(1)]).isRequired,
                label: PropTypes.string,
                enabled: PropTypes.bool,
                dotSize_sigCid: PropTypes.string.isRequired,
                X_label: PropTypes.string,
                Y_label: PropTypes.string,
                Size_label: PropTypes.string
            })).isRequired
        }).isRequired,
        maxDotCount: PropTypes.number, // set to negative number for unlimited
        minDotRadius: PropTypes.number,
        maxDotRadius: PropTypes.number,
        minDotRadiusValue: PropTypes.number,
        maxDotRadiusValue: PropTypes.number,
        highlightDotRadius: PropTypes.number, // radius multiplier
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        withBrush: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withTransition: PropTypes.bool,

    };

    static defaultProps = {
        withBrush: true,
        withTooltip: true,
        withTransition: true
    };

    render() {
        return (
                <ScatterPlotBase {...this.props} />
        );
    }
}