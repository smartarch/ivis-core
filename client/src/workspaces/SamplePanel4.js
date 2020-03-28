'use strict';

import React, {Component} from "react";
import {TimeRangeSelector} from "../ivis/TimeRangeSelector";
import {TimeContext} from "../ivis/TimeContext";
import {rgb} from "d3-color";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {HeatmapChart} from "../ivis/correlation_charts/HeatmapChart";
import {IntervalSpec} from "../ivis/TimeInterval";

class TestHeatmap extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.props.t;

        const cnf = {
            sigSetCid: "top:random_correlated",
            X_sigCid: "x_val",
            Y_sigCid: "y_val",
            tsSigCid: "ts",
            colors: [rgb(255, 255, 255), rgb(0, 87, 219)]
        };

        return (
            <TimeContext initialIntervalSpec={new IntervalSpec("now-5y", "now", null, null)}>
                <TimeRangeSelector/>
                    {/*/
                    <HistogramChart
                        config={cnf}
                        height={400}
                        margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                    />
                    /**/}
                    {/**/
                    <HeatmapChart
                        config={cnf}
                        height={400}
                        margin={{left: 40, right: 5, top: 5, bottom: 40}}
                    />
                    /**/}
            </TimeContext>
        );
    }
}


export default class SamplePanel4 extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <TestWorkspacePanel
                title="Sample Panel 4"
                content={TestHeatmap}
            />
        );
    }
}