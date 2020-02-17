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
import {BubblePlot} from "../ivis/correlation_charts/BubblePlot";

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
            "id": "dotSize_sigCid",
            "label": "Dot Size Signal",
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
            "id": "X_label",
            "label": "X Label",
            "type": "string"
        },
        {
            "id": "Y_label",
            "label": "Y Label",
            "type": "string"
        },
        {
            "id": "Size_label",
            "label": "Size Label",
            "type": "string"
        }
    ]
};

@withPanelConfig
class TestBubblePlot extends Component {
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
            <div>
                <Legend label="Sensors" configPath={['sensors']} withSelector structure={sensorsStructure} withConfigurator configSpec={sensorsConfigSpec}/>
                <BubblePlot config={cnf}
                            height={400} width={400}
                            margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                            maxDotCount={10}
                            highlightDotRadius={1}
                             />
            </div>
        );
    }
}


export default class SamplePanel_BubblePlot extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {
            sensors: [
                {
                    signalSet: "top:bubble",
                    X_sigCid: "x",
                    Y_sigCid: "y",
                    color: [rgb(200, 12, 0), rgb(200, 12, 0), rgb(0, 0, 219)],
                    label: "Bubble",
                    enabled: true,
                    dotSize_sigCid: "z",
                    color_sigCid: "w"
                }
            ],
        };

        return (
            <TestWorkspacePanel
                title="Sample Bubble Plot"
                panel={{
                    id: 1,
                    template: 1
                }}
                params={panelParams}
                content={TestBubblePlot}
            />
        );
    }
}