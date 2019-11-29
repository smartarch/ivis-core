'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Array from "d3-array";
import * as d3Format from "d3-format";
import * as d3Selection from "d3-selection";
import {select} from "d3-selection";
import {intervalAccessMixin} from "../TimeContext";
import {DataAccessSession} from "../DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {Tooltip} from "../Tooltip";
import {Icon} from "../../lib/bootstrap-components";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    intervalAccessMixin()
])
export class ScatterPlot extends Component {
    constructor(props) {
        super(props);

        const t = props.t;

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetsData: null,
            statusMsg: t('Loading...'),
            width: 0,
        };

        this.resizeListener = () => {
            this.createChart(this.state.signalSetsData);
        };
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        withBrush: PropTypes.bool,
        withTooltip: PropTypes.bool,

    };

    static defaultProps = {
        withBrush: true,
        withTooltip: true
    };

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(null, false);
    }

    componentDidUpdate(prevProps, prevState) {
        let signalSetsData = this.state.signalSetsData;

        const t = this.props.t;
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
        const self = this;

        const width = this.containerNode.getClientRects()[0].width;
        if (!forceRefresh && width === this.renderedWidth) {
            return;
        }
        this.renderedWidth = width;

        const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
        const xSize = width - this.props.margin.left - this.props.margin.right;

        const data = this.props.config.data; // TODO

        // y Scale
        let yExtent = d3Array.extent(data, function (d) {  return d.y });
        yExtent = this.extentWithMargin(yExtent, 0.1);
        const yScale = d3Scale.scaleLinear()
            .domain(yExtent)
            .range([ySize, 0]);
        const yAxis = d3Axis.axisLeft(yScale);
        this.yAxisSelection.call(yAxis);

        // x Scale
        let xExtent = d3Array.extent(data, function (d) {  return d.x });
        xExtent = this.extentWithMargin(xExtent, 0.1);
        const xScale = d3Scale.scaleLinear()
            .domain(xExtent)
            .range([0, xSize]);
        const xAxis = d3Axis.axisBottom(xScale)
        this.xAxisSelection.call(xAxis);

        // create dots on chart
        const dots = this.dotsSelection
            .selectAll('circle')
            .data(data);

        dots.enter()
            .append('circle')
            .merge(dots)
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', 5)
            .attr('fill', 'red');

        dots.exit()
            .remove();
    }

    render() {
        const config = this.props.config;

        return (
            <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}>
                    <g ref={node => this.dotsSelection = select(node)}/>
                </g>
                <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
            </svg>
        );

    }
}