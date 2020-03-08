'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Format from "d3-format";
import * as d3Selection from "d3-selection";
import {event as d3Event, select} from "d3-selection";
import * as d3Array from "d3-array";
import * as d3Interpolate from "d3-interpolate";
import {intervalAccessMixin} from "./TimeContext";
import {DataAccessSession} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {Tooltip} from "./Tooltip";
import {Icon} from "../lib/bootstrap-components";
import * as d3Zoom from "d3-zoom";
import * as d3Brush from "d3-brush";
import styles from "./correlation_charts/CorrelationCharts.scss";
import {brushHandlesLeftRight, isInExtent, transitionInterpolate, WheelDelta} from "./common";
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
])
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
        margin: PropTypes.object.isRequired,
        overviewHeight: PropTypes.number,
        overviewMargin: PropTypes.object,

        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withOverview: PropTypes.bool,
        withTransition: PropTypes.bool,
        withZoom: PropTypes.bool,

        minStep: PropTypes.number,
        minBarWidth: PropTypes.number,
        maxBucketCount: PropTypes.number,
        topPaddingWhenZoomed: PropType_NumberInRange(0, 1), // determines whether bars will be stretched up when zooming
        xMin: PropTypes.number,
        xMax: PropTypes.number,

        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,
    };

    static defaultProps = {
        minBarWidth: 20,
        maxBucketCount: undefined,
        xMin: NaN,
        xMax: NaN,
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

    componentDidUpdate(prevProps, prevState) {
        const t = this.props.t;

        let configDiff = compareConfigs(this.props.config, prevProps.config);

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
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

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
                let queryWithRangeFilter = false;
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
                        sigCid: config.sigCid,
                        gte: this.props.xMin
                    });
                if (!isNaN(this.props.xMax))
                    filter.children.push({
                        type: "range",
                        sigCid: config.sigCid,
                        lte: this.props.xMax
                    });

                // filter by current zoom
                if (!Object.is(this.state.zoomTransform, d3Zoom.zoomIdentity)) {
                    const scale = this.state.zoomTransform.k;
                    if (minStep !== undefined)
                        minStep = Math.floor(minStep / scale);
                    maxBucketCount = Math.ceil(maxBucketCount * scale);
                    queryWithRangeFilter = true;
                }

                const results = await this.dataAccessSession.getLatestHistogram(config.sigSetCid, [config.sigCid], maxBucketCount, minStep, filter);

                if (results) { // Results is null if the results returned are not the latest ones
                    const processedResults = this.processData(results);

                    if (!queryWithRangeFilter) { // zoomed completely out
                        // update extent of x axis
                        this.xExtent = [processedResults.min, processedResults.max];
                        if (!isNaN(this.props.xMin)) this.xExtent[0] = this.props.xMin;
                        if (!isNaN(this.props.xMax)) this.xExtent[1] = this.props.xMax;

                        this.setState({
                            globalSignalSetData: processedResults
                        });

                        if (this.zoom)
                            this.svgContainerSelection.call(this.zoom.transform, d3Zoom.zoomIdentity); // reset zoom
                    }

                    this.setState({
                        signalSetData: processedResults
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

    createChart(forceRefresh, updateZoom) {
        const signalSetData = this.state.signalSetData;
        const globalSignalSetData = this.state.globalSignalSetData;

        const t = this.props.t;
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

        const noData = signalSetData.buckets.length === 0;
        if (noData) {
            this.statusMsgSelection.text(t('No data.'));
            this.cursorSelection.attr('visibility', 'hidden');

            this.cursorAreaSelection
                .on('mouseenter', null)
                .on('mousemove', null)
                .on('mouseleave', null);

            this.brush = null;
            this.zoom = null;

        } else {
             //<editor-fold desc="Scales">
            const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
            const xSize = this.renderedWidth - this.props.margin.left - this.props.margin.right;

            let xScale = d3Scale.scaleLinear()
                .domain(this.xExtent)
                .range([0, width - this.props.margin.left - this.props.margin.right]);
            xScale = this.state.zoomTransform.rescaleX(xScale);
            const xAxis = d3Axis.axisBottom(xScale)
                .tickSizeOuter(0);
            this.xAxisSelection.call(xAxis);

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
            if (maxProbInZoom !== undefined && maxProbInZoom !== 0){
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

            this.drawBars(signalSetData, this.barsSelection, xScale, yScale, ySize, this.props.config.color, false);

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
    }

    drawBars(signalSetsData, barsSelection, xScale, yScale, ySize, barColor, disableTransitions = true) {
        const step = signalSetsData.step;
        const barWidth = xScale(step) - xScale(0) - 1;

        const bars = barsSelection
            .selectAll('rect')
            .data(signalSetsData.buckets, d => d.key);

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

    createChartCursor(signalSetData, xScale, yScale, ySize) {
        const self = this;
        const pointColor = this.props.config.color.darker();

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
                }, self.barsHighlightSelection, xScale, yScale, ySize, pointColor)
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

    createChartZoom(xSize, ySize) {
        // noinspection DuplicatedCode
        const self = this;

        const handleZoom = function () {
            // noinspection JSUnresolvedVariable
            if (self.props.withTransition && d3Event.sourceEvent && d3Event.sourceEvent.type === "wheel") {
                transitionInterpolate(select(self), self.state.zoomTransform, d3Event.transform, setZoomTransform, () => {
                    self.deselectPoints();
                });
            } else {
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
        this.zoom = d3Zoom.zoom()
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

    createChartOverview(signalSetData) {
        //<editor-fold desc="Scales">
        const ySize = this.props.overviewHeight - this.props.overviewMargin.top - this.props.overviewMargin.bottom;

        const yScale = d3Scale.scaleLinear()
            .domain([0, signalSetData.maxProb])
            .range([ySize, 0]);

        let xScale = d3Scale.scaleLinear()
            .domain(this.xExtent)
            .range([0, this.renderedWidth - this.props.margin.left - this.props.margin.right]);
        const xAxis = d3Axis.axisBottom(xScale)
            .tickSizeOuter(0);
        this.overviewXAxisSelection.call(xAxis);
        //</editor-fold>

        this.drawBars(signalSetData, this.overviewBarsSelection, xScale, yScale, ySize, this.props.config.color);

        this.createChartOverviewBrush();
    }

    createChartOverviewBrush() {
        const self = this;

        const xSize = this.renderedWidth - this.props.margin.left - this.props.margin.right;
        const ySize = this.props.overviewHeight - this.props.overviewMargin.top - this.props.overviewMargin.bottom;
        this.defaultBrush = [0, xSize];
        const brushExisted = this.brush !== null;
        this.brush = d3Brush.brushX()
            .extent([[0, 0], [xSize, ySize]])
            .handleSize(20)
            .on("brush end", function () {
                // noinspection JSUnresolvedVariable
                const sel = d3Event.selection;
                self.overviewBrushSelection.call(brushHandlesLeftRight, sel, ySize);

                // noinspection JSUnresolvedVariable
                if (d3Event.sourceEvent && d3Event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
                const newTransform = d3Zoom.zoomIdentity.scale(xSize / (sel[1] - sel[0])).translate(-sel[0], 0);
                if (self.zoom)
                    self.svgContainerSelection.call(self.zoom.transform, newTransform);
                else
                    self.setState({ zoomTransform: newTransform });
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
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <text textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                        {this.state.statusMsg}
                    </text>
                </svg>
            );

        } else {

            return (
                <div>
                    <div ref={node => this.svgContainerSelection = select(node)} className={styles.touchActionPanY}>
                    <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                        <defs>
                            <clipPath id="plotRect">
                                <rect x="0" y="0" width={this.state.width} height={this.props.height - this.props.margin.top - this.props.margin.bottom} />
                            </clipPath>
                        </defs>
                        <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`} clipPath="url(#plotRect)" >
                            <g ref={node => this.barsSelection = select(node)}/>
                            <g ref={node => this.barsHighlightSelection = select(node)}/>
                        </g>
                        <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                        <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                        {!this.state.zoomInProgress &&
                        <line ref={node => this.cursorSelection = select(node)} strokeWidth="1" stroke="rgb(50,50,50)" visibility="hidden"/>}
                        <text ref={node => this.statusMsgSelection = select(node)} textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"/>
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
                    <svg id="overview" ref={node => this.overview = node} height={this.props.overviewHeight}
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
