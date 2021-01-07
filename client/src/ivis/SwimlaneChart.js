'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import {select} from "d3-selection";
import * as d3Selection from "d3-selection";
import {withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import {PropType_d3Color} from "../lib/CustomPropTypes";
import moment from "moment";
import {intervalAccessMixin} from "./TimeContext";
import {DataAccessSession} from "./DataAccess";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {ConfigDifference, getTextColor, TimeIntervalDifference} from "./common";
import {withPageHelpers} from "../lib/page-common";
import {Tooltip} from "./Tooltip";
import commonStyles from "./commons.scss";

/** get moment object exactly in between two moment object */
function midpoint(ts1, ts2) {
    return ts1.clone().add(ts2.diff(ts1) / 2);
}

/**
 * Displays horizontal lanes with bars
 */
@withComponentMixins([
    withErrorHandling,
])
export class StaticSwimlaneChart extends Component {
    constructor(props) {
        super(props);

        this.state = {
            width: 0,
            mousePosition: null,
            tooltip: null,
        };

        this.resizeListener = () => this.createChart();
    }

    static propTypes = {
        config: PropTypes.shape({
            rows: PropTypes.arrayOf(PropTypes.shape({
                label: PropTypes.string.isRequired,
                color: PropType_d3Color(), // used if not specified in bar
                bars: PropTypes.arrayOf(PropTypes.shape({
                    begin: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
                    end: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
                    color: PropType_d3Color(),
                }))
            })).isRequired,
            xMin: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
            xMax: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object,
        getSvgDefs: PropTypes.func,
        getGraphContent: PropTypes.func,
        createChart: PropTypes.func,
        statusMsg: PropTypes.string,
        paddingInner: PropTypes.number,
        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withLabels: PropTypes.bool,
        getLabelColor: PropTypes.func,
        tooltipExtraProps: PropTypes.object,
    }

    static defaultProps = {
        margin: {
            left: 60,
            right: 5,
            top: 5,
            bottom: 30
        },
        getSvgDefs: () => null,
        getGraphContent: () => null,
        createChart: () => null,
        paddingInner: 0.2,
        withCursor: true,
        withTooltip: true,
        withLabels: true,
        getLabelColor: getTextColor,
    }

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(true);
    }

    componentDidUpdate(prevProps, prevState, prevContext) {
        const forceRefresh = this.prevContainerNode !== this.containerNode
            || !Object.is(prevProps.config, this.props.config);

        this.createChart(forceRefresh);
        this.prevContainerNode = this.containerNode;
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    createChart(forceRefresh) {
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

        const innerWidth = width - this.props.margin.left - this.props.margin.right;
        const innerHeight = this.props.height - this.props.margin.top - this.props.margin.bottom;

        const xScale = d3Scale.scaleTime()
            .domain([moment(this.props.config.xMin), moment(this.props.config.xMax)])
            .range([0, innerWidth]);
        const xAxis = d3Axis.axisBottom(xScale);
        this.xAxisSelection.call(xAxis);

        const yScale = d3Scale.scaleBand()
            .domain(this.props.config.rows.map(r => r.label))
            .rangeRound([innerHeight, 0])
            .paddingInner(this.props.paddingInner);
        const yAxis = d3Axis.axisLeft(yScale);
        this.yAxisSelection.call(yAxis);

        this.props.config.rows.forEach(r => r.bars.forEach(b => {
            b.beginTime = moment(b.begin);
            b.endTime = moment(b.end);
            b.row = r.label;
            if (b.color === undefined)
                b.color = r.color;
        }))
        const barHeight = yScale.bandwidth();
        const rows = this.rowsSelection.selectAll('g').data(this.props.config.rows);
        const bars = rows.enter().append('g')
            .attr('key', d => d.label)
            .merge(rows)
            .selectAll('rect')
            .data(d => d.bars);

        bars.enter()
            .append('rect')
            .merge(bars)
            .attr('key', d => d.begin)
            .attr('x', d => xScale(d.beginTime))
            .attr('y', d => yScale(d.row))
            .attr('width', d => xScale(d.endTime) - xScale(d.beginTime))
            .attr('height', barHeight)
            .attr('fill', d => d.color);

        bars.exit().remove();
        rows.exit().remove();

        if (this.props.withLabels) {
            const labelRows = this.labelsSelection.selectAll('g').data(this.props.config.rows);
            const labels = labelRows.enter().append('g')
                .attr('key', d => d.label)
                .merge(labelRows)
                .selectAll('text')
                .data(d => d.bars);

            labels.enter()
                .append('text')
                .merge(labels)
                .text(d => d.label || '')
                .attr('text-anchor', "middle")
                .attr('dominant-baseline', "middle")
                .attr('x', d => (xScale(d.beginTime) + xScale(d.endTime)) / 2)
                .attr('y', d => yScale(d.row) + barHeight / 2)
                .attr('font-family', "'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif")
                .attr('font-size', "12px")
                .attr('pointer-events', "none")
                .attr('fill', d => this.props.getLabelColor(d.color))
                .attr('visibility', function(d) {
                    if (this.getBBox().width > xScale(d.endTime) - xScale(d.beginTime))
                        return 'hidden';
                    return 'visible';
                });
        }

        this.createChartCursor(innerWidth, innerHeight);

        if (this.props.createChart)
            this.props.createChart(this, this.props.config, xScale, yScale);
    }

    /** Handles mouse movement to display cursor line.
     *  Called from this.createChart(). */
    createChartCursor(xSize, ySize) {
        const self = this;

        const mouseMove = function (bar = null) {
            const containerPos = d3Selection.mouse(self.containerNode);

            self.cursorSelection
                .attr('x1', containerPos[0])
                .attr('x2', containerPos[0])
                .attr('y1', self.props.margin.top)
                .attr('y2', ySize + self.props.margin.top)
                .attr('visibility', self.props.withCursor ? 'visible' : "hidden");

            const mousePosition = { x: containerPos[0], y: -10 + self.props.margin.top };
            self.setState({
                mousePosition,
                tooltip: bar,
            });
        };

        const mouseLeave = function () {
            self.cursorSelection.attr('visibility', 'hidden');
            self.setState({
                tooltip: null,
                mousePosition: null
            });
        }

        this.cursorAreaSelection
            .on('mouseenter', mouseMove)
            .on('mousemove', mouseMove)
            .on('mouseleave', mouseLeave);
        this.rowsSelection.selectAll('g').selectAll('rect')
            .on('mouseenter', mouseMove)
            .on('mousemove', mouseMove)
            .on('mouseleave', mouseLeave);
    }

    render() {
        const plotRectId = _.uniqueId("plotRect");
        return (
            <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                {this.props.getSvgDefs(this)}
                <defs>
                    <clipPath id={plotRectId}>
                        <rect x="0" y="0" width={this.state.width - this.props.margin.left - this.props.margin.right} height={this.props.height - this.props.margin.top - this.props.margin.bottom} />
                    </clipPath>
                </defs>

                {/* cursor area */}
                <rect ref={node => this.cursorAreaSelection = select(node)}
                      x={this.props.margin.left} y={this.props.margin.top}
                      width={this.state.width - this.props.margin.left - this.props.margin.right}
                      height={this.props.height - this.props.margin.top - this.props.margin.bottom}
                      pointerEvents={"all"} cursor={"crosshair"} visibility={"hidden"}
                />

                {/* main content */}
                <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`} clipPath={`url(#${plotRectId})`}>
                    <g name={"rows"} ref={node => this.rowsSelection = select(node)} cursor={"crosshair"} />
                    <g name={"labels"} ref={node => this.labelsSelection = select(node)} />
                    {this.props.getGraphContent(this)}
                </g>

                {/* axes */}
                <g ref={node => this.xAxisSelection = select(node)}
                   transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                <g ref={node => this.yAxisSelection = select(node)}
                   transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                {/* cursor line */}
                <line ref={node => this.cursorSelection = select(node)} className={commonStyles.cursorLine} visibility="hidden" pointerEvents="none"/>
                {/* status message */}
                <text textAnchor="middle" x="50%" y="50%"
                      fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"
                      fill="currentColor">
                    {this.props.statusMsg}
                </text>

                {/* tooltip */}
                {this.props.withTooltip &&
                <Tooltip
                    config={this.props.config}
                    containerHeight={this.props.height + 50}
                    containerWidth={this.state.width}
                    mousePosition={this.state.mousePosition}
                    selection={this.state.tooltip}
                    signalSetsData={this.state.signalSetsData}
                    width={100}
                    contentRender={props => props.selection.label}
                    {...this.props.tooltipExtraProps}
                />}
            </svg>
        );
    }
}

/**
 * Displays one lane for each signal, bar is rendered when the signal is `true` (non-zero)
 */
@withComponentMixins([
    intervalAccessMixin(),
    withTranslation,
])
export class BooleanSwimlaneChart extends Component {
    constructor(props) {
        super(props);
        const t = props.t;

        this.state = {
            signalSetsData: null,
            statusMsg: t('Loading...'),
        }

        this.dataAccessSession = new DataAccessSession();
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                tsSigCid: PropTypes.string,
                signals: PropTypes.arrayOf(PropTypes.shape({
                    cid: PropTypes.string.isRequired,
                    label: PropTypes.string.isRequired,
                    color: PropType_d3Color,
                })),
            })).isRequired,
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object,
        getSvgDefs: PropTypes.func,
        getGraphContent: PropTypes.func,
        createChart: PropTypes.func,
        discontinuityInterval: PropTypes.number,
        paddingInner: PropTypes.number,
        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withLabels: PropTypes.bool,
        getLabelColor: PropTypes.func,
        tooltipExtraProps: PropTypes.object,
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (!Object.is(this.props.config, prevProps.config) // TODO: better compare configs
            || TimeIntervalDifference(this, prevProps) !== ConfigDifference.NONE)
            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();
    }

    async fetchData() {
        this.setState({ statusMsg: this.props.t("Loading...") });
        const config = this.props.config;
        const signalSets = {};
        for (const sigSetConf of config.signalSets) {
            const signals = {};
            for (const signal of sigSetConf.signals) {
                signals[signal.cid] = ["max"];
            }
            signalSets[sigSetConf.cid] = {
                tsSigCid: sigSetConf.tsSigCid || "ts",
                signals,
            }
        }
        const abs = this.getIntervalAbsolute();

        const data = await this.dataAccessSession.getLatestTimeSeries(signalSets, abs);
        if (data) { // Results is null if the results returned are not the latest ones
            const newState = {
                signalSetsData: data,
            };
            if (Object.values(data).every(d => d.main.length === 0))
                newState.statusMsg = this.props.t("No data.");
            else
                newState.statusMsg = "";
            this.setState(newState)
        }
    }

    getRows() {
        const signalSetsData = this.state.signalSetsData;
        if (signalSetsData === null)
            return [];
        const config = this.props.config;
        const rows = [];

        for (const sigSetConf of config.signalSets) {
            const main = signalSetsData[sigSetConf.cid].main;

            if (main.length === 0) {
                rows.push(...sigSetConf.signals.map(signal => ({
                    label: signal.label,
                    color: signal.color,
                    bars: [],
                })));
                continue;
            }

            // prev and next data
            if (signalSetsData[sigSetConf.cid].prev)
                main.unshift(signalSetsData[sigSetConf.cid].prev);
            if (signalSetsData[sigSetConf.cid].next)
                main.push(signalSetsData[sigSetConf.cid].next);

            for (const signal of sigSetConf.signals) {
                const bars = [];
                let previous = 0;
                let previousTs = main[0].ts;
                let start = null;

                for (const point of main) {
                    let d = point.data[signal.cid].max;
                    if (d === null || d === undefined)
                        d = 0;
                    if (d > 0 && previous > 0 && point.ts.diff(previousTs, 'seconds') > this.props.discontinuityInterval) {
                        bars.push({
                            begin: start,
                            end: previousTs,
                        });
                        start = point.ts;
                    }
                    else if (d > 0 && previous === 0)
                        start = midpoint(previousTs, point.ts);
                    else if (d === 0 && previous > 0)
                        bars.push({
                            begin: start,
                            end: midpoint(previousTs, point.ts),
                        });
                    previous = d;
                    previousTs = point.ts;
                }
                if (previous > 0) // end of last bar
                    bars.push({
                        begin: start,
                        end: main[main.length - 1].ts,
                    });

                rows.push({
                    label: signal.label,
                    color: signal.color,
                    bars,
                });
            }
        }

        return rows;
    }

    render() {
        const rows = this.getRows();
        const abs = this.getIntervalAbsolute();
        const config = {
            rows,
            xMin: abs.from,
            xMax: abs.to,
        };
        return <StaticSwimlaneChart
            {...this.props}
            config={config}
            statusMsg={this.state.statusMsg}
            withTooltip={false}
        />
    }
}

/**
 * Displays only one lane with bar of the color of the signal with highest value
 */
@withComponentMixins([
    intervalAccessMixin(),
    withTranslation,
    withPageHelpers,
])
export class MaximumSwimlaneChart extends Component {
    constructor(props) {
        super(props);
        const t = props.t;

        this.state = {
            bars: [],
            statusMsg: t('Loading...'),
        }

        this.dataAccessSession = new DataAccessSession();

        if (props.config.signalSets.length !== 1)
            this.setFlashMessage("warning", "The MaximumSwimlaneChart component currently works for only one signal set. Only the first signal set will be displayed.");
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                tsSigCid: PropTypes.string,
                signals: PropTypes.arrayOf(PropTypes.shape({
                    cid: PropTypes.string.isRequired,
                    label: PropTypes.string.isRequired,
                    color: PropType_d3Color,
                })),
            })).isRequired,
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object,
        getSvgDefs: PropTypes.func,
        getGraphContent: PropTypes.func,
        createChart: PropTypes.func,
        discontinuityInterval: PropTypes.number,
        signalAgg: PropTypes.string,
        paddingInner: PropTypes.number,
        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withLabels: PropTypes.bool,
        getLabelColor: PropTypes.func,
        tooltipExtraProps: PropTypes.object,
    }

    static defaultProps = {
        signalAgg: 'avg'
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (!Object.is(this.props.config, prevProps.config) // TODO: better compare configs
            || TimeIntervalDifference(this, prevProps) !== ConfigDifference.NONE)
            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();
    }

    async fetchData() {
        this.setState({ statusMsg: this.props.t("Loading...") });
        const config = this.props.config;
        const signalSets = {};
        for (const sigSetConf of config.signalSets) {
            const signals = {};
            for (const signal of sigSetConf.signals) {
                signals[signal.cid] = [this.props.signalAgg];
            }
            signalSets[sigSetConf.cid] = {
                tsSigCid: sigSetConf.tsSigCid || "ts",
                signals,
            }
        }
        const abs = this.getIntervalAbsolute();

        const data = await this.dataAccessSession.getLatestTimeSeries(signalSets, abs);
        if (data) { // Results is null if the results returned are not the latest ones
            const bars = this.processData(data);
            const newState = {
                bars,
                statusMsg: bars.length > 0 ? "" : this.props.t("No data."),
            };
            this.setState(newState)
        }
    }

    processData(data) {
        const config = this.props.config;
        const sigSetConf = config.signalSets[0];
        const main = data[sigSetConf.cid].main;

        const maxs = [];
        for (const point of main) {
            let max = Number.NEGATIVE_INFINITY;
            let maxSignal = null;
            for (const signal of sigSetConf.signals) {
                const d = point.data[signal.cid][this.props.signalAgg];
                if (d > max) {
                    max = d;
                    maxSignal = signal;
                }
            }
            if (maxSignal != null) {
                maxs.push({
                    value: max,
                    signal: maxSignal,
                    ts: point.ts,
                });
            }
        }

        if (maxs.length === 0) {
            return [];
        }

        const bars = [];
        let previous = null;
        let startTs = maxs[0].ts;
        for (const point of maxs) {
            if (previous === null) {
                previous = point;
                continue;
            }
            if (point.ts.diff(previous.ts, 'seconds') > this.props.discontinuityInterval) {
                bars.push({
                    begin: startTs,
                    end: previous.ts,
                    color: previous.signal.color,
                    label: previous.signal.label,
                });
                startTs = point.ts;
            }
            else if (point.signal !== previous.signal) {
                bars.push({
                    begin: startTs,
                    end: midpoint(previous.ts, point.ts),
                    color: previous.signal.color,
                    label: previous.signal.label,
                });
                startTs = midpoint(previous.ts, point.ts);
            }
            previous = point;
        }
        // end of last bar
        const last = maxs[maxs.length - 1];
        bars.push({
            begin: startTs,
            end: last.ts,
            color: last.signal.color,
            label: last.signal.label,
        });

        return bars;
    }

    render() {
        const abs = this.getIntervalAbsolute();
        const config = {
            rows: [{
                label: "",
                bars: this.state.bars,
            }],
            xMin: abs.from,
            xMax: abs.to,
        };
        return <StaticSwimlaneChart
            withTooltip={false}
            {...this.props}
            config={config}
            statusMsg={this.state.statusMsg}
        />
    }
}
