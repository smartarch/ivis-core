'use strict';

import React, {Component} from "react";
import {BubblePlot, TimeContext, TimeRangeSelector, IntervalSpec} from "ivis";

export default class HansRoslingBubblePlot extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const cnf = {
            signalSets: [{
                cid: "top:gapminder",
                x_sigCid: "fertility_rate",
                y_sigCid: "life_expectancy",
                colorDiscrete_sigCid: "region",
                dotSize_sigCid: "population",
                tsSigCid: "year",
                label_sigCid: "country",
                label: null,
                x_label: null,
                y_label: null,
                color_label: null,
                dotSize_label: "Population",
                dotGlobalShape: "none"
            }]
        };

        return (
            <TimeContext initialIntervalSpec={new IntervalSpec("1953-10-30", "1966-04-01", null, null)}>
                <TimeRangeSelector/>
                <BubblePlot
                    config={cnf}
                    height={600}
                    margin={{ left: 25, right: 5, top: 5, bottom: 20 }}
                    maxDotCount={200}
                    maxDotSize={30}
                    minDotSizeValue={0}
                    colorValues={["europe", "americas", "africa", "asia"]}
                    xMin={0.5}
                    xMax={8.7}
                    yMin={20}
                    yMax={87}
                    withToolbar={false}
                    zoomLevelMax={3}
                    highlightDotSize={1}
                />
            </TimeContext>
        );
    }
}