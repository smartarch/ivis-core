'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Format from "d3-format";
import * as d3Selection from "d3-selection";
import {event as d3Event, select} from "d3-selection";
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
            signalSetsData: null,
            statusMsg: t('Loading...'),
            width: 0,
            maxBucketCount: 0,
            zoomTransform: d3Zoom.zoomIdentity
        };

        this.resizeListener = () => {
            this.createChart(this.state.signalSetsData);
        };
    }

    static propTypes = {
        config: PropTypes.shape({
            sigSetCid: PropTypes.string.isRequired,
            sigCid: PropTypes.string.isRequired,
            color: PropTypes.object.isRequired,
            tsSigCid: PropTypes.string
        }).isRequired,
        height: PropTypes.number.isRequired,
        overviewHeight: PropTypes.number,
        overviewMargin: PropTypes.object,
        margin: PropTypes.object.isRequired,

        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withOverview: PropTypes.bool,

        minStep: PropTypes.number,
        minBarWidth: PropTypes.number,
        bucketCount: PropTypes.number
    };

    static defaultProps = {
        minBarWidth: 20,
        bucketCount: undefined,

        withCursor: true,
        withTooltip: true,
        withOverview: true,

        overviewHeight: 100,
        overviewMargin: { top: 20, bottom: 20 }
    };

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(null, false, false);
    }

    componentDidUpdate(prevProps, prevState) {
        let signalSetsData = this.state.signalSetsData;

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

        if (prevState.maxBucketCount !== this.state.maxBucketCount) {
            configDiff = ConfigDifference.DATA;
        }

        if (configDiff === ConfigDifference.DATA || configDiff === ConfigDifference.DATA_WITH_CLEAR) {
            if (configDiff === ConfigDifference.DATA_WITH_CLEAR) {
                this.setState({
                    signalSetsData: null,
                    statusMsg: t('Loading...')
                });

                signalSetsData = null;
            }

            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();

        } else {
             const forceRefresh = this.prevContainerNode !== this.containerNode
                || prevState.signalSetsData !== this.state.signalSetsData
                || configDiff !== ConfigDifference.NONE;

            const updateZoom = !Object.is(prevState.zoomTransform, this.state.zoomTransform);

            this.createChart(signalSetsData, forceRefresh, updateZoom);
            this.prevContainerNode = this.containerNode;
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    @withAsyncErrorHandler
    async fetchData() {
        const config = this.props.config;

        if (this.state.maxBucketCount > 0) {
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

                const results = await this.dataAccessSession.getLatestHistogram(config.sigSetCid, [config.sigCid], this.state.maxBucketCount, this.props.minStep, filter);

                if (results) { // Results is null if the results returned are not the latest ones
                    this.setState({
                        signalSetsData: {
                            step: results.step,
                            offset: results.offset,
                            buckets: results.buckets
                        }
                    });

                    if (this.zoom)
                        this.cursorAreaSelection.call(this.zoom.transform, d3Zoom.zoomIdentity); // reset zoom
                }
            } catch (err) {
                throw err;
            }
        }
    }

    createChart(signalSetsData, forceRefresh, updateZoom) {
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

        if (!signalSetsData) {
            return;
        }

        const noData = signalSetsData.buckets.length === 0;

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
            //<editor-fold desc="Data processing">
            const xMin = signalSetsData.buckets[0].key;
            const xMax = signalSetsData.buckets[signalSetsData.buckets.length - 1].key + signalSetsData.step;

            let yMax = 0;
            let totalCount = 0;
            for (const bucket of signalSetsData.buckets) {
                if (bucket.count > yMax) {
                    yMax = bucket.count;
                }

                totalCount += bucket.count;
            }
            yMax /= totalCount;

            for (const bucket of signalSetsData.buckets) {
                bucket.prob = bucket.count / totalCount;
            }
            //</editor-fold>

            //<editor-fold desc="Scales">
            const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
            const xSize = this.renderedWidth - this.props.margin.left - this.props.margin.right;

            const yScale = d3Scale.scaleLinear()
                .domain([0, yMax])
                .range([ySize, 0]);
            const yAxis = d3Axis.axisLeft(yScale)
                .tickFormat(yScale.tickFormat(10, "-%"));
            this.yAxisSelection.call(yAxis);

            let xScale = d3Scale.scaleLinear()
                .domain([xMin, xMax])
                .range([0, width - this.props.margin.left - this.props.margin.right]);
            xScale = this.state.zoomTransform.rescaleX(xScale);
            const xAxis = d3Axis.axisBottom(xScale)
                .tickSizeOuter(0);
            this.xAxisSelection.call(xAxis);
            //</editor-fold>

            this.drawBars(signalSetsData, this.barsSelection, xScale, yScale, ySize, this.props.config.color);

            // we don't want to change zoom object and cursor area when updating only zoom (it breaks touch drag)
            if (forceRefresh || widthChanged) {
                this.createChartCursorArea();
                this.createChartZoom(xSize, ySize);
            }

            this.createChartCursor(signalSetsData, xScale, yScale, ySize);

            if (this.props.withOverview)
                this.createChartOverview(signalSetsData, xMin, xMax, yMax);
        }
    }

    drawBars(signalSetsData, barsSelection, xScale, yScale, ySize, barColor) {
        const step = signalSetsData.step;
        const barWidth = xScale(step) - xScale(0) - 1;

        const bars = barsSelection
            .selectAll('rect')
            .data(signalSetsData.buckets);

        bars.enter()
            .append('rect')
            .merge(bars)
            .attr('x', d => xScale(d.key))
            .attr('y', d => yScale(d.prob))
            .attr("width", barWidth)
            .attr("height", d => ySize - yScale(d.prob))
            .attr("fill", barColor);

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

    createChartCursor(signalSetsData, xScale, yScale, ySize) {
        const self = this;
        const pointColor = this.props.config.color.darker();

        this.barsHighlightSelection
            .selectAll('rect')
            .remove();

        let selection, mousePosition;

        const selectPoints = function () {
            const containerPos = d3Selection.mouse(self.containerNode);
            const x = containerPos[0] - self.props.margin.left;

            const key = xScale.invert(x);
            let newSelection = null;
            for (const bucket of signalSetsData.buckets) {
                if (bucket.key <= key) {
                    newSelection = bucket;
                } else {
                    break;
                }
            }

            if (selection !== newSelection && (self.props.withCursor || self.props.withTooltip)) {
                self.drawBars({
                    buckets: [newSelection],
                    step: signalSetsData.step
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
        const self = this;

        // zoom
        const handleZoom = function () {
            self.setState({
                zoomTransform: d3Event.transform
            });
            if (self.brush)
                self.overviewBrushSelection.call(self.brush.move, self.defaultBrush.map(d3Event.transform.invertX, d3Event.transform));
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
            .scaleExtent([1, 4])
            .translateExtent(zoomExtent)
            .extent(zoomExtent)
            .on("zoom", handleZoom)
            .on("end", handleZoomEnd)
            .on("start", handleZoomStart);
        this.cursorAreaSelection.call(this.zoom);
    }

    createChartOverview(signalSetsData, xMin, xMax, yMax) {
        //<editor-fold desc="Scales">
        const ySize = this.props.overviewHeight - this.props.overviewMargin.top - this.props.overviewMargin.bottom;

        const yScale = d3Scale.scaleLinear()
            .domain([0, yMax])
            .range([ySize, 0]);

        let xScale = d3Scale.scaleLinear()
            .domain([xMin, xMax])
            .range([0, this.renderedWidth - this.props.margin.left - this.props.margin.right]);
        const xAxis = d3Axis.axisBottom(xScale)
            .tickSizeOuter(0);
        this.overviewXAxisSelection.call(xAxis);
        //</editor-fold>

        this.drawBars(signalSetsData, this.overviewBarsSelection, xScale, yScale, ySize, this.props.config.color);

        this.createChartOverviewBrush();
    }

    createChartOverviewBrush() {
        const self = this;

        const xSize = this.renderedWidth - this.props.margin.left - this.props.margin.right;
        const ySize = this.props.overviewHeight - this.props.overviewMargin.top - this.props.overviewMargin.bottom;
        this.defaultBrush = [0, xSize];
        this.brush = d3Brush.brushX()
            .extent([[0, 0], [xSize, ySize]])
            .handleSize(20)
            .on("brush end", function () {
                const sel = d3Event.selection;
                self.overviewBrushSelection.call(::self.brushHandle, sel);

                if (d3Event.sourceEvent && d3Event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
                const newTransform = d3Zoom.zoomIdentity.scale(xSize / (sel[1] - sel[0])).translate(-sel[0], 0);
                self.cursorAreaSelection.call(self.zoom.transform, newTransform);
            });

        this.overviewBrushSelection
            .attr('pointer-events', 'all')
            .call(this.brush);
        this.overviewBrushSelection.select(".selection")
            .classed(styles.selection, true);
        this.overviewBrushSelection.select(".overlay")
            .attr('pointer-events', 'none');
    }

    brushHandle(group, selection) {
        const ySize = this.props.overviewHeight - this.props.overviewMargin.top - this.props.overviewMargin.bottom;

        group.selectAll(".handle--custom")
            .data([{type: "w"}, {type: "e"}])
            .join(
                enter => enter.append("rect")
                    .attr("class", d => `handle--custom handle--custom--${d.type}`)
                    .attr("fill", "#434343")
                    .attr("cursor", "ew-resize")
                    .attr("x", "-5px")
                    .attr("width", "10px")
                    .attr("y", ySize / 4)
                    .attr("height", ySize / 2)
                    .attr("rx", "5px")
            )
            .attr("display", selection === null ? "none" : null)
            .attr("transform", selection === null ? null : (d, i) => `translate(${selection[i]},0)`);
    }


    render() {
        const config = this.props.config;

        if (!this.state.signalSetsData) {
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
                            signalSetsData={this.state.signalSetsData}
                            containerHeight={this.props.height}
                            containerWidth={this.state.width}
                            mousePosition={this.state.mousePosition}
                            selection={this.state.selection}
                            contentRender={props => <TooltipContent {...props}/>}
                        />
                        }
                        <g ref={node => this.cursorAreaSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    </svg>
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
