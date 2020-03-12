'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Array from "d3-array";
import * as d3Selection from "d3-selection";
import * as d3Brush from "d3-brush";
import * as d3Regression from "d3-regression";
import * as d3Shape from "d3-shape";
import * as d3Zoom from "d3-zoom";
import * as d3Interpolate from "d3-interpolate";
import * as d3Color from "d3-color";
import * as d3Scheme from "d3-scale-chromatic";
import {event as d3Event, select} from "d3-selection";
import {intervalAccessMixin} from "./TimeContext";
import {DataAccessSession} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {Tooltip} from "./Tooltip";
import {Button, CheckBox, Form, InputField, withForm} from "../lib/form";
import styles from "./CorrelationCharts.scss";
import {ActionLink, Icon} from "../lib/bootstrap-components";
import {
    distance,
    extentWithMargin,
    getColorScale,
    getExtent,
    isInExtent,
    isSignalVisible,
    ModifyColorCopy,
    roundTo, setZoomTransform, transitionInterpolate, WheelDelta
} from "./common";
import {PropType_d3Color_Required} from "../lib/CustomPropTypes";
import {dotShapes, dotShapeNames} from "./dot_shapes";

const ConfigDifference = {
    NONE: 0,
    RENDER: 1,
    DATA: 2,
    DATA_WITH_CLEAR: 3
};

function compareConfigs(conf1, conf2) {
    let diffResult = ConfigDifference.NONE;

    if (conf1.signalSets.length !== conf2.signalSets.length)
        return ConfigDifference.DATA_WITH_CLEAR;

    for (let i = 0; i < conf1.signalSets.length; i++) {
        const signalSetConfigComparison = compareSignalSetConfigs(conf1.signalSets[i], conf2.signalSets[i]);
        if (signalSetConfigComparison > diffResult)
            diffResult = signalSetConfigComparison;
    }

    return diffResult;
}

function compareSignalSetConfigs(conf1, conf2) {
    let diffResult = ConfigDifference.NONE;

    if (conf1.cid !== conf2.cid ||
        conf1.X_sigCid !== conf2.X_sigCid ||
        conf1.Y_sigCid !== conf2.Y_sigCid ||
        conf1.dotSize_sigCid !== conf2.dotSize_sigCid ||
        conf1.colorContinuous_sigCid !== conf2.colorContinuous_sigCid ||
        conf1.colorDiscrete_sigCid !== conf2.colorDiscrete_sigCid ||
        conf1.tsSigCid !== conf2.tsSigCid) {
        diffResult = ConfigDifference.DATA_WITH_CLEAR;
    } else if (conf1.color !== conf2.color ||
               conf1.enabled !== conf2.enabled ||
               conf1.label !== conf2.label ||
               conf1.X_label !== conf2.X_label ||
               conf1.Y_label !== conf2.Y_label ||
               conf1.Size_label !== conf2.Size_label ||
               conf1.Color_label !== conf2.Color_label ||
               conf1.regressions !== conf2.regressions) {
        diffResult = ConfigDifference.RENDER;
    }

    return diffResult;
}

class TooltipContent extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        selection: PropTypes.object
    };

    getLabel(cid, label, defaultLabel) {
        if (this.props.labels && this.props.labels[cid] && this.props.labels[cid][label])
            return this.props.labels[cid][label];
        else
            return defaultLabel;
    }

    render() {
        if (this.props.selection) {
            let tooltipHTML = [];
            for (let cid in this.props.selection) {
                const dot = this.props.selection[cid];
                if (dot) {
                    tooltipHTML.push((
                        <div key={cid}>
                            <div><b>{this.getLabel(cid, "label", cid)}</b></div>
                            <div>{this.getLabel(cid, "X_label", "x")}: {dot.x}</div>
                            <div>{this.getLabel(cid, "Y_label", "y")}: {dot.y}</div>
                            {dot.s && (
                                <div>{this.getLabel(cid, "Size_label", "size")}: {dot.s}</div>
                            )}
                            {dot.c && (
                                <div>{this.getLabel(cid, "Color_label", "color")}: {dot.c}</div>
                            )}
                            {dot.d && (
                                <div>{this.getLabel(cid, "Color_label", "category")}: {dot.d}</div>
                            )}
                        </div>
                    ));
                }
            }
            return tooltipHTML;
        } else {
            return null;
        }
    }
}

@withComponentMixins([
    withTranslation,
    withForm
])
class ScatterPlotToolbar extends Component {
    constructor(props) {
        super(props);

        this.state = {
            opened: false
        };

        this.initForm();
    }

    static propTypes = {
        resetZoomClick: PropTypes.func.isRequired,
        zoomOutClick: PropTypes.func,
        zoomInClick: PropTypes.func,
        reloadDataClick: PropTypes.func.isRequired,
        brushClick: PropTypes.func,
        setSettings: PropTypes.func,
        setLimits: PropTypes.func,
        withSettings: PropTypes.bool.isRequired,
        settings: PropTypes.object,
        brushInProgress: PropTypes.bool
    };

    static defaultProps = {
        withSettings: false
    };

    componentDidMount() {
        this.updateFormValues();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.settings !== prevProps.settings)
            this.updateFormValues();
    }

    updateFormValues() {
        let settings = this.props.settings;
        if (settings.maxDotCount < 0)
            settings.maxDotCount = "";
        if (isNaN(settings.xMin)) settings.xMin = "";
        if (isNaN(settings.xMax)) settings.xMax = "";
        if (isNaN(settings.yMin)) settings.yMin = "";
        if (isNaN(settings.yMax)) settings.yMax = "";

        this.populateFormValues(settings);
    }

    localValidateFormValues(state) {
        this.validateNumber(state, "maxDotCount", "Maximum number of dots must be empty or a number.");
        this.validateNumber(state, "xMin","X axis minimum must be empty or a number.");
        this.validateNumber(state, "xMax","Y axis maximum must be empty or a number.");
        this.validateNumber(state, "yMin","Y axis minimum must be empty or a number.");
        this.validateNumber(state, "yMax","Y axis maximum must be empty or a number.");
    }

    validateNumber(state, numberFormId, errorMessage) {
        const t = this.props.t;
        const num = state.getIn([numberFormId, 'value']);
        if (num !== undefined && num !== "" && isNaN(num)) {
            state.setIn([numberFormId, 'error'], t(errorMessage));
        }
        else
            state.setIn([numberFormId, 'error'], null);
    }

    async submitForm() {
        if (this.isFormWithoutErrors()) {
            let maxDotCount = this.getFormValue('maxDotCount');
            let xMin = this.getFormValue("xMin");
            let xMax = this.getFormValue("xMax");
            let yMin = this.getFormValue("yMin");
            let yMax = this.getFormValue("yMax");
            const withTooltip = this.getFormValue('withTooltip');

            if (maxDotCount === undefined || maxDotCount === "")
                maxDotCount = -1;
            else
                maxDotCount = parseInt(maxDotCount);
            xMin = parseFloat(xMin);
            xMax = parseFloat(xMax);
            yMin = parseFloat(yMin);
            yMax = parseFloat(yMax);

            this.props.setSettings(maxDotCount, withTooltip);
            this.props.setLimits(xMin, xMax, yMin, yMax);

            this.setState({
                opened: false
            });

        } else {
            this.showFormValidation();
        }
    }

    render() {
        const t = this.props.t;

        return (
            <div className="card">
                <div className="card-header" /*onClick={() => this.setState({opened: !this.state.opened})}*/>
                    <div className={styles.headingButtons}>
                        {this.props.zoomOutClick && <ActionLink onClickAsync={async () => this.props.zoomOutClick()}><Icon icon="search-minus" title={t('Zoom out')}/></ActionLink>}
                        {this.props.zoomInClick && <ActionLink onClickAsync={async () => this.props.zoomInClick()}><Icon icon="search-plus" title={t('Zoom in')}/></ActionLink>}
                        <ActionLink onClickAsync={async () => this.props.reloadDataClick()}><Icon icon="redo" title={t('Reload data')}/></ActionLink>
                        {this.props.brushClick &&
                        <ActionLink onClickAsync={async () => this.props.brushClick()}
                                    className={this.props.brushInProgress ? styles.active : ""}>
                            <Icon icon="edit"
                                  title={this.props.brushInProgress ? t('Cancel selection') : t('Select area')}/>
                        </ActionLink>}
                        <ActionLink onClickAsync={async () => this.props.resetZoomClick()}><Icon icon="backspace" title={t('Reset zoom')}/></ActionLink>
                        {this.props.withSettings &&
                        <ActionLink onClickAsync={async () => this.setState({opened: !this.state.opened})}><Icon icon="sliders-h" title={t('Open settings')}/></ActionLink>}
                    </div>
                </div>
                {this.state.opened && this.props.withSettings &&
                <div className="card-body">
                    <Form stateOwner={this} onSubmitAsync={::this.submitForm} format="wide">
                        <InputField id="maxDotCount" label={t('Maximum number of dots')}
                                    help={"Keep empty for unlimited."}/>
                        <CheckBox id={"withTooltip"} label={t("Show tooltip")}/>
                        <InputField id="xMin" label={t('X axis minimum')}/>
                        <InputField id="xMax" label={t('X axis maximum')}/>
                        <InputField id="yMin" label={t('Y axis minimum')}/>
                        <InputField id="yMax" label={t('Y axis maximum')}/>
                        <Button type="submit" className="btn-primary" label={t('Apply')}/>
                    </Form>
                </div>
                }
            </div>
        );
    }
}

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    intervalAccessMixin()
], ["setMaxDotCount", "setWithTooltip", "getLimits", "setLimits"])
export class ScatterPlotBase extends Component {
    //<editor-fold desc="React methods, constructor">
    constructor(props) {
        super(props);

        const t = props.t;
        this.dataAccessSession = new DataAccessSession();
        this.resizeListener = () => {
            this.createChart();
        };
        this.labels = {};
        this.globalRegressions = [];
        this.regressions = [];

        this.brush = null;
        this.zoom = null;

        this.state = {
            signalSetsData: null, // data from last request
            globalSignalSetsData: null, // data from request without range filters (completely zoomed out)
            statusMsg: t('Loading...'),
            width: 0,
            selections: null,
            zoomTransform: d3Zoom.zoomIdentity,
            zoomYScaleMultiplier: 1,
            zoomInProgress: false,
            brushInProgress: false,
            xMin: props.xMin,
            xMax: props.xMax,
            yMin: props.yMin,
            yMax: props.yMax,
            withTooltip: props.withTooltip,
            maxDotCount: props.maxDotCount,
            noData: true
        };
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                X_sigCid: PropTypes.string.isRequired,
                Y_sigCid: PropTypes.string.isRequired,
                dotSize_sigCid: PropTypes.string, // used for BubblePlot
                colorContinuous_sigCid: PropTypes.string,
                colorDiscrete_sigCid: PropTypes.string,
                tsSigCid: PropTypes.string, // for use of TimeContext
                color: PropTypes.oneOfType([PropType_d3Color_Required(), PropTypes.arrayOf(PropType_d3Color_Required())]),
                label: PropTypes.string,
                enabled: PropTypes.bool,
                dotShape: PropTypes.oneOf(dotShapeNames), // default = ScatterPlotBase.dotShape
                dotGlobalShape: PropTypes.oneOf(dotShapeNames), // default = ScatterPlotBase.dotGlobalShape
                dotSize: PropTypes.number, // default = props.dotRadius; used when dotSize_sigCid is not specified
                X_label: PropTypes.string,
                Y_label: PropTypes.string,
                Size_label: PropTypes.string, // for BubblePlot
                Color_label: PropTypes.string,
                regressions: PropTypes.arrayOf(PropTypes.shape({
                    type: PropTypes.string.isRequired,
                    color: PropTypes.oneOfType([PropType_d3Color_Required(), PropTypes.arrayOf(PropType_d3Color_Required())]),
                    createRegressionForEachColor: PropTypes.bool, // default: false
                    bandwidth: PropTypes.number,    // for LOESS
                    // order: PropTypes.number         // for polynomial
                }))
            })).isRequired
        }).isRequired,

        maxDotCount: PropTypes.number, // set to negative number for unlimited; prop will get copied to state in constructor, changing it later will not update it, use setMaxDotCount method to update it
        dotSize: PropTypes.number,
        minDotSize: PropTypes.number, // for BubblePlot
        maxDotSize: PropTypes.number, // for BubblePlot
        minDotSizeValue: PropTypes.number, // for BubblePlot
        maxDotSizeValue: PropTypes.number, // for BubblePlot
        colors: PropTypes.arrayOf(PropType_d3Color_Required()), // if specified, uses same cScale for all signalSets that have color*_sigCid and config.signalSets[*].color is not array
        minColorValue: PropTypes.number,
        maxColorValue: PropTypes.number,
        highlightDotSize: PropTypes.number, // radius multiplier
        xAxisExtentFromSampledData: PropTypes.bool, // whether xExtent should be [min, max] of the whole signal or only of the returned docs
        yAxisExtentFromSampledData: PropTypes.bool,
        updateColorOnZoom: PropTypes.bool,
        updateSizeOnZoom: PropTypes.bool, // for BubblePlot

        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,

        withBrush: PropTypes.bool,
        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool, // prop will get copied to state in constructor, changing it later will not update it, use setSettings to update it
        withZoom: PropTypes.bool,
        withTransition: PropTypes.bool,
        withRegressionCoefficients: PropTypes.bool,
        withToolbar: PropTypes.bool,
        withSettings: PropTypes.bool,
        withAutoRefreshOnBrush: PropTypes.bool,

        xMin: PropTypes.number, // these will get copied to state in constructor, changing them later will not update them, use setLimits to update them
        xMax: PropTypes.number,
        yMin: PropTypes.number,
        yMax: PropTypes.number,

        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,
        zoomLevelStepFactor: PropTypes.number
    };

    static defaultProps = {
        withBrush: true,
        withCursor: true,
        withTooltip: true,
        withZoom: true,
        withTransition: true,
        withRegressionCoefficients: true,
        withToolbar: true,
        withSettings: true,
        withAutoRefreshOnBrush: true,

        xMin: NaN,
        xMax: NaN,
        yMin: NaN,
        yMax: NaN,

        dotSize: 5,
        minDotSize: 2,
        maxDotSize: 14,
        highlightDotSize: 1.2,
        xAxisExtentFromSampledData: false,
        yAxisExtentFromSampledData: false,
        updateColorOnZoom: false,
        updateSizeOnZoom: false,
        maxDotCount: 100,
        zoomLevelMin: 1,
        zoomLevelMax: 10,
        zoomLevelStepFactor: 1.5,
        colors: d3Scheme.schemeCategory10
    };

    static defaultDotShape = "circle";
    static defaultDotGlobalShape = "circle_empty";

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(false);
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData();
    }

    componentDidUpdate(prevProps, prevState) {
        const t = this.props.t;

        let configDiff = compareConfigs(this.props.config, prevProps.config);

        if (this.state.maxDotCount !== prevState.maxDotCount)
            configDiff = Math.max(configDiff, ConfigDifference.DATA_WITH_CLEAR);
        if (this.props.colors !== prevProps.colors)
            configDiff = Math.max(configDiff, ConfigDifference.RENDER);

        if (this.props.colors.length === 0)
            throw new Error("ScatterPlotBase: 'colors' prop must contain at least one element. You may omit it completely for default value.");

        const considerTs =  this.props.config.signalSets.some(setConf => !!setConf.tsSigCid);
        if (considerTs) {
            const prevAbs = this.getIntervalAbsolute(prevProps);
            const prevSpec = this.getIntervalSpec(prevProps);

            if (prevSpec !== this.getIntervalSpec()) {
                configDiff = Math.max(configDiff, ConfigDifference.DATA_WITH_CLEAR);
            } else if (prevAbs !== this.getIntervalAbsolute()) { // If its just a regular refresh, don't clear the chart
                configDiff = Math.max(configDiff, ConfigDifference.DATA);
            }
        }

        if (configDiff === ConfigDifference.DATA_WITH_CLEAR)
        {
            this.setState({
                signalSetsData: null,
                globalSignalSetsData: null,
                statusMsg: t('Loading...'),
                xMin: this.props.xMin,
                xMax: this.props.xMax,
                yMin: this.props.yMin,
                yMax: this.props.yMax,
                zoomTransform: d3Zoom.zoomIdentity,
                zoomYScaleMultiplier: 1
            }, () => this.fetchData());
        }
        else if (configDiff === ConfigDifference.DATA) {
            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();
        }
        else {
            const forceRefresh = this.prevContainerNode !== this.containerNode
                || prevState.signalSetsData !== this.state.signalSetsData
                || prevState.globalSignalSetsData !== this.state.globalSignalSetsData
                || prevState.brushInProgress !== this.state.brushInProgress
                || prevState.zoomYScaleMultiplier !== this.state.zoomYScaleMultiplier // update zoom extent
                || configDiff !== ConfigDifference.NONE;

            const updateZoom = !Object.is(prevState.zoomTransform, this.state.zoomTransform);

            this.createChart(forceRefresh, updateZoom);
            this.prevContainerNode = this.containerNode;
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }
    //</editor-fold>

    getQueries(xMin, xMax, yMin, yMax) {
        const config = this.props.config;
        const queries = [];
        let queryWithRangeFilter = !isNaN(xMin) || !isNaN(xMax) || !isNaN(yMin) || !isNaN(yMax);
        const aggsQueriesSignalSetIndices = [];

        for (const [i, signalSet] of config.signalSets.entries()) {
            let filter = {
                type: 'and',
                children: [
                    {
                        type: "function_score",
                        function: {
                            "random_score": {}
                        }
                    }
                ]
            };

            if (signalSet.tsSigCid) {
                const abs = this.getIntervalAbsolute();
                filter.children.push({
                    type: 'range',
                    sigCid: signalSet.tsSigCid,
                    gte: abs.from.toISOString(),
                    lt: abs.to.toISOString()
                });
            }

            if (Math.abs(this.state.zoomTransform.k - 1) > 0.01 ||
                Math.abs(this.state.zoomYScaleMultiplier - 1) > 0.01 ||
                Math.abs(this.state.zoomTransform.x) > 3 ||
                Math.abs(this.state.zoomTransform.y) > 3) {

                queryWithRangeFilter = true;

                // update limits with current zoom (if not set yet)
                if (xMin === undefined && !isNaN(this.state.xMin))
                    xMin = this.state.xMin;
                if (xMax === undefined && !isNaN(this.state.xMax))
                    xMax = this.state.xMax;
                if (yMin === undefined && !isNaN(this.state.yMin))
                    yMin = this.state.yMin;
                if (yMax === undefined && !isNaN(this.state.yMax))
                    yMax = this.state.yMax;
                // TODO does not work when updating after brush zoom!!!
            }

            // set limits to props (if not set yet)
            if (xMin === undefined && !isNaN(this.props.xMin))
                xMin = this.props.xMin;
            if (xMax === undefined && !isNaN(this.props.xMax))
                xMax = this.props.xMax;
            if (yMin === undefined && !isNaN(this.props.yMin))
                yMin = this.props.yMin;
            if (yMax === undefined && !isNaN(this.props.yMax))
                yMax = this.props.yMax;

            // add x and y filters
            if (!isNaN(xMin))
                filter.children.push({
                    type: "range",
                    sigCid: signalSet.X_sigCid,
                    gte: xMin
                });
            if (!isNaN(xMax))
                filter.children.push({
                    type: "range",
                    sigCid: signalSet.X_sigCid,
                    lte: xMax
                });
            if (!isNaN(yMin))
                filter.children.push({
                    type: "range",
                    sigCid: signalSet.Y_sigCid,
                    gte: yMin
                });
            if (!isNaN(yMax))
                filter.children.push({
                    type: "range",
                    sigCid: signalSet.Y_sigCid,
                    lte: yMax
                });

            let limit = undefined;
            if (this.state.maxDotCount >= 0) {
                limit = this.state.maxDotCount;
            }

            let signals = [signalSet.X_sigCid, signalSet.Y_sigCid];
            if (signalSet.dotSize_sigCid)
                signals.push(signalSet.dotSize_sigCid);
            if (signalSet.colorContinuous_sigCid)
                signals.push(signalSet.colorContinuous_sigCid);
            if (signalSet.colorDiscrete_sigCid) {
                signals.push(signalSet.colorDiscrete_sigCid);

                if (!queryWithRangeFilter) {
                    const aggs = [{
                        sigCid: signalSet.colorDiscrete_sigCid,
                        agg_type: "terms"
                    }];
                    queries.push({
                        type: "aggs",
                        args: [signalSet.cid, filter, aggs]
                    });
                    aggsQueriesSignalSetIndices.push(i);
                }
            }

            queries.push({
                type: "docs",
                args: [ signalSet.cid, signals, filter, undefined, limit ]
            });

            if (!queryWithRangeFilter) {
                const summary = {
                    signals: {}
                };
                summary.signals[signalSet.X_sigCid] = ["min", "max"];
                summary.signals[signalSet.Y_sigCid] = ["min", "max"];
                if (signalSet.dotSize_sigCid)
                    summary.signals[signalSet.dotSize_sigCid] = ["min", "max"];
                if (signalSet.colorContinuous_sigCid)
                    summary.signals[signalSet.colorContinuous_sigCid] = ["min", "max"];
                queries.push({
                    type: "summary",
                    args: [ signalSet.cid, filter, summary ]
                });
            }
        }

        return [ queries, queryWithRangeFilter, aggsQueriesSignalSetIndices ];
    }

    @withAsyncErrorHandler
    async fetchData(xMin, xMax, yMin, yMax) {
        try {
            const [queries, queryWithRangeFilter, aggsQueriesSignalSetIndices] = this.getQueries(xMin, xMax, yMin, yMax);
            const results = await this.dataAccessSession.getLatestMixed(queries);

            if (results) { // Results is null if the results returned are not the latest ones
                const processedResults = this.processData(results.filter((_, i) => queries[i].type === "docs"));

                if (!queryWithRangeFilter) { // zoomed completely out
                    // update extents of axes
                    const summaries = results.filter((_, i) => queries[i].type === "summary");
                    //<editor-fold desc="Y extent">
                    if (this.props.yAxisExtentFromSampledData)
                        this.yExtent = getExtent(processedResults, function (d) {  return d.y });
                    else {
                        const yMin = d3Array.min(results.filter((_, i) => queries[i].type === "summary"), (summary, i) => {
                            return summary[this.props.config.signalSets[i].Y_sigCid].min;
                        });
                        const yMax = d3Array.min(results.filter((_, i) => queries[i].type === "summary"), (summary, i) => {
                            return summary[this.props.config.signalSets[i].Y_sigCid].max;
                        });
                        this.yExtent = [yMin, yMax];
                    }
                    this.yExtent = extentWithMargin(this.yExtent, 0.05);
                    if (!isNaN(this.props.yMin)) this.yExtent[0] = this.props.yMin;
                    if (!isNaN(this.props.yMax)) this.yExtent[1] = this.props.yMax;
                    //</editor-fold>
                    //<editor-fold desc="X extent">
                    if (this.props.xAxisExtentFromSampledData)
                        this.xExtent = getExtent(processedResults, function (d) {  return d.x });
                    else {
                        const xMin = d3Array.min(summaries, (summary, i) => {
                            return summary[this.props.config.signalSets[i].X_sigCid].min;
                        });
                        const xMax = d3Array.min(summaries, (summary, i) => {
                            return summary[this.props.config.signalSets[i].X_sigCid].max;
                        });
                        this.xExtent = [xMin, xMax];
                    }
                    this.xExtent = extentWithMargin(this.xExtent, 0.05);
                    if (!isNaN(this.props.xMin)) this.xExtent[0] = this.props.xMin;
                    if (!isNaN(this.props.xMax)) this.xExtent[1] = this.props.xMax;
                    //</editor-fold>
                    //<editor-fold desc="Size extent">
                    const sMin = d3Array.min(summaries, (summary, i) => {
                        if (this.props.config.signalSets[i].hasOwnProperty("dotSize_sigCid"))
                            return summary[this.props.config.signalSets[i].dotSize_sigCid].min;
                    });
                    const sMax = d3Array.min(summaries, (summary, i) => {
                        if (this.props.config.signalSets[i].hasOwnProperty("dotSize_sigCid"))
                            return summary[this.props.config.signalSets[i].dotSize_sigCid].max;
                    });
                    this.sExtent = this.updateSExtent([sMin, sMax]);
                    //</editor-fold>
                    //<editor-fold desc="Color (continuous) extent">
                    this.cExtents = [];
                    for (let i = 0; i < processedResults.length; i++) {
                        const signalSetConfig = this.props.config.signalSets[i];
                        if (signalSetConfig.hasOwnProperty("colorContinuous_sigCid")) {
                            const signal = summaries[i][signalSetConfig.colorContinuous_sigCid];
                            this.cExtents[i] = this.updateCExtent([signal.min, signal.max]);
                        }
                    }
                    this.cExtent = [ d3Array.min(this.cExtents, ex => ex[0]), d3Array.max(this.cExtents, ex => ex[1]) ];
                    //</editor-fold>
                    //<editor-fold desc="Color (discrete) extent">
                    this.dExtents = [];
                    for (const [j, res] of results.filter((_, i) => queries[i].type === "aggs").entries()) {
                        const buckets = res[0].buckets;
                        const i = aggsQueriesSignalSetIndices[j];
                        this.dExtents[i] = buckets.map(b => b.key);
                    }
                    this.dExtent = [...new Set(this.dExtents.flat())]; // get all keys in extents and then keeps only unique values
                    //</editor-fold>
                }

                this.setState({
                    signalSetsData: processedResults
                });

                if (!queryWithRangeFilter) { // zoomed completely out
                    this.setState({
                        globalSignalSetsData: processedResults
                    });
                    this.globalRegressions = await this.createRegressions(processedResults);
                }

                this.regressions = await this.createRegressions(processedResults);
                this.createChart(true);
            }
        } catch (err) {
            throw err;
        }
    }

    createChart(forceRefresh, updateZoom) {
        const signalSetsData = this.state.signalSetsData;
        const globalSignalSetsData = this.state.globalSignalSetsData;

        const width = this.containerNode.getClientRects()[0].width;
        if (this.state.width !== width) {
            this.setState({
                width
            });
        }
        const widthChanged = width !== this.renderedWidth;
        if (!forceRefresh && !widthChanged && !updateZoom) {
            return;
        }
        this.renderedWidth = width;

        if (!signalSetsData || !globalSignalSetsData) {
            return;
        }

        const noData = !signalSetsData.some(d => d.length > 0);
        this.setState({noData});
        if (noData) {
            this.statusMsgSelection.text(this.props.t('No data.'));

            this.brushParentSelection
                .on('mouseenter', null)
                .on('mousemove', null)
                .on('mouseleave', null);

            this.brush = null;
            this.zoom = null;

            return;
        }

        this.statusMsgSelection.text("");
        this.updateLabels();

        const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
        const xSize = width - this.props.margin.left - this.props.margin.right;
        const SignalSetsConfigs = this.props.config.signalSets;

        //<editor-fold desc="X and Y Scales">
        // y Scale
        const yScale = this.state.zoomTransform.scale(this.state.zoomYScaleMultiplier).rescaleY(d3Scale.scaleLinear()
            .domain(this.yExtent)
            .range([ySize, 0]));
        this.yScale = yScale;
        const yAxis = d3Axis.axisLeft(yScale);
        this.yAxisSelection.call(yAxis);

        // x Scale
        const xScale = this.state.zoomTransform.rescaleX(d3Scale.scaleLinear()
            .domain(this.xExtent)
            .range([0, xSize]));
        this.xScale = xScale;
        const xAxis = d3Axis.axisBottom(xScale);
        this.xAxisSelection.call(xAxis);
        //</editor-fold>

        // data filtering
        const filteredData = this.filterData(signalSetsData, xScale.domain(), yScale.domain());
        const filteredGlobalData = this.filterData(globalSignalSetsData, xScale.domain(), yScale.domain());

        //<editor-fold desc="Size and Color Scales">
        // s Scale (dot size)
        let sScale = undefined;
        if (SignalSetsConfigs.some((cfg) => cfg.hasOwnProperty("dotSize_sigCid"))) {
            let sExtent = this.sExtent;
            if (this.props.updateSizeOnZoom) {
                const allFilteredData = filteredData.concat(filteredGlobalData);
                if (allFilteredData.length > 1) {
                    sExtent = this.getSExtent_notFlat(allFilteredData);
                }
            }

            sScale = d3Scale.scaleSqrt()
                .domain(sExtent)
                .range([this.props.minDotSize, this.props.maxDotSize]);
        }

        // c Scale (color)
        let cScales = [];
        let cExtents = this.cExtents, cExtent = this.cExtent;
        if (this.props.updateColorOnZoom && SignalSetsConfigs.some(cfg => cfg.hasOwnProperty("colorContinuous_sigCid"))) {
            // recompute extents on filtered data
            for (let i = 0; i < filteredData.length; i++) {
                if (SignalSetsConfigs[i].hasOwnProperty("colorContinuous_sigCid")) {
                    const allFilteredData = filteredData[i].concat(filteredGlobalData[i]);
                    if (allFilteredData.length > 1)
                        cExtents[i] = this.getCExtent(allFilteredData);
                }
            }
            cExtent = [ d3Array.min(cExtents, ex => ex[0]), d3Array.max(cExtents, ex => ex[1]) ];
        }
        for (let i = 0; i < filteredData.length; i++) {
            const signalSetConfig = SignalSetsConfigs[i];
            if (signalSetConfig.hasOwnProperty("colorContinuous_sigCid")) {
                if (Array.isArray(signalSetConfig.color) && signalSetConfig.color.length > 0)
                    cScales.push(getColorScale(cExtents[i], signalSetConfig.color));
                else
                    cScales.push(getColorScale(cExtent, this.props.colors));
            }
            else if (signalSetConfig.hasOwnProperty("colorDiscrete_sigCid")) {
                if (Array.isArray(signalSetConfig.color) && signalSetConfig.color.length > 0) {
                    const dExtent = this.dExtents[i];
                    if (dExtent.length > signalSetConfig.color.length)
                        console.warn("More values than colors in signal set config " + i + ". Colors will be repeated."); // TODO better warning
                    cScales.push(d3Scale.scaleOrdinal(dExtent, signalSetConfig.color));
                }
                else {
                    if (this.dExtent.length > this.props.colors.length)
                        console.warn("More values than colors in props. Colors will be repeated."); // TODO better warning
                    cScales.push(d3Scale.scaleOrdinal(this.dExtent, this.props.colors));
                }
            }
            else {
                let color = this.getColor(i);
                cScales.push(_ => color);
            }
        }
        //</editor-fold>

        // draw data
        for (let i = 0; i < filteredData.length; i++) {
            const cidIndex = SignalSetsConfigs[i].cid + "-" + i;
            this.drawDots(filteredData[i], this.dotsSelection[cidIndex], xScale, yScale, sScale, cScales[i], SignalSetsConfigs[i], SignalSetsConfigs[i].dotShape || ScatterPlotBase.defaultDotShape);
            this.drawDots(filteredGlobalData[i], this.dotsGlobalSelection[cidIndex], xScale, yScale, sScale, cScales[i], SignalSetsConfigs[i], SignalSetsConfigs[i].dotGlobalShape || ScatterPlotBase.defaultDotGlobalShape, c => ModifyColorCopy(c, 0.5));
        }
        this.drawRegressions(xScale, yScale, cScales);

        this.createChartCursor(xScale, yScale, sScale, cScales, filteredData);

        // we don't want to change brush and zoom when updating only zoom (it breaks touch drag)
        if (forceRefresh || widthChanged) {
            this.createChartBrush();
            if (this.props.withZoom)
                this.createChartZoom(xSize, ySize);
        }
    }

    //<editor-fold desc="Data processing">
    /**
     * renames data from all signalSets to be in format [{x,y}]
     */
    processData(signalSetsData) {
        const config = this.props.config;
        let ret = [];

        for (let i = 0; i < config.signalSets.length; i++) {
            const signalSetConfig = config.signalSets[i];
            let data = [];
            for (const d of signalSetsData[i]) {
                let d1 = {
                    x: d[signalSetConfig.X_sigCid],
                    y: d[signalSetConfig.Y_sigCid]
                };
                if (signalSetConfig.dotSize_sigCid)
                    d1.s = d[signalSetConfig.dotSize_sigCid];
                if (signalSetConfig.colorContinuous_sigCid)
                    d1.c = d[signalSetConfig.colorContinuous_sigCid];
                if (signalSetConfig.colorDiscrete_sigCid)
                    d1.d = d[signalSetConfig.colorDiscrete_sigCid];
                data.push(d1);
            }
            ret.push(data);
        }
        return ret;
    }

    getCExtent(data) {
        let extent = d3Array.extent(data, d => d.c);
        return this.updateCExtent(extent);
    }

    updateCExtent(extent) {
        if (this.props.hasOwnProperty("minColorValue"))
            extent[0] = this.props.minColorValue;
        if (this.props.hasOwnProperty("maxColorValue"))
            extent[1] = this.props.maxColorValue;
        return extent;
    }

    getSExtent_notFlat(data) {
        let extent = getExtent(data, d => d.s);
        return this.updateSExtent(extent);
    }

    updateSExtent(extent) {
        if (this.props.hasOwnProperty("minDotRadiusValue"))
            extent[0] = this.props.minDotSizeValue;
        if (this.props.hasOwnProperty("maxDotRadiusValue"))
            extent[1] = this.props.maxDotSizeValue;
        return extent;
    }

    updateLabels() {
        // used for Tooltip
        this.labels = {};
        for (let i = 0; i < this.props.config.signalSets.length; i++) {
            const signalSetConfig = this.props.config.signalSets[i];
            this.labels[signalSetConfig.cid + "-" + i] = {};
            if (signalSetConfig.label)
                this.labels[signalSetConfig.cid + "-" + i].label = signalSetConfig.label;
            if (signalSetConfig.X_label)
                this.labels[signalSetConfig.cid + "-" + i].X_label = signalSetConfig.X_label;
            if (signalSetConfig.Y_label)
                this.labels[signalSetConfig.cid + "-" + i].Y_label = signalSetConfig.Y_label;
            if (signalSetConfig.Size_label)
                this.labels[signalSetConfig.cid + "-" + i].Size_label = signalSetConfig.Size_label;
            if (signalSetConfig.Color_label)
                this.labels[signalSetConfig.cid + "-" + i].Color_label = signalSetConfig.Color_label;
        }
    }

    filterData(setsData, xExtent, yExtent) {
        return setsData.map((data, i) => {
            if (!isSignalVisible(this.props.config.signalSets[i]))
                return [];
            return data.filter(d => isInExtent(d.x, xExtent) && isInExtent(d.y, yExtent))
        });
    }
    //</editor-fold>

    //<editor-fold desc="Data drawing">
    getColor(index) {
        let color = this.props.config.signalSets[index].color || this.props.colors[index] || d3Color.color("black");
        if (Array.isArray(color))
            return color[0];
        else
            return color;
    }

    /** data = [{ x, y, s?, c?, d? }], dotShape = id (excl. '#') */
    drawDots(data, selection, xScale, yScale, sScale, cScale, signalSetConfig, dotShape, modifyColor) {
        const size = (signalSetConfig.dotSize ? signalSetConfig.dotSize : this.props.dotSize);
        const constantSize = !signalSetConfig.hasOwnProperty("dotSize_sigCid");
        const s = d => constantSize ? size : sScale(d.s);
        if (modifyColor === undefined)
            modifyColor = c => c;

        if (dotShape === "none") {
            selection.selectAll('use').remove();
            return;
        }
        dotShape = "#" + dotShape;

        // create global dots on chart
        const dots = selection
            .selectAll('use')
            .data(data, (d) => {
                return d.x + " " + d.y;
            });

        // enter
        const allDots = dots.enter()
            .append('use')
            .attr('href', dotShape)
            .attr('transform', "scale(0)")
            .merge(dots)
            .attr('x', d => xScale(d.x))
            .attr('y', d => yScale(d.y))
            .style("transform-origin", d => `${xScale(d.x)}px ${yScale(d.y)}px`);

        // update
        (this.props.withTransition ? allDots.transition() : allDots)
            .attr('transform', d => `scale(${s(d)})`)
            .attr('fill', d => modifyColor(cScale(d.c || d.d)))
            .attr('stroke', d => modifyColor(cScale(d.c || d.d)));

        // remove
        dots.exit()
            .remove();
    }
    //</editor-fold>

    //<editor-fold desc="Regressions">
    async createRegressions(SignalSetsData) {
        let ret = [];
        for (let i = 0; i < SignalSetsData.length; i++) {
            const data = SignalSetsData[i];
            const signalSetConfig = this.props.config.signalSets[i];

            if (signalSetConfig.hasOwnProperty("regressions")) {
                for (const regConfig of signalSetConfig.regressions) {
                    if (regConfig.hasOwnProperty("createRegressionForEachColor") && regConfig.createRegressionForEachColor && signalSetConfig.hasOwnProperty("colorDiscrete_sigCid")) {
                        for (const category of this.dExtents[i]) {
                            const reg = this.createRegression(data.filter(d => d.d === category), this.xExtent, regConfig, signalSetConfig);
                            if (reg === undefined)
                                continue;

                            reg.filter = category;
                            reg.label += ": " + category;
                            reg.signalSetIndex = i;
                            ret.push(reg);
                        }
                    } else {
                        const reg = this.createRegression(data, this.xExtent, regConfig, signalSetConfig);
                        if (reg === undefined)
                            continue;

                        reg.signalSetIndex = i;
                        ret.push(reg);
                    }
                }
            }
        }
        return ret;
    }

    createRegression(data, domain, regressionConfig, signalSetConfig) {
        let regression;
        switch (regressionConfig.type) {
            case "linear":
                regression = d3Regression.regressionLinear();
                break;
            /* other types of regressions are to slow to compute
            case "exponential":
                regression = d3Regression.regressionExp();
                break;
            case "logarithmic":
                regression = d3Regression.regressionLog();
                break;
            case "quadratic":
                regression = d3Regression.regressionQuad();
                break;
            case "polynomial":
                regression = d3Regression.regressionPoly();
                if (regressionConfig.order)
                    regression.order(regressionConfig.order);
                break;
            case "power":
                regression = d3Regression.regressionPow();
                break;
            /**/
            case "loess":
                regression = d3Regression.regressionLoess();
                if (regressionConfig.bandwidth)
                    regression.bandwidth(regressionConfig.bandwidth);
                break;
            default:
                console.error("Regression type not supported: ", regressionConfig.type);
                return undefined;
        }

        regression.x(d => d.x)
                  .y(d => d.y);
        if (typeof regression.domain === "function")
            regression.domain(domain);

        return {
            data: regression(data),
            label: signalSetConfig.label ? signalSetConfig.label : signalSetConfig.cid,
            config: regressionConfig
        };
    }

    getRegressionColor(regression, cScales) {
        if (Array.isArray(regression.config.color) && regression.config.color.length > 0) {
            if (regression.filter) {
                const i = this.dExtents[regression.signalSetIndex].indexOf(regression.filter) % regression.config.color.length;
                return regression.config.color[i];
            }
            else
                return regression.config.color[0];
        }
        else if (regression.config.color)
            return regression.config.color;
        else {
            if (regression.filter)
                return cScales[regression.signalSetIndex](regression.filter);
            else
                return this.getColor(regression.signalSetIndex);
        }
    }

    drawRegressions(xScale, yScale, cScales) {
        for (let i = 0; i < this.globalRegressions.length; i++) {
            this.globalRegressions[i].color = ModifyColorCopy(this.getRegressionColor( this.globalRegressions[i], cScales), 0.3);
        }
        for (let i = 0; i < this.regressions.length; i++) {
            this.regressions[i].color = this.getRegressionColor(this.regressions[i], cScales);
        }

        const regressions = this.regressionsSelection
            .selectAll("path")
            .data(d3Array.merge([this.globalRegressions, this.regressions])
                .filter(reg => isSignalVisible(this.props.config.signalSets[reg.signalSetIndex])));

        const lineGenerator = d3Shape.line()
            .x(d => xScale(d[0]))
            .y(d => yScale(d[1]))
            .curve(d3Shape.curveBasis);

        regressions.enter()
            .append('path')
            .attr('stroke-width', "2px")
            .attr('fill', 'none')
            .merge(regressions)
            .attr('stroke', d => d.color)
            .attr('d', d => lineGenerator(d.data));

        regressions.exit()
            .remove();

        this.drawRegressionCoefficients();
    }

    drawRegressionCoefficients() {
        if (!this.props.withRegressionCoefficients)
            return;

        this.regressionsCoefficients.selectAll("*").remove();

        if (this.regressions.length <= 0)
            return;

        this.regressionsCoefficients.append("h4").text("Linear regression coefficients");

        const coeffs = this.regressionsCoefficients
            .selectAll("div")
            .data(this.regressions);

        coeffs.enter().append("div")
            .merge(coeffs)
            .html(d => {
            if (d.data.hasOwnProperty("a"))
                return `<b>${d.label}</b>: <i>slope:</i> ${roundTo(d.data.a, 3)}; <i>intercept:</i> ${roundTo(d.data.b, 3)}`;
        });
    }
    //</editor-fold>

    //<editor-fold desc="Cursor and Brush">
    createChartCursor(xScale, yScale, sScale, cScales, setsData) {
        const self = this;

        let selections = this.state.selections;
        let mousePosition;

        const selectPoints = function () {
            const containerPos = d3Selection.mouse(self.containerNode);
            const x = containerPos[0] - self.props.margin.left;
            const y = containerPos[1] - self.props.margin.top;

            let newSelections = {};

            for (let i = 0; i < setsData.length && i <self.props.config.signalSets.length; i++) {
                const signalSetCidIndex = self.props.config.signalSets[i].cid + "-" + i;

                const data = setsData[i];
                let newSelection = null;
                let minDist = Number.MAX_VALUE;
                for (const point of data) {
                    const dist = distance({x, y}, {x: xScale(point.x), y: yScale(point.y)});
                    if (dist < minDist) {
                        minDist = dist;
                        newSelection = point;
                    }
                }

                if (selections && selections[signalSetCidIndex] !== newSelection) {
                    self.dotHighlightSelections[signalSetCidIndex]
                        .selectAll('use')
                        .remove();
                }

                if (newSelection) {
                    const signalSetConfig = self.props.config.signalSets[i];
                    let size = self.props.dotSize;
                    if (signalSetConfig.dotSize)
                        size = signalSetConfig.dotSize;
                    if (signalSetConfig.hasOwnProperty("dotSize_sigCid"))
                        size = sScale(newSelection.s);

                    // noinspection JSUnresolvedVariable
                    self.dotHighlightSelections[signalSetCidIndex]
                        .append('use')
                        .attr('href', "#" + (signalSetConfig.dotShape || ScatterPlotBase.defaultDotShape))
                        .attr('x', xScale(newSelection.x))
                        .attr('y', yScale(newSelection.y))
                        .attr('transform', `scale(${self.props.highlightDotSize * size})`)
                        .style("transform-origin", `${xScale(newSelection.x)}px ${yScale(newSelection.y)}px`)
                        .attr("fill", d3Color.color(cScales[i](newSelection.c || newSelection.d)).darker())
                        .attr("stroke", d3Color.color(cScales[i](newSelection.c || newSelection.d)).darker());
                    /*self.dotHighlightSelections[signalSetCidIndex]
                        .attr('stroke', "black")
                        .attr("stroke-width", "1px");*/
                }

                newSelections[signalSetCidIndex] = newSelection;
            }

            self.cursorSelectionX
                .attr('y1', self.props.margin.top)
                .attr('y2', self.props.height - self.props.margin.bottom)
                .attr('x1', containerPos[0])
                .attr('x2', containerPos[0])
                .attr('visibility', self.props.withCursor ? "visible" : "hidden");

            self.cursorSelectionY
                .attr('y1', containerPos[1])
                .attr('y2', containerPos[1])
                .attr('x1', self.props.margin.left)
                .attr('x2', self.renderedWidth - self.props.margin.right)
                .attr('visibility', self.props.withCursor ? "visible" : "hidden");

            let allNull = true;
            for (const selName in newSelections)
                if (newSelections[selName] !== null)
                    allNull = false;
            if (allNull)
                newSelections = null;

            selections = newSelections;
            mousePosition = {x: containerPos[0], y: containerPos[1]};

            self.setState({
                selections,
                mousePosition
            });
        };

        this.brushParentSelection
            .on('mouseenter', selectPoints)
            .on('mousemove', selectPoints)
            .on('mouseleave', ::this.deselectPoints);
    }

    deselectPoints() {
        this.cursorSelectionX.attr('visibility', 'hidden');
        this.cursorSelectionY.attr('visibility', 'hidden');

        for (const cid in this.dotHighlightSelections) {
            this.dotHighlightSelections[cid]
                .selectAll('use')
                .remove();
        }

        this.setState({
            selections: null,
            mousePosition: null
        });
    }

    createChartBrush() {
        const self = this;

        if (this.props.withBrush && this.state.brushInProgress) {
            const xSize = this.renderedWidth - this.props.margin.left - this.props.margin.right;
            const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
            const brush = d3Brush.brush()
                .extent([[0, 0], [xSize, ySize]])
                .on("start", function () {
                    self.setState({
                        zoomInProgress: true
                    });
                })
                .on("end", function () {
                    if (this.withZoom)
                        self.setState({
                            zoomInProgress: false
                        });
                    // noinspection JSUnresolvedVariable
                    const sel = d3Event.selection;

                    if (sel) {
                        const xMin = self.xScale.invert(sel[0][0]);
                        const xMax = self.xScale.invert(sel[1][0]);
                        const yMin = self.yScale.invert(sel[1][1]);
                        const yMax = self.yScale.invert(sel[0][1]);
                        self.setZoomToLimits(xMin, xMax, yMin, yMax);

                        if (self.props.withAutoRefreshOnBrush) {
                            // load new data for brushed region
                            self.reloadData(xMin, xMax, yMin, yMax);
                        }

                        // hide brush
                        self.brushSelection.call(brush.move, null);
                        self.deselectPoints();
                        self.setState({
                            brushInProgress: false
                        });
                    }
                });

            this.brushSelection
                .attr('pointer-events', 'all')
                .call(brush);
        }
        else {
            this.brushParentSelection
                .selectAll('rect')
                .remove();
            this.brushSelection
                .attr('pointer-events', 'none');

            this.brushParentSelection
                .insert('rect', "g") // insert it before the brushSelection
                .attr('pointer-events', 'all')
                .attr('cursor', 'crosshair')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', this.renderedWidth - this.props.margin.left - this.props.margin.right)
                .attr('height', this.props.height - this.props.margin.top - this.props.margin.bottom)
                .attr('visibility', 'hidden');
        }
    }
    //</editor-fold>

    //<editor-fold desc="Zoom">
    createChartZoom(xSize, ySize) {
        const self = this;

        const handleZoom = function () {
            // noinspection JSUnresolvedVariable
            if (self.props.withTransition && d3Event.sourceEvent && d3Event.sourceEvent.type === "wheel") {
                transitionInterpolate(select(self), self.state.zoomTransform, d3Event.transform, setZoomTransform(self), () => {
                    self.deselectPoints();
                });
            } else {
                // noinspection JSUnresolvedVariable
                self.setState({
                    zoomTransform: d3Event.transform
                });
            }
        };

        const handleZoomEnd = function () {
            self.deselectPoints();
            self.setState({
                zoomInProgress: false
            });
            self.setLimitsToCurrentZoom();
        };

        const handleZoomStart = function () {
            self.setState({
                zoomInProgress: true
            });
        };

        const zoomExtent = [[0, 0], [xSize, ySize]];
        const translateExtent = [[0, 0], [xSize, ySize * this.state.zoomYScaleMultiplier]];
        const zoomExisted = this.zoom !== null;
        this.zoom = d3Zoom.zoom()
            .scaleExtent([this.props.zoomLevelMin, this.props.zoomLevelMax])
            .translateExtent(translateExtent)
            .extent(zoomExtent)
            .filter(() => {
                // noinspection JSUnresolvedVariable
                return !d3Selection.event.ctrlKey && !d3Selection.event.button && !this.state.brushInProgress;
            })
            .on("zoom", handleZoom)
            .on("end", handleZoomEnd)
            .on("start", handleZoomStart)
            .interpolate(d3Interpolate.interpolate)
            .wheelDelta(WheelDelta(3));
        this.svgContainerSelection.call(this.zoom);
        if (!zoomExisted)
            this.setLimitsToCurrentZoom(); // initialize limits
    }
    //</editor-fold>

    //<editor-fold desc="Toolbar">
    setLimits(xMin, xMax, yMin, yMax) {
        if (isNaN(xMin) || isNaN(xMax) ||isNaN(yMin) || isNaN(yMax))
            throw new Error("Parameters must be numbers.");
        this.setZoomToLimits(xMin, xMax, yMin, yMax);
        // zoom.end event saves limits to state
    }
    getLimits() {
        return {
            xMin: this.state.xMin,
            xMax: this.state.xMax,
            yMin: this.state.yMin,
            yMax: this.state.yMax
        };
    }

    setSettings(maxDotCount, withTooltip) {
        this.setWithTooltip(withTooltip);
        this.setMaxDotCount(maxDotCount)
    }

    setWithTooltip(newValue) {
        if (typeof newValue !== "boolean")
            newValue = ScatterPlotBase.defaultProps.withTooltip;
        this.setState({
            withTooltip: newValue
        });
    }

    /** set to negative number for unlimited */
    setMaxDotCount(newValue) {
        if (isNaN(newValue))
            newValue = ScatterPlotBase.defaultProps.maxDotCount;
        this.setState({
            maxDotCount: newValue
        });
    }

    zoomIn() {
        this.svgContainerSelection.transition().call(this.zoom.scaleBy, this.props.zoomLevelStepFactor);
    };

    zoomOut() {
        this.svgContainerSelection.transition().call(this.zoom.scaleBy, 1.0 / this.props.zoomLevelStepFactor);
    };

    resetZoom() {
        this.setZoom(d3Zoom.zoomIdentity, 1);
    }

    setLimitsToCurrentZoom() {
        const [xMin, xMax] = this.xScale.domain();
        const [yMin, yMax] = this.yScale.domain();
        this.setState({xMin, xMax, yMin, yMax});
    }

    setZoomToLimits(xMin, xMax, yMin, yMax) {
        const newXSize = xMax - xMin;
        const newYSize = yMax - yMin;
        const oldXSize = this.xScale.domain()[1] - this.xScale.domain()[0];
        const oldYSize = this.yScale.domain()[1] - this.yScale.domain()[0];

        const oldZoomYScaleMultiplier = this.state.zoomYScaleMultiplier;
        const scaleFactor = (oldYSize * newXSize) / (oldXSize * newYSize);
        const newZoomYScaleMultiplier =  scaleFactor * oldZoomYScaleMultiplier;

        const selTopLeftInverted = this.state.zoomTransform.invert([this.xScale(xMin), this.yScale(yMax)]);
        const transform = d3Zoom.zoomIdentity.scale(this.state.zoomTransform.k * oldXSize / newXSize).translate(-selTopLeftInverted[0], -selTopLeftInverted[1] * scaleFactor);

        this.setZoom(transform, newZoomYScaleMultiplier);
    }

    setZoom(transform, yScaleMultiplier) {
        const self = this;
        if (this.withZoom) {
            if (this.props.withTransition) {
                const transition = this.svgContainerSelection.transition().duration(500)
                    .tween("yZoom", () => function (t) {
                        self.setState({
                            zoomYScaleMultiplier: self.state.zoomYScaleMultiplier * (1 - t) + yScaleMultiplier * t
                        });
                    });
                transition.call(this.zoom.transform, transform);
            } else {
                this.svgContainerSelection.call(this.zoom.transform, transform);
                this.setState({
                    zoomYScaleMultiplier: yScaleMultiplier
                });
            }
        }
        else {
            if (this.props.withTransition) {
                this.setState({ zoomInProgress: true }, () => {
                transitionInterpolate(this.svgContainerSelection, this.state.zoomTransform, transform,
                    setZoomTransform(this),() => {
                        self.setState({zoomInProgress: false});
                        self.deselectPoints()
                    },500, self.state.zoomYScaleMultiplier, yScaleMultiplier);
                });
            }
            else {
                this.setState({
                    zoomTransform: transform,
                    zoomYScaleMultiplier: yScaleMultiplier
                });
                this.deselectPoints();
            }
        }
    }

    reloadData(xMin, xMax, yMin, yMax) {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData(xMin, xMax, yMin, yMax);
    }

    // toggle between brush and zoom, returns true if brush is enabled after call
    brushButtonClick() {
        const brushEnabled = !this.state.brushInProgress;
        this.setState({
            brushInProgress: brushEnabled
        });
        return brushEnabled;
    };
    //</editor-fold>

    render() {
        if (!this.state.signalSetsData) {
            return (
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <text textAnchor="middle" x="50%" y="50%"
                          fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                        {this.state.statusMsg}
                    </text>
                </svg>
            );
        }
        else {
            this.dotHighlightSelections = {};
            const dotsHighlightSelectionGroups = this.props.config.signalSets.map((signalSet, i) =>
                <g key={signalSet.cid + "-" + i}
                   ref={node => this.dotHighlightSelections[signalSet.cid + "-" + i] = select(node)}/>
            );

            this.dotsSelection = {};
            const dotsSelectionGroups = this.props.config.signalSets.map((signalSet, i) =>
                <g key={signalSet.cid + "-" + i}
                   ref={node => this.dotsSelection[signalSet.cid + "-" + i] = select(node)}/>
            );

            this.dotsGlobalSelection = {};
            const dotsGlobalSelectionGroups = this.props.config.signalSets.map((signalSet, i) =>
                <g key={signalSet.cid + "-" + i}
                   ref={node => this.dotsGlobalSelection[signalSet.cid + "-" + i] = select(node)}/>
            );

            return (
                <div>
                    {this.props.withToolbar && !this.state.noData &&
                    <ScatterPlotToolbar resetZoomClick={::this.resetZoom}
                                        zoomInClick={this.props.withZoom ? ::this.zoomIn : undefined}
                                        zoomOutClick={this.props.withZoom ? ::this.zoomOut : undefined}
                                        reloadDataClick={::this.reloadData}
                                        brushClick={this.props.withBrush ? ::this.brushButtonClick : undefined}
                                        brushInProgress={this.state.brushInProgress}

                                        withSettings={this.props.withSettings}
                                        settings={{
                                            xMin: this.state.xMin,
                                            xMax: this.state.xMax,
                                            yMin: this.state.yMin,
                                            yMax: this.state.yMax,
                                            withTooltip: this.state.withTooltip,
                                            maxDotCount: this.state.maxDotCount
                                        }}
                                        setLimits={::this.setLimits}
                                        setSettings={::this.setSettings}
                    />}

                    <div ref={node => this.svgContainerSelection = select(node)} className={styles.touchActionNone}>
                        <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                            <defs>
                                <clipPath id="plotRect">
                                    <rect x="0" y="0" width={this.state.width} height={this.props.height - this.props.margin.top - this.props.margin.bottom} />
                                </clipPath>
                                {/* dot shape definitions */}
                                {dotShapes}
                            </defs>
                            <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`} clipPath="url(#plotRect)" >
                                <g name={"regressions"} ref={node => this.regressionsSelection = select(node)}/>
                                <g name={"dots_global"}>{dotsGlobalSelectionGroups}</g>
                                <g name={"dots"}>{dotsSelectionGroups}</g>
                                <g name={"highlightDots"} visibility={(this.props.withCursor || this.state.withTooltip) && !this.state.zoomInProgress ? "visible" : "hidden"} >{dotsHighlightSelectionGroups}</g>
                            </g>

                            {/* axes */}
                            <g ref={node => this.xAxisSelection = select(node)}
                               transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                            <g ref={node => this.yAxisSelection = select(node)}
                               transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>

                            {/* cursor lines */}
                            {!this.state.zoomInProgress &&
                            <line ref={node => this.cursorSelectionX = select(node)} strokeWidth="1"
                                  stroke="rgb(50,50,50)"
                                  visibility="hidden"/> }
                            {!this.state.zoomInProgress &&
                            <line ref={node => this.cursorSelectionY = select(node)} strokeWidth="1"
                                  stroke="rgb(50,50,50)"
                                  visibility="hidden"/> }

                            {/* status message */}
                            <text ref={node => this.statusMsgSelection = select(node)} textAnchor="middle" x="50%"
                                  y="50%"
                                  fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"/>

                            {/* tooltip */}
                            {this.state.withTooltip && !this.state.zoomInProgress &&
                            <Tooltip
                                name={"Tooltip"}
                                config={this.props.config}
                                signalSetsData={{}}
                                containerHeight={this.props.height}
                                containerWidth={this.state.width}
                                mousePosition={this.state.mousePosition}
                                selection={this.state.selections}
                                width={250}
                                contentRender={props => <TooltipContent {...props} labels={this.labels}/>}
                            /> }

                            {/* brush */}
                            <g ref={node => this.brushParentSelection = select(node)}
                               transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`} >
                                <g ref={node => this.brushSelection = select(node)} />
                            </g>
                        </svg>
                    </div>
                    {this.props.withRegressionCoefficients &&
                    <div ref={node => this.regressionsCoefficients = select(node)}/>}
                </div>
            );
        }
    }
}