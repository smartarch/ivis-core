'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Format from "d3-format";
import * as d3Selection from "d3-selection";
import {event as d3Event, select} from "d3-selection";
import * as d3Array from "d3-array";
import * as d3Zoom from "d3-zoom";
import * as d3Brush from "d3-brush";
import * as d3Color from "d3-color";
import {intervalAccessMixin} from "./TimeContext";
import {DataAccessSession} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {Tooltip} from "./Tooltip";
import {Icon} from "../lib/bootstrap-components";
import styles from "./CorrelationCharts.scss";
import {brushHandlesLeftRight, isInExtent, transitionInterpolate, WheelDelta, ZoomEventSources} from "./common";
import {PropType_d3Color_Required, PropType_NumberInRange} from "../lib/CustomPropTypes";

const ConfigDifference = {
    NONE: 0,
    RENDER: 1,
    DATA: 2,
    DATA_WITH_CLEAR: 3
};

function compareConfigs(conf1, conf2) {
    let diffResult = ConfigDifference.NONE;

    if (conf1.sigSetCid !== conf2.sigSetCid || conf1.sigCid !== conf2.sigCid || conf1.tsSigCid !== conf2.tsSigCid) {
        diffResult = ConfigDifference.DATA_WITH_CLEAR;
    } else if (conf1.color !== conf2.color) {
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
        signalSetsData: PropTypes.object,
        selection: PropTypes.object
    };

    render() {
        if (this.props.selection) {
            const step = this.props.signalSetsData.step;
            const bucket = this.props.selection;

            const keyF = d3Format.format("." + d3Format.precisionFixed(step) + "f");
            const probF = d3Format.format(".2f");

            return (
                <div>
                    <div>Range: <Icon icon="chevron-left"/>{keyF(bucket.key)} <Icon icon="ellipsis-h"/> {keyF(bucket.key + step)}<Icon icon="chevron-right"/></div>
                    <div>Count: {bucket.count}</div>
                    <div>Frequency: {probF(bucket.prob * 100)}%</div>
                </div>
            );

        } else {
            return null;
        }
    }
}

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    intervalAccessMixin()
], ["getView", "setView"])
export class HistogramChart extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetData: null,
            globalSignalSetData: null,
            statusMsg: t('Loading...'),
            width: 0,
            maxBucketCount: 0,
            zoomTransform: d3Zoom.zoomIdentity
        };

        this.zoom = null;
        this.brush = null;
        this.lastZoomCausedByUser = false;

        this.resizeListener = () => {
            this.createChart(true);
        };
    }

    static propTypes = {
        config: PropTypes.shape({
            sigSetCid: PropTypes.string.isRequired,
            sigCid: PropTypes.string.isRequired,
            color: PropType_d3Color_Required(),
            tsSigCid: PropTypes.string
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object,
        overviewHeight: PropTypes.number,
        overviewMargin: PropTypes.object,

        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withOverview: PropTypes.bool,
        withTransition: PropTypes.bool,
        withZoom: PropTypes.bool,

        xAxisTicksCount: PropTypes.number,
        xAxisTicksFormat: PropTypes.func,
        xAxisLabel: PropTypes.string,

        minStep: PropTypes.number,
        minBarWidth: PropTypes.number,
        maxBucketCount: PropTypes.number,
        topPaddingWhenZoomed: PropType_NumberInRange(0, 1), // determines whether bars will be stretched up when zooming
        xMinValue: PropTypes.number,
        xMaxValue: PropTypes.number,
        viewChangeCallback: PropTypes.func,

        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,

        className: PropTypes.string,
        style: PropTypes.object
    };

    static defaultProps = {
        margin: { left: 40, right: 5, top: 5, bottom: 20 },
        minBarWidth: 20,
        maxBucketCount: undefined,
        xMinValue: NaN,
        xMaxValue: NaN,
        topPaddingWhenZoomed: 0,

        withCursor: true,
        withTooltip: true,
        withOverview: true,
        withTransition: true,
        withZoom: true,

        zoomLevelMin: 1,
        zoomLevelMax: 4,

        overviewHeight: 100,
        overviewMargin: { top: 20, bottom: 20 }
    };

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(false, false);
    }

    /** Update and redraw the chart based on changes in React props and state */
    componentDidUpdate(prevProps, prevState) {
        const t = this.props.t;

        let configDiff = compareConfigs(this.props.config, prevProps.config);

        // test if time interval changed
        const considerTs = !!this.props.config.tsSigCid;
        if (considerTs) {
            const prevAbs = this.getIntervalAbsolute(prevProps);
            const prevSpec = this.getIntervalSpec(prevProps);

            if (prevSpec !== this.getIntervalSpec()) {
                configDiff = Math.max(configDiff, ConfigDifference.DATA_WITH_CLEAR);
            } else if (prevAbs !== this.getIntervalAbsolute()) { // If its just a regular refresh, don't clear the chart
                configDiff = Math.max(configDiff, ConfigDifference.DATA);
            }
        }

        if (prevState.maxBucketCount !== this.state.maxBucketCount) {
            configDiff = Math.max(configDiff, ConfigDifference.DATA);
        }

        if (configDiff === ConfigDifference.DATA_WITH_CLEAR) {
            if (configDiff === ConfigDifference.DATA_WITH_CLEAR) {
                this.brush = null;
                this.zoom = null;
                this.setState({
                    signalSetData: null,
                    globalSignalSetData: null,
                    statusMsg: t('Loading...'),
                    zoomTransform: d3Zoom.zoomIdentity
                }, () => {
                    // noinspection JSIgnoredPromiseFromCall
                    this.fetchData();
                });
            }
        }
        else if (configDiff === ConfigDifference.DATA) {
            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();
        }
        else {
             const forceRefresh = this.prevContainerNode !== this.containerNode
                || prevState.signalSetData !== this.state.signalSetData
                || configDiff !== ConfigDifference.NONE;

            const updateZoom = !Object.is(prevState.zoomTransform, this.state.zoomTransform);

            this.createChart(forceRefresh, updateZoom);
            this.prevContainerNode = this.containerNode;
            if (updateZoom)
                this.callViewChangeCallback();
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    /** Fetches new data for the chart, processes the results using this.processData method and updates the state accordingly, so the chart is redrawn */
    @withAsyncErrorHandler
    async fetchData() {
        const config = this.props.config;

        let maxBucketCount = this.props.maxBucketCount || this.state.maxBucketCount;
        let minStep = this.props.minStep;
        if (maxBucketCount > 0) {
            try {
                let filter = {
                    type: 'and',
                        children: []
                };
                let isZoomedIn = false;
                if (config.tsSigCid) {
                    const abs = this.getIntervalAbsolute();
                    filter.children.push({
                        type: 'range',
                        sigCid: config.tsSigCid,
                        gte: abs.from.toISOString(),
                        lt: abs.to.toISOString()
                    });
                }
                if (!isNaN(this.props.xMinValue))
                    filter.children.push({
                        type: "range",
                        sigCid: config.sigCid,
                        gte: this.props.xMinValue
                    });
                if (!isNaN(this.props.xMaxValue))
                    filter.children.push({
                        type: "range",
                        sigCid: config.sigCid,
                        lte: this.props.xMaxValue
                    });

                // filter by current zoom
                if (!Object.is(this.state.zoomTransform, d3Zoom.zoomIdentity)) {
                    const scale = this.state.zoomTransform.k;
                    if (minStep !== undefined)
                        minStep = Math.floor(minStep / scale);
                    maxBucketCount = Math.ceil(maxBucketCount * scale);
                    isZoomedIn = true;
                }

                const results = await this.dataAccessSession.getLatestHistogram(config.sigSetCid, [config.sigCid], maxBucketCount, minStep, filter);

                if (results) { // Results is null if the results returned are not the latest ones
                    const processedResults = this.processData(results);
                    if (processedResults.buckets.length === 0) {
                        this.setState({
                            signalSetData: null,
                            statusMsg: "No data."
                        });
                        this.brush = null;
                        this.zoom = null;
                        return;
                    }
                    if (isNaN(processedResults.step)) { // not a numeric signal
                        this.setState({
                            signalSetData: null,
                            statusMsg: "Histogram not available for this type of signal."
                        });
                        return;
                    }

                    if (!isZoomedIn) { // zoomed completely out
                        // update extent of x axis
                        this.xExtent = [processedResults.min, processedResults.max];
                        if (!isNaN(this.props.xMinValue)) this.xExtent[0] = this.props.xMinValue;
                        if (!isNaN(this.props.xMaxValue)) this.xExtent[1] = this.props.xMaxValue;

                        this.setZoom(d3Zoom.zoomIdentity); // reset zoom
                    }

                    const newState = {
                        signalSetData: processedResults,
                        statusMsg: ""
                    };
                    if (!isZoomedIn)
                        newState.globalSignalSetData = processedResults;

                    this.setState(newState, () => {
                        if (!isZoomedIn)
                            // call callViewChangeCallback when data new data without range filter are loaded as the xExtent might got updated (even though this.state.zoomTransform is the same)
                            this.callViewChangeCallback();
                    });
                }
            } catch (err) {
                throw err;
            }
        }
    }

    processData(data) {
        if (data.buckets.length === 0)
            return {
                buckets: data.buckets,
                step: data.step,
                offset: data.offset,
                min: NaN,
                max: NaN,
                maxProb: 0
            };

        const min = data.buckets[0].key;
        const max = data.buckets[data.buckets.length - 1].key + data.step;

        let maxCount = 0;
        let totalCount = 0;
        for (const bucket of data.buckets) {
            if (bucket.count > maxCount)
                maxCount = bucket.count;
            totalCount += bucket.count;
        }

        for (const bucket of data.buckets) {
            bucket.prob = bucket.count / totalCount;
        }
        const maxProb = maxCount / totalCount;

        return {
            buckets: data.buckets,
            step: data.step,
            offset: data.offset,
            min,
            max,
            maxProb
        };
    }

    /** Creates (or updates) the chart with current data.
     * This method is called from componentDidUpdate automatically when state or config is updated.
     * All the 'createChart*' methods are called from here. */
    createChart(forceRefresh, updateZoom) {
        /** @description last data loaded by fetchData */
        const signalSetData = this.state.signalSetData;
        /** @description data loaded when chart was completely zoomed out - displayed by overview */
        const globalSignalSetData = this.state.globalSignalSetData;

        const width = this.containerNode.getClientRects()[0].width;

        if (this.state.width !== width) {
            const maxBucketCount = Math.ceil(width / this.props.minBarWidth);

            this.setState({
                width,
                maxBucketCount
            });
        }

        const widthChanged = width !== this.renderedWidth;
        if (!forceRefresh && !widthChanged && !updateZoom) {
            return;
        }
        this.renderedWidth = width;

        if (!signalSetData || !globalSignalSetData) {
            return;
        }

        //<editor-fold desc="Scales">
        const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
        const xSize = this.renderedWidth - this.props.margin.left - this.props.margin.right;

        let xScale = d3Scale.scaleLinear()
            .domain(this.xExtent)
            .range([0, width - this.props.margin.left - this.props.margin.right]);
        xScale = this.state.zoomTransform.rescaleX(xScale);
        this.xScale = xScale;
        const xAxis = d3Axis.axisBottom(xScale)
            .tickSizeOuter(0);
        if (this.props.xAxisTicksCount) xAxis.ticks(this.props.xAxisTicksCount);
        if (this.props.xAxisTicksFormat) xAxis.tickFormat(this.props.xAxisTicksFormat);
        this.xAxisSelection.call(xAxis);
        this.xAxisLabelSelection.text(this.props.xAxisLabel).style("text-anchor", "middle");

        let maxProb = signalSetData.maxProb;
        let maxProbInZoom;
        const [xDomainMin, xDomainMax] = xScale.domain();
        if (this.state.zoomTransform.k > 1 && this.props.topPaddingWhenZoomed !== 1) {
            maxProbInZoom = d3Array.max(signalSetData.buckets, b => {
                if (b.key + signalSetData.step >= xDomainMin &&
                    b.key <= xDomainMax)
                    return b.prob;
            });
        }
        if (maxProbInZoom !== undefined && maxProbInZoom !== 0) {
            if (maxProbInZoom / maxProb < 1 - this.props.topPaddingWhenZoomed)
                maxProb = maxProbInZoom / (1 - this.props.topPaddingWhenZoomed);
        }

        const yScale = d3Scale.scaleLinear()
            .domain([0, maxProb])
            .range([ySize, 0]);
        const yAxis = d3Axis.axisLeft(yScale)
            .tickFormat(yScale.tickFormat(10, "-%"));
        (this.props.withTransition ? this.yAxisSelection.transition() : this.yAxisSelection)
            .call(yAxis);
        //</editor-fold>

        this.drawBars(signalSetData, this.barsSelection, xScale, yScale, d3Color.color(this.props.config.color), false);

        // we don't want to change zoom object and cursor area when updating only zoom (it breaks touch drag)
        if (forceRefresh || widthChanged) {
            this.createChartCursorArea();
            if (this.props.withZoom)
                this.createChartZoom(xSize, ySize);
        }

        this.createChartCursor(signalSetData, xScale, yScale, ySize);

        if (this.props.withOverview)
            this.createChartOverview(globalSignalSetData);
    }

    // noinspection JSCommentMatchesSignature
    /**
     * @param data                  data in format as produces by this.processData
     * @param selection             d3 selection to which the data will get assigned and drawn
     * @param disableTransitions    animations when bars are created or modified
     */
    drawBars(data, selection, xScale, yScale, barColor, disableTransitions = true) {
        const step = data.step;
        const barWidth = xScale(step) - xScale(0) - 1;
        const ySize = yScale.range()[0];

        const bars = selection
            .selectAll('rect')
            .data(data.buckets, d => d.key);

        const allBars = bars.enter()
            .append('rect')
            .attr('y', yScale.range()[0])
            .attr("height", 0)
            .merge(bars);

        allBars.attr('x', d => xScale(d.key))
            .attr("width", barWidth)
            .attr("fill", barColor);
        (disableTransitions || !this.props.withTransition ?  allBars : allBars.transition())
            .attr('y', d => yScale(d.prob))
            .attr("height", d => ySize - yScale(d.prob));

        bars.exit()
            .remove();
    }

    /** Prepares rectangle for cursor movement events.
     *  Called from this.createChart(). */
    createChartCursorArea() {
        this.cursorAreaSelection
            .selectAll('rect')
            .remove();

        this.cursorAreaSelection
            .append('rect')
            .attr('pointer-events', 'all')
            .attr('cursor', 'crosshair')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.renderedWidth - this.props.margin.left - this.props.margin.right)
            .attr('height', this.props.height - this.props.margin.top - this.props.margin.bottom)
            .attr('visibility', 'hidden');
    }

    /** Handles mouse movement to select the closest bar (for displaying its details in Tooltip, etc.).
     *  Called from this.createChart(). */
    createChartCursor(signalSetData, xScale, yScale) {
        const self = this;
        const highlightBarColor = d3Color.color(this.props.config.color).darker();

        this.barsHighlightSelection
            .selectAll('rect')
            .remove();

        let selection, mousePosition;

        const selectPoints = function () {
            if (self.state.zoomInProgress)
                return;

            const containerPos = d3Selection.mouse(self.containerNode);
            const x = containerPos[0] - self.props.margin.left;

            const key = xScale.invert(x);
            let newSelection = null;
            if (isInExtent(key, [self.state.signalSetData.min, self.state.signalSetData.max])) {
                for (const bucket of signalSetData.buckets) {
                    if (bucket.key <= key) {
                        newSelection = bucket;
                    } else {
                        break;
                    }
                }
            }
            else {
                self.deselectPoints();
            }

            if (selection !== newSelection && newSelection !== null && (self.props.withCursor || self.props.withTooltip)) {
                self.drawBars({
                    buckets: [newSelection],
                    step: signalSetData.step
                }, self.barsHighlightSelection, xScale, yScale, highlightBarColor)
            }

            self.cursorSelection
                .attr('y1', self.props.margin.top)
                .attr('y2', self.props.height - self.props.margin.bottom)
                .attr('x1', containerPos[0])
                .attr('x2', containerPos[0])
                .attr('visibility', self.props.withCursor ? 'visible' : "hidden");

            selection = newSelection;
            mousePosition = {x: containerPos[0], y: containerPos[1]};

            self.setState({
                selection,
                mousePosition
            });
        };

        this.cursorAreaSelection
            .on('mouseenter', selectPoints)
            .on('mousemove', selectPoints)
            .on('mouseleave', ::this.deselectPoints);
    }

    deselectPoints() {
        this.cursorSelection.attr('visibility', 'hidden');

        this.barsHighlightSelection
            .selectAll('rect')
            .remove();

        this.setState({
            selection: null,
            mousePosition: null
        });
    }

    /** Handles zoom of the chart by user using d3-zoom.
     *  Called from this.createChart(). */
    createChartZoom(xSize, ySize) {
        // noinspection DuplicatedCode
        const self = this;

        const handleZoom = function () {
            // noinspection JSUnresolvedVariable
            if (self.props.withTransition && d3Event.sourceEvent && d3Event.sourceEvent.type === "wheel") {
                self.lastZoomCausedByUser = true;
                transitionInterpolate(select(self), self.state.zoomTransform, d3Event.transform, setZoomTransform, () => {
                    self.deselectPoints();
                });
            } else {
                // noinspection JSUnresolvedVariable
                if (d3Event.sourceEvent && ZoomEventSources.includes(d3Event.sourceEvent.type))
                    self.lastZoomCausedByUser = true;
                // noinspection JSUnresolvedVariable
                setZoomTransform(d3Event.transform);
            }
        };

        const setZoomTransform = function (transform) {
            self.setState({
                zoomTransform: transform
            });
            moveBrush(transform);
        };

        const moveBrush = function (transform) {
            if (self.brush)
                self.overviewBrushSelection.call(self.brush.move, self.defaultBrush.map(transform.invertX, transform));
        };

        const handleZoomEnd = function () {
            self.deselectPoints();
            self.setState({
                zoomInProgress: false
            });
        };
        const handleZoomStart = function () {
            self.setState({
                zoomInProgress: true
            });
        };

        const zoomExtent = [[0,0], [xSize, ySize]];
        const zoomExisted = this.zoom !== null;
        this.zoom = zoomExisted ? this.zoom : d3Zoom.zoom();
        this.zoom
            .scaleExtent([this.props.zoomLevelMin, this.props.zoomLevelMax])
            .translateExtent(zoomExtent)
            .extent(zoomExtent)
            .on("zoom", handleZoom)
            .on("end", handleZoomEnd)
            .on("start", handleZoomStart)
            .wheelDelta(WheelDelta(2));
        this.svgContainerSelection.call(this.zoom);
        moveBrush(this.state.zoomTransform);
    }

    /** Returns the current view (boundaries of visible region)
     * @return {{xMin: number, xMax: number }} left, right boundary
     */
    getView() {
        const [xMin, xMax] = this.xScale.domain();
        return {xMin, xMax};
    }

    /**
     * Set the visible region of the chart to defined limits (in units of the data, not in pixels)
     * @param xMin          left boundary of the visible region (in units of data on x-axis)
     * @param xMax          right boundary of the visible region (in units of data on x-axis)
     * @param source        the element which caused the view change (if source === this, the update is ignored)
     * @param causedByUser  tells whether the view update was caused by user (this propagates to props.viewChangeCallback call), default = false
     */
    setView(xMin, xMax, source, causedByUser = false) {
        if (source === this || this.state.signalSetData === null)
            return;

        if (xMin === undefined) xMin = this.xScale.domain()[0];
        if (xMax === undefined) xMax = this.xScale.domain()[1];

        if (isNaN(xMin) || isNaN(xMax))
            throw new Error("Parameters must be numbers.");

        this.lastZoomCausedByUser = causedByUser;
        // noinspection JSUnresolvedVariable
        this.setZoomToLimits(xMin, xMax);
    }

    /** Sets zoom object (transform) to desired view boundaries. */
    setZoomToLimits(xMin, xMax) {
        if (this.brush) {
            this.overviewBrushSelection.call(this.brush.move, [this.overviewXScale(xMin), this.overviewXScale(xMax)]);
            // brush will also adjust zoom if sourceEvent is not "zoom" caused by this.zoom which is true when this method is called from this.setView
        }
        else {
            const newXSize = xMax - xMin;
            const oldXSize = this.xScale.domain()[1] - this.xScale.domain()[0];

            const leftInverted = this.state.zoomTransform.invertX(this.xScale(xMin));
            const transform = d3Zoom.zoomIdentity.scale(this.state.zoomTransform.k * oldXSize / newXSize).translate(-leftInverted, 0);

            this.setZoom(transform);
        }
    }

    /** Helper method to update zoom transform in state and zoom object. */
    setZoom(transform) {
        if (this.zoom)
            this.svgContainerSelection.call(this.zoom.transform, transform);
        else
            this.setState({ zoomTransform: transform });
    }

    callViewChangeCallback() {
        if (typeof(this.props.viewChangeCallback) !== "function")
            return;

        this.props.viewChangeCallback(this, this.getView(), this.lastZoomCausedByUser);
    }

    /** Creates additional histogram below the main one without zoom to enable zoom navigation by d3-brush
     *  Called from this.createChart(). */
    createChartOverview(signalSetData) {
        //<editor-fold desc="Scales">
        const ySize = this.props.overviewHeight - this.props.overviewMargin.top - this.props.overviewMargin.bottom;

        const yScale = d3Scale.scaleLinear()
            .domain([0, signalSetData.maxProb])
            .range([ySize, 0]);

        let xScale = d3Scale.scaleLinear()
            .domain(this.xExtent)
            .range([0, this.renderedWidth - this.props.margin.left - this.props.margin.right]);
        this.overviewXScale = xScale;
        const xAxis = d3Axis.axisBottom(xScale)
            .tickSizeOuter(0);
        if (this.props.xAxisTicksCount) xAxis.ticks(this.props.xAxisTicksCount);
        if (this.props.xAxisTicksFormat) xAxis.tickFormat(this.props.xAxisTicksFormat);
        this.overviewXAxisSelection.call(xAxis);
        //</editor-fold>

        this.drawBars(signalSetData, this.overviewBarsSelection, xScale, yScale, d3Color.color(this.props.config.color));

        this.createChartOverviewBrush();
    }

    /** Creates d3-brush for overview.
     *  Called from this.createChart(). */
    createChartOverviewBrush() {
        const self = this;

        const xSize = this.renderedWidth - this.props.margin.left - this.props.margin.right;
        const ySize = this.props.overviewHeight - this.props.overviewMargin.top - this.props.overviewMargin.bottom;
        this.defaultBrush = [0, xSize];
        const brushExisted = this.brush !== null;
        this.brush = brushExisted ? this.brush :d3Brush.brushX();
        this.brush
            .extent([[0, 0], [xSize, ySize]])
            .handleSize(20)
            .on("brush", function () {
                // noinspection JSUnresolvedVariable
                const sel = d3Event.selection;
                self.overviewBrushSelection.call(brushHandlesLeftRight, sel, ySize);

                // noinspection JSUnresolvedVariable
                if (d3Event.sourceEvent && d3Event.sourceEvent.type === "zoom" && d3Event.sourceEvent.target === self.zoom) return; // ignore brush-by-zoom

                // noinspection JSUnresolvedVariable
                if (d3Event.sourceEvent && ZoomEventSources.includes(d3Event.sourceEvent.type))
                    self.lastZoomCausedByUser = true;

                const newTransform = d3Zoom.zoomIdentity.scale(xSize / (sel[1] - sel[0])).translate(-sel[0], 0);
                self.setZoom(newTransform);
            });

        this.overviewBrushSelection
            .attr('pointer-events', 'all')
            .call(this.brush);
        if (!brushExisted)
            this.overviewBrushSelection.call(this.brush.move, this.defaultBrush);
        this.overviewBrushSelection.select(".selection")
            .classed(styles.selection, true);
        this.overviewBrushSelection.select(".overlay")
            .attr('pointer-events', 'none');
    }

    render() {
        if (!this.state.signalSetData) {
            return (
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%"
                     className={this.props.className} style={this.props.style} >
                    <text textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                        {this.state.statusMsg}
                    </text>
                </svg>
            );

        } else {

            return (
                <div className={this.props.className} style={this.props.style} >
                    <div ref={node => this.svgContainerSelection = select(node)} className={styles.touchActionPanY}>
                    <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                        <defs>
                            <clipPath id="plotRect">
                                <rect x="0" y="0" width={this.state.width - this.props.margin.left - this.props.margin.right} height={this.props.height - this.props.margin.top - this.props.margin.bottom} />
                            </clipPath>
                        </defs>
                        <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`} clipPath="url(#plotRect)" >
                            <g ref={node => this.barsSelection = select(node)}/>
                            <g ref={node => this.barsHighlightSelection = select(node)}/>
                        </g>

                        {/* axes */}
                        <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                        <text ref={node => this.xAxisLabelSelection = select(node)}
                              transform={`translate(${this.props.margin.left + (this.state.width - this.props.margin.left - this.props.margin.right) / 2}, ${this.props.height - 5})`} />
                        <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>

                        {!this.state.zoomInProgress &&
                        <line ref={node => this.cursorSelection = select(node)} strokeWidth="1" stroke="rgb(50,50,50)" visibility="hidden"/>}
                        <text textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                            {this.state.statusMsg}
                        </text>
                        {this.props.withTooltip && !this.state.zoomInProgress &&
                        <Tooltip
                            config={this.props.config}
                            signalSetsData={this.state.signalSetData}
                            containerHeight={this.props.height}
                            containerWidth={this.state.width}
                            mousePosition={this.state.mousePosition}
                            selection={this.state.selection}
                            contentRender={props => <TooltipContent {...props}/>}
                        />
                        }
                        <g ref={node => this.cursorAreaSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    </svg>
                    </div>
                    {this.props.withOverview &&
                    <svg id="overview" height={this.props.overviewHeight}
                         width="100%">
                        <g transform={`translate(${this.props.margin.left}, ${this.props.overviewMargin.top})`}>
                            <g ref={node => this.overviewBarsSelection = select(node)}/>
                        </g>
                        <g ref={node => this.overviewXAxisSelection = select(node)}
                           transform={`translate(${this.props.margin.left}, ${this.props.overviewHeight - this.props.overviewMargin.bottom})`}/>
                        <g ref={node => this.overviewBrushSelection = select(node)}
                           transform={`translate(${this.props.margin.left}, ${this.props.overviewMargin.top})`}
                           className={styles.brush}/>
                    </svg>}
                </div>

            );
        }
    }
}
