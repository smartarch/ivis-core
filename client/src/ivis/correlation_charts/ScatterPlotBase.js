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

class TooltipContent extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        selection: PropTypes.object
    };

    render() {
        if (this.props.selection) {
            const dot = this.props.selection;

            return (
                <div>
                    <div>x: {dot.x}</div>
                    <div>y: {dot.y}</div>
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
export class ScatterPlotBase extends Component {
    constructor(props) {
        super(props);

        const t = props.t;

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetsData: null,
            statusMsg: t('Loading...'),
            width: 0
        };

        this.resizeListener = () => {
            this.createChart(this.state.signalSetsData);
        };
    }

    static propTypes = {
        /**
         * config: {
         *     data: [{x: number, y: number}]
         *     color: color
         * }
         */
        config: PropTypes.object.isRequired,
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
        xMin: null,
        xMax: null,
        yMin: null,
        yMax: null
    };

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(null, false);
    }

    componentDidUpdate(prevProps, prevState) {
        let signalSetsData = this.state.signalSetsData;

        const t = this.props.t;
        this.createChart(null, true);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    @withAsyncErrorHandler
    async fetchData() {
        const t = this.props.t;
        const config = this.props.config;
    }

    /**
     * Adds margin to extent in format of d3.extent()
     */
    extentWithMargin(extent, margin_percentage) {
        const diff = extent[1] - extent[0];
        const margin = diff * margin_percentage;
        return [extent[0] - margin, extent[1] + margin];
    }

    createChart(signalSetsData, forceRefresh) {
        const t = this.props.t;

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

        const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
        const xSize = width - this.props.margin.left - this.props.margin.right;

        const data = this.filterData(this.props.config.data); // TODO

        // y Scale
        let yExtent = d3Array.extent(data, function (d) {  return d.y });
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
        let xExtent = d3Array.extent(data, function (d) {  return d.x });
        xExtent = this.extentWithMargin(xExtent, 0.1);
        const xScale = d3Scale.scaleLinear()
            .domain(xExtent)
            .range([0, xSize]);
        const xAxis = d3Axis.axisBottom(xScale);
        (this.props.withTransition ?
            this.xAxisSelection.transition() :
            this.xAxisSelection)
            .call(xAxis);

        // create dots on chart
        const dots = this.dotsSelection
            .selectAll('circle')
            .data(data, (d) => {
                return d.x + " " + d.y;
            });

        let new_circles = function(self) {
            dots.enter()
                .append('circle')
                .attr('cx', d => xScale(d.x))
                .attr('cy', d => yScale(d.y))
                .attr('r', 5)
                .attr('fill', self.props.config.color);
        };

        if (this.props.withTransition && dots.size() !== 0)
            setTimeout(new_circles, 250, this);
        else
            new_circles(this);

        (this.props.withTransition ?
            dots.transition() : dots)
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y));

        dots.exit()
            .remove();

        this.createChartCursor(xScale, yScale, data);
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

    filterData(data) {
        const props = this.props;
        if (props.xMin && props.xMax && props.yMin && props.yMax)
        {
            let ret = [];
            for (const d of data) {
                if (d.x >= props.xMin && d.x <= props.xMax &&
                    d.y >= props.yMin && d.y <= props.yMax) {
                    ret.push(d);
                }
            }
            return ret;
        }
        else
            return data;
    }

    createChartCursor(xScale, yScale, data) {
        const self = this;

        let selection = this.state.selection;
        let mousePosition;

        const selectPoints = function () {
            const containerPos = d3Selection.mouse(self.containerNode);
            const x = containerPos[0] - self.props.margin.left;
            const y = containerPos[1] - self.props.margin.top;

            let newSelection = null;
            let minDist = Number.MAX_VALUE;
            for (const point of data) {
                const dist = self.distance({x, y}, {x: xScale(point.x), y: yScale(point.y) });
                if (dist < minDist) {
                    minDist = dist;
                    newSelection = point;
                }
            }

            if (selection !== newSelection) {
                self.dotHighlightSelection
                    .selectAll('circle')
                    .remove();

                if (newSelection) {
                    self.dotHighlightSelection
                        .append('circle')
                        .attr('cx', xScale(newSelection.x))
                        .attr('cy', yScale(newSelection.y))
                        .attr('r', 7)
                        .attr('fill', self.props.config.color.darker());
                }
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

            selection = newSelection;
            mousePosition = {x: containerPos[0], y: containerPos[1]};

            self.setState({
                selection,
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

        this.dotHighlightSelection
            .selectAll('circle')
            .remove();

        this.setState({
            selection: null,
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
        const config = this.props.config;

        return (
            <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}>
                    <g ref={node => this.dotHighlightSelection = select(node)} />
                    <g ref={node => this.dotsSelection = select(node)}/>
                </g>
                {/* axes */}
                <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
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
                    signalSetsData={this.state.signalSetsData}
                    containerHeight={this.props.height}
                    containerWidth={this.state.width}
                    mousePosition={this.state.mousePosition}
                    selection={this.state.selection}
                    width={100}
                    contentRender={props => <TooltipContent {...props}/>}
                />
                }
                {/* brush */}
                <g ref={node => this.brushSelection = select(node)}
                   transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
            </svg>
        );

    }
}