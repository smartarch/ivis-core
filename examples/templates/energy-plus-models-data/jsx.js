
'use strict';

import React, {Component} from "react";
import styles from './styles.scss';
import {withPanelConfig, TimeContext, TimeRangeSelector, LineChart, Legend, StaticLegend} from "ivis";
import {select} from "d3-selection";


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

    constructor(props) {
        super(props);
        this.referenceLines = {};
    }

    render() {
        const config = this.getPanelConfig();

        const graphSpecs = [
            {
                label: "Temperature",
                modelCid: "temperature",
                sensorCid: config.sensor.temperature,
                yScaleMin: 0,
                yScaleMax: 30,
                unit: "°C"
            },
            {
                label: "CO2",
                modelCid: "co2",
                sensorCid: config.sensor.co2,
                unit: "ppm"
            },
            {
                label: "Humidity",
                modelCid: "humidity",
                sensorCid: config.sensor.humidity,
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
                cid: config.sensor.signalSet,
                tsSigCid: config.ts,
                signals: [
                    {
                        label: "Sensor",
                        color: config.sensor.color,
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

                        createChart={(base, signalSetsData, baseState, abs, xScale, yScales, points) => {
                            const yScale = yScales[0];

                            const updateLine = (id, value) => this.referenceLines[id]
                                .attr('x1', xScale(abs.from))
                                .attr('x2', xScale(abs.to))
                                .attr('y1', yScale(value))
                                .attr('y2', yScale(value));

                            // TODO update to work on actual scale, also do just for co2
                            for(let i = 0;i<2200;i+=100){
                                updateLine(`${i}`, i);
                            }
                        }}
                        getGraphContent={(base, paths) => {

                            // TODO same as with update line above
                            const lines = [];
                            for(let i = 500;i<2200;i+=100){
                                lines.push(<line key={i} ref={node => this.referenceLines[`${i}`] = select(node)} stroke="#808080" strokeWidth="1" strokeDasharray="2 2"/>)
                            }

                            return [
                                (<g key={`referenceLines`}>
                                    {lines}
                                </g>),
                                ...paths
                            ];
                        }}

                    />
                </div>
            );

            graphIdx += 1;
        }

        return (

            <TimeContext>
                <TimeRangeSelector/>
                <Legend label="Models" configPath={['models']} withSelector structure={modelsStructure} withConfigurator configSpec={modelsConfigSpec}/>
                <StaticLegend
                    rowClassName="col-6 col-sm-4 col-md-3"
                    config={ [{ label: 'Sensor', color: config.sensor.color, enabled: config.sensor.enabled }] }
                    structure= { [{ labelAttr: 'label', colorAttr: 'color', selectionAttr: 'enabled' }] }
                    onChange={ (path, value) => this.updatePanelConfig(['sensor', 'enabled'], value[0].enabled) }
                    withSelector
                />
                {graphs}
            </TimeContext>
        );
    }
}
