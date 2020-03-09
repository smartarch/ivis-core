'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Format from "d3-format";
import * as d3Selection from "d3-selection";
import * as d3Array from "d3-array";
import {select} from "d3-selection";
import {intervalAccessMixin} from "../TimeContext";
import {DataAccessSession} from "../DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {Tooltip} from "../Tooltip";
import {Icon} from "../../lib/bootstrap-components";
import {
    brushHandlesLeftRight,
    brushHandlesTopBottom,
    getColorScale, setZoomTransform,
    transitionInterpolate,
    WheelDelta
} from "../common";
import styles from "./CorrelationCharts.scss";
import {PropType_d3Color} from "../../lib/CustomPropTypes";
import * as d3Brush from "d3-brush";
import {event as d3Event} from "d3-selection";
import * as d3Zoom from "d3-zoom";
import * as d3Interpolate from "d3-interpolate";

const ConfigDifference = {
    NONE: 0,
    RENDER: 1,
    DATA: 2,
    DATA_WITH_CLEAR: 3
};

function compareConfigs(conf1, conf2) {
    let diffResult = ConfigDifference.NONE;

    if (conf1.sigSetCid !== conf2.sigSetCid || conf1.X_sigCid !== conf2.X_sigCid || conf1.Y_sigCid !== conf2.Y_sigCid || conf1.tsSigCid !== conf2.tsSigCid) {
        diffResult = ConfigDifference.DATA_WITH_CLEAR;
    } else if (conf1.colors !== conf2.colors) {
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
            const xStep = this.props.signalSetsData.step;
            const yStep = this.props.signalSetsData.buckets[0].step;
            const bucket = this.props.selection;

            let xDescription;
            if (xStep !== undefined) { // NUMBER
                const xKeyF = d3Format.format("." + d3Format.precisionFixed(xStep) + "f");
                xDescription = <div>X axis range: <Icon icon="chevron-left"/>{xKeyF(bucket.xKey)} <Icon icon="ellipsis-h"/> {xKeyF(bucket.xKey + xStep)}<Icon icon="chevron-right"/></div>
            }
            else // KEYWORD
                xDescription = <div>X axis: {bucket.xKey}</div>;

            let yDescription;
            if (yStep !== undefined) { // NUMBER
                const yKeyF = d3Format.format("." + d3Format.precisionFixed(yStep) + "f");
                yDescription = <div>Y axis range: <Icon icon="chevron-left"/>{yKeyF(bucket.key)} <Icon icon="ellipsis-h"/> {yKeyF(bucket.key + yStep)}<Icon icon="chevron-right"/></div>
            }
            else // KEYWORD
                yDescription = <div>Y axis: {bucket.key}</div>;

            const probF = d3Format.format(".2f");

            return (
                <div>
                    {xDescription}
                    {yDescription}
                    <div>Count: {bucket.count}</div>
                    <div>Frequency: {probF(bucket.prob * 100)}%</div>
                </div>
            );

        } else {
            return null;
        }
    }
}

const DataType = {
    NUMBER: 0,
    KEYWORD: 1
};

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    intervalAccessMixin()
])
/** 2D histogram */
export class HeatmapChart extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetData: null,
            statusMsg: t('Loading...'),
            width: undefined,
            height: 0,
            maxBucketCountX: 0,
            maxBucketCountY: 0,
            zoomTransform: d3Zoom.zoomIdentity,
            zoomYScaleMultiplier: 1,
        };

        this.brushBottom = null;
        this.brushLeft = null;
        this.zoom = null;

        this.resizeListener = () => {
            this.createChart(true);
        };
    }

    static propTypes = {
        config: PropTypes.shape({
            sigSetCid: PropTypes.string.isRequired,
            X_sigCid: PropTypes.string.isRequired,
            Y_sigCid: PropTypes.string.isRequired,
            colors: PropTypes.arrayOf(PropType_d3Color()),
            tsSigCid: PropTypes.string
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        overviewBottomHeight: PropTypes.number,
        overviewBottomMargin: PropTypes.object,
        overviewBottomColor: PropType_d3Color(),
        overviewLeftWidth: PropTypes.number,
        overviewLeftMargin: PropTypes.object,
        overviewLeftColor: PropType_d3Color(),

        withTooltip: PropTypes.bool,
        withOverviewBottom: PropTypes.bool,
        withOverviewLeft: PropTypes.bool,
        withOverviewLeftBrush: PropTypes.bool,
        withOverviewBottomBrush: PropTypes.bool,
        withTransition: PropTypes.bool,
        withZoomX: PropTypes.bool,
        withZoomY: PropTypes.bool,

        minStep: PropTypes.number,
        minRectWidth: PropTypes.number,
        minRectHeight: PropTypes.number,
        maxBucketCountX: PropTypes.number,
        maxBucketCountY: PropTypes.number,
        xMin: PropTypes.number,
        xMax: PropTypes.number,
        yMin: PropTypes.number,
        yMax: PropTypes.number,

        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,
    };

    static defaultProps = {
        minRectWidth: 40,
        minRectHeight: 40,
        withTooltip: true,
        withOverviewBottom: true,
        withOverviewLeft: true,
        withOverviewLeftBrush: true,
        withOverviewBottomBrush: true,
        withTransition: true,
        withZoomX: true,
        withZoomY: true,

        zoomLevelMin: 1,
        zoomLevelMax: 4,

        overviewBottomHeight: 60,
        overviewBottomMargin: { top: 0, bottom: 20 },
        overviewLeftWidth: 70,
        overviewLeftMargin: { left: 30, right: 0 }
    };
    static defaultColors = ["#ffffff", "#1c70ff"]; // default value for props.config.colors

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(false, false);
    }

    componentDidUpdate(prevProps, prevState) {
        const t = this.props.t;

        let configDiff = compareConfigs(this.props.config, prevProps.config);

        const considerTs = !!this.props.config.tsSigCid;
        if (considerTs) {
            const prevAbs = this.getIntervalAbsolute(prevProps);
            const prevSpec = this.getIntervalSpec(prevProps);

            if (prevSpec !== this.getIntervalSpec()) {
                configDiff = ConfigDifference.DATA_WITH_CLEAR;
            } else if (prevAbs !== this.getIntervalAbsolute()) { // If its just a regular refresh, don't clear the chart
                configDiff = ConfigDifference.DATA;
            }
        }

        if (prevState.maxBucketCountX !== this.state.maxBucketCountX ||
            prevState.maxBucketCountY !== this.state.maxBucketCountY) {
            configDiff = Math.max(configDiff, ConfigDifference.DATA);
        }

        if (configDiff === ConfigDifference.DATA || configDiff === ConfigDifference.DATA_WITH_CLEAR) {
            if (configDiff === ConfigDifference.DATA_WITH_CLEAR) {
                this.setState({
                    signalSetData: null,
                    statusMsg: t('Loading...')
                });
            }

            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();

        } else {
            const forceRefresh = this.prevContainerNode !== this.containerNode
                || prevState.signalSetData !== this.state.signalSetData
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

    @withAsyncErrorHandler
    async fetchData() {
        const t = this.props.t;
        const config = this.props.config;

        let maxBucketCountX = this.props.maxBucketCountX || this.state.maxBucketCountX;
        let maxBucketCountY = this.props.maxBucketCountY || this.state.maxBucketCountY;
        let minStep = this.props.minStep;
        if (maxBucketCountX > 0 && maxBucketCountY > 0) {
            try {
                let filter = {
                    type: 'and',
                    children: []
                };
                if (config.tsSigCid) {
                    const abs = this.getIntervalAbsolute();
                    filter.children.push({
                        type: 'range',
                        sigCid: config.tsSigCid,
                        gte: abs.from.toISOString(),
                        lt: abs.to.toISOString()
                    });
                }
                if (!isNaN(this.props.xMin))
                    filter.children.push({
                        type: "range",
                        sigCid: config.X_sigCid,
                        gte: this.props.xMin
                    });
                if (!isNaN(this.props.xMax))
                    filter.children.push({
                        type: "range",
                        sigCid: config.X_sigCid,
                        lte: this.props.xMax
                    });
                if (!isNaN(this.props.yMin))
                    filter.children.push({
                        type: "range",
                        sigCid: config.Y_sigCid,
                        gte: this.props.yMin
                    });
                if (!isNaN(this.props.yMax))
                    filter.children.push({
                        type: "range",
                        sigCid: config.Y_sigCid,
                        lte: this.props.yMax
                    });

                // filter by current zoom
                if (!Object.is(this.state.zoomTransform, d3Zoom.zoomIdentity) || this.state.zoomYScaleMultiplier !== 1) {
                    const scaleX = this.state.zoomTransform.k;
                    maxBucketCountX = Math.ceil(maxBucketCountX * scaleX);
                    const scaleY = this.state.zoomTransform.k * this.state.zoomYScaleMultiplier;
                    maxBucketCountY = Math.ceil(maxBucketCountY * scaleY);
                }

                const results = await this.dataAccessSession.getLatestHistogram(config.sigSetCid, [config.X_sigCid, config.Y_sigCid], [maxBucketCountX, maxBucketCountY], this.props.minStep, filter);

                if (results) { // Results is null if the results returned are not the latest ones
                    this.setState(this.processData(results));
                }
            } catch (err) {
                throw err;
            }
        }
    }

    processData(data) {
        this.xType = data.step !== undefined ? DataType.NUMBER : DataType.KEYWORD;
        const xBucketsCount = data.buckets.length;
        this.xExtent = null; this.yExtent = null;

        if (xBucketsCount === 0)
            return {
                signalSetData: data,
                xBucketsCount: 0,
                yBucketsCount: 0
            };

        this.yType = data.buckets[0].step !== undefined ? DataType.NUMBER : DataType.KEYWORD;

        let yBucketsCount;
        if (this.xType === DataType.NUMBER) {
            const xMin = data.buckets[0].key;
            const xMax = data.buckets[xBucketsCount - 1].key + data.step;
            this.xExtent = [xMin, xMax];
        } else { // xType === DataType.KEYWORD
            this.xExtent = this.getKeys(data.buckets);
        }

        if (this.yType === DataType.NUMBER) {
            yBucketsCount = data.buckets[0].buckets.length;
            if (yBucketsCount === 0)
                return {
                    signalSetData: data,
                    xBucketsCount: 0,
                    yBucketsCount: 0,
                };

            const yMin = data.buckets[0].buckets[0].key;
            const yMax = data.buckets[0].buckets[yBucketsCount - 1].key + data.buckets[0].step;
            this.yExtent = [yMin, yMax];
        }
        else { // yType === DataType.KEYWORD
            this.yExtent = this.getKeywordExtent(data.buckets);
            this.yExtent.sort((a, b) => a.localeCompare(b));
            // add missing inner buckets
            for (const bucket of data.buckets) {
                const innerKeys = this.getKeys(bucket.buckets);
                for (const key of this.yExtent)
                    if (innerKeys.indexOf(key) === -1)
                        bucket.buckets.push({ key: key, count: 0 });
                // sort inner buckets so they are in same order in all outer buckets
                bucket.buckets.sort((a, b) => a.key.localeCompare(b.key));
            }
        }

        // calculate probabilities of buckets
        let totalCount = d3Array.sum(data.buckets, d => d.count);
        for (const bucket of data.buckets)
            bucket.prob = bucket.count / totalCount;
        const rowProbs = data.buckets[0].buckets.map((b, i) => { return {key: b.key, prob: 0, index: i}; });

        let maxProb = 0;
        for (const bucket of data.buckets) {
            let columnCount = d3Array.sum(bucket.buckets, d => d.count);
            for (const [i, innerBucket] of bucket.buckets.entries()) {
                innerBucket.prob = bucket.prob * innerBucket.count / columnCount || 0;
                innerBucket.xKey = bucket.key;
                if (innerBucket.prob > maxProb)
                    maxProb = innerBucket.prob;
                rowProbs[i].prob += innerBucket.prob;
            }
        }

        if (this.yType === DataType.KEYWORD) {
            // sort inner buckets by rowProbs
            rowProbs.sort((a,b) => b.prob - a.prob); // smallest to biggest prob
            const permuteKeys = rowProbs.map(d => d.index);
            this.yExtent = d3Array.permute(this.yExtent, permuteKeys);
            for (const bucket of data.buckets)
                bucket.buckets = d3Array.permute(bucket.buckets, permuteKeys);
        }

        return{
            signalSetData: data,
            xBucketsCount, yBucketsCount,
            maxProb,
            rowProbs // colProbs are in signalSetData.buckets (outer buckets)
        };
    }

    getKeywordExtent(buckets_of_buckets) {
        const keys = new Set();
        for (const bucket of buckets_of_buckets)
            for (const inner_bucket of bucket.buckets)
                keys.add(inner_bucket.key);
        return [...keys];
    }

    getKeys(buckets) {
        return buckets.map(bucket => bucket.key);
    }

    getXScale() {
        if (this.xType === DataType.NUMBER)
            return this.state.zoomTransform.rescaleX(d3Scale.scaleLinear()
                .domain(this.xExtent)
                .range([0, this.xSize])
            );
        else // this.xType === DataType.KEYWORD
            return d3Scale.scaleBand()
                .domain(this.xExtent)
                .range([0, this.xSize].map(d => this.state.zoomTransform.applyX(d)));
    }

    getYScale() {
        const zoomTransformY = this.state.zoomTransform.scale(this.state.zoomYScaleMultiplier);
        if (this.yType === DataType.NUMBER)
            return zoomTransformY.rescaleY(d3Scale.scaleLinear()
                .domain(this.yExtent)
                .range([this.ySize, 0])
            );
        else // this.yType === DataType.KEYWORD
            return d3Scale.scaleBand()
                .domain(this.yExtent)
                .range([this.ySize, 0].map(d => zoomTransformY.applyY(d)));
    }

    createChart(forceRefresh, updateZoom) {
        const signalSetData = this.state.signalSetData;

        const t = this.props.t;

        let width = this.containerNode.getClientRects()[0].width;
        const height = this.props.height;

        if (this.state.width !== width || this.state.height !== height) {
            if (this.props.withOverviewLeft && this.state.width === undefined)
                width -= this.props.overviewLeftWidth;
            const maxBucketCountX = Math.ceil(width / this.props.minRectWidth);
            const maxBucketCountY = Math.ceil(height / this.props.minRectHeight);

            this.setState({
                width,
                height,
                maxBucketCountX,
                maxBucketCountY
            });
        }

        const widthChanged = width !== this.renderedWidth;
        if (!forceRefresh && !widthChanged && !updateZoom) {
            return;
        }
        this.renderedWidth = width;

        if (!signalSetData) {
            return;
        }

        const noData = this.state.xBucketsCount === 0 || this.state.yBucketsCount === 0;

        if (noData) {
            this.statusMsgSelection.text(t('No data.'));

            this.cursorAreaSelection
                .on('mouseenter', null)
                .on('mousemove', null)
                .on('mouseleave', null);

            this.brushBottom = null;
            this.brushLeft = null;
            this.zoom = null;

        } else {
            //<editor-fold desc="Scales">
            // x axis
            const xSize = width - this.props.margin.left - this.props.margin.right;
            this.xSize = xSize;
            const xScale = this.getXScale();
            this.xScale = xScale;
            const xAxis = d3Axis.axisBottom(xScale)
                .tickSizeOuter(0);
            this.xAxisSelection.call(xAxis);
            const xStep = signalSetData.step;
            const xOffset = signalSetData.offset;
            const rectWidth = this.xType === DataType.NUMBER ?
                xScale(xStep) - xScale(0) :
                xScale.bandwidth();

            // y axis
            const ySize = height - this.props.margin.top - this.props.margin.bottom;
            this.ySize = ySize;
            const yScale = this.getYScale();
            this.yScale = yScale;
            const yAxis = d3Axis.axisLeft(yScale)
                .tickSizeOuter(0);
            this.yAxisSelection.call(yAxis);
            const yStep = signalSetData.buckets[0].step;
            const yOffset = signalSetData.buckets[0].offset;
            const rectHeight = this.yType === DataType.NUMBER ?
                yScale(0) - yScale(yStep) :
                yScale.bandwidth();

            // color scale
            const colors = this.props.config.colors && this.props.config.colors.length >= 2 ? this.props.config.colors : HeatmapChart.defaultColors;
            const colorScale = getColorScale([0, this.state.maxProb], colors);
            //</editor-fold>

            this.createChartRectangles(signalSetData, xScale, yScale, rectHeight, rectWidth, colorScale);

            if (this.props.withTooltip) {
                this.createChartCursor(signalSetData, xScale, yScale, rectHeight, rectWidth);
            }

            this.defaultBrushLeft = [0, this.ySize];
            this.defaultBrushBottom = [0, this.xSize];
            if (this.props.withOverviewLeft)
                this.createChartOverviewLeft(this.state.rowProbs, this.yExtent, this.props.overviewLeftColor || colors[colors.length - 1]);
            if (this.props.withOverviewBottom)
                this.createChartOverviewBottom(signalSetData.buckets, this.xExtent, this.props.overviewBottomColor || colors[colors.length - 1]);

            // we don't want to change zoom object and cursor area when updating only zoom (it breaks touch drag)
            if (forceRefresh || widthChanged) {
                this.createChartCursorArea(width, height);
                if (this.props.withZoomX || this.props.withZoomY)
                    this.createChartZoom(xSize, ySize);
            }
        }
    }

    createChartCursorArea(width, height) {
        this.cursorAreaSelection
            .selectAll('rect')
            .remove();

        this.cursorAreaSelection
            .append('rect')
            .attr('pointer-events', 'all')
            .attr('cursor', 'crosshair')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width - this.props.margin.left - this.props.margin.right)
            .attr('height', height - this.props.margin.top - this.props.margin.bottom)
            .attr('visibility', 'hidden');
    }

    createChartCursor(signalSetData, xScale, yScale, rectHeight, rectWidth) {
        const self = this;
        let selection, mousePosition;

        const selectPoints = function () {
            const containerPos = d3Selection.mouse(self.containerNode);
            const x = containerPos[0] - self.props.margin.left;
            const y = containerPos[1] - self.props.margin.top;

            let newSelectionColumn = null;
            for (const bucket of signalSetData.buckets) {
                if (xScale(bucket.key) <= x)
                    newSelectionColumn = bucket;
                else break;
            }

            let newSelection = null;
            const yCompensate = this.yType === DataType.NUMBER ? rectHeight : 0;
            if (newSelectionColumn)
                for (const innerBucket of newSelectionColumn.buckets) {
                    if (yScale(innerBucket.key) + rectHeight - yCompensate >= y)
                        newSelection = innerBucket;
                    else break;
                }

            if (selection !== newSelection) {
                self.highlightSelection
                    .selectAll('rect')
                    .remove();

                if (newSelection) {
                    self.highlightSelection
                        .append('rect')
                        .attr('x', xScale(newSelection.xKey))
                        .attr('y', yScale(newSelection.key) - yCompensate)
                        .attr("width", rectWidth)
                        .attr("height", rectHeight)
                        .attr("fill", "none")
                        .attr("stroke", "black")
                        .attr("stroke-width", "2px");
                }
            }

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
        this.highlightSelection
            .selectAll('rect')
            .remove();

        this.setState({
            selection: null,
            mousePosition: null
        });
    };

    createChartRectangles(signalSetData, xScale, yScale, rectHeight, rectWidth, colorScale) {
        const yCompensate = this.yType === DataType.NUMBER ? rectHeight : 0;

        const columns = this.columnsSelection
            .selectAll('g')
            .data(signalSetData.buckets);

        const rects = columns.enter()
            .append('g')
            .attr('key', d => d.key)
            .merge(columns)
            .selectAll('rect')
            .data(d => d.buckets);

        rects.enter()
            .append('rect')
            .merge(rects)
            .attr('key', d => d.key)
            .attr('x', d => xScale(d.xKey))
            .attr('y', d => yScale(d.key) - yCompensate)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("fill", d => colorScale(d.prob));

        rects.exit()
            .remove();
        columns.exit()
            .remove();
    }

    createChartZoom(xSize, ySize) {
        // noinspection DuplicatedCode
        const self = this;

        const handleZoom = function () {
            // noinspection JSUnresolvedVariable
            let newTransform = d3Event.transform;
            let newZoomYScaleMultiplier = self.state.zoomYScaleMultiplier;
            // check brush extents
            const [newBrushBottom, newBrushLeft, updated] = self.getBrushValuesFromZoomValues(newTransform, newZoomYScaleMultiplier);
            if (updated)
                [newTransform, newZoomYScaleMultiplier] = self.getZoomValuesFromBrushValues(newBrushBottom, newBrushLeft);

            // noinspection JSUnresolvedVariable
            if (d3Event.sourceEvent && d3Event.sourceEvent.type === "wheel" && self.props.withTransition) {
                transitionInterpolate(select(self), self.state.zoomTransform, newTransform, (t, y) => {
                    setZoomTransform(self)(t, y);
                    moveBrush(t, y || newZoomYScaleMultiplier); // sourceEvent is "wheel"
                }, () => {
                    self.deselectPoints();
                    setZoomTransform(self)(newTransform, newZoomYScaleMultiplier);
                    moveBrush(newTransform, newZoomYScaleMultiplier);
                }, 150, self.state.zoomYScaleMultiplier, newZoomYScaleMultiplier);
            } else {
                setZoomTransform(self)(newTransform, newZoomYScaleMultiplier);
                // noinspection JSUnresolvedVariable
                if (d3Event.sourceEvent && d3Event.sourceEvent.type !== "brush" && d3Event.sourceEvent.type !== "zoom")
                    moveBrush(newTransform, newZoomYScaleMultiplier);
            }
        };

        const moveBrush = function (transform, zoomYScaleMultiplier) {
            const [newBrushBottom, newBrushLeft, _] = self.getBrushValuesFromZoomValues(transform, zoomYScaleMultiplier);
            if (newBrushBottom && self.brushBottom)
                self.overviewBottomBrushSelection.call(self.brushBottom.move, newBrushBottom);
            else
                self.brushBottomValues = newBrushBottom;
            if (newBrushLeft && self.brushLeft)
                self.overviewLeftBrushSelection.call(self.brushLeft.move, newBrushLeft);
            else
                self.brushLeftValues = newBrushLeft;
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

        const zoomExtent = [[0, 0], [xSize, ySize]];
        const translateExtent = [[0, 0], [xSize, ySize * this.state.zoomYScaleMultiplier]];
        let minZoom = Math.min(this.props.zoomLevelMin, this.props.zoomLevelMin / this.state.zoomYScaleMultiplier);
        if (this.props.withZoomY && !this.props.withZoomX)
            minZoom = this.props.zoomLevelMin / this.state.zoomYScaleMultiplier;
        else if (!this.props.withZoomY && this.props.withZoomX)
            minZoom = this.props.zoomLevelMin;

        // noinspection DuplicatedCode
        this.zoom = d3Zoom.zoom()
            .scaleExtent([minZoom, this.props.zoomLevelMax])
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
            .wheelDelta(WheelDelta(2));
        this.svgContainerSelection.call(this.zoom);
        if (d3Zoom.zoomTransform(this.svgContainerSelection.node()).k < minZoom)
            this.svgContainerSelection.call(this.zoom.scaleTo, this.props.zoomLevelMin);
        //moveBrush(this.state.zoomTransform);
        this.svgContainerSelection.call(this.zoom.transform, this.state.zoomTransform);
    }

    getBrushValuesFromZoomValues(transform, zoomYScaleMultiplier) {
        let updated = false;
        let newBrushBottom = this.defaultBrushBottom.map(transform.invertX, transform);
        const yTransform = transform.scale(zoomYScaleMultiplier);
        let newBrushLeft = this.defaultBrushLeft.map(yTransform.invertY, yTransform);

        if (this.props.withZoomX && this.props.withZoomY) {
            if (newBrushBottom[0] < this.defaultBrushBottom[0]) {
                newBrushBottom[0] = this.defaultBrushBottom[0];
                updated = true;
            }
            if (newBrushBottom[1] > this.defaultBrushBottom[1]) {
                newBrushBottom[1] = this.defaultBrushBottom[1];
                updated = true;
            }

            if (newBrushLeft[0] < this.defaultBrushLeft[0]) {
                newBrushLeft[0] = this.defaultBrushLeft[0];
                updated = true;
            }
            if (newBrushLeft[1] > this.defaultBrushLeft[1]) {
                newBrushLeft[1] = this.defaultBrushLeft[1];
                updated = true;
            }
        }
        else {
            updated = true;
            if (!this.props.withZoomX) {
                newBrushBottom = this.brushBottomValues || this.defaultBrushBottom;
            }
            if (!this.props.withZoomY) {
                newBrushLeft = this.brushLeftValues || this.defaultBrushLeft;
            }
        }
        return [newBrushBottom, newBrushLeft, updated];
    }

    createChartOverviewLeft(rowProbs, yExtent, barColor) {
        //<editor-fold desc="Scales">
        const xSize = this.props.overviewLeftWidth - this.props.overviewLeftMargin.left - this.props.overviewLeftMargin.right;
        const maxProb = d3Array.max(rowProbs, d => d.prob);

        const xScale = d3Scale.scaleLinear() // probabilities
            .domain([0, maxProb])
            .range([0, xSize]);

        const yScale = this.yType === DataType.NUMBER ? // keys
            d3Scale.scaleLinear().domain(yExtent).range([this.ySize, 0]) :
            d3Scale.scaleBand().domain(yExtent).range([this.ySize, 0]);
        const yAxis = d3Axis.axisLeft(yScale)
            .tickSizeOuter(0);
        this.overviewLeftYAxisSelection.call(yAxis);
        //</editor-fold>

        this.drawHorizontalBars(rowProbs, this.overviewLeftBarsSelection, yScale, xScale, barColor);
        if (this.props.withOverviewLeftBrush)
            this.createChartOverviewLeftBrush();
    }

    createChartOverviewBottom(colProbs, xExtent, barColor) {
        //<editor-fold desc="Scales">
        const ySize = this.props.overviewBottomHeight - this.props.overviewBottomMargin.top - this.props.overviewBottomMargin.bottom;
        const maxProb = d3Array.max(colProbs, d => d.prob);

        const yScale = d3Scale.scaleLinear() // probabilities
            .domain([0, maxProb])
            .range([ySize, 0]);

        const xScale = this.xType === DataType.NUMBER ? // keys
            d3Scale.scaleLinear().domain(xExtent).range([0, this.xSize]) :
            d3Scale.scaleBand().domain(xExtent).range([0, this.xSize]);
        const xAxis = d3Axis.axisBottom(xScale)
            .tickSizeOuter(0);
        this.overviewBottomXAxisSelection.call(xAxis);
        //</editor-fold>

        this.drawVerticalBars(colProbs, this.overviewBottomBarsSelection, xScale, yScale, barColor);
        if (this.props.withOverviewBottomBrush)
            this.createChartOverviewBottomBrush();
    }

    createChartOverviewLeftBrush() {
        const self = this;

        const xSize = this.props.overviewLeftWidth - this.props.overviewLeftMargin.left - this.props.overviewLeftMargin.right;
        const brushExisted = this.brushLeft !== null;
        this.brushLeft = d3Brush.brushY()
            .extent([[0, 0], [xSize, this.ySize]])
            .handleSize(20)
            .on("brush end", function () {
                // noinspection JSUnresolvedVariable
                const sel = d3Event.selection;
                self.overviewLeftBrushSelection.call(brushHandlesTopBottom, sel, xSize);
                // noinspection JSUnresolvedVariable
                self.brushLeftValues = d3Event.selection;

                // noinspection JSUnresolvedVariable
                if (d3Event.sourceEvent && d3Event.sourceEvent.type !== "zoom" && d3Event.sourceEvent.type !== "brush") // ignore brush by zoom
                    self.updateZoomFromBrush();
            });

        this.overviewLeftBrushSelection
            .attr('pointer-events', 'all')
            .call(this.brushLeft);
        if (!brushExisted)
            this.overviewLeftBrushSelection.call(this.brushLeft.move, this.defaultBrushLeft);
        this.overviewLeftBrushSelection.select(".selection")
            .classed(styles.selection, true);
        this.overviewLeftBrushSelection.select(".overlay")
            .attr('pointer-events', 'none');
    }

    createChartOverviewBottomBrush() {
        const self = this;

        const ySize = this.props.overviewBottomHeight - this.props.overviewBottomMargin.top - this.props.overviewBottomMargin.bottom;
        const brushExisted = this.brushBottom !== null;
        this.brushBottom = d3Brush.brushX()
            .extent([[0, 0], [this.xSize, ySize]])
            .handleSize(20)
            .on("brush end", function () {
                // noinspection JSUnresolvedVariable
                const sel = d3Event.selection;
                self.overviewBottomBrushSelection.call(brushHandlesLeftRight, sel, ySize);
                // noinspection JSUnresolvedVariable
                self.brushBottomValues = d3Event.selection;

                // noinspection JSUnresolvedVariable
                if (d3Event.sourceEvent && d3Event.sourceEvent.type !== "zoom" && d3Event.sourceEvent.type !== "brush") // ignore brush by zoom
                    self.updateZoomFromBrush();
            });

        this.overviewBottomBrushSelection
            .attr('pointer-events', 'all')
            .call(this.brushBottom);
        if (!brushExisted)
            this.overviewBottomBrushSelection.call(this.brushBottom.move, this.defaultBrushBottom);
        this.overviewBottomBrushSelection.select(".selection")
            .classed(styles.selection, true);
        this.overviewBottomBrushSelection.select(".overlay")
            .attr('pointer-events', 'none');
    }

    getZoomValuesFromBrushValues(bottom, left) {
        if (!bottom) bottom = this.defaultBrushBottom;
        if (!left) left = this.defaultBrushLeft;
        const newXSize = bottom[1] - bottom[0];
        const newYSize = left[1] - left[0];
        const newXScaling = this.xSize / newXSize;
        const newYScaling = this.ySize / newYSize;
        const newZoomYScaleMultiplier = newYScaling / newXScaling;
        const transform = d3Zoom.zoomIdentity.scale(newXScaling).translate(-bottom[0], -left[0] * newZoomYScaleMultiplier);
        return [transform, newZoomYScaleMultiplier];
    }

    updateZoomFromBrush() {
        const [transform, newZoomYScaleMultiplier] = this.getZoomValuesFromBrushValues(this.brushBottomValues, this.brushLeftValues);

        if (this.props.withZoomX || this.props.withZoomY)
            this.svgContainerSelection.call(this.zoom.transform, transform);
        else
            this.setState({ zoomTransform: transform });
        this.setState({
            zoomYScaleMultiplier: newZoomYScaleMultiplier
        });
    }

    drawVerticalBars(data, barsSelection, keyScale, probScale, barColor) {
        const bars = barsSelection
            .selectAll('rect')
            .data(data, d => d.key);
        const ySize = probScale.range()[0];
        const barWidth = (keyScale.range()[1] - keyScale.range()[0]) / data.length;

        bars.enter()
            .append('rect')
            .merge(bars)
            .attr('x', d => keyScale(d.key))
            .attr('y', d => probScale(d.prob))
            .attr("width", barWidth)
            .attr("height", d => ySize - probScale(d.prob))
            .attr("fill", barColor);

        bars.exit()
            .remove();
    }

    drawHorizontalBars(data, barsSelection, keyScale, probScale, barColor) {
        const bars = barsSelection
            .selectAll('rect')
            .data(data, d => d.key);
        const barHeight = (keyScale.range()[0] - keyScale.range()[1]) / data.length;
        const yCompensate = this.yType === DataType.NUMBER ? barHeight : 0;

        bars.enter()
            .append('rect')
            .merge(bars)
            .attr('x', 0)
            .attr('y', d => keyScale(d.key) - yCompensate)
            .attr("width", d => probScale(d.prob))
            .attr("height", barHeight)
            .attr("fill", barColor);

        bars.exit()
            .remove();
    }


    render() {
        if (!this.state.signalSetData) {
            return (
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <text textAnchor="middle" x="50%" y="50%"
                          fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                        {this.state.statusMsg}
                    </text>
                </svg>
            );

        } else {

            return (
                <div>
                    {this.props.withOverviewLeft &&
                    <svg id="overview_left" ref={node => this.overviewLeft = node} height={this.props.height}
                         width={this.props.overviewLeftWidth} >
                        <g transform={`translate(${this.props.overviewLeftMargin.left}, ${this.props.margin.top})`}>
                            <g ref={node => this.overviewLeftBarsSelection = select(node)}/>
                        </g>
                        <g ref={node => this.overviewLeftYAxisSelection = select(node)}
                           transform={`translate(${this.props.overviewLeftMargin.left}, ${this.props.margin.top})`}/>
                        <g ref={node => this.overviewLeftBrushSelection = select(node)}
                           transform={`translate(${this.props.overviewLeftMargin.left}, ${this.props.margin.top})`}
                           className={styles.brush}/>
                    </svg>}
                    <div ref={node => this.svgContainerSelection = select(node)} className={styles.touchActionNone}
                         style={{ width: this.props.withOverviewLeft ? `calc(100% - ${this.props.overviewLeftWidth}px)` : "100%", height: this.props.height, display: "inline-block"}} >
                        <svg id="cnt" ref={node => this.containerNode = node} height={"100%"} width={"100%"}>
                            <defs>
                                <clipPath id="plotRect">
                                    <rect x="0" y="0" width={this.state.width} height={this.props.height - this.props.margin.top - this.props.margin.bottom} />
                                </clipPath>
                                <clipPath id="leftAxis">
                                    <rect x={-this.props.margin.left + 1} y={0} width={this.props.margin.left} height={this.props.height - this.props.margin.top - this.props.margin.bottom + 6} /* 6 is default size of axis ticks, so we can add extra space in the bottom left corner for this axis and still don't collide with the other axis. Thanks to this, the first tick text should not be cut in half. */ />
                                </clipPath>
                                <clipPath id="bottomAxis">
                                    <rect x={-6} y={0} width={this.state.width + 6} height={this.props.margin.bottom} /* same reason for 6 as above */ />
                                </clipPath>
                            </defs>
                            <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`} clipPath="url(#plotRect)" >
                                <g ref={node => this.columnsSelection = select(node)}/>
                                {!this.state.zoomInProgress &&
                                    <g ref={node => this.highlightSelection = select(node)}/>}
                            </g>
                            <g ref={node => this.xAxisSelection = select(node)}
                               transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}
                               clipPath="url(#bottomAxis)" />
                            <g ref={node => this.yAxisSelection = select(node)}
                               transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}
                               clipPath="url(#leftAxis)"/>
                            <text ref={node => this.statusMsgSelection = select(node)} textAnchor="middle" x="50%" y="50%"
                                  fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"/>
                            {this.props.withTooltip && !this.state.zoomInProgress &&
                            <Tooltip
                                config={this.props.config}
                                signalSetsData={this.state.signalSetData}
                                containerHeight={this.props.height}
                                containerWidth={this.state.width}
                                mousePosition={this.state.mousePosition}
                                selection={this.state.selection}
                                contentRender={props => <TooltipContent {...props}/>}
                                width={250}
                            />
                            }
                            <g ref={node => this.cursorAreaSelection = select(node)}
                               transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                        </svg>
                    </div>
                    {this.props.withOverviewBottom &&
                    <svg id="overview_bottom"
                         style={{marginLeft: this.props.withOverviewLeft ? this.props.overviewLeftWidth : 0}}
                         ref={node => this.overviewBottom = node}
                         height={this.props.overviewBottomHeight}
                         width={ this.props.withOverviewLeft ? `calc(100% - ${this.props.overviewLeftWidth}px)` : "100%"} >
                        <g transform={`translate(${this.props.margin.left}, ${this.props.overviewBottomMargin.top})`}>
                            <g ref={node => this.overviewBottomBarsSelection = select(node)}/>
                        </g>
                        <g ref={node => this.overviewBottomXAxisSelection = select(node)}
                           transform={`translate(${this.props.margin.left}, ${this.props.overviewBottomHeight - this.props.overviewBottomMargin.bottom})`}/>
                        <g ref={node => this.overviewBottomBrushSelection = select(node)}
                           transform={`translate(${this.props.margin.left}, ${this.props.overviewBottomMargin.top})`}
                           className={styles.brush}/>
                    </svg>}
                </div>
            );
        }
    }
}
