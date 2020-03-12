'use strict';

import React, {Component} from "react";
import {ScatterPlot, withPanelConfig} from "ivis";
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
                left: 20, right: 5, top: 5, bottom: 20
            },
            dotSize: 4,
            maxDotCount: 25
        };

        const rows = [];
        for (const [index, sig1] of this.props.config.sigCids.entries()) {
            const row = [];
            for (const sig2 of this.props.config.sigCids) {
                if (sig1 !== sig2)
                    row.push(<ScatterPlot config={{signalSets: [{cid: this.props.config.sigSetCid, X_sigCid: sig1, Y_sigCid: sig2}]}}  {...scatterPlotProps} />);
                else
                    row.push(<div className={styles.label}>{this.props.config.labels[index]}</div>);
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
            labels: config.signals.map(x => x.label)
        };

        return (<Correlogram
            config={cnf}
            height={400}
            margin={{left: 0, right: 0, top: 0, bottom: 0}}
        />);
    }
}