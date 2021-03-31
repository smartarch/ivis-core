
'use strict';

import React, {Component} from "react";
import styles from './styles.scss';
import {withPanelConfig, TimeContext, TimeRangeSelector, LineChart, Legend, StaticLegend} from "ivis";
import {select} from "d3-selection";
import moment from 'moment';

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

            const yMaxLimit = 3500;
            const step = 100;

            const linechartProps = {};
            if (graphSpec.modelCid==='co2' ){
                if (config.mod){
                    lineChartConfig.modVisible = config.mod.visible;
                    linechartProps.getExtraQueries = (base, abs) => {
                        return [
                            {
                                type: 'docs',
                                args: [
                                    config.mod.sigSet,
                                    ['mod','ts','model'],
                                    {
                                        type: 'range',
                                        sigCid: 'ts',
                                        gte: abs.from.toISOString(),
                                        lt: abs.to.toISOString()
                                    },
                                    null,
                                    1000
                                ]
                            }
                        ];
                    };
                    linechartProps.prepareExtraData = (base, signalSetsData, extraData) => {
                        return {
                            mod: extraData[0].map(x => ({mod: x.mod, model: x.model, ts: moment(x.ts)}))
                        };
                    };
                }

                linechartProps.createChart =  (base, signalSetsData, baseState, abs, xScale, yScales, points) => {
                    const yScale = yScales[0];
                    const domain = yScale.domain();
                    const yMin = domain[0];
                    const yMax = domain[1] < yMaxLimit ? domain[1]: yMaxLimit;
                    const ySize = base.props.height - base.props.margin.top - base.props.margin.bottom;


                    // Ruler lines
                    const getLineAttrs = (value) => {return {
                        'x1': xScale(abs.from),
                        'x2': xScale(abs.to),
                        'y1': yScale(value),
                        'y2': yScale(value)
                    }};

                    const yRulerStart = Math.ceil(yMin / step) * step;
                    const lines = []
                    for(let i = yRulerStart;i<yMax;i+=step){
                        lines.push(getLineAttrs(i));
                    }

                    const ruler = base.rulerSelection
                        .selectAll('line')
                        .data(lines);

                    ruler.enter()
                        .append('line')
                        .merge(ruler)
                        .attr('x1', l => l.x1)
                        .attr('x2', l => l.x2)
                        .attr('y1', l => l.y1)
                        .attr('y2', l => l.y2)
                        .attr("class", styles.rulerLine);

                    ruler.exit()
                        .remove();

                    if (config.mod){
                        // Mod
                        const modData = [];
                        for (const element of baseState.mod) {
                            modData.push({
                                'x1': xScale(element.ts),
                                'x2': xScale(element.ts),
                                'y1': 0,
                                'y2': ySize,
                                'mod': element.mod
                            });
                        }

                        // Mod lines
                        const modLines = base.modSelection
                            .selectAll('line')
                            .data(modData);


                        modLines.enter()
                            .append('line')
                            .merge(modLines)
                            .attr('x1', l => l.x1)
                            .attr('x2', l => l.x2)
                            .attr('y1', l => l.y1)
                            .attr('y2', l => l.y2)
                            .attr("class", styles.modLine);

                        modLines.exit()
                            .remove();

                        // Mod lines labels
                        const modLabels = base.modSelection
                            .selectAll('text')
                            .data(modData);


                        modLabels.enter()
                            .append("text")
                            .merge(modLabels)
                            .attr("y", l => l.y1 + 10)
                            .attr("x", l => l.x2 + 10)
                            .text(l => l.mod)
                            .attr("class", styles.modLabel);

                        modLabels.exit()
                            .remove();
                    }

                }

                linechartProps.getGraphContent = (base, paths) => {
                    return [
                        <g ref={node => base.rulerSelection = select(node)} key="ruler"/>,
                        <g ref={node => base.modSelection = select(node)} key="mod"/>,
                        ...paths
                    ];
                }
            }

            graphs.push(
                <div key={graphIdx} className={"my-3 page-block"}>
                    <h4>{graphSpec.label}</h4>
                    <LineChart
                        config={chartConfig}
                        height={500}
                        margin={{ left: 60, right: 60, top: 5, bottom: 20 }}
                        withTooltip
                        tooltipExtraProps={{ width: 500 }}

                        {...linechartProps}
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
                    config={ [{ label: 'Sensor', color: config.sensor.color}] }
                    structure= { [{ labelAttr: 'label', colorAttr: 'color'}] }
                    withSelector
                />
                {graphs}
            </TimeContext>
        );
    }
}
