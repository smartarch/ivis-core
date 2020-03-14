'use strict';

import React, {Component} from "react";
import * as d3Scheme from "d3-scale-chromatic";
import {
    Legend, withPanelConfig,
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
class TestScatterPlotColor extends Component {
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
                <ScatterPlot config={cnf}
                             height={400}
                             margin={{ left: 40, right: 5, top: 5, bottom: 40 }}
                             withBrush={true}
                             withSettings={true}
                             maxDotCount={15}
                             />
            </div>
        );
    }
}


export default class SamplePanel_ScatterPlotColor extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {
            sensors: [
                {
                    signalSet: "top:bubble",
                    x_sigCid: "x",
                    y_sigCid: "y",
                    color: d3Scheme.schemeDark2,
                    label: "Color Test",
                    enabled: true,
                    x_label: "X",
                    y_label: "Y",
                    colorDiscrete_sigCid: "a",
                    regressions: [{
                        type: "linear",
                        createRegressionForEachColor: true,
                        color: d3Scheme.schemePastel2
                    }]
                }
            ]
        };

        return (
            <TestWorkspacePanel
                title="Sample Scatter Plot Color"
                panel={{
                    id: 1,
                    template: 1
                }}
                params={panelParams}
                content={TestScatterPlotColor}
            />
        );
    }
}