'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {rgb} from "d3-color";
import {
    Legend,
    LegendPosition, withPanelConfig,
} from "../ivis/ivis";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {ScatterPlot} from "../ivis/correlation_charts/ScatterPlot";

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
            "id": "X_sigCid",
            "label": "Signal X",
            "type": "signal",
            "signalSetRef": "signalSet"
        },
        {
            "id": "Y_sigCid",
            "label": "Signal Y",
            "type": "signal",
            "signalSetRef": "signalSet"
        },
        {
            "id": "enabled",
            "label": "Enabled",
            "type": "boolean",
            "default": true
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
            signalSets.push({
                    cid: sensor.signalSet,
                    label: sensor.label,
                    color: sensor.color,
                    enabled: sensor.enabled,
                    X_sigCid: sensor.X_sigCid,
                    Y_sigCid: sensor.Y_sigCid
                }
            );
        }
        const cnf = {
            signalSets
        };

        return (
            <div>
                <Legend label="Sensors" configPath={['sensors']} withSelector structure={sensorsStructure} withConfigurator configSpec={sensorsConfigSpec}/>
                <ScatterPlot config={cnf}
                             height={400} width={400}
                             margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                             />
            </div>
        );
    }
}


export default class SamplePanel_Scatterplot extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {
            sensors: [
                {
                    signalSet: "top:random",
                    X_sigCid: "x_val",
                    Y_sigCid: "y_val",
                    color: rgb(219, 0, 0),
                    label: "Random",
                    enabled: true
                },
                {
                    signalSet: "top:random_correlated",
                    X_sigCid: "x_val",
                    Y_sigCid: "y_val",
                    color: rgb(0, 0, 219),
                    label: "Correlated",
                    enabled: true
                }
            ]
        };

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