'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {rgb} from "d3-color";
import {
    LegendPosition,
} from "../ivis/ivis";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {ScatterPlot} from "../ivis/correlation_charts/ScatterPlot";

class TestScatterPlot extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.props.t;

        const cnf = {
            signalSets: [
                {
                    cid: "top:random",
                    X_sigCid: "x_val",
                    Y_sigCid: "y_val",
                    color: rgb(219, 0, 0),
                    label: "Random"
                },
                {
                    cid: "top:random_correlated",
                    X_sigCid: "x_val",
                    Y_sigCid: "y_val",
                    color: rgb(0, 0, 219),
                    label: "Correlated"
                }
            ]
        };

        return (
            <div>
                <ScatterPlot config={cnf}
                             height={400} width={400}
                             margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                             legendPosition={LegendPosition.BOTTOM} legendRowClass="col-12 col-md-6 col-lg-4 col-xl-2"/>
            </div>
        );
    }
}


export default class SamplePanel_Scatterplot extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {};

        return (
            <TestWorkspacePanel
                title="Sample Panel 3"
                panel={{
                    id: 1,
                    template: 1
                }}
                params={panelParams}
                content={TestScatterPlot}
            />
        );
    }
}