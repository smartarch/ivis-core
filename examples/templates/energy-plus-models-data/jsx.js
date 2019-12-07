
'use strict';

import React, {Component} from "react";
import styles from './styles.scss';
import {withPanelConfig, TimeContext, TimeRangeSelector, LineChart, Legend} from "ivis";



const modelsStructure = [
    {
        labelAttr: 'label',
        colorAttr: 'color',
        selectionAttr: 'enabled'
    }
];

const modelsConfigSpec = {
    "id": "models",
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
            "id": "sigSet",
            "label": "Signal Set",
            "type": "signalSet"
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
export default class Panel extends Component {
    render() {
        const config = this.getPanelConfig();

        const graphSpecs = [
            {
                label: "Temperature",
                modelCid: "temperature",
                sensorCid: config.temperature,
                yScaleMin: 0,
                yScaleMax: 30,
                unit: "°C"
            },
            {
                label: "CO2",
                modelCid: "co2",
                sensorCid: config.co2,
                unit: "ppm"
            },
            {
                label: "Humidity",
                modelCid: "humidity",
                sensorCid: config.humidity,
                unit: "%"
            }
        ];

        const graphs = [];
        let graphIdx = 0;

        for (const graphSpec of graphSpecs) {
            const yScaleMin = graphSpec.yScaleMin;
            const yScaleMax = graphSpec.yScaleMax;

            const yScale = {
                visible: true,
                label: graphSpec.label + (graphSpec.unit ? ` (${graphSpec.unit})` : '')
            };

            if (!Number.isNaN(yScaleMin)) {
                yScale.includedMin = yScaleMin;
            }

            if (!Number.isNaN(yScaleMax)) {
                yScale.includedMax = yScaleMax;
            }

            const signalSets = [];

            signalSets.push({
                cid: config.sensors,
                tsSigCid: config.ts,
                signals: [
                    {
                        label: "Sensor",
                        color: config.color,
                        cid: graphSpec.sensorCid,
                        enabled: true,
                        unit: graphSpec.unit,
                        axis: 0
                    }
                ]
            });

            for (const model of config.models) {
                signalSets.push({
                    cid: model.sigSet,
                    tsSigCid: 'date',
                    signals: [
                        {
                            label: model.label,
                            color: model.color,
                            cid: graphSpec.modelCid,
                            enabled: model.enabled,
                            unit: graphSpec.unit,
                            axis: 0
                        }
                    ]
                });
            }

            const chartConfig = {
                yAxes: [ yScale ],
                signalSets
            };

            graphs.push(
                <div key={graphIdx} className={"my-3 page-block"}>
                    <h4>{graphSpec.label}</h4>
                    <LineChart
                        config={chartConfig}
                        height={500}
                        margin={{ left: 60, right: 60, top: 5, bottom: 20 }}
                        withTooltip
                        tooltipExtraProps={{ width: 500 }}
                    />
                </div>
            );

            graphIdx += 1;
        }

        return (

            <TimeContext>
                <TimeRangeSelector/>
                <Legend label="Models" configPath={['models']} withSelector structure={modelsStructure} withConfigurator configSpec={modelsConfigSpec}/>
                {config.sensors.toString()}
                {graphs}
            </TimeContext>
        );
    }
}
