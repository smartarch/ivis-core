'use strict';

import React, { Component } from "react";
import { withComponentMixins } from "../../lib/decorator-helpers";
import { withTranslation } from "../../lib/i18n";
import { Panel } from "../../lib/panel";
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

    async getChartConfig(modelId) {
        const prediction = this.props.prediction;
        const outputConfig = (await axios.get(getUrl(`rest/predictions-output-config/${modelId}`))).data;
        const signalSet = (await axios.get(getUrl(`rest/signal-sets/${prediction.set}`))).data;
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

@withComponentMixins([
    withTranslation,
])
class ARIMAModelInfoTable extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
        }
    }

    async componentDidMount() {
        try {
            const jobStateRes = await axios.get(getUrl(`rest/predictions-arima-job-state/${this.props.predictionId}`));
            const jobState = jobStateRes.data;

            this.setState({
                jobState,
                isLoading: false,
            });
        } catch (error) {
            this.setState({
                error,
                isLoading: false,
            });
        }

        this.setState();
    }

    render() {
        const t = this.props.t;

        if (this.state.isLoading) {
            return (
                <div>Loading...</div>
            );
        } else {
            const jobState = this.state.jobState;
            const modelState = jobState.state;

            // jobState.modelInfo might not exist in which case the model is
            // not yet trained
            let order = '';
            let seasonalOrder = '';

            if ('model_info' in jobState) {
                order = jobState.model_info.order;
                seasonalOrder = jobState.model_info.seasonal_order;
            }

            const states = {
                'unknown': t('Unknown'),
                'training': t('Training'),
                'active': t('Active'),
                'degraded': t('Degraded'),
            };

            let orderDesc = '';
            if (order) {
                orderDesc = `ARIMA(${order[0]},${order[1]},${order[2]})`;
            }

            if (seasonalOrder && seasonalOrder[0] || seasonalOrder[1] || seasonalOrder[2]) {
                orderDesc = `SARIMA(${order[0]},${order[1]},${order[2]})(${seasonalOrder[0]},${seasonalOrder[1]},${seasonalOrder[2]})${seasonalOrder[3]}`;
            }

            return (
                <table className={'table table-striped table-bordered'}>
                    <thead>
                        <tr>
                            <th colspan="2">{'Model info'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th>{t('Current state')}:</th>
                            <td>{states[modelState]}</td>
                        </tr>
                        {orderDesc &&
                            <tr>
                                <th>{t('Order')}:</th>
                                <td>{orderDesc}</td>
                            </tr>
                        }
                    </tbody>
                </table>
            );
        }
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
        let requestBody = {
            from: from,
            to: to,
            sourceSetCid: this.props.sourceSetCid,
            predSetCid: this.props.predSetCid,
            signalCid: this.props.signalCid,
        };
        let response = await axios.post(getUrl(`rest/predictions-rmse/`), requestBody);

        return response.data;
    }

    @withAsyncErrorHandler
    async fetchData() {
        const abs = await this.getIntervalAbsolute();

        const from = abs.from.toISOString();
        const to = abs.to.toISOString();

        const results = await this.getRMSE(from, to);

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
                            <th scope="row">{t('Evaluation range')}:</th>
                            <td>{t('{{from}} to {{to}}', { from: this.state.realFrom, to: this.state.realTo })}</td>
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

        // leave some space on the right side of the graph
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
        // ARIMA always has a single main signal
        const signalCid = this.props.prediction.signals['main'][0].cid;
        const from = this.state.first;
        const to = this.state.last;
        return (
            <Panel
                title={t('ARIMA model overview')}
                key={from} // Panel will be refreshed after data is fetched
            >
                <Toolbar>
                    <LinkButton
                        to={`/settings/signal-sets/${prediction.set}/predictions/${prediction.type}/${prediction.id}/delete`}
                        className="btn-danger"
                        icon="trash-alt"
                        label={t('Delete')} />
                </Toolbar>
                <ARIMAModelInfoTable predictionId={prediction.id} />
                <TimeContext
                    initialIntervalSpec={new IntervalSpec(from, to, null, moment.duration(1, 'd'))}
                >
                    <PredicionsLineChart
                        prediction={prediction}
                        ahead={this.state.ahead}
                    />
                    <AheadSelector
                        aheadCount={prediction.ahead_count}
                        onAheadChange={this.onAheadChange.bind(this)}
                    />
                    <TimeRangeSelector />
                    {signalCid && <RMSETable
                        ahead={this.state.ahead}
                        sourceSetCid={this.state.sourceSetCid}
                        predSetCid={this.state.predSetCid}
                        signalCid={signalCid}
                    />
                    }
                </TimeContext>
            </Panel>
        );
    }
}