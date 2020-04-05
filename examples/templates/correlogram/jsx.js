'use strict';

import React, {Component} from "react";
import {ScatterPlot, withPanelConfig, TimeContext, IntervalSpec, TimeRangeSelector} from "ivis";
import styles from './styles.scss';

class Correlogram extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const scatterPlotProps = {
            withTooltip: false,
            withZoom: false,
            withRegressionCoefficients: false,
            withToolbar: false,
            withBrush: false,
            height: this.props.height / this.props.config.sigCids.length,
            margin: {
                left: 55, right: 3, top: 5, bottom: 20
            },
            dotSize: 3,
            maxDotCount: 200,
            xAxisTicksCount: 8
        };

        const rows = [];
        for (const [index, sig1] of this.props.config.sigCids.entries()) {
            const row = [];
            for (const sig2 of this.props.config.sigCids) {
                if (sig1 !== sig2) {
                    const cnf = {
                        signalSets: [{
                            cid: this.props.config.sigSetCid,
                            x_sigCid: sig2,
                            y_sigCid: sig1,
                            dotGlobalShape: "none"
                        }]
                    };
                    if (this.props.config.color_sigCid)
                        cnf.signalSets[0].colorDiscrete_sigCid = this.props.config.color_sigCid;
                    if (this.props.config.ts_signal)
                        cnf.signalSets[0].tsSigCid = this.props.config.ts_signal;
                    row.push(<ScatterPlot config={cnf}  {...scatterPlotProps} />);
                }
                else
                    row.push(<div className={styles.label} style={{marginLeft: scatterPlotProps.margin.left, marginRight: scatterPlotProps.margin.right, marginTop: scatterPlotProps.margin.top, marginBottom: scatterPlotProps.margin.bottom}}>
                        {this.props.config.labels[index]}
                    </div>);
            }
            rows.push(row);
        }

        return (<table><tbody>
        {rows.map((r, i) => <tr key={i}>{r.map((sp, j) => <td key={j}>{sp}</td>)}</tr>)}
        </tbody></table>);
    }
}

@withPanelConfig
export default class TestCorrelogram extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const config = this.getPanelConfig();

        if (config.signals.every(x => x === undefined))
            return (<div>No signals selected in panel configuration.</div>);

        const cnf = {
            sigSetCid: config.sigSet,
            sigCids: config.signals.map(x => x.sigCid),
            labels: config.signals.map(x => x.label),
            color_sigCid: config.color_signal,
            ts_signal: config.ts_signal
        };

        return (
            <TimeContext initialIntervalSpec={new IntervalSpec("2003-10-30", "2016-04-01", null, null)}>
                <Correlogram
                    config={cnf}
                    height={700}
                    margin={{left: 0, right: 0, top: 0, bottom: 0}}
                />
                {config.ts_signal && <TimeRangeSelector/>}
            </TimeContext>);
    }
}