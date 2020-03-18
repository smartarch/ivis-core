'use strict';

import React, {Component} from "react";
import {TimeRangeSelector} from "../ivis/TimeRangeSelector";
import {TimeContext} from "../ivis/TimeContext";
import {rgb} from "d3-color";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {IntervalSpec} from "../ivis/TimeInterval";
import {HistogramChart} from "../ivis/HistogramChart";

class TestHistogramChart extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const cnf = {
            sigSetCid: "top:histogram",
            sigCid: "x_val",
            tsSigCid: "ts",
            color: rgb(0, 87, 219)
        };

        return (
            <TimeContext initialIntervalSpec={new IntervalSpec("now-5y", "now", null, null)}>
                <TimeRangeSelector/>
                <HistogramChart
                    config={cnf}
                    height={400}
                    margin={{left: 40, right: 5, top: 5, bottom: 20}}
                    xMin={200}
                    topPaddingWhenZoomed={0.1}
                />
                {/*bucketCount={10}*/}
            </TimeContext>
        );
    }
}

export default class SamplePanel_HistogramChart extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <TestWorkspacePanel
                title="Sample Panel 4"
                content={TestHistogramChart}
            />
        );
    }
}