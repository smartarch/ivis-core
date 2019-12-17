'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Array from "d3-array";
import * as d3Selection from "d3-selection";
import * as d3Brush from "d3-brush";
import {event as d3Event, select} from "d3-selection";
import {intervalAccessMixin} from "../TimeContext";
import {DataAccessSession} from "../DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {Tooltip} from "../Tooltip";

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
        conf1.dotSize_sigCid !== conf2.dotSize_sigCid) {
        diffResult = ConfigDifference.DATA_WITH_CLEAR;
    } else if (conf1.color !== conf2.color ||
               conf1.enabled !== conf2.enabled ||
               conf1.label !== conf2.label ||
               conf1.X_label !== conf2.X_label ||
               conf1.Y_label !== conf2.Y_label ||
               conf1.Size_label !== conf2.Size_label) {
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

function isSignalVisible(sigConf) {
    return (!('enabled' in sigConf) || sigConf.enabled);
}

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    intervalAccessMixin()
])
export class ScatterPlotBase extends Component {
    constructor(props) {
        super(props);

        const t = props.t;

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetsData: null,
            statusMsg: t('Loading...'),
            width: 0,
            selections: null,
            lastQueryWasWithRangeFilter: false
        };

        this.resizeListener = () => {
            this.createChart(this.state.signalSetsData);
        };

        this.labels = {};
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
                dotSize_sigCid: PropTypes.string, // used for BubblePlot
                X_label: PropTypes.string,
                Y_label: PropTypes.string,
                Size_label: PropTypes.string // for BubblePlot
            })).isRequired
        }).isRequired,
        maxDotCount: PropTypes.number, // set to negative number for unlimited
        dotRadius: PropTypes.number,
        minDotRadius: PropTypes.number, // for BubblePlot
        maxDotRadius: PropTypes.number, // for BubblePlot
        minDotRadiusValue: PropTypes.number, // for BubblePlot
        maxDotRadiusValue: PropTypes.number, // for BubblePlot
        highlightDotRadius: PropTypes.number, // radius multiplier
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        withBrush: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withTransition: PropTypes.bool,

        xMin: PropTypes.number,
        xMax: PropTypes.number,
        yMin: PropTypes.number,
        yMax: PropTypes.number,
        setZoom: PropTypes.func
    };

    static defaultProps = {
        withBrush: true,
        withTooltip: true,
        withTransition: true,
        xMin: NaN,
        xMax: NaN,
        yMin: NaN,
        yMax: NaN,
        dotRadius: 5,
        minDotRadius: 2,
        maxDotRadius: 14,
        highlightDotRadius: 1.2,
        maxDotCount: 100
    };

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(null, false);
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData();
    }

    componentDidUpdate(prevProps, prevState) {
        let signalSetsData = this.state.signalSetsData;

        const t = this.props.t;

        let configDiff = compareConfigs(this.props.config, prevProps.config);

        if (this.props.maxDotCount !== prevProps.maxDotCount)
            configDiff = Math.max(configDiff, ConfigDifference.DATA_WITH_CLEAR);
        if (this.state.lastQueryWasWithRangeFilter && isNaN(this.props.xMin) && isNaN(this.props.xMax) && isNaN(this.props.yMin) && isNaN(this.props.yMax))
            configDiff = Math.max(configDiff, ConfigDifference.DATA_WITH_CLEAR);


        if (configDiff === ConfigDifference.DATA_WITH_CLEAR || this.props.maxDotCount !== prevProps.maxDotCount)
        {
            this.setState({
                signalSetsData: null,
                statusMsg: t('Loading...')
            });

            signalSetsData = null;

            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();
        }
        else {
            const forceRefresh = this.prevContainerNode !== this.containerNode
                || prevState.signalSetsData !== this.state.signalSetsData
                || configDiff !== ConfigDifference.NONE
                || prevProps.xMin !== this.props.xMin
                || prevProps.xMax !== this.props.xMax
                || prevProps.yMin !== this.props.yMin
                || prevProps.yMax !== this.props.yMax;

            this.createChart(signalSetsData, forceRefresh);
            this.prevContainerNode = this.containerNode;
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    getQueries() {
        const config = this.props.config;
        let queries = [];

        for (const signalSet of config.signalSets) {
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

            if (!isNaN(this.props.xMin))
                filter.children.push({
                    type: "range",
                    sigCid: signalSet.X_sigCid,
                    gte: this.props.xMin
                });
            if (!isNaN(this.props.xMax))
                filter.children.push({
                    type: "range",
                    sigCid: signalSet.X_sigCid,
                    lte: this.props.xMax
                });
            if (!isNaN(this.props.yMin))
                filter.children.push({
                    type: "range",
                    sigCid: signalSet.Y_sigCid,
                    gte: this.props.yMin
                });
            if (!isNaN(this.props.yMax))
                filter.children.push({
                    type: "range",
                    sigCid: signalSet.Y_sigCid,
                    lte: this.props.yMax
                });
            if (!isNaN(this.props.xMin) || !isNaN(this.props.xMax) || !isNaN(this.props.yMin) || !isNaN(this.props.yMax))
                this.setState({lastQueryWasWithRangeFilter: true});
            else
                this.setState({lastQueryWasWithRangeFilter: false});

            let limit = undefined;
            if (this.props.maxDotCount >= 0) {
                limit = this.props.maxDotCount;
            }

            let signals = [signalSet.X_sigCid, signalSet.Y_sigCid];
            if (signalSet.dotSize_sigCid)
                signals.push(signalSet.dotSize_sigCid);

            queries.push({
                type: "docs",
                args: [ signalSet.cid, signals, filter, undefined, limit ]
            });
        }

        return queries;
    }

    @withAsyncErrorHandler
    async fetchData() {
        try {
            const results = await this.dataAccessSession.getLatestMixed(this.getQueries());

            if (results) { // Results is null if the results returned are not the latest ones
                console.log("docs:", results);
                this.setState({
                    signalSetsData: results
                });
            }
        } catch (err) {
            throw err;
        }
    }

    /**
     * Adds margin to extent in format of d3.extent()
     */
    extentWithMargin(extent, margin_percentage) {
        const diff = extent[1] - extent[0];
        const margin = diff * margin_percentage;
        return [extent[0] - margin, extent[1] + margin];
    }

    getExtent(setsData, valueof) {
        const min = d3Array.min(setsData, function(data) {
            return d3Array.min(data, valueof);
        });
        const max = d3Array.max(setsData, function(data) {
            return d3Array.max(data, valueof);
        });
        return [min, max];
    }

    createChart(signalSetsData, forceRefresh) {
        const width = this.containerNode.getClientRects()[0].width;
        if (this.state.width !== width) {
            this.setState({
                width
            });
        }
        if (!forceRefresh && width === this.renderedWidth) {
            return;
        }
        this.renderedWidth = width;

        if (!signalSetsData) {
            return;
        }

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
        }

        const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
        const xSize = width - this.props.margin.left - this.props.margin.right;

        const processedSetsData = this.processData(signalSetsData);

        // y Scale
        let yExtent = this.getExtent(processedSetsData, function (d) {  return d.y });
        yExtent = this.extentWithMargin(yExtent, 0.1);
        const yScale = d3Scale.scaleLinear()
            .domain(yExtent)
            .range([ySize, 0]);
        const yAxis = d3Axis.axisLeft(yScale);
        (this.props.withTransition ?
            this.yAxisSelection.transition() :
            this.yAxisSelection)
            .call(yAxis);

        // x Scale
        let xExtent = this.getExtent(processedSetsData, function (d) {  return d.x });
        xExtent = this.extentWithMargin(xExtent, 0.1);
        const xScale = d3Scale.scaleLinear()
            .domain(xExtent)
            .range([0, xSize]);
        const xAxis = d3Axis.axisBottom(xScale);
        (this.props.withTransition ?
            this.xAxisSelection.transition() :
            this.xAxisSelection)
            .call(xAxis);

        const SignalSetsConfigs = this.props.config.signalSets;

        // s Scale (dot size)
        let sScale = undefined;
        if (SignalSetsConfigs.some((cfg) => cfg.hasOwnProperty("dotSize_sigCid"))) {
            let sExtent = this.getExtent(processedSetsData, function (d) {  return d.s });
            if (this.props.hasOwnProperty("minDotRadiusValue"))
                sExtent[0] = this.props.minDotRadiusValue;
            if (this.props.hasOwnProperty("maxDotRadiusValue"))
                sExtent[1] = this.props.maxDotRadiusValue;

            sScale = d3Scale.scalePow()
                .exponent(1/3)
                .domain(sExtent)
                .range([this.props.minDotRadius, this.props.maxDotRadius]);
        }

        let i = 0;
        for (const data of processedSetsData) {
            this.drawDots(data, xScale, yScale, sScale,SignalSetsConfigs[i].cid + "-" + i, SignalSetsConfigs[i]);
            i++;
        }

        this.createChartCursor(xScale, yScale, sScale, processedSetsData);
        this.createChartBrush(xScale, yScale);
    }

    /**
     * Computes Euclidean distance of two points
     * @param point1 object in format {x,y}
     * @param point2 object in format {x,y}
     */
    distance(point1, point2) {
        return Math.hypot(point1.x - point2.x, point1.y - point2.y);
    }

    /** data = [{ x, y, s? }] */
    drawDots(data, xScale, yScale, sScale, cidIndex, SignalSetConfig) {
        const color = SignalSetConfig.color;
        const radius = SignalSetConfig.dotRadius ? SignalSetConfig.dotRadius : this.props.dotRadius;
        const constantRadius = !SignalSetConfig.hasOwnProperty("dotSize_sigCid");

        // create dots on chart
        const dots = this.dotsSelection[cidIndex]
            .selectAll('circle')
            .data(data, (d) => {
                return d.x + " " + d.y;
            });

        let new_dots = function() {
            dots.enter()
                .append('circle')
                .attr('cx', d => xScale(d.x))
                .attr('cy', d => yScale(d.y))
                .attr('r', d => constantRadius ? radius : sScale(d.s))
                .attr('fill', color);
        };

        if (this.props.withTransition && dots.size() !== 0)
            setTimeout(new_dots, 250, this);
        else
            new_dots(this);

        (this.props.withTransition ?
            dots.transition() : dots)
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', d => constantRadius ? radius : sScale(d.s));

        dots.exit()
            .remove();
    }

    /** data = [{x,y}] */
    filterData(data) {
        const props = this.props;
        if (props.xMin || props.xMax || props.yMin || props.yMax)
        {
            let ret = [];
            for (const d of data) {
                if ((isNaN(props.xMin) || d.x >= props.xMin) &&
                    (isNaN(props.xMax) || d.x <= props.xMax) &&
                    (isNaN(props.yMin) || d.y >= props.yMin) &&
                    (isNaN(props.yMax) || d.y <= props.yMax)) {
                    ret.push(d);
                }
            }
            return ret;
        }
        else
            return data;
    }

    /**
     * renames data from all signalSets to be in format [{x,y}] and performs filterData() on the data
     */
    processData(signalSetsData) {
        const config = this.props.config;
        let ret = [];

        for (let i = 0; i < config.signalSets.length; i++) {
            const signalSetConfig = config.signalSets[i];
            let data = [];
            if(isSignalVisible(signalSetConfig))
                for (const d of signalSetsData[i]) {
                    let d1 = {
                        x: d[signalSetConfig.X_sigCid],
                        y: d[signalSetConfig.Y_sigCid]
                    };
                    if (signalSetConfig.dotSize_sigCid)
                        d1.s = d[signalSetConfig.dotSize_sigCid];
                    data.push(d1);
                }
            ret.push(this.filterData(data));
        }
        return ret;
    }

    createChartCursor(xScale, yScale, sScale, setsData) {
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
                    const dist = self.distance({x, y}, {x: xScale(point.x), y: yScale(point.y)});
                    if (dist < minDist) {
                        minDist = dist;
                        newSelection = point;
                    }
                }

                if (selections && selections[signalSetCidIndex] !== newSelection) {
                    self.dotHighlightSelections[signalSetCidIndex]
                        .selectAll('circle')
                        .remove();
                }

                if (newSelection) {
                    const SignalSetConfig = self.props.config.signalSets[i];
                    let radius = self.props.dotRadius;
                    if (SignalSetConfig.dotRadius)
                        radius = SignalSetConfig.dotRadius;
                    if (SignalSetConfig.hasOwnProperty("dotSize_sigCid"))
                        radius = sScale(newSelection.s);

                    self.dotHighlightSelections[signalSetCidIndex]
                        .append('circle')
                        .attr('cx', xScale(newSelection.x))
                        .attr('cy', yScale(newSelection.y))
                        .attr('r', self.props.highlightDotRadius * radius)
                        .attr('fill', SignalSetConfig.color.darker());
                }

                newSelections[signalSetCidIndex] = newSelection;
            }

            self.cursorSelectionX
                .attr('y1', self.props.margin.top)
                .attr('y2', self.props.height - self.props.margin.bottom)
                .attr('x1', containerPos[0])
                .attr('x2', containerPos[0])
                .attr('visibility', 'visible');

            self.cursorSelectionY
                .attr('y1', containerPos[1])
                .attr('y2', containerPos[1])
                .attr('x1', self.props.margin.left)
                .attr('x2', self.renderedWidth - self.props.margin.right)
                .attr('visibility', 'visible');

            selections = newSelections;
            mousePosition = {x: containerPos[0], y: containerPos[1]};

            self.setState({
                selections,
                mousePosition
            });
        };

        const deselectPoints = function () {
            self.deselectPoints();
        };

        this.brushSelection
            .on('mouseenter', selectPoints)
            .on('mousemove', selectPoints)
            .on('mouseleave', deselectPoints);
    }

    deselectPoints() {
        this.cursorSelectionX.attr('visibility', 'hidden');
        this.cursorSelectionY.attr('visibility', 'hidden');

        for (const cid in this.dotHighlightSelections) {
            this.dotHighlightSelections[cid]
                .selectAll('circle')
                .remove();
        }

        this.setState({
            selections: null,
            mousePosition: null
        });
    }

    createChartBrush(xScale, yScale) {
        const self = this;

        if (this.props.withBrush) {
            const brush = d3Brush.brush()
                .extent([[0, 0], [this.renderedWidth - this.props.margin.left - this.props.margin.right, this.props.height - this.props.margin.top - this.props.margin.bottom]])
                .on("end", function brushed() {
                    const sel = d3Event.selection;

                    if (sel) {
                        const xMin = xScale.invert(sel[0][0]);
                        const xMax = xScale.invert(sel[1][0]);
                        const yMin = yScale.invert(sel[1][1]);
                        const yMax = yScale.invert(sel[0][1]);

                        if (self.props.setZoom)
                            self.props.setZoom(xMin, xMax, yMin, yMax);

                        self.brushSelection.call(brush.move, null);
                        self.deselectPoints();
                    }
                });

            this.brushSelection
                .call(brush);
        }
        else {
            this.brushSelection
                .selectAll('rect')
                .remove();

            this.brushSelection
                .append('rect')
                .attr('pointer-events', 'all')
                .attr('cursor', 'crosshair')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', this.renderedWidth - this.props.margin.left - this.props.margin.right)
                .attr('height', this.props.height - this.props.margin.top - this.props.margin.bottom)
                .attr('visibility', 'hidden');
        }
    }

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

            return (
                <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}>
                        {dotsSelectionGroups}
                        {dotsHighlightSelectionGroups}
                    </g>
                    {/* axes */}
                    <g ref={node => this.xAxisSelection = select(node)}
                       transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                    <g ref={node => this.yAxisSelection = select(node)}
                       transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    {/* cursor lines */}
                    <line ref={node => this.cursorSelectionX = select(node)} strokeWidth="1" stroke="rgb(50,50,50)"
                          visibility="hidden"/>
                    <line ref={node => this.cursorSelectionY = select(node)} strokeWidth="1" stroke="rgb(50,50,50)"
                          visibility="hidden"/>
                    {/* tooltip */}
                    {this.props.withTooltip &&
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
                    />
                    }
                    {/* brush */}
                    <g ref={node => this.brushSelection = select(node)}
                       transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                </svg>
            );
        }
    }
}