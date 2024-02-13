'use strict';

import React, {Component} from "react";
import {
    isSignalVisible,
    RenderStatus
} from "./TimeBasedChartBase";
import {getAxisIdx, LineChartBase, lineWithoutPoints} from "./LineChartBase";
import {select} from "d3-selection";
import * as d3Shape
    from "d3-shape";
import {rgb} from "d3-color";
import PropTypes
    from "prop-types";
import tooltipStyles
    from "./Tooltip.scss";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "react-i18next";
import {PropType_d3Color} from "../lib/CustomPropTypes";

function getSignalValuesForDefaultTooltip(tooltipContent, sigSetConf, sigConf, sigSetCid, sigCid, signalData) {
    const val = signalData.max ? 'ON' : 'OFF';

    const unit = sigConf.unit;

    return (
        <span className={tooltipStyles.signalVal}>{val} {unit}</span>
    );
}

@withComponentMixins([
    withTranslation
])
export class OnOffAreaChart extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.areaPathSelection = {};

        this.boundCreateChart = ::this.createChart;
        this.boundPrepareData = ::this.prepareData;
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        data: PropTypes.object,
        contentComponent: PropTypes.func,
        contentRender: PropTypes.func,
        onClick: PropTypes.func,
        height: PropTypes.number,
        margin: PropTypes.object,
        withTooltip: PropTypes.bool,
        withBrush: PropTypes.bool,
        withZoom: PropTypes.bool,
        zoomUpdateReloadInterval: PropTypes.number, // milliseconds after the zoom ends; set to null to disable updates
        loadingOverlayColor: PropType_d3Color(),
        displayLoadingTextWhenUpdating: PropTypes.bool,
        tooltipContentComponent: PropTypes.func,
        tooltipContentRender: PropTypes.func,
        tooltipExtraProps: PropTypes.object,
        discontinuityInterval: PropTypes.number, // if two data points are further apart than this interval (in seconds), the lines are split into segments
    }

    static defaultProps = {
        margin: { left: 5, right: 5, top: 5, bottom: 20 },
        height: 500,
        withTooltip: true,
        withBrush: true
    }

    prepareData(base, signalSetsData, extraData) {
        const data = signalSetsData;

        const signalSetsReverse = this.props.config.signalSets.slice().reverse();

        for (const setSpec of signalSetsReverse) {
            const signalsReverse = setSpec.signals.slice().reverse();

            const changeData = data => {
                let accumulator = 0;
                for (const sigSpec of signalsReverse) {
                    accumulator += data[sigSpec.cid].max;
                    data[sigSpec.cid].max = data[sigSpec.cid].max ? accumulator : 0;
                }
            };

            const sigSetData = data[setSpec.cid];
            if (sigSetData.prev) {
                changeData(sigSetData.prev.data);
            }
            for (const main of sigSetData.main) {
                changeData(main.data);
            }
            if (sigSetData.next) {
                changeData(sigSetData.next.data);
            }
        }

        return {
            signalSetsData: data
        };
    }

    createChart(base, signalSetsData, baseState, abs, xScale, yScales, points) {
        for (const sigSetConf of this.props.config.signalSets) {
            if (points[sigSetConf.cid]) {
                for (const sigConf of sigSetConf.signals) {
                    if (isSignalVisible(sigConf)) {
                        const sigCid = sigConf.cid;
                        const yScale = yScales[getAxisIdx(sigConf)];

                        const minMaxArea = d3Shape.area()
                            .defined(d => d !== null)
                            .x(d => xScale(d.ts))
                            .y0(d => yScale(0))
                            .y1(d => yScale(d.data[sigCid].max))
                            .curve(d3Shape.curveStep);

                        const minMaxAreaColor = rgb(sigConf.color);

                        this.areaPathSelection[sigSetConf.cid][sigCid]
                            .datum(points[sigSetConf.cid])
                            .attr('fill', minMaxAreaColor.toString())
                            .attr('stroke', 'none')
                            .attr('stroke-linejoin', 'round')
                            .attr('stroke-linecap', 'round')
                            .attr('d', minMaxArea);
                    }
                }
            }
        }

        return RenderStatus.SUCCESS;
    }

    render() {
        const props = this.props;

        for (const sigSetConf of props.config.signalSets) {
            this.areaPathSelection[sigSetConf.cid] = {};
        }

        return (
            <LineChartBase
                config={props.config}
                height={props.height}
                data={props.data}
                margin={props.margin}
                signalAggs={['max']}
                lineAgg="max"
                getSignalValuesForDefaultTooltip={getSignalValuesForDefaultTooltip}
                prepareData={this.boundPrepareData}
                createChart={this.boundCreateChart}
                getSignalGraphContent={(base, sigSetCid, sigCid) => <path ref={node => this.areaPathSelection[sigSetCid][sigCid] = select(node)}/>}
                withTooltip={props.withTooltip}
                withBrush={props.withBrush}
                withZoom={props.withZoom}
                zoomUpdateReloadInterval={props.zoomUpdateReloadInterval}
                contentComponent={props.contentComponent}
                contentRender={props.contentRender}
                tooltipContentComponent={this.props.tooltipContentComponent}
                tooltipContentRender={this.props.tooltipContentRender}
                tooltipExtraProps={this.props.tooltipExtraProps}
                getLineColor={color => color.darker()}
                lineVisibility={lineWithoutPoints}
                lineCurve={d3Shape.curveStep}
                discontinuityInterval={this.props.discontinuityInterval}
                loadingOverlayColor={this.props.loadingOverlayColor}
                displayLoadingTextWhenUpdating={this.props.displayLoadingTextWhenUpdating}
            />
        );
    }
}
