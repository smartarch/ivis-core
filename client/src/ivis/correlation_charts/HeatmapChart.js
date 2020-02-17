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
import {getColorScale} from "../common";


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
            signalSetsData: null,
            statusMsg: t('Loading...'),
            width: 0,
            height: 0,
            maxBucketCountX: 0,
            maxBucketCountY: 0
        };

        this.resizeListener = () => {
            this.createChart(this.state.signalSetsData);
        };
    }

    static propTypes = {
        config: PropTypes.shape({
            sigSetCid: PropTypes.string.isRequired,
            X_sigCid: PropTypes.string.isRequired,
            Y_sigCid: PropTypes.string.isRequired,
            colors: PropTypes.array,
            tsSigCid: PropTypes.string
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        withTooltip: PropTypes.bool,

        minStep: PropTypes.number,
        minRectWidth: PropTypes.number,
        minRectHeight: PropTypes.number
    };

    static defaultProps = {
        minRectWidth: 40,
        minRectHeight: 40,
        withTooltip: true,
    };
    static defaultColors = ["#ffffff", "#1c70ff"]; // default value for props.config.colors

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(null, false);
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

        if (prevState.maxBucketCountX !== this.state.maxBucketCountX ||
            prevState.maxBucketCountY !== this.state.maxBucketCountY) {
            configDiff = Math.max(configDiff, ConfigDifference.DATA);
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

            this.createChart(signalSetsData, forceRefresh);
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
                        signalSetsData: results,
                        xBucketsCount: results.buckets.length,
                        yBucketsCount: results.buckets.length > 0 ? results.buckets[0].buckets.length : 0
                    });
                }
            } catch (err) {
                throw err;
            }
        }
    }

    createChart(signalSetsData, forceRefresh) {
        const t = this.props.t;
        const self = this;

        const width = this.containerNode.getClientRects()[0].width;
        const height = this.props.height;

        if (this.state.width !== width || this.state.height) {
            const maxBucketCountX = Math.ceil(width / this.props.minRectWidth);
            const maxBucketCountY = Math.ceil(height / this.props.minRectHeight);

            this.setState({
                width,
                maxBucketCountX,
                maxBucketCountY
            });
        }

        if (!forceRefresh && width === this.renderedWidth) {
            return;
        }
        this.renderedWidth = width;

        if (!signalSetsData) {
            return;
        }

        const noData = signalSetsData.buckets.length === 0 || signalSetsData.buckets[0].buckets.length === 0;

        if (noData) {
            this.statusMsgSelection.text(t('No data.'));

            this.brushSelection
                .on('mouseenter', null)
                .on('mousemove', null)
                .on('mouseleave', null);

        } else {
            const xMin = signalSetsData.buckets[0].key;
            const xMax = signalSetsData.buckets[this.state.xBucketsCount - 1].key + signalSetsData.step;
            const yMin = signalSetsData.buckets[0].buckets[0].key;
            const yMax = signalSetsData.buckets[0].buckets[this.state.yBucketsCount - 1].key + signalSetsData.buckets[0].step;

            // calculate probabilities of buckets
            let totalSum = d3Array.sum(signalSetsData.buckets, d => d.count);
            for (const bucket of signalSetsData.buckets)
                bucket.prob = bucket.count / totalSum;

            let maxProb = 0;
            for (const bucket of signalSetsData.buckets) {
                let rowSum = d3Array.sum(bucket.buckets, d => d.count);
                for (const innerBucket of bucket.buckets) {
                    innerBucket.prob = bucket.prob * innerBucket.count / rowSum || 0;
                    innerBucket.xKey = bucket.key;
                    if (innerBucket.prob > maxProb)
                        maxProb = innerBucket.prob;
                }
            }

            // x axis
            const xSize = width - this.props.margin.left - this.props.margin.right;
            const xScale = d3Scale.scaleLinear()
                .domain([xMin, xMax])
                .range([0, xSize]);
            const xAxis = d3Axis.axisBottom(xScale)
                .tickSizeOuter(0);
            this.xAxisSelection.call(xAxis);
            const xStep = signalSetsData.step;
            const xOffset = signalSetsData.offset;
            const rectWidth = xScale(xStep) - xScale(0);

            // y axis
            const ySize = height - this.props.margin.left - this.props.margin.right;
            const yScale = d3Scale.scaleLinear()
                .domain([yMin, yMax])
                .range([ySize, 0]);
            const yAxis = d3Axis.axisLeft(yScale)
                .tickSizeOuter(0);
            this.yAxisSelection.call(yAxis);
            const yStep = signalSetsData.buckets[0].step;
            const yOffset = signalSetsData.buckets[0].offset;
            const rectHeight = yScale(0) - yScale(yStep);

            // color scale
            const colors = this.props.config.colors && this.props.config.colors.length >= 2 ? this.props.config.colors : HeatmapChart.defaultColors;
            const colorScale = getColorScale([0, maxProb], colors);

            // create rectangles
            const columns = this.columnsSelection
                .selectAll('g')
                .data(signalSetsData.buckets);

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

            if (this.props.withTooltip) {
                this.brushSelection
                    .selectAll('rect')
                    .remove();

                this.brushSelection
                    .append('rect')
                    .attr('pointer-events', 'all')
                    .attr('cursor', 'crosshair')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('width', width - this.props.margin.left - this.props.margin.right)
                    .attr('height', height - this.props.margin.top - this.props.margin.bottom)
                    .attr('visibility', 'hidden');

                let selection, mousePosition;

                const selectPoints = function () {
                    const containerPos = d3Selection.mouse(self.containerNode);
                    const x = containerPos[0] - self.props.margin.left;
                    const y = containerPos[1] - self.props.margin.top;
                    const xKey = xScale.invert(x);
                    const yKey = yScale.invert(y);

                    let newSelectionColumn = null;
                    for (const bucket of signalSetsData.buckets) {
                        if (bucket.key <= xKey)
                            newSelectionColumn = bucket;
                        else break;
                    }

                    let newSelection = null;
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

                const deselectPoints = function () {
                    if (selection) {
                        self.highlightSelection
                            .selectAll('rect')
                            .remove();
                    }

                    selection = null;
                    mousePosition = null;

                    self.setState({
                        selection,
                        mousePosition
                    });
                };

                this.brushSelection
                    .on('mouseenter', selectPoints)
                    .on('mousemove', selectPoints)
                    .on('mouseleave', deselectPoints);
            }
        }

    }

    render() {
        const config = this.props.config;

        if (!this.state.signalSetsData) {
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
                <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}>
                        <g ref={node => this.columnsSelection = select(node)}/>
                        <g ref={node => this.highlightSelection = select(node)}/>
                    </g>
                    <g ref={node => this.xAxisSelection = select(node)}
                       transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                    <g ref={node => this.yAxisSelection = select(node)}
                       transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    <text ref={node => this.statusMsgSelection = select(node)} textAnchor="middle" x="50%" y="50%"
                          fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"/>
                    {this.props.withTooltip &&
                    <Tooltip
                        config={this.props.config}
                        signalSetsData={this.state.signalSetsData}
                        containerHeight={this.props.height}
                        containerWidth={this.state.width}
                        mousePosition={this.state.mousePosition}
                        selection={this.state.selection}
                        contentRender={props => <TooltipContent {...props}/>}
                        width={250}
                    />
                    }
                    <g ref={node => this.brushSelection = select(node)}
                       transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                </svg>
            );
        }
    }
}
