'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {rgb} from "d3-color";
import {
    IntervalSpec,
    Legend,
    LegendPosition, TimeContext, TimeRangeSelector, withPanelConfig,
} from "../ivis/ivis";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {ScatterPlot} from "../ivis/ScatterPlot";

const sensorsStructure = [
    {
        labelAttr: 'label',
        colorAttr: 'color',
        selectionAttr: 'enabled'
    }
];

const sensorsConfigSpec = {
    "id": "signalSets",
    "type": "fieldset",
    "cardinality": "1..n",
    "children": [
        {
            "id": "label",
            "label": "Label",
            "type": "string"
        },
        {
            "id": "color",
            "label": "Color",
            "type": "color"
        },
        {
            "id": "signalSet",
            "label": "Signal Set",
            "type": "signalSet"
        },
        {
            "id": "x_sigCid",
            "label": "Signal X",
            "type": "signal",
            "signalSetRef": "signalSet"
        },
        {
            "id": "y_sigCid",
            "label": "Signal Y",
            "type": "signal",
            "signalSetRef": "signalSet"
        },
        {
            "id": "enabled",
            "label": "Enabled",
            "type": "boolean",
            "default": true
        },
        {
            "id": "x_label",
            "label": "X Label",
            "type": "string"
        },
        {
            "id": "y_label",
            "label": "Y Label",
            "type": "string"
        }
    ]
};

@withPanelConfig
class TestScatterPlot extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const config = this.getPanelConfig();

        const signalSets = [];
        for (const sensor of config.sensors) {
            let signalSet = sensor;
            signalSet.cid = sensor.signalSet;
            signalSet.signalSet = null;
            signalSets.push(signalSet);
        }
        const cnf = {
            signalSets
        };

        return (
            <TimeContext initialIntervalSpec={new IntervalSpec("now-5y", "now", null, null)}>
                <TimeRangeSelector/>
                <Legend label="Sensors" configPath={['sensors']} withSelector structure={sensorsStructure} withConfigurator configSpec={sensorsConfigSpec}/>
                <ScatterPlot config={cnf}
                             height={400}
                             margin={{ left: 40, right: 5, top: 5, bottom: 40 }}
                             withBrush={true}
                             withSettings={true}
                             xMin={0}
                             yMin={0}
                             withAutoRefreshOnBrush={true}
                             />
            </TimeContext>
        );
    }
}


export default class SamplePanel_ScatterPlot extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {
            sensors: [
                {
                    signalSet: "top:random",
                    x_sigCid: "x_val",
                    y_sigCid: "y_val",
                    color: rgb(219, 0, 0),
                    label: "Random",
                    enabled: true,
                    x_label: "X value",
                    y_label: "Y value",
                    tsSigCid: "ts"
                },
                {
                    signalSet: "top:random_correlated",
                    x_sigCid: "x_val",
                    y_sigCid: "y_val",
                    color: rgb(0, 0, 219),
                    label: "Correlated",
                    enabled: true,
                    x_label: "X value",
                    y_label: "Y value",
                    regressions: [{
                        type: "linear",
                        color: rgb(0, 0, 169)
                    }],
                    tsSigCid: "ts",
                    dotShape: "diamond",
                    dotGlobalShape: "diamond_empty"
                }
            ]
        };

        return (
            <TestWorkspacePanel
                title="Sample Scatter Plot"
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