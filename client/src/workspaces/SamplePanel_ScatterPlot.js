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
            data: [ {x: 1, y: 3 },
                    {x: 4, y: 2 },
                    {x: 2, y: 5 },
                    {x: 6, y: 2 },
                    {x: 1, y: 4 },
                    {x: 3, y: 5 }]
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