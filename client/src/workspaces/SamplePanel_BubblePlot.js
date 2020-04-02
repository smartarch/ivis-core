'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {rgb} from "d3-color";
import {
    Legend, withPanelConfig,
} from "../ivis/ivis";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {BubblePlot} from "../ivis/BubblePlot";

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
            "id": "x_label",
            "label": "X Label",
            "type": "string"
        },
        {
            "id": "y_label",
            "label": "Y Label",
            "type": "string"
        },
        {
            "id": "dotSize_label",
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
                            height={400}
                            margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                            maxDotCount={10}
                            highlightDotRadius={1}
                            //updateSizeOnZoom={true}
                            updateColorOnZoom={true}
                            yAxisExtentFromSampledData={true}
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
                    x_sigCid: "x",
                    y_sigCid: "y",
                    color: [rgb(100, 150, 255), rgb(0, 0, 219)],
                    label: "Bubble",
                    enabled: true,
                    dotSize_sigCid: "z",
                    colorContinuous_sigCid: "w",
                    dotShape: "cross_fat",
                    dotGlobalShape: "cross_fat"
                },
                {
                    signalSet: "top:bubble",
                    x_sigCid: "y",
                    y_sigCid: "x",
                    color: [rgb(255, 150, 100), rgb(200, 0, 29)],
                    label: "Bubble",
                    enabled: true,
                    dotSize_sigCid: "w",
                    colorContinuous_sigCid: "z",
                    dotShape: "square",
                    dotGlobalShape: "square_empty"
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