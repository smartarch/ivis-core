'use strict';

import React, { Component } from "react";
import { tableRestActionDialogInit, tableRestActionDialogRender } from "../../lib/modals";
import { withComponentMixins } from "../../lib/decorator-helpers";
import { withTranslation } from "../../lib/i18n";
import { Panel } from "../../lib/panel";
import { Toolbar, requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import { withErrorHandling } from "../../lib/error-handling";
import {
    Form,
    withForm,
    TableSelect,
    TableSelectMode,
} from "../../lib/form";
import { LineChart } from "../../ivis/LineChart";
import { intervalAccessMixin, TimeContext } from "../../ivis/TimeContext";
import { TimeRangeSelector } from "../../ivis/TimeRangeSelector";
import { IntervalSpec } from "../../ivis/TimeInterval";
import moment from "moment";
import axios from '../../lib/axios';
import { getUrl } from "../../lib/urls";

@withComponentMixins([
    withTranslation,
    intervalAccessMixin()
])
class PredictionsEvaluationTableMulti extends Component {
    constructor(props) {
        super(props);

        this.state = {
            modelInfos: [],
            evalFrom: '',
            evalTo: '',
        };
    }

    async fetchPredictionRMSE(signalCid, outputConfig, ahead, from, to) {
        const sourceSetCid = this.props.sigSetCid;
        const predSetCid = outputConfig.ahead_sets[ahead];

        return await this.fetchRMSE(signalCid, sourceSetCid, predSetCid, from, to);
    }

    async fetchRMSE(signalCid, sourceSetCid, predSetCid, from, to) {
        const request = {
            signalCid,
            from,
            to,
            sourceSetCid,
            predSetCid,
        };

        const rmse = (await axios.post(getUrl(`rest/predictions-rmse/`), request)).data;

        return rmse;
    }

    async fetchSigSetBoundaries(sigSetCid, signalCid, from = null, to = null) {
        // FIXME: Handle signal!
        const signalSet = (await axios.get(getUrl(`rest/signal-sets-by-cid/${sigSetCid}`))).data;
        const boundaries = (await axios.get(getUrl(`rest/predictions-set-boundaries/${signalSet.id}`))).data;

        return boundaries;

    }

    async fetchModelInfo(modelId) {
        const prediction = (await axios.get(getUrl(`rest/predictions/${modelId}`))).data;
        const outputConfig = (await axios.get(getUrl(`rest/predictions-output-config/${modelId}`))).data;

        const absInterval = await this.getIntervalAbsolute(); // from IntevalAccessMixin
        const from = absInterval.from.toISOString();
        const to = absInterval.to.toISOString();

        const rmse = await this.fetchPredictionRMSE(this.props.signalCid, outputConfig, this.props.ahead, from, to);
        console.log(`rmse: ${JSON.stringify(rmse, null, 4)}`);
        return {
            name: prediction.name,
            type: prediction.type,
            aheadCount: this.props.ahead,
            period: rmse.interval,
            minMSE: rmse.minMSE,
            maxMSE: rmse.maxMSE,
            minMAE: rmse.minMAE,
            maxMAE: rmse.maxMAE,
            from: rmse.from,
            to: rmse.to
        };
    }

    async fetchData() {
        const boundaries = [];
        for (let modelId of this.props.models) {
            //const boundary = await this.fetchSigSetBoundariesoundaries()
            //boundaries.push();
        }

        const modelInfos = {};
        for (let modelId of this.props.models) {
            modelInfos[modelId] = await this.fetchModelInfo(modelId);
        }

        this.setState({
            modelInfos
        });
    }

    componentDidMount() {
        this.fetchData();
    }

    componentDidUpdate(prevProps) {
        const intervalChanged = this.getIntervalAbsolute(prevProps) !== this.getIntervalAbsolute();
        const modelsChanged = this.props.models !== prevProps.models;
        // do not fetch data if no importatnt props changed
        if (intervalChanged || modelsChanged) {
            this.fetchData();
        }
    }

    render() {
        const t = this.props.t;
        const rows = [];

        const loading = t('Loading...');

        const evalFrom = this.state.evalFrom;
        const evalTo = this.state.evalTo;

        for (let modelId of this.props.models) {
            const modelInfo = this.state.modelInfos[modelId] || {};
            const row = (
                <tr>
                    <td>{modelInfo.name || loading}</td>
                    <td>{modelInfo.type || loading}</td>
                    <td>{modelInfo.aheadCount || "(stub)1"}</td>
                    <td>{modelInfo.period || "(stub)1d"}</td>
                    <td>{modelInfo.minMSE || "(stub)0"}</td>
                    <td>{modelInfo.maxMSE || "(stub)infinity"}</td>
                    <td>{modelInfo.minMAE || "(stub)0"}</td>
                    <td>{modelInfo.maxMAE || "(stub)infinity"}</td>
                </tr>
            );
            rows.push(row);
        }

        // TODO: Replace this with accurate value
        let fakeEvalFrom = ' '; // first printable char
        let fakeEvalTo = 'z'; // printable char after numbers

        for (const [key, value] of Object.entries(this.state.modelInfos) || {}) {
            if (value.from > fakeEvalFrom) {
                fakeEvalFrom = value.from;
            }

            if (value.to < fakeEvalTo) {
                fakeEvalTo = value.to;
            }
        }
        if (fakeEvalFrom === ' ') {
            fakeEvalFrom = this.state.from;
        }
        if (fakeEvalTo === 'z') {
            fakeEvalTo = this.state.to;
        }
        // TODO: END

        return (
            <div>
                <table className={'table table-striped table-bordered'}>
                    <thead>
                        <th scope="column">Model</th>
                        <th scope="column">Type</th>
                        <th scope="column">Ahead</th>
                        <th scope="column">Bucket interval</th>
                        <th scope="column">MSE min</th>
                        <th scope="column">MSE max</th>
                        <th scope="column">MAE min</th>
                        <th scope="column">MAE max</th>
                    </thead>
                    <tbody>
                        {rows}
                    </tbody>
                </table>
                <table>
                    <tbody className={'table table-striped table-bordered'}>
                        <tr>
                            <th scope="row">Evaluation Time Range:</th>
                            <td>{`${fakeEvalFrom || evalFrom} to ${fakeEvalTo || evalTo}`}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

class PredictionsGraph extends Component {
    constructor(props) {
        super(props);
        this.state = {
        };
    }

    async getPredOuputConfig(predictionId) {
        const x = await axios.get(getUrl(`rest/predictions-output-config/${predictionId}`));
        return await x.data;
    }

    async getModel(modelId) {
        const prediction = await axios.get(getUrl(`rest/predictions/${modelId}`));
        const outputConfig = await this.getPredOuputConfig(prediction.data.id);
        prediction.data.outputConfig = outputConfig;
        return await prediction.data;
    }

    async fetchData() {
        const models = await this.props.models.map(this.getModel.bind(this));

        return await models;
    }

    async getConfig() {
        const colors = ["rgb(255,0,0)", "rgb(0,255,0)", "rgb(0,0,255)"]
        let config = {
            signalSets: [
                {
                    cid: this.props.sigSetCid,
                    signals: [
                        {
                            label: "original data",
                            color: "#220000",
                            cid: this.props.signalCid,
                            enabled: true,
                        }
                    ],
                    tsSigCid: this.props.tsCid,
                },
            ]
        };

        let models = await this.fetchData();
        // TODO: Check all models share the same signal
        // TODO: Get models' signal sets

        for (let i = 0; i < models.length; i++) {
            let model = await models[i];
            config.signalSets.push({
                cid: model.outputConfig.future_set, // FIXME
                signals: [
                    {
                        label: model.name + "_futr", // TODO
                        color: colors[i % colors.length], // TODO
                        cid: this.props.signalCid,
                        enabled: true,
                    }
                ],
                tsSigCid: 'ts',
            });
            config.signalSets.push({
                cid: model.outputConfig.ahead_sets['1'], // FIXME
                signals: [
                    {
                        label: model.name + "_hist", // TODO
                        color: colors[i % colors.length], // TODO
                        cid: this.props.signalCid,
                        enabled: true,
                    }
                ],
                tsSigCid: 'ts',
            });
        }

        // TODO: Get common first ts - for now hardcoded
        return config;
    }

    componentDidMount() {
        this.getConfig().then(config => this.setState({ config: config, ready: true }));
    }

    componentDidUpdate(prevProps) {
        if (this.props.models !== prevProps.models) {
            this.getConfig().then(config => this.setState({ config: config }));
        }
    }

    render() {
        const config = this.state.config;

        return (
            <div>
                { config && <LineChart config={config} />}
            </div>
        );
    }
}

function filterBySignal(element, index, signal) {
    if (element[index] == signal)
        return true;
    return false;
}

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class PredictionsCompare extends Component {
    constructor(props) {
        super(props);

        this.state = {
            first: "1900-01-01", // initial time interval, will be replaced
            last: "2099-01-01",  // when we get more information about the time series
        };

        this.initForm({
            onChange: {
                signal: this.onSignalChange.bind(this),
                models: this.onModelsChange.bind(this),
            }
        });
        tableRestActionDialogInit(this);
    }

    componentDidMount() {
        this.populateFormValues({
            name: '',
        });
        this.fetchBoundaries(this.props.signalSet.id);
    }

    onSignalChange(state, key, oldValue, newValue) {
        if (oldValue != newValue) {
            //this.setState({ signal: newValue });
            state.signal = newValue;
        }
    }

    onModelsChange(state, key, oldValue, newValue) {
        if (oldValue != newValue) {
            //this.setState({ models: newValue });
            //console.log("state");
            //console.log(this.state);
            //console.log(`onModelsChange(${state}, ${key}, ${oldValue}, ${newValue})`);
            state.models = newValue;
        }
    }

    /** Fetch first and last timestamps of the source signal set so that we can
     *  set the initial IntervalSpec in a proper way.
     *
     * @param signalSetId the source signal set
     */
    async fetchBoundaries(signalSetId) {
        const x = (await axios.get(getUrl(`rest/predictions-set-boundaries/${signalSetId}`))).data;

        let offset = moment(x.last).diff(moment(x.first)) / 5;
        let last = moment(x.last).add(offset);

        this.setState({
            first: x.first,
            last: last.toISOString()
        });
    }

    render() {
        const t = this.props.t;
        const sigSetId = this.props.signalSet.id;
        const sigSetCid = this.props.signalSet.cid;
        const columns = [
            { data: 1, title: t('Id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            //{ data: 4, title: t('Type'), render: data => signalTypes[data] },
        ];

        const modelsColumns = [
            { data: 0, title: t('Model id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Type') },
            { data: 4, title: t('Predicted signal') },
            //{ data: 4, title: t('Type'), render: data => signalTypes[data] },
        ];
        return (
            <Panel
                title={t('Compare models')}
            >
                {tableRestActionDialogRender(this)}
                <Toolbar>
                    {/*<LinkButton to={`/settings/signal-sets/${sigSetId}/predictions/create-arima`} className="btn-primary"
                        icon="plus"
        label={t('Add ARIMA model')} />*/}
                </Toolbar>

                {/*<Table ref={node => this.table = node} withHeader
                    dataUrl={`rest/signal-set-predictions-table/${sigSetId}`} columns={columns} />*/}
                {/*
                  * 1. Select signal
                  * 2. Select models using this signal
                  * 3. Select appropriate timespan
                  * 4. Show graph of original data and these models
                  * 5. Calculate their performance on the timespan
                */}
                <Form stateOwner={this} >
                    <TableSelect
                        key="signal"
                        id="signal"
                        label={t("Target signal")}
                        withHeader
                        dropdown
                        selectMode={TableSelectMode.SINGLE}
                        selectionLabelIndex={2}
                        selectionKeyIndex={1}
                        dataUrl={`rest/signals-table-by-cid/${this.props.signalSet.cid}`}
                        columns={columns}
                    />

                    {this.state.signal && <TableSelect
                        /* We change the key here so that the table refreshes */
                        key={`models + ${this.state.signal}`}
                        id="models"
                        label={t("Models to compare")}
                        withHeader
                        dropdown
                        selectMode={TableSelectMode.MULTI}
                        selectionLabelIndex={2}
                        selectionKeyIndex={0}
                        dataUrl={`rest/signal-set-predictions-table/${sigSetId}`}
                        //dataFilter={x => x.filter(y => filterBySignal(y, 4, this.state.signal))}
                        columns={modelsColumns}
                    />}

                </Form>
                <TimeContext
                    key={`${this.state.first}-${this.state.last}`} // refresh the time context after we have more info and can set sane defaults
                    initialIntervalSpec={new IntervalSpec(this.state.first, this.state.last, null, moment.duration(1, 'd'))}
                >
                    <TimeRangeSelector />
                    {this.state.models && <PredictionsGraph
                        //sigSetId={sigSetId}
                        key={this.state.models.length}
                        sigSetCid={sigSetCid}
                        tsCid="ts"
                        signalCid={this.state.signal}
                        models={this.state.models}
                    />
                    }
                    {this.state.models && <PredictionsEvaluationTableMulti
                        ahead={1}
                        sigSetCid={sigSetCid}
                        tsCid="ts"
                        signalCid={this.state.signal}
                        models={this.state.models}
                    />
                    }
                </TimeContext>
            </Panel>
        );
    }
}