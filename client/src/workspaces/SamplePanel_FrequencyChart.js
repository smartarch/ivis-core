'use strict';

import React, {Component} from "react";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {FrequencyPieChart} from "../ivis/FrequencyPieChart";
import {LegendPosition} from "../ivis/PieChart";
import {FrequencyBarChart} from "../ivis/FrequencyBarChart";

class TestFrequencyChart extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const cnf = {
            sigSetCid: "top:bubble",
            sigCid: "a"
        };

        return (
            <div>
                <FrequencyPieChart
                    config={cnf}
                    height={400}
                    legendPosition={LegendPosition.BOTTOM}
                    legendRowClass="col-12 col-md-6 col-lg-4 col-xl-2"
                />
                <FrequencyBarChart
                    config={cnf}
                    height={400}
                />
            </div>
        );
    }
}

export default class SamplePanel_FrequencyChart extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <TestWorkspacePanel
                title="Sample Panel Frequency"
                content={TestFrequencyChart}
            />
        );
    }
}