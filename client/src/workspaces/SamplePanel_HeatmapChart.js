'use strict';

import React, {Component} from "react";
import {TimeRangeSelector} from "../ivis/TimeRangeSelector";
import {TimeContext} from "../ivis/TimeContext";
import {rgb} from "d3-color";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {HeatmapChart} from "../ivis/correlation_charts/HeatmapChart";
import {IntervalSpec} from "../ivis/TimeInterval";

class TestHeatmapChart extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.props.t;

        const cnf = {
            sigSetCid: "top:bubble",
            X_sigCid: "x",
            Y_sigCid: "y",
            tsSigCid: "ts",
            colors: [rgb(255, 255, 255), rgb(0, 87, 219)]
        };

        return (
            <TimeContext initialIntervalSpec={new IntervalSpec("now-5y", "now", null, null)}>
                <TimeRangeSelector/>
                    <HeatmapChart
                        config={cnf}
                        height={400}
                        margin={{left: 30, right: 5, top: 5, bottom: 30}}
                        overviewLeftMargin={{left: 0, right: 0}}
                        overviewBottomMargin={{top: 0, bottom: 0}}
                    />
            </TimeContext>
        );
    }
}


export default class SamplePanel_HeatmapChart extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <TestWorkspacePanel
                title="Sample Panel 4"
                content={TestHeatmapChart}
            />
        );
    }
}