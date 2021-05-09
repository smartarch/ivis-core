'use strict';

import React, { Component } from "react";
import { withComponentMixins } from "../../lib/decorator-helpers";
import { withTranslation } from "../../lib/i18n";
import { Panel } from "../../lib/panel";
import { Table } from "../../lib/table";
import { Toolbar, LinkButton, requiresAuthenticatedUser } from "../../lib/page";
import axios from '../../lib/axios';
import { getUrl } from "../../lib/urls";
import { LineChart } from "../../ivis/LineChart";
import { TimeContext } from "../../ivis/TimeContext";
import { TimeRangeSelector } from "../../ivis/TimeRangeSelector";
import { withAsyncErrorHandler, withErrorHandling } from '../../lib/error-handling';
import { IntervalSpec } from "../../ivis/TimeInterval";
import { intervalAccessMixin } from "../../ivis/TimeContext";
import moment from "moment";

@withComponentMixins([
    withTranslation,
])
class PredicionsLineChart extends Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    async getModel(modelId) {
        let x = await axios.get(getUrl(`rest/predictions/${modelId}`));
        return await x.data;
    }

    async getOutputConfig(modelId) {
        let x = await axios.get(getUrl(`rest/predictions-output-config/${modelId}`));
        return await x.data;
    }

    async getPredictionInfo(modelId) {
        const prediction = (await axios.get(getUrl(`rest/predictions/${modelId}`))).data;
        const outputConfig = (await axios.get(getUrl(`rest/predictions-output-config/${modelId}`))).data;
        const signalSet = (await axios.get(getUrl(`rest/signal-sets/${prediction.set}`))).data;
    }

    async getChartConfig(modelId) {
        const prediction = this.props.prediction;
        const outputConfig = (await axios.get(getUrl(`rest/predictions-output-config/${modelId}`))).data;
        const signalSet = (await axios.get(getUrl(`rest/signal-sets/${prediction.set}`))).data;
        const signalCid = outputConfig.signals[1].cid;

        return {
            signalSets: [
                {
                    cid: outputConfig.ahead_sets[this.props.ahead],
                    signals: [
                        {
                            label: `${this.props.ahead}ahead`,
                            color: '#00ff00',
                            cid: signalCid,
                            enabled: true
                        }
                    ],
                    tsSigCid: 'ts'
                },
                {
                    cid: outputConfig.future_set,
                    signals: [
                        {
                            label: 'future',
                            color: '#ff0000',
                            cid: signalCid,
                            enabled: true
                        }
                    ],
                    tsSigCid: 'ts'
                },
                {
                    cid: signalSet.cid,
                    signals: [
                        {
                            label: 'original',
                            color: '#000000',
                            cid: signalCid,
                            enabled: true
                        }
                    ],
                    tsSigCid: 'ts'
                }
            ]
        }
    }

    fetchData() {
        const predictionId = this.props.prediction.id;
        // this.getModel(predictionId).then(x => { console.log(x) });
        // this.getOutputConfig(predictionId).then(x => { });
        this.getChartConfig(predictionId).then(config => this.setState({ config: config, ready: true }));
    }

    componentDidMount() {
        this.fetchData();
    }

    componentDidUpdate(prevProps) {
        if (this.props.ahead !== prevProps.ahead) {
            this.getChartConfig(this.props.prediction.id).then(config => this.setState({ config: config, ready: true }));
        }
    }

    render() {
        const t = this.props.t;
        const signalCid = '';

        const config = this.state.config;

        return (
            <div>
                {config &&
                        /* We need the key here so that the LineChart is recreated
                        and not only updated. During the update, there is a
                        small time window when having the cursor inside the chart
                        can crash the client. */
                    <LineChart
                        key={config.signalSets[0].cid} config={config}
                    />
                }
            </div>
        );
    }
}

class SignalSelector extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="input-group mb-3">
                <label className="col-sm-2 col-form-label">Signal:</label>
                <select className="custom-select">
                    <option value="1">Main signal</option>
                </select>
            </div>
        );
    }
}

class AheadSelector extends Component {
    constructor(props) {
        super(props);
        this.state = { value: '1' };
    }

    genOptions(aheadCount) {
        const options = [];
        for (let i = 1; i <= aheadCount; i++) {
            const option = <option value={i} key={i}>{`Ahead ${i}`}</option>;
            options.push(option)
        }
        return options;
    }

    handleChange(event) {
        this.setState({ value: event.target.value });
        this.props.onAheadChange(event.target.value);
    }

    render() {
        const signals = this.props.signals;
        const aheadCount = this.props.aheadCount;
        return (
            <div className="input-group mb-3">
                <label className="col-sm-2 col-form-label">Ahead:</label>
                <select className="custom-select" onChange={this.handleChange.bind(this)}>
                    {this.genOptions(aheadCount)}
                </select>
            </div>
        );
    }
}

@withComponentMixins([
    withTranslation,
    intervalAccessMixin()
])
class RMSETable extends Component {
    constructor(props) {
        super(props);

        this.state = {
            min: '0',
            max: 'infinity',
            realFrom: '0',
            realTo: '1000000',
        }
    }

    async getRMSE(from, to) {
        let testBody = {
            from: from,
            to: to,
            sourceSetCid: this.props.sourceSetCid,
            predSetCid: this.props.predSetCid,
        };
        let test = await axios.post(getUrl(`rest/predictions-rmse/`), testBody);

        return test.data;
    }

    @withAsyncErrorHandler
    async fetchData() {
        const abs = await this.getIntervalAbsolute();

        const from = abs.from.toISOString();
        const to = abs.to.toISOString();

        const results = await this.getRMSE(from, to);

        const rmseResult = '';
        this.setState({
            min: results.min,
            max: results.max,
            realFrom: from, // TODO
            realTo: results.to,
        });
    }

    componentDidMount() {
        this.fetchData();
    }

    componentDidUpdate(prevProps) {
        const intervalChanged = this.getIntervalAbsolute(prevProps) !== this.getIntervalAbsolute();
        const aheadChanged = prevProps.ahead !== this.props.ahead;

        if (intervalChanged || aheadChanged) {
            this.fetchData();
        }
    }

    render() {
        const t = this.props.t;

        const ahead = this.props.ahead;

        return (
            <div>
                <table className={'table table-striped table-bordered'}>
                    <tbody>
                        <tr>
                            <th scope="row">Target:</th>
                            <td>{ahead} ahead</td>
                        </tr>
                        <tr>
                            <th scope="row">Range:</th>
                            <td>{this.state.realFrom} - {this.state.realTo}</td>
                        </tr>
                        <tr>
                            <th scope="row">RMSE min:</th>
                            <td>{this.state.min}</td>
                        </tr>
                        <tr>
                            <th scope="row">RMSE max:</th>
                            <td>{this.state.max}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    //withPageHelpers,
    requiresAuthenticatedUser
])
export default class ArimaOverview extends Component {
    constructor(props) {
        super(props);

        this.state = {
            ahead: '1'
        };
    }

    onAheadChange(value) {
        this.setState({ ahead: value });
    }

    getFirstTs() {
        return 'now-65y';
    }

    getLastTs() {
        return 'now-45y';
    }

    async getSetById(setId) {
        const set = (await axios.get(getUrl(`rest/signal-sets/${setId}`))).data;;

        return set.cid;
    }

    async getPredSetOuputConfig(predictionId) {
        let x = await axios.get(getUrl(`rest/predictions-output-config/${predictionId}`));
        return await x.data;
    }

    async getPredSetCid() {
        const config = await this.getPredSetOuputConfig(this.props.prediction.id);
        return config.ahead_sets[this.state.ahead];
    }

    async fetchData() {
        const sourceSetCid = await this.getSetById(this.props.prediction.set);
        const predSetCid = await this.getPredSetCid();

        this.setState({
            sourceSetCid,
            predSetCid,
        });
    }

    componentDidMount() {
        this.fetchData();
    }

    render() {
        const t = this.props.t;
        const predictionId = parseInt(this.props.prediction.id);
        const prediction = this.props.prediction;
        console.log(`prediction: ${this.props.prediction}`);
        const from = this.getFirstTs();
        const to = this.getLastTs();
        return (
            <Panel title={t('ARIMA model overview')}>
                {/*
                <Toolbar>
                    <LinkButton to={`/settings/`} className="btn-primary"
                        icon="plus"
                        label={t('Edit')} />
                </Toolbar>*/}
                <TimeContext
                    initialIntervalSpec={new IntervalSpec(from, to, null, moment.duration(1, 'd'))}
                >
                    <PredicionsLineChart
                        predictionId={predictionId}
                        prediction={prediction}
                        signalCid={"TBD"}
                        ahead={this.state.ahead}
                    />
                    {/*<SignalSelector />*/}
                    <AheadSelector aheadCount={prediction.ahead_count} onAheadChange={this.onAheadChange.bind(this)} />
                    <TimeRangeSelector />
                    <RMSETable ahead={this.state.ahead} sourceSetCid={this.state.sourceSetCid} predSetCid={this.state.predSetCid} />
                </TimeContext>
            </Panel>
        );
    }
}