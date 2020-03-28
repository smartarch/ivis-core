'use strict';

import React, {Component} from "react";
import {HeatmapChart, withPanelConfig, TimeContext, IntervalSpec, TimeRangeSelector} from "ivis";

@withPanelConfig
export default class HeatmapTemplate extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const config = this.getPanelConfig();
        const props = JSON.parse(config.props);
        
        const heatmap_config = {
            sigSetCid: config.sigSetCid, 
            x_sigCid: config.x_sigCid, 
            y_sigCid: config.y_sigCid,
            tsSigCid: config.tsSigCid,
            colors: config.colors.map(c => c.color) 
        };

        return (
            <TimeContext initialIntervalSpec={new IntervalSpec("2003-10-30", "2016-04-01", null, null)}>
                <TimeRangeSelector/>
                <HeatmapChart config={heatmap_config}
                              {...props}
                />
            </TimeContext>
        );
    }
}