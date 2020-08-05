'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import {select} from "d3-selection";
import * as d3Array from "d3-array";
import * as d3Color from "d3-color";
import * as d3Shape from "d3-shape";
import {intervalAccessMixin} from "./TimeContext";
import {DataAccessSession} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {PropType_d3Color_Required} from "../lib/CustomPropTypes";
import {withPageHelpers} from "../lib/page-common";

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

    if (conf1.cid !== conf2.cid || conf1.sigCid !== conf2.sigCid || conf1.tsSigCid !== conf2.tsSigCid) {
        diffResult = ConfigDifference.DATA_WITH_CLEAR;
    } else if (conf1.color !== conf2.color) {
        diffResult = ConfigDifference.RENDER;
    }

    return diffResult;
}

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    intervalAccessMixin()
], [], ["processBucket", "prepareData", "prepareDataForSignalSet"])
export class ViolinPlot extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetsData: null,
            statusMsg: t('Loading...'),
            width: 0,
            maxBucketCount: 0,
        };

        this.resizeListener = () => {
            this.createChart(true);
        };
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                sigCid: PropTypes.string.isRequired,
                tsSigCid: PropTypes.string, // for use of TimeContext
                color: PropType_d3Color_Required(),
                label: PropTypes.string,
                metric_sigCid: PropTypes.string,
                metric_type: PropTypes.oneOf(["sum", "min", "max", "avg"]),
                filter: PropTypes.object,
            })).isRequired
        }).isRequired,

        height: PropTypes.number.isRequired,
        margin: PropTypes.object,

        xAxisLabel: PropTypes.string,
        yAxisTicksCount: PropTypes.number,
        yAxisTicksFormat: PropTypes.func,
        yAxisLabel: PropTypes.string,

        minStep: PropTypes.number,
        minBarHeight: PropTypes.number,
        maxBucketCount: PropTypes.number,
        yMinValue: PropTypes.number,
        yMaxValue: PropTypes.number,
        curve: PropTypes.func, // d3Shape curve to render the violin (d3Shape.curveCatmullRom is default, use d3Shape.step to get a histogram look)

        className: PropTypes.string,
        style: PropTypes.object,

        filter: PropTypes.object,
        processBucket: PropTypes.func, // see ViolinPlot.processBucket for reference
        prepareData: PropTypes.func, // see ViolinPlot.prepareData for reference
        prepareDataForSignalSet: PropTypes.func, // see ViolinPlot.prepareDataForSignalSet for reference
        getData: PropTypes.func,
    };

    static defaultProps = {
        margin: { left: 40, right: 5, top: 5, bottom: 20 },
        minBarHeight: 20,
        maxBucketCount: undefined,
        yMinValue: NaN,
        yMaxValue: NaN,

        curve: d3Shape.curveCatmullRom,
    };

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(false);
    }

    /** Update and redraw the chart based on changes in React props and state */
    componentDidUpdate(prevProps, prevState) {
        const t = this.props.t;

        let configDiff = compareConfigs(this.props.config, prevProps.config);

        // test if time interval changed
        const considerTs =  this.props.config.signalSets.some(setConf => !!setConf.tsSigCid);
        if (considerTs) {
            const prevAbs = this.getIntervalAbsolute(prevProps);
            const prevSpec = this.getIntervalSpec(prevProps);

            if (prevSpec !== this.getIntervalSpec()) {
                configDiff = Math.max(configDiff, ConfigDifference.DATA_WITH_CLEAR);
            } else if (prevAbs !== this.getIntervalAbsolute()) { // If its just a regular refresh, don't clear the chart
                configDiff = Math.max(configDiff, ConfigDifference.DATA);
            }
        }

        // test if limits changed
        if (!Object.is(prevProps.yMinValue, this.props.yMinValue) || !Object.is(prevProps.yMaxValue, this.props.yMaxValue))
            configDiff = Math.max(configDiff, ConfigDifference.DATA_WITH_CLEAR);

        if (prevState.maxBucketCount !== this.state.maxBucketCount) {
            configDiff = Math.max(configDiff, ConfigDifference.DATA);
        }

        if (configDiff === ConfigDifference.DATA_WITH_CLEAR) {
            this.setState({
                statusMsg: t('Loading...')
            }, () => {
                // noinspection JSIgnoredPromiseFromCall
                this.fetchData();
            });
        }
        else if (configDiff === ConfigDifference.DATA) {
            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();
        }
        else {
             const forceRefresh = this.prevContainerNode !== this.containerNode
                || prevState.signalSetsData !== this.state.signalSetsData
                || configDiff !== ConfigDifference.NONE
                || prevProps.height !== this.props.height;

            this.createChart(forceRefresh);
            this.prevContainerNode = this.containerNode;
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    getQueryForSignalSet(signalSetConfig, maxBucketCount, minStep) {
        let filter = {
            type: 'and',
            children: []
        };
        if (signalSetConfig.tsSigCid) {
            const abs = this.getIntervalAbsolute();
            filter.children.push({
                type: 'range',
                sigCid: signalSetConfig.tsSigCid,
                gte: abs.from.toISOString(),
                lt: abs.to.toISOString()
            });
        }
        if (!isNaN(this.props.yMinValue))
            filter.children.push({
                type: "range",
                sigCid: signalSetConfig.sigCid,
                gte: this.props.yMinValue
            });
        if (!isNaN(this.props.yMaxValue))
            filter.children.push({
                type: "range",
                sigCid: signalSetConfig.sigCid,
                lte: this.props.yMaxValue
            });
        if (signalSetConfig.filter)
            filter.children.push(signalSetConfig.filter);
        if (this.props.filter)
            filter.children.push(this.props.filter);

        let metrics;
        if (this.props.config.metric_sigCid && this.props.config.metric_type) {
            metrics = {};
            metrics[this.props.config.metric_sigCid] = [this.props.config.metric_type];
        }

        return {
            type: "histogram",
            args: [signalSetConfig.cid, [signalSetConfig.sigCid], maxBucketCount, minStep, filter, metrics]
        };
    }

    /** Fetches new data for the chart, processes the results using prepareData method and updates the state accordingly, so the chart is redrawn */
    @withAsyncErrorHandler
    async fetchData() {
        if (typeof this.props.getData === "function") {
            this.setState(this.getData());
            return;
        }

        let maxBucketCount = this.props.maxBucketCount || this.state.maxBucketCount;
        let minStep = this.props.minStep;
        if (maxBucketCount > 0) {
            try {
                const queries = [];
                for (const signalSetConfig of this.props.config.signalSets)
                    queries.push(this.getQueryForSignalSet(signalSetConfig, maxBucketCount, minStep));

                const results = await this.dataAccessSession.getLatestMixed(queries);

                if (results) { // Results is null if the results returned are not the latest ones
                    const prepareData = this.props.prepareData || ViolinPlot.prepareData;
                    const processedResults = prepareData(this, results);
                    if (!processedResults.signalSetsData.some(d => d.buckets.length > 0)) {
                        this.setState({
                            signalSetsData: null,
                            statusMsg: this.props.t("No data.")
                        });
                        return;
                    }

                    // update extent of x axis
                    this.yExtent = [processedResults.min, processedResults.max];
                    if (!isNaN(this.props.yMinValue)) this.yExtent[0] = this.props.yMinValue;
                    if (!isNaN(this.props.yMaxValue)) this.yExtent[1] = this.props.yMaxValue;

                    this.setState(processedResults);
                }
            } catch (err) {
                this.setState({statusMsg: this.props.t("Error loading data.")});
                throw err;
            }
        }
    }

    /**
     * The value returned from this function is used to determine the height of the bar corresponding to the bucket.
     *
     * @param {ViolinPlot} self - this ViolinPlot object
     * @param {object} bucket - the record from server; contains 'count' field, and also 'values' field if metrics were specified
     */
    static processBucket(self, bucket) {
        const config = self.props.config;
        if (config.metric_sigCid && config.metric_type) {
            bucket.metric = bucket.values[config.metric_sigCid][config.metric_type];
            delete bucket.values;
            return bucket.metric;
        }
        else
            return bucket.count;
    }

    /**
     * Processes the data returned from the server and returns new signalSetData object.
     *
     * @param {ViolinPlot} self - this ViolinPlot object
     * @param {object} data - the data from server; contains at least 'buckets', 'step' and 'offset' fields
     * @param signalSetConfig - configuration of the corresponding signalSet
     *
     * @returns {object} - signalSet data to be saved to state; must contain (if valid):
     *
     *   - 'buckets' - array of objects with 'key' (lowest value of the bucket) and 'prob' (frequency; height of the bucket)
     *   - 'step' - width of the bucket
     *   - 'min' and 'max' (along the y-axis)
     *   - 'maxValue' - value (count of elements) of the most frequent bucket
     */
    static prepareDataForSignalSet(self, data, signalSetConfig) {
        if (data.buckets.length === 0)
            return {
                buckets: [],
                maxValue: 0
            };
        if (isNaN(data.step)) { // not a numeric signal
            self.setFlashMessage("warning", `ViolinPlot is not available for non-numeric signal: '${signalSetConfig.cid}:${signalSetConfig.sigCid}'.`);
            return {
                buckets: [],
                maxValue: 0
            };
        }

        const min = data.buckets[0].key;
        const max = data.buckets[data.buckets.length - 1].key + data.step;

        const processBucket = self.props.processBucket || ViolinPlot.processBucket;
        for (const bucket of data.buckets)
            bucket.value = processBucket(self, bucket);

        let maxValue = 0;
        let totalValue = 0;
        for (const bucket of data.buckets) {
            if (bucket.value > maxValue)
                maxValue = bucket.value;
            totalValue += bucket.value;
        }

        for (const bucket of data.buckets) {
            bucket.prob = bucket.value / totalValue;
        }

        return {
            buckets: data.buckets,
            step: data.step,
            offset: data.offset,
            min,
            max,
            maxValue
        };
    }

    /**
     * Processes the data returned from the server and returns new state.
     *
     * @param {ViolinPlot} self - this ViolinPlot object
     * @param {object} data - the data from server, an array of objects containing 'buckets', 'step' and 'offset' fields
     *
     * @returns {object} - state update (will be passed to this.setState); must contain:
     *
     *   - 'signalSetsData' - array of objects with 'buckets' and 'step' fields.
     *                        'buckets' must be an array in which each item contains 'key' (vertical position of the bucket) and 'prob' (frequency; width of the violin)
     *                        'step' is the width of the bucket (in units of data)
     *   - 'min' and 'max' (out of all signalSets)
     *   - 'maxValue' - value (count of elements) of the most frequent bucket (out of all signalSets)
     *   - 'statusMsg': "" (to reset the "Loading..." status message)
     */
    static prepareData(self, data) {
        const processedResults = [];
        const prepareDataForSignalSet = self.props.prepareDataForSignalSet || ViolinPlot.prepareDataForSignalSet;

        for (let i = 0; i < self.props.config.signalSets.length; i++) {
            const signalSetConfig = self.props.config.signalSets[i];
            processedResults.push(prepareDataForSignalSet(self, data[i], signalSetConfig));
        }

        const min = d3Array.min(processedResults, d => d.min);
        const max = d3Array.min(processedResults, d => d.max);
        const maxValue = d3Array.max(processedResults, d => d.maxValue);

        return {
            signalSetsData: processedResults,
            min,
            max,
            maxValue,
            statusMsg: "",
        };
    }

    /** Creates (or updates) the chart with current data.
     * This method is called from componentDidUpdate automatically when state or config is updated. */
    createChart(forceRefresh) {
        const signalSetsData = this.state.signalSetsData;

        const maxBucketCount = Math.ceil(this.props.height / this.props.minBarHeight);
        if (maxBucketCount !== this.state.maxBucketCount)
            this.setState({
                maxBucketCount
            });

        const width = this.containerNode.getClientRects()[0].width;
        const widthChanged = width !== this.state.width;
        if (widthChanged)
            this.setState({width});
        if (!forceRefresh && !widthChanged) {
            return;
        }

        if (!signalSetsData) {
            return;
        }

        //<editor-fold desc="Scales">
        const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
        const xSize = width - this.props.margin.left - this.props.margin.right;

        const xExtent = this.props.config.signalSets.map((b, i) => b.label || i);
        const xScale = d3Scale.scalePoint()
            .domain(xExtent)
            .range([0, xSize])
            .padding(1);
        this.xScale = xScale;
        const xAxis = d3Axis.axisBottom(xScale)
            .tickSizeOuter(0);
        this.xAxisSelection.call(xAxis);
        this.xAxisLabelSelection.text(this.props.xAxisLabel).style("text-anchor", "middle");

        const yScale = d3Scale.scaleLinear()
            .domain(this.yExtent)
            .range([ySize, 0]);
        const yAxis = d3Axis.axisLeft(yScale);
        if (this.props.yAxisTicksCount) yAxis.ticks(this.props.yAxisTicksCount);
        if (this.props.yAxisTicksFormat) yAxis.tickFormat(this.props.yAxisTicksFormat);
        this.yAxisSelection.call(yAxis);
        this.yAxisLabelSelection.text(this.props.yAxisLabel).style("text-anchor", "middle");
        //</editor-fold>

        this.drawChart(signalSetsData, xScale, yScale);
    }

    drawChart(signalSetsData, xScale, yScale) {
        const violinWidth = xScale.step() / 2;
        const xWidthScale = d3Scale.scaleLinear()
            .domain([0, this.state.maxValue])
            .range([0, violinWidth]);

        for (let i = 0; i < this.props.config.signalSets.length; i++) {
            const config = this.props.config.signalSets[i];
            const data = signalSetsData[i];
            const color = d3Color.color(config.color);
            const verticalPosition = key => yScale(key + data.step / 2); // 'key' is the lowest value in bucket -> this returns the center

            this.drawViolin(data.buckets, this.violinSelections[i], xScale(config.label || i), xWidthScale, verticalPosition, color, this.props.curve);
        }
    }

    /**
     * @param data             data in format as produces by ViolinPlot.prepareDataForSignalSet
     * @param path             d3 selection of <path> to which the data will get assigned and drawn
     * @param xPosition {number}
     * @param xWidthScale      d3Scale to convert probability of the bucket to the width of the violin
     * @param yScale           d3Scale to convert key of the bucket to the vertical position
     * @param color            fill color
     * @param curve            d3Shape curve used for rendering
     */
    drawViolin(data, path, xPosition, xWidthScale, yScale, color, curve) {
        const violin = d3Shape.area()
            .y(d => yScale(d.key))
            .x0(d => xPosition - xWidthScale(d.value))
            .x1(d => xPosition + xWidthScale(d.value))
            .curve(curve);

        path.datum(data)
            .attr('fill', color)
            .attr('stroke', 'none')
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('d', violin);
    }

    render() {
        if (!this.state.signalSetsData) {
            return (
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%"
                     className={this.props.className} style={this.props.style} >
                    <text textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                        {this.state.statusMsg}
                    </text>
                </svg>
            );

        } else {

            this.violinSelections = [];
            const violinSelectionPaths = this.props.config.signalSets.map((signalSet, i) =>
                <path key={i}
                      ref={node => this.violinSelections[i] = select(node)}/>
            );

            return (
                <div ref={node => this.svgContainerSelection = select(node)}
                     className={this.props.className} style={this.props.style}>
                    <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                        <defs>
                            <clipPath id="plotRect">
                                <rect x="0" y="0" width={this.state.width - this.props.margin.left - this.props.margin.right} height={this.props.height - this.props.margin.top - this.props.margin.bottom} />
                            </clipPath>
                        </defs>
                        <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`} clipPath="url(#plotRect)" >
                            {violinSelectionPaths}
                        </g>

                        {/* axes */}
                        <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                        <text ref={node => this.xAxisLabelSelection = select(node)}
                              transform={`translate(${this.props.margin.left + (this.state.width - this.props.margin.left - this.props.margin.right) / 2}, ${this.props.height - 5})`} />
                        <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                        <text ref={node => this.yAxisLabelSelection = select(node)}
                              transform={`translate(${15}, ${this.props.margin.top + (this.props.height - this.props.margin.top - this.props.margin.bottom) / 2}) rotate(-90)`} />

                        <line ref={node => this.cursorSelection = select(node)} strokeWidth="1" stroke="rgb(50,50,50)" visibility="hidden"/>}

                        <text textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                            {this.state.statusMsg}
                        </text>
                    </svg>
                </div>
            );
        }
    }
}
