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
import { fetchPrediction, fetchPredictionOutputConfig, fetchSignalSetBoundariesByCid } from "../../lib/predictions";
import { getUrl } from "../../lib/urls";
import {PredictionTypes} from "../../../../shared/predictions";
import {NeuralNetworkArchitecturesSpecs, NeuralNetworksCommonParams} from "../../../../shared/predictions-nn";
import * as d3Format from "d3-format";

/* Colors are adapted from matplotlib's and seaborn's tab20 scheme
    (see: https://seaborn.pydata.org/tutorial/color_palettes.html)
   Generally speaking, for a given index i, the future color is a less saturated variant of the ahead color.
   Colors will be reused and cycled if more than 10 models are plotted. */
const colorsFuture = [
    'rgb(31,119,180)',
    'rgb(255,127,14)',
    'rgb(44,160,44)',
    'rgb(214,39,40)',
    'rgb(148,103,189)',
    'rgb(140,86,75)',
    'rgb(227,119,194)',
    'rgb(127,127,127)',
    'rgb(188,189,34)',
    'rgb(23,190,207)'
];
const colorsAhead = [
    'rgb(174,199,232)',
    'rgb(255,187,120)',
    'rgb(152,223,138)',
    'rgb(255,152,150)',
    'rgb(197,176,213)',
    'rgb(196,156,148)',
    'rgb(247,182,210)',
    'rgb(199,199,199)',
    'rgb(219,219,141)',
    'rgb(158,218,229)'
];

@withComponentMixins([
    withTranslation,
    intervalAccessMixin()
])
class PredictionsEvaluationTableMulti extends Component {
    constructor(props) {
        super(props);

        this.state = {
            modelInfos: [],  // information about the model including its performance
            evalFrom: '',
            evalTo: '',
        };
    }

    async fetchPredictionRMSE(signalCid, outputConfig, ahead, from, to, modelId) {
        const sourceSetCid = this.props.sigSetCid;
        const predSetCid = outputConfig.ahead_sets[ahead];

        return await this.fetchSigSetRMSE(signalCid, sourceSetCid, predSetCid, from, to, modelId);
    }

    async fetchSigSetRMSE(signalCid, sourceSetCid, predSetCid, from, to, modelId) {
        const request = {
            signalCid,
            from,
            to,
            sourceSetCid,
            predSetCid,
            predictionId: modelId,
        };

        const rmse = (await axios.post(getUrl(`rest/predictions-rmse/`), request)).data;

        return rmse;
    }

    async fetchModelInfo(modelId, from, to) {
        const prediction = await fetchPrediction(modelId);
        const outputConfig = await fetchPredictionOutputConfig(modelId);

        const rmse = await this.fetchPredictionRMSE(this.props.signalCid, outputConfig, this.props.ahead, from, to, modelId);
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
        // get the interval which to evaluate on
        const absInterval = await this.getIntervalAbsolute(); // from IntervalAccessMixin
        const origFrom = absInterval.from.toISOString();
        const origTo = absInterval.to.toISOString();

        const froms = [origFrom];
        const tos = [origTo];

        // the segment can be larger than the common interval of all the models
        // so we have to find the largest subsegment
        for (let modelId of this.props.models) {
            const outputConfig = await fetchPredictionOutputConfig(modelId);
            const ahead = this.props.ahead;
            const sigSetCid = outputConfig.ahead_sets[`${ahead}`];

            const bounds = await fetchSignalSetBoundariesByCid(sigSetCid);
            froms.push(bounds.first);
            tos.push(bounds.last);
        }

        // dates are stored in ISO8601 so we can sort them lexicographically
        froms.sort();
        tos.sort();

        // we are looking for the largest common segment, so we select the
        // last from value and the earliest to value
        const from = froms[froms.length - 1];
        const to = tos[0];

        const modelInfos = [];

        for (let modelId of this.props.models) {
            modelInfos[modelId] = await this.fetchModelInfo(modelId, from, to);
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
        const aheadChanged = this.props.ahead != prevProps.ahead;
        // do not fetch data if no important props changed
        if (intervalChanged || modelsChanged || aheadChanged) {
            this.fetchData();
        }
    }

    render() {
        const t = this.props.t;
        const rows = [];

        const loading = t('Loading...');

        for (let [idx, modelId] of this.props.models.entries()) {
            const modelInfo = this.state.modelInfos[modelId] || {};
            const numberFormat = n => n !== undefined ? d3Format.format(".4r")(n) : undefined;
            const row = (
                <tr id={modelId} key={modelId}>
                    <td style={{backgroundColor: colorsFuture[idx % 10], width: 0}}/>
                    <td id="1">{modelInfo.name || loading}</td>
                    <td id="2">{modelInfo.type || loading}</td>
                    <td id="3">{modelInfo.aheadCount || loading}</td>
                    <td id="4">{modelInfo.period || loading}</td>
                    <td id="5">{numberFormat(modelInfo.minMSE) || loading}</td>
                    <td id="6">{numberFormat(modelInfo.maxMSE) || loading}</td>
                    <td id="7">{numberFormat(modelInfo.minMAE) || loading}</td>
                    <td id="8">{numberFormat(modelInfo.maxMAE) || loading}</td>
                </tr>
            );
            rows.push(row);
        }

        let evalFrom = ' '; // first printable char
        let evalTo = 'z'; // printable char after numbers

        const fromValues = [];
        const toValues = [];
        for (const [key, value] of Object.entries(this.state.modelInfos) || {}) {
            fromValues.push(value.from);
            toValues.push(value.to)
        }

        // dates are stored in ISO8601 so we can sort them lexicographically
        fromValues.sort();
        toValues.sort();

        if (fromValues.length > 0 && toValues.length > 0) {
            evalFrom = moment(fromValues[fromValues.length - 1]).format('YYYY-MM-DD HH:mm:ss');
            evalTo = moment(toValues[0]).format('YYYY-MM-DD HH:mm:ss');
        } else {
            evalFrom = loading;
            evalTo = loading;
        }

        const evaluationRange = t('{{from}} to {{to}}', {
            from: evalFrom,
            to: evalTo,
        });

        return (
            <div>
                <table className={'table table-striped table-bordered'}>
                    <thead>
                        <tr>
                            <th scope="column"/>
                            <th scope="column">{t('Model')}</th>
                            <th scope="column">{t('Type')}</th>
                            <th scope="column">{t('Ahead')}</th>
                            <th scope="column">{t('Bucket interval')}</th>
                            <th scope="column">{t('MSE min')}</th>
                            <th scope="column">{t('MSE max')}</th>
                            <th scope="column">{t('MAE min')}</th>
                            <th scope="column">{t('MAE max')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
                    </tbody>
                </table>
                <div>
                    <b>{t('Evaluation Time Range')}:</b> {evaluationRange}
                </div>
            </div>
        );
    }
}

@withComponentMixins([
    withTranslation,
])
class PredictionsHyperparametersTable extends Component {
    constructor(props) {
        super(props);

        this.state = {
            trainingResults: [],
        };
    }

    async fetchModelTrainingResults(modelId) {
        const prediction = await fetchPrediction(modelId);

        if (prediction.type === PredictionTypes.NN) {
            if (prediction.settings && prediction.settings.training_completed) {
                try {
                    const jobsResponse = await axios.get(getUrl(`rest/predictions-nn-jobs/${modelId}`));
                    const trainingJobId = jobsResponse.data.training;
                    const trainingResultResponse = await axios.get(getUrl(`files/job/file/${trainingJobId}/training_results.json`));
                    const trainingResult = trainingResultResponse.data;
                    trainingResult.model = prediction;
                    return trainingResult;
                } catch (error) {
                    console.log(`Training results not available for model '${prediction.name}'.`);
                }
            }
        }

        return {};
    }

    async fetchData() {
        const requests = this.props.models.map(m => this.fetchModelTrainingResults(m));
        const results = await Promise.all(requests);

        this.setState({
            trainingResults: results
        });
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData();
    }

    componentDidUpdate(prevProps) {
        const modelsChanged = this.props.models !== prevProps.models;
        if (modelsChanged) {
            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();
        }
    }

    render() {
        const t = this.props.t;
        const rows = [];

        const loading = t('Loading...');

        //return <pre>{JSON.stringify(this.state.trainingResults, null, 2)}</pre>;

        // get a set of all hyperparameters for all models
        const hyperparameters = new Map();
        for (const trainingResult of this.state.trainingResults) {
            if (!trainingResult.model || trainingResult.model.type !== PredictionTypes.NN)
                continue;

            const architecture = trainingResult.tuned_parameters.architecture;
            const architectureSpec = NeuralNetworkArchitecturesSpecs[architecture];
            for (const hyperparameter of architectureSpec.params)
                hyperparameters.set(hyperparameter.id, hyperparameter);
        }
        for (const commonParam of NeuralNetworksCommonParams)
            hyperparameters.set(commonParam.id, commonParam);

        // render the header
        const header = []
        for (const [id, hyperparameter] of hyperparameters) {
            header.push(<th key={id}>{hyperparameter.label}</th>);
        }

        // render the hyperparameters
        for (const [idx, trainingResult] of this.state.trainingResults.entries()) {
            if (!trainingResult.model || trainingResult.model.type !== PredictionTypes.NN)
                continue;

            const tunedParameters = trainingResult.tuned_parameters;
            const architectureParams = tunedParameters.architecture_params;

            const render = (hyperparameter, value) => {
                if (hyperparameter.hasOwnProperty("render"))
                    return hyperparameter.render(value)
                else
                    return JSON.stringify(value, null, 2)
            }

            const columns = [];
            for (const [id, hyperparameter]  of hyperparameters) {
                if (architectureParams.hasOwnProperty(id)) {
                    const value = architectureParams[id];
                    columns.push(<td key={id}>{render(hyperparameter, value)}</td>);
                } else if (tunedParameters.hasOwnProperty(id)) {
                    const value = tunedParameters[id];
                    columns.push(<td key={id}>{render(hyperparameter, value)}</td>);
                } else {
                    columns.push(<td key={id}/>);
                }
            }

            const architecture = trainingResult.tuned_parameters.architecture;
            const architectureSpec = NeuralNetworkArchitecturesSpecs[architecture];

            rows.push(<tr key={trainingResult.model.id}>
                <td style={{backgroundColor: colorsFuture[idx % 10], width: 0}}/>
                <td key={"name"}>{trainingResult.model.name || loading}</td>
                <td key={"architecture"}>{architectureSpec.label || loading}</td>
                {columns}
            </tr>);
        }

        return (
            <div>
                <h4>Hyperparameters</h4>
                <table className={'table table-striped table-bordered'}>
                    <thead>
                        <tr>
                            <th scope="column"/>
                            <th scope="column">{t('Model')}</th>
                            <th scope="column">{t('Architecture')}</th>
                            {header}
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
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
        return models;
    }

    async getConfig() {
        let config = {
            signalSets: [
                {
                    cid: this.props.sigSetCid,
                    signals: [
                        {
                            label: "original data",
                            color: "#000000",
                            cid: this.props.signalCid,
                            enabled: true,
                        }
                    ],
                    tsSigCid: this.props.tsCid,
                },
            ]
        };

        let models = await this.fetchData();
        let ahead = this.props.aheadValue;

        for (let i = 0; i < models.length; i++) {
            let model = await models[i];
            config.signalSets.push({
                cid: model.outputConfig.future_set,
                signals: [
                    {
                        label: `${model.name}_futr`,
                        color: colorsAhead[i % colorsAhead.length],
                        cid: this.props.signalCid,
                        enabled: true,
                    }
                ],
                tsSigCid: 'ts',
            });
            config.signalSets.push({
                cid: model.outputConfig.ahead_sets[`${ahead}`],
                signals: [
                    {
                        label: `${model.name}_hist`,
                        color: colorsFuture[i % colorsFuture.length],
                        cid: this.props.signalCid,
                        enabled: true,
                    }
                ],
                tsSigCid: 'ts',
            });
        }

        return config;
    }

    componentDidMount() {
        this.getConfig().then(config => this.setState({ config: config, ready: true }));
    }

    componentDidUpdate(prevProps) {
        const modelsChanged = this.props.models !== prevProps.models;
        const aheadChanged = this.props.aheadValue !== prevProps.aheadValue;

        if (modelsChanged || aheadChanged) {
            this.getConfig().then(config => this.setState({ config: config }));
        }
    }

    render() {
        const config = this.state.config;

        return (
            <div>
                {config && <LineChart
                    // We want the key here so that the LineChart is recreated.
                    // Otherwise, during the update, there is a small time window
                    // when having the cursor inside the chart will crash the client.
                    key={`${config.signalSets.length}_${this.props.aheadValue}`}
                    config={config}
                    keepAggregationInterval={true}
                />
                }
            </div>
        );
    }
}

@withComponentMixins([
    withTranslation,
])
class AheadSelector extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isAheadLocked: true,  // ahead value the same for all models
        };
    }

    generateAheadOptions(minAhead, maxAhead) {
        const options = [];

        for (let ahead = minAhead; ahead <= maxAhead; ahead++) {
            options.push(<option id={ahead} key={ahead}>{ahead}</option>);
        }

        return options;
    }

    handleChange(event) {
        const target = event.target;
        const name = target.name;
        const value = target.type === 'checkbox' ? target.checked : target.value;

        if (target.type === 'select-one') {
            this.props.handleAheadChange(value);
        } else {

            this.setState({
                [name]: value,
            });
        }
    }

    render() {
        const t = this.props.t;

        const minAhead = 1;
        const maxAhead = this.props.max;

        // in case each model will set its own ahead value, we will disable
        // the dropdown and not use it anymore
        const dropdownDisabled = !this.state.isAheadLocked;

        return (
            <div>
                {
                    // It would make sense to allow the individual ahead values
                    // for models change in the future, so this is left here
                    // in preparation for that
                    /*
                    <div className="form-check">
                        <input
                            name="isAheadLocked"
                            className="form-check-input"
                            type="checkbox"
                            value="isAheadLocked"
                            onChange={this.handleChange.bind(this)} />
                        <label>
                            {t('Lock ahead for all models.')}
                        </label>
                    </div>
                    */
                }
                <div className="form-group row">
                    <label className="col-sm-2 col-form-label">
                        {`${t('Steps ahead')}:`}
                    </label>
                    <select
                        name="aheadValue"
                        disabled={dropdownDisabled}
                        onChange={this.handleChange.bind(this)}
                    >
                        {this.generateAheadOptions(minAhead, maxAhead)}
                    </select>
                </div>
            </div>
        );
    }
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
            aheadValue: 1,
            maxAhead: 1, // maximum ahead value available for all models
            models: [],
        };

        this.initForm({
            onChange: {
                signal: this.onSignalChange.bind(this),
                models: this.onModelsChange.bind(this),
            },
            leaveConfirmation: false,
        });
        tableRestActionDialogInit(this);
    }

    componentDidMount() {
        this.populateFormValues({
            name: '',
        });
        this.fetchBoundaries(this.props.signalSet.id);
    }

    componentDidUpdate(prevProps, prevState) {
        const prevLength = prevState.models ? prevState.models.length : 0;
        const newLength = this.state.models ? this.state.models.length : 0;
        const modelsChanged = prevLength !== newLength;

        if (modelsChanged) {
            this.findMaxAhead();
        }
    }

    onSignalChange(state, key, oldValue, newValue) {
        if (oldValue != newValue) {
            state.signal = newValue;
        }
    }

    onModelsChange(state, key, oldValue, newValue) {
        if (oldValue != newValue) {
            state.models = newValue;
        }
    }

    handleAllAheadChange(aheadValue) {
        // ahead value for all models changes
        this.setState({ aheadValue });
    }

    // handleSingleAheadChange(modelId, aheadValue) { // not yet implemented
    //
    // }

    /** Find the largest ahead value available for every model
     */
    async findMaxAhead() {
        let maxAhead = 1;
        if (this.state.models.length > 0) {
            const maxAheadValues = [];
            for (let modelId of this.state.models) {
                const prediction = (await axios.get(getUrl(`rest/predictions/${modelId}`))).data;

                maxAheadValues.push(prediction.ahead_count);
            }
            maxAhead = Math.min(...maxAheadValues);
        }

        this.setState({
            maxAhead
        });
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
            last: last.toISOString(),
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
        ];

        const modelsColumns = [
            { data: 0, title: t('Model id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Type') },
        ];

        return (
            <Panel
                title={t('Compare models')}
            >
                {tableRestActionDialogRender(this)}
                <Toolbar>
                </Toolbar>
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
                        columns={modelsColumns}
                    />}

                </Form>
                <TimeContext
                    key={`${this.state.first}-${this.state.last}`} // refresh the time context after we have more info and can set sane defaults
                    initialIntervalSpec={new IntervalSpec(this.state.first, this.state.last, null, moment.duration(1, 'd'))}
                >
                    <TimeRangeSelector />
                    {this.state.models.length > 0 && <PredictionsGraph
                        key={this.state.models.length}
                        sigSetCid={sigSetCid}
                        tsCid="ts"
                        signalCid={this.state.signal}
                        models={this.state.models}
                        aheadValue={this.state.aheadValue}
                    />
                    }
                    {this.state.models.length > 0 && <AheadSelector
                        handleAheadChange={this.handleAllAheadChange.bind(this)}
                        aheadValue={this.state.aheadValue}
                        max={this.state.maxAhead}
                    />}
                    {this.state.models.length > 0 && <>
                        <PredictionsEvaluationTableMulti
                            ahead={this.state.aheadValue}
                            sigSetCid={sigSetCid}
                            tsCid="ts"
                            signalCid={this.state.signal}
                            models={this.state.models}
                        />
                        <PredictionsHyperparametersTable
                            models={this.state.models}
                        />
                    </>}
                </TimeContext>
            </Panel>
        );
    }
}