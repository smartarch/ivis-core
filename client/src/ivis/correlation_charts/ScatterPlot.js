'use strict';

import React, {Component} from "react";
import {intervalAccessMixin} from "../TimeContext";
import {withErrorHandling} from "../../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {ScatterPlotBase} from "./ScatterPlotBase";
import styles from "../TimeRangeSelector.scss";
import {ActionLink, Icon} from "../../lib/bootstrap-components";
import {select} from "d3-selection";

@withComponentMixins([
    withTranslation
])
class ScatterPlotToolbar extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        zoomOutClick: PropTypes.func.isRequired,
    }

    render() {
        const t = this.props.t;

        return (
        <div className="card">
            <div className="card-header">
                <div className={styles.headingButtons}>
                    <ActionLink onClickAsync={async () => this.props.zoomOutClick() }><Icon icon="search-minus" title={t('Reset zoom')}/></ActionLink>
                </div>
            </div>
        </div>
        );
    }
}

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    intervalAccessMixin()
])
export class ScatterPlot extends Component {
    constructor(props) {
        super(props);

        this.state = {
            xMin: null,
            xMax: null,
            yMin: null,
            yMax: null
        };

        this.boundSetDefaultZoom = ::this.setDefaultZoom;
        this.boundSetZoom = ::this.setZoom;
    }

    static propTypes = {
        /**
         * config: {
         *      signalSets: [
         *      {
         *          cid: <signalSetCid>,
         *          X_sigCid: <signalCid>,
         *          Y_sigCid: <signalCid>,
         *          color: <color>,
         *          label: <text>,
         *          enabled: <boolean>
         *      }
         *      ]
         * }
         */
        config: PropTypes.object.isRequired,
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

    setDefaultZoom() {
        this.setState({
            xMin: null,
            xMax: null,
            yMin: null,
            yMax: null
        });
    }

    setZoom(xMin, xMax, yMin, yMax) {
        this.setState({
            xMin: xMin,
            xMax: xMax,
            yMin: yMin,
            yMax: yMax
        });
    }

    render() {
        const state = this.state;

        return (
            <div>
                <ScatterPlotToolbar zoomOutClick={this.boundSetDefaultZoom} />
                <ScatterPlotBase {...this.props}
                    setZoom={this.boundSetZoom}
                    xMin={state.xMin}
                    xMax={state.xMax}
                    yMin={state.yMin}
                    yMax={state.yMax}
                />
            </div>
        );

    }
}