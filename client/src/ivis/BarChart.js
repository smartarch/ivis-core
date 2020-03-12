'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Selection from "d3-selection";
import * as d3Array from "d3-array";
import * as d3Zoom from "d3-zoom";
import * as d3Scheme from "d3-scale-chromatic";
import {event as d3Event, select} from "d3-selection";
import PropTypes from "prop-types";
import {withErrorHandling} from "../lib/error-handling";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {PropType_d3Color, PropType_d3Color_Required, PropType_NumberInRange} from "../lib/CustomPropTypes";
import {Tooltip} from "./Tooltip";
import {extentWithMargin, transitionInterpolate, WheelDelta} from "./common";
import styles from "./CorrelationCharts.scss";

class TooltipContent extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        selection: PropTypes.object,
    };

    render() {
        if (this.props.selection) {
            return (
                <div>{this.props.selection.label}: {this.props.selection.value}</div>
            );

        } else {
            return null;
        }
    }
}

@withComponentMixins([
    withTranslation,
    withErrorHandling,
])
export class StaticBarChart extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.state = {
            statusMsg: t('Loading...'),
            width: 0,
            zoomTransform: d3Zoom.zoomIdentity,
        };

        this.zoom = null;

        this.resizeListener = () => {
            this.createChart(true);
        };
    }

    static propTypes = {
        config: PropTypes.shape({
            bars: PropTypes.arrayOf(PropTypes.shape({
                label: PropTypes.string.isRequired,
                color: PropType_d3Color(),
                value: PropTypes.number.isRequired
            })).isRequired
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        padding: PropType_NumberInRange(0, 1),
        colors: PropTypes.arrayOf(PropType_d3Color_Required()),

        minValue: PropTypes.number,
        maxValue: PropTypes.number,

        withTooltip: PropTypes.bool,
        withTransition: PropTypes.bool,
        withZoom: PropTypes.bool,

        zoomLevelMin: PropTypes.number,
        zoomLevelMax: PropTypes.number,
    };

    static defaultProps = {
        margin: { left: 40, right: 5, top: 5, bottom: 20 },
        padding: 0.2,
        minValue: 0,
        colors: d3Scheme.schemeCategory10,

        withTooltip: true,
        withTransition: true,
        withZoom: true,

        zoomLevelMin: 1,
        zoomLevelMax: 4,
    };

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(false, false);
    }

    componentDidUpdate(prevProps, prevState) {
        const forceRefresh = this.prevContainerNode !== this.containerNode
            || !Object.is(prevProps.config, this.props.config);

        const updateZoom = !Object.is(prevState.zoomTransform, this.state.zoomTransform);

        this.createChart(forceRefresh, updateZoom);
        this.prevContainerNode = this.containerNode;
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    createChart(forceRefresh, updateZoom) {
        const width = this.containerNode.getClientRects()[0].width;

        if (this.state.width !== width)
            this.setState({ width });

        const widthChanged = width !== this.renderedWidth;
        if (!forceRefresh && !widthChanged && !updateZoom) {
            return;
        }
        this.renderedWidth = width;

        if (this.props.config.bars.length === 0) {
            this.statusMsgSelection.text(this.props.t('No data.'));

            this.cursorAreaSelection
                .on('mouseenter', null)
                .on('mousemove', null)
                .on('mouseleave', null);
            this.zoom = null;
            return;
        }

        //<editor-fold desc="Scales">
        // x axis
        const xSize = width - this.props.margin.left - this.props.margin.right;
        const xExtent = this.props.config.bars.map(b => b.label);
        const xScale = d3Scale.scaleBand()
            .domain(xExtent)
            .range([0, xSize].map(d => this.state.zoomTransform.applyX(d)))
            .padding(this.props.padding);
        const xAxis = d3Axis.axisBottom(xScale)
            //.tickFormat(this.props.getLabel)
            .tickSizeOuter(0);
        this.xAxisSelection.call(xAxis);

        // y axis
        const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
        let yExtent = extentWithMargin(d3Array.extent(this.props.config.bars, b => b.value), 0.1);
        if (this.props.minValue !== undefined)
            yExtent[0] = this.props.minValue;
        if (this.props.maxValue !== undefined)
            yExtent[1] = this.props.maxValue;
        const yScale = d3Scale.scaleLinear()
            .domain(yExtent)
            .range([ySize, 0]);
        const yAxis = d3Axis.axisLeft(yScale)
            .tickSizeOuter(0);
        (this.props.withTransition ? this.yAxisSelection.transition() : this.yAxisSelection)
            .call(yAxis);
        //</editor-fold>

        this.drawVerticalBars(this.props.config.bars, this.barsSelection, xScale, yScale);

        // we don't want to change zoom object and cursor area when updating only zoom (it breaks touch drag)
        if ((forceRefresh || widthChanged) && this.props.withZoom) {
            this.createChartZoom(xSize, ySize);
        }
    }

    createChartZoom(xSize, ySize) {
        const self = this;

        const handleZoom = function () {
            // noinspection JSUnresolvedVariable
            if (self.props.withTransition && d3Event.sourceEvent && d3Event.sourceEvent.type === "wheel") {
                transitionInterpolate(select(self), self.state.zoomTransform, d3Event.transform, setZoomTransform, () => {
                    self.deselectBars();
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
        };

        const handleZoomEnd = function () {
            self.deselectBars();
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
        this.zoom = d3Zoom.zoom()
            .scaleExtent([this.props.zoomLevelMin, this.props.zoomLevelMax])
            .translateExtent(zoomExtent)
            .extent(zoomExtent)
            .on("zoom", handleZoom)
            .on("end", handleZoomEnd)
            .on("start", handleZoomStart)
            .wheelDelta(WheelDelta(2));
        this.svgContainerSelection.call(this.zoom);
    }

    drawVerticalBars(data, barsSelection, xScale, yScale) {
        const self = this;
        const bars = barsSelection
            .selectAll('rect')
            .data(data, d => d.label);
        const ySize = yScale.range()[0];
        const barWidth = xScale.bandwidth();

        const selectBar = function(bar = null) {
            if (bar !== self.state.selection) {
                self.highlightSelection
                    .selectAll('rect')
                    .remove();

                if (bar !== null) {
                    self.highlightSelection
                        .append('rect')
                        .attr('x', xScale(bar.label))
                        .attr('y', yScale(bar.value))
                        .attr("width", barWidth)
                        .attr("height", ySize - yScale(bar.value))
                        .attr("fill", "none")
                        .attr("stroke", "black")
                        .attr("stroke-width", "2px");
                }
            }

            const containerPos = d3Selection.mouse(self.containerNode);
            const mousePosition = {x: containerPos[0], y: containerPos[1]};

            self.setState({
                selection: bar,
                mousePosition
            });
        };

        const allBars = bars.enter()
            .append('rect')
            .attr('y', ySize)
            .attr("height", 0)
            .merge(bars)
            .attr('x', d => xScale(d.label))
            .attr("width", barWidth)
            .attr("fill", (d, i) => d.color || this.getColor(i))
            .on("mouseover", selectBar)
            .on("mousemove", selectBar)
            .on("mouseout", ::this.deselectBars);
        (this.props.withTransition ?  allBars.transition() : allBars)
            .attr('y', d => yScale(d.value))
            .attr("height", d => ySize - yScale(d.value));

        bars.exit()
            .remove();
    }

    getColor(i) {
        return this.props.colors[i % this.props.colors.length];
    }

    deselectBars() {
        this.highlightSelection
            .selectAll('rect')
            .remove();

        this.setState({
            selection: null,
            mousePosition: null
        });
    };

    render() {
        return (
            <div ref={node => this.svgContainerSelection = select(node)} className={styles.touchActionNone}>
                <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width={"100%"}>
                    <defs>
                        <clipPath id="plotRect">
                            <rect x="0" y="0" width={this.state.width}
                                  height={this.props.height - this.props.margin.top - this.props.margin.bottom}/>
                        </clipPath>
                        <clipPath id="bottomAxis">
                            <rect x={-6} y={0} width={this.state.width + 6}
                                  height={this.props.margin.bottom} /* same reason for 6 as in HeatmapChart */ />
                        </clipPath>
                    </defs>
                    <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}
                       clipPath="url(#plotRect)">
                        <g ref={node => this.barsSelection = select(node)}/>
                        {!this.state.zoomInProgress &&
                        <g ref={node => this.highlightSelection = select(node)}/>}
                    </g>
                    <g ref={node => this.xAxisSelection = select(node)}
                       transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}
                       clipPath="url(#bottomAxis)"/>
                    <g ref={node => this.yAxisSelection = select(node)}
                       transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    <text ref={node => this.statusMsgSelection = select(node)} textAnchor="middle" x="50%" y="50%"
                          fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"/>
                    {this.props.withTooltip && !this.state.zoomInProgress &&
                    <Tooltip
                        config={this.props.config}
                        signalSetsData={this.props.config}
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
        );
    }
}
