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
        let prediction = await axios.get(getUrl(`rest/predictions/${modelId}`));
        return await prediction.data;
    }

    async getOutputConfig(modelId) {
        let outputCofig = await axios.get(getUrl(`rest/predictions-output-config/${modelId}`));
        return await outputCofig.data;
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
        console.log(`outputConfig.signals ${outputConfig.signals}`);
        const signalCid = outputConfig.signals['main'][0].cid;

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
    withErrorHandling,
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
            min: results.minMAE,
            max: results.maxMAE,
            minMSE: results.minMSE,
            maxMSE: results.maxMSE,
            interval: results.interval,
            realFrom: from,
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
                            <th scope="row">{t('Target')}:</th>
                            <td>{ahead} ahead</td>
                        </tr>
                        <tr>
                            <th scope="row">{t('Range')}:</th>
                            <td>{this.state.realFrom} - {this.state.realTo}</td>
                        </tr>
                        <tr>
                            <th scope="row">{t('MAE min')}:</th>
                            <td>{this.state.min}</td>
                        </tr>
                        <tr>
                            <th scope="row">{t('MAE max')}:</th>
                            <td>{this.state.max}</td>
                        </tr>
                        <tr>
                            <th scope="row">{t('RMSE min')}:</th>
                            <td>{Math.sqrt(this.state.minMSE)}</td>
                        </tr>
                        <tr>
                            <th scope="row">{t('RMSE max')}:</th>
                            <td>{Math.sqrt(this.state.maxMSE)}</td>
                        </tr>
                        <tr>
                            <th scope="row">{t('Aggregation interval')}:</th>
                            <td>{this.state.interval}</td>
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
            ahead: '1',
            // original time interval, will be replaced after component is mounted
            first: 'now-1000y',
            last: 'now-45y'
        };
    }

    async onAheadChange(value) {
        const predSigSetCid = await this.getPredSetCid(value);
        this.setState({ ahead: value, predSetCid: predSigSetCid });
    }

    async getSetById(setId) {
        const set = (await axios.get(getUrl(`rest/signal-sets/${setId}`))).data;;

        return set.cid;
    }

    async getPredSetOuputConfig(predictionId) {
        let x = await axios.get(getUrl(`rest/predictions-output-config/${predictionId}`));
        return await x.data;
    }

    async getPredSetCid(ahead) {
        const config = await this.getPredSetOuputConfig(this.props.prediction.id);
        return config.ahead_sets[ahead];
    }

    async fetchData() {
        const sourceSetCid = await this.getSetById(this.props.prediction.set);
        const predSetCid = await this.getPredSetCid(this.state.ahead);

        this.setState({
            sourceSetCid,
            predSetCid,
        });
    }

    /** Fetch first and last timestamps of the source signal set so that we can
     *  set the initial IntervalSpec in a proper way.
     *
     * @param signalSetId the source signal set
     */
    async fetchBoundaries(signalSetId) {
        const x = (await axios.get(getUrl(`rest/predictions-set-boundaries/${signalSetId}`))).data;

        console.log(`x: ${JSON.stringify(await x, null, 4)}`);

        let offset = moment(x.last).diff(moment(x.first)) / 5;
        let last = moment(x.last).add(offset);

        let y = {
            first: x.first,
            last: last.toISOString()
        };

        this.setState(y);
    }

    componentDidMount() {
        this.fetchData();
        this.fetchBoundaries(this.props.prediction.set);
    }

    componentWillUnmount() {
    }

    render() {
        const t = this.props.t;
        const prediction = this.props.prediction;
        const from = this.state.first;
        const to = this.state.last;
        return (
            <Panel title={t('ARIMA model overview')}
                key={from} // Panel will be refreshed after data is fetched
            >
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
                        prediction={prediction}
                        ahead={this.state.ahead}
                    />
                    {/*<SignalSelector />*/}
                    <AheadSelector
                        aheadCount={prediction.ahead_count}
                        onAheadChange={this.onAheadChange.bind(this)}
                    />
                    <TimeRangeSelector />
                    <RMSETable
                        ahead={this.state.ahead}
                        sourceSetCid={this.state.sourceSetCid}
                        predSetCid={this.state.predSetCid}
                    />
                </TimeContext>
            </Panel>
        );
    }
}