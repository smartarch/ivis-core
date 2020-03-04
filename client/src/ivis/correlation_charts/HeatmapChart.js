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
import {brushHandlesLeftRight, brushHandlesTopBottom, getColorScale, WheelDelta} from "../common";
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

            const xKeyF = d3Format.format("." + d3Format.precisionFixed(xStep) + "f");
            const yKeyF = d3Format.format("." + d3Format.precisionFixed(yStep) + "f");
            const probF = d3Format.format(".2f");

            return (
                <div>
                    <div>X axis range: <Icon icon="chevron-left"/>{xKeyF(bucket.xKey)} <Icon icon="ellipsis-h"/> {xKeyF(bucket.xKey + xStep)}<Icon icon="chevron-right"/></div>
                    <div>Y axis range: <Icon icon="chevron-left"/>{yKeyF(bucket.key)} <Icon icon="ellipsis-h"/> {yKeyF(bucket.key + yStep)}<Icon icon="chevron-right"/></div>
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
            width: 0,
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
        withTransition: PropTypes.bool,

        minStep: PropTypes.number,
        minRectWidth: PropTypes.number,
        minRectHeight: PropTypes.number,

        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,
    };

    static defaultProps = {
        minRectWidth: 40,
        minRectHeight: 40,
        withTooltip: true,
        withOverviewBottom: true,
        withOverviewLeft: true,
        withTransition: true,

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

        if (this.state.maxBucketCountX > 0 && this.state.maxBucketCountY > 0) {
            try {
                let filter;
                if (config.tsSigCid) {
                    const abs = this.getIntervalAbsolute();
                    filter = {
                        type: 'range',
                        sigCid: config.tsSigCid,
                        gte: abs.from.toISOString(),
                        lt: abs.to.toISOString()
                    };
                }

                const results = await this.dataAccessSession.getLatestHistogram(config.sigSetCid, [config.X_sigCid, config.Y_sigCid], [this.state.maxBucketCountX, this.state.maxBucketCountY], this.props.minStep, filter);

                if (results) { // Results is null if the results returned are not the latest ones
                    this.setState({
                        signalSetData: results,
                        xBucketsCount: results.buckets.length,
                        yBucketsCount: results.buckets.length > 0 ? results.buckets[0].buckets.length : 0
                    });
                }
            } catch (err) {
                throw err;
            }
        }
    }

    createChart(forceRefresh, updateZoom) {
        const signalSetData = this.state.signalSetData;

        const t = this.props.t;

        const width = this.containerNode.getClientRects()[0].width;
        const height = this.props.height;

        if (this.state.width !== width || this.state.height !== height) {
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

        const noData = signalSetData.buckets.length === 0 || signalSetData.buckets[0].buckets.length === 0;

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
            //<editor-fold desc="Data processing">
            const xMin = signalSetData.buckets[0].key;
            const xMax = signalSetData.buckets[this.state.xBucketsCount - 1].key + signalSetData.step;
            const yMin = signalSetData.buckets[0].buckets[0].key;
            const yMax = signalSetData.buckets[0].buckets[this.state.yBucketsCount - 1].key + signalSetData.buckets[0].step;

            // calculate probabilities of buckets
            let totalCount = d3Array.sum(signalSetData.buckets, d => d.count);
            for (const bucket of signalSetData.buckets)
                bucket.prob = bucket.count / totalCount;
            const rowProbs = signalSetData.buckets[0].buckets.map(b => { return {key: b.key, prob: 0}; });

            let maxProb = 0;
            for (const bucket of signalSetData.buckets) {
                let columnCount = d3Array.sum(bucket.buckets, d => d.count);
                for (const [i, innerBucket] of bucket.buckets.entries()) {
                    innerBucket.prob = bucket.prob * innerBucket.count / columnCount || 0;
                    innerBucket.xKey = bucket.key;
                    if (innerBucket.prob > maxProb)
                        maxProb = innerBucket.prob;
                    rowProbs[i].prob += innerBucket.prob;
                }
            }
            //</editor-fold>

            //<editor-fold desc="Scales">
            // x axis
            const xSize = width - this.props.margin.left - this.props.margin.right;
            this.xSize = xSize;
            const xScale = this.state.zoomTransform.rescaleX(
                d3Scale.scaleLinear()
                    .domain([xMin, xMax])
                    .range([0, xSize])
            );
            this.xScale = xScale;
            const xAxis = d3Axis.axisBottom(xScale)
                .tickSizeOuter(0);
            this.xAxisSelection.call(xAxis);
            const xStep = signalSetData.step;
            const xOffset = signalSetData.offset;
            const rectWidth = xScale(xStep) - xScale(0);

            // y axis
            const ySize = height - this.props.margin.left - this.props.margin.right;
            this.ySize = ySize;
            const yScale = this.state.zoomTransform.scale(this.state.zoomYScaleMultiplier).rescaleY(
                d3Scale.scaleLinear()
                    .domain([yMin, yMax])
                    .range([ySize, 0])
            );
            this.yScale = yScale;
            const yAxis = d3Axis.axisLeft(yScale)
                .tickSizeOuter(0);
            this.yAxisSelection.call(yAxis);
            const yStep = signalSetData.buckets[0].step;
            const yOffset = signalSetData.buckets[0].offset;
            const rectHeight = yScale(0) - yScale(yStep);

            // color scale
            const colors = this.props.config.colors && this.props.config.colors.length >= 2 ? this.props.config.colors : HeatmapChart.defaultColors;
            const colorScale = getColorScale([0, maxProb], colors);
            //</editor-fold>

            this.createChartRectangles(signalSetData, xScale, yScale, rectHeight, rectWidth, colorScale);

            // we don't want to change zoom object and cursor area when updating only zoom (it breaks touch drag)
            if (forceRefresh || widthChanged) {
                this.createChartCursorArea(width, height);
                this.createChartZoom(xSize, ySize);
            }

            if (this.props.withTooltip) {
                this.createChartCursor(signalSetData, xScale, yScale, rectHeight, rectWidth);
            }

            this.defaultBrushLeft = [0, this.ySize];
            this.defaultBrushBottom = [0, this.xSize];
            if (this.props.withOverviewLeft)
                this.createChartOverviewLeft(rowProbs, [yMin, yMax], this.props.overviewLeftColor || colors[colors.length - 1]);
            if (this.props.withOverviewBottom)
                this.createChartOverviewBottom(signalSetData.buckets, [xMin, xMax], this.props.overviewBottomColor || colors[colors.length - 1]);
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
            const xKey = xScale.invert(x);
            const yKey = yScale.invert(y);

            let newSelectionColumn = null;
            for (const bucket of signalSetData.buckets) {
                if (bucket.key <= xKey)
                    newSelectionColumn = bucket;
                else break;
            }

            let newSelection = null;
            if (newSelectionColumn)
                for (const innerBucket of newSelectionColumn.buckets) {
                    if (innerBucket.key <= yKey)
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
                        .attr('y', yScale(newSelection.key) - rectHeight)
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
            .attr('x', d => xScale(d.xKey))
            .attr('y', d => yScale(d.key) - rectHeight)
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

            // noinspection JSUnresolvedVariable
            if (d3Event.sourceEvent && d3Event.sourceEvent.type === "wheel") {
                const [newBrushBottom, newBrushLeft, updated] = self.getBrushValuesFromZoomValues(newTransform, self.state.zoomYScaleMultiplier);
                if (updated) {
                    [newTransform, newZoomYScaleMultiplier] = self.getZoomValuesFromBrushValues(newBrushBottom, newBrushLeft);
                }

                if (self.props.withTransition) {
                const prevTransform = self.state.zoomTransform;
                const xInterpolate = d3Interpolate.interpolate(prevTransform.x, newTransform.x);
                const yInterpolate = d3Interpolate.interpolate(prevTransform.y, newTransform.y);
                const kInterpolate = d3Interpolate.interpolate(prevTransform.k, newTransform.k);
                const prevZoomYScaleMultiplier = self.state.zoomYScaleMultiplier;
                const mInterpolate = updated ? d3Interpolate.interpolate(prevZoomYScaleMultiplier, newZoomYScaleMultiplier) : (_) => undefined;

                select(self).transition().duration(150)
                    .tween("zoom", () => function (t) {
                        const transform = d3Zoom.zoomIdentity.translate(xInterpolate(t), yInterpolate(t)).scale(kInterpolate(t));
                        const zoomYScaleMultiplier = mInterpolate(t);
                        setZoomTransform(transform, zoomYScaleMultiplier);
                        moveBrush(transform, zoomYScaleMultiplier || newZoomYScaleMultiplier);
                    })
                    .on("end", () => {
                        self.deselectPoints();
                        setZoomTransform(newTransform, newZoomYScaleMultiplier);
                        moveBrush(newTransform, newZoomYScaleMultiplier);
                    });
                }
                else {
                    setZoomTransform(newTransform, newZoomYScaleMultiplier);
                    // noinspection JSUnresolvedVariable
                    if (d3Event.sourceEvent && d3Event.sourceEvent.type !== "brush" && d3Event.sourceEvent.type !== "zoom")
                        moveBrush(newTransform, newZoomYScaleMultiplier);
                }
            } else {
                setZoomTransform(newTransform);
                // noinspection JSUnresolvedVariable
                if (d3Event.sourceEvent && d3Event.sourceEvent.type !== "brush" && d3Event.sourceEvent.type !== "zoom")
                    moveBrush(newTransform, newZoomYScaleMultiplier);
            }
        };

        const setZoomTransform = function (transform, newZoomYScaleMultiplier) {
            if (newZoomYScaleMultiplier)
                self.setState({
                    zoomTransform: transform,
                    zoomYScaleMultiplier: newZoomYScaleMultiplier
                });
            else
                self.setState({
                    zoomTransform: transform
                });
        };

        const moveBrush = function (transform, zoomYScaleMultiplier) {
            const [newBrushBottom, newBrushLeft, _] = self.getBrushValuesFromZoomValues(transform, zoomYScaleMultiplier);
            if (newBrushBottom && self.brushBottom)
                self.overviewBottomBrushSelection.call(self.brushBottom.move, newBrushBottom);
            if (newBrushLeft && self.brushLeft)
                self.overviewLeftBrushSelection.call(self.brushLeft.move, newBrushLeft);
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
        const minZoom = Math.min(this.props.zoomLevelMin, this.props.zoomLevelMin / this.state.zoomYScaleMultiplier);
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
    }

    getBrushValuesFromZoomValues(transform, zoomYScaleMultiplier) {
        let updated = false;
        let newBrushBottom, newBrushLeft;
        if (this.brushBottom) {
            newBrushBottom = this.defaultBrushBottom.map(transform.invertX, transform);
            if (newBrushBottom[0] < this.defaultBrushBottom[0]) {
                newBrushBottom[0] = this.defaultBrushBottom[0];
                updated = true;
            }
            if (newBrushBottom[1] > this.defaultBrushBottom[1]) {
                newBrushBottom[1] = this.defaultBrushBottom[1];
                updated = true;
            }
        }
        else {
            newBrushBottom = this.defaultBrushBottom;
            updated = true;
        }
        if (this.brushLeft) {
            const yTransform = transform.scale(zoomYScaleMultiplier);
            newBrushLeft = this.defaultBrushLeft.map(yTransform.invertY, yTransform);
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
            newBrushLeft = this.defaultBrushLeft;
            updated = true;
        }
        return [newBrushBottom, newBrushLeft, updated];
    }

    createChartOverviewLeft(rowProbs, yExtent, barColor) {
        //<editor-fold desc="Scales">
        const xSize = this.props.overviewLeftWidth - this.props.overviewLeftMargin.left - this.props.overviewLeftMargin.right;
        const maxProb = d3Array.max(rowProbs, d => d.prob);

        const xScale = d3Scale.scaleLinear()
            .domain([0, maxProb])
            .range([0, xSize]);

        const yScale = d3Scale.scaleLinear()
            .domain(yExtent)
            .range([this.ySize, 0]);
        const yAxis = d3Axis.axisLeft(yScale)
            .tickSizeOuter(0);
        this.overviewLeftYAxisSelection.call(yAxis);
        //</editor-fold>

        this.drawHorizontalBars(rowProbs, this.overviewLeftBarsSelection, yScale, xScale, barColor);
        this.createChartOverviewLeftBrush();
    }

    createChartOverviewBottom(colProbs, xExtent, barColor) {
        //<editor-fold desc="Scales">
        const ySize = this.props.overviewBottomHeight - this.props.overviewBottomMargin.top - this.props.overviewBottomMargin.bottom;
        const maxProb = d3Array.max(colProbs, d => d.prob);

        const yScale = d3Scale.scaleLinear() // probabilities
            .domain([0, maxProb])
            .range([ySize, 0]);

        const xScale = d3Scale.scaleLinear() // keys
            .domain(xExtent)
            .range([0, this.xSize]);
        const xAxis = d3Axis.axisBottom(xScale)
            .tickSizeOuter(0);
        this.overviewBottomXAxisSelection.call(xAxis);
        //</editor-fold>

        this.drawVerticalBars(colProbs, this.overviewBottomBarsSelection, xScale, yScale, barColor);
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

        this.svgContainerSelection.call(this.zoom.transform, transform);
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

        bars.enter()
            .append('rect')
            .merge(bars)
            .attr('x', 0)
            .attr('y', d => keyScale(d.key) - barHeight)
            .attr("width", d => probScale(d.prob))
            .attr("height", barHeight)
            .attr("fill", barColor);

        bars.exit()
            .remove();
    }


    render() {
        const config = this.props.config;

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
                            </defs>
                            <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`} clipPath="url(#plotRect)" >
                                <g ref={node => this.columnsSelection = select(node)}/>
                                {!this.state.zoomInProgress &&
                                    <g ref={node => this.highlightSelection = select(node)}/>}
                            </g>
                            <g ref={node => this.xAxisSelection = select(node)}
                               transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                            <g ref={node => this.yAxisSelection = select(node)}
                               transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
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
