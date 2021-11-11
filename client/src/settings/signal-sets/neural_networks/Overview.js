'use strict';

import React, { Component } from "react";
import { withComponentMixins } from "../../../lib/decorator-helpers";
import { withTranslation } from "../../../lib/i18n";
import { Panel } from "../../../lib/panel";
import { Toolbar, LinkButton, requiresAuthenticatedUser } from "../../../lib/page";
import { withAsyncErrorHandler, withErrorHandling } from '../../../lib/error-handling';
import {getUrl} from "../../../lib/urls";
import axios from "../../../lib/axios";
import RunConsole from "../../jobs/RunConsole";
import {ActionLink, Button, ModalDialog} from "../../../lib/bootstrap-components";
import {JobState} from "../../../../../shared/jobs";
import {NeuralNetworkArchitecturesSpecs, NeuralNetworksCommonParams} from "../../../../../shared/predictions-nn";
import * as d3Format from "d3-format";
import {Form, TableSelect, TableSelectMode, withForm} from "../../../lib/form";
import {LineChart} from "../../../ivis/LineChart";
import {IntervalSpec} from "../../../ivis/TimeInterval";
import {TimeContext} from "../../../ivis/TimeContext";
import moment from "moment";
import {TimeRangeSelector} from "../../../ivis/TimeRangeSelector";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    requiresAuthenticatedUser
])
export default class NNOverview extends Component {
    constructor(props) {
        super(props);

        this.state = {
            lastTrainingRun: null,
            lastPredictionRun: null,
            runTrainingModalVisible: false,
            runPredictionModalVisible: false,
            timeout: null,
            predictionJob: null,
            enablePredictionButtonDisabled: false,
            prediction: props.prediction,
            trainingResults: null,
        }
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData();
    }

    componentWillUnmount() {
        if (this.state.timeout !== null)
            clearTimeout(this.state.timeout);
    }

    @withAsyncErrorHandler
    async fetchData() {
        const trainingJobId = this.props.jobs.training;
        const predictionJobId = this.props.jobs.prediction;
        const predictionId = this.state.prediction.id;

        const lastTrainingRun = await this.fetchLastJobRun(trainingJobId);
        const lastPredictionRun = await this.fetchLastJobRun(predictionJobId);
        const timeout = await this.setFetchTimeout(lastTrainingRun, lastPredictionRun);

        const predictionJobResponse = await axios.get(getUrl(`rest/jobs/${predictionJobId}`));
        const predictionJob = predictionJobResponse.data;

        const predictionResponse = await axios.get(getUrl(`rest/predictions/${predictionId}`))
        const prediction = predictionResponse.data;

        let trainingResults = await this.fetchTrainingResults(prediction, trainingJobId);

        this.setState({
            lastTrainingRun,
            timeout,
            predictionJob,
            prediction,
            trainingResults,
            lastPredictionRun,
        });
    }

    async fetchTrainingResults(prediction, trainingJobId) {
        let trainingResults = null;
        if (prediction.settings && prediction.settings.training_completed) {
            try {
                const trainingResultsResponse = await axios.get(getUrl(`files/job/file/${trainingJobId}/training_results.json`));
                trainingResults = trainingResultsResponse.data;
            } catch (error) {
                console.log("Training results not available.");
            }
        }
        return trainingResults;
    }
    
    async fetchLastJobRun(jobId) {
        const lastRunResponse = await axios.get(getUrl(`rest/jobs/${jobId}/last-run`))
        return lastRunResponse.data;
    }

    async setFetchTimeout(...jobsToWaitFor) {
        let timeout = null;
        if (this.state.timeout) {
            clearTimeout(this.state.timeout); // clear the last timeout (this is safe even if the timeout was already executed)
        }
        if (jobsToWaitFor.some(j => j && !j.finished_at)) { // there is a last run which is not yet finished
            timeout = setTimeout(::this.fetchData, 1000);
        }
        return timeout;
    }

    @withAsyncErrorHandler
    async stopTraining() {
        if (this.state.lastTrainingRun)
            await axios.post(getUrl(`rest/job-stop/${this.state.lastTrainingRun.id}`));
    }

    showRunTrainingModal() {
        this.setState({runTrainingModalVisible: true});
    }

    hideRunTrainingModal() {
        this.setState({runTrainingModalVisible: false});
    }

    showRunPredictionModal() {
        this.setState({runPredictionModalVisible: true});
    }

    hideRunPredictionModal() {
        this.setState({runPredictionModalVisible: false});
    }

    @withAsyncErrorHandler
    async runTraining() {
        this.hideRunTrainingModal()
        await axios.post(getUrl(`rest/job-run/${this.props.jobs.training}`));
        // noinspection ES6MissingAwait
        this.fetchData();
    }

    @withAsyncErrorHandler
    async runPrediction() {
        this.hideRunPredictionModal()
        await axios.post(getUrl(`rest/job-run/${this.props.jobs.prediction}`));
        // noinspection ES6MissingAwait
        this.fetchData();
    }

    @withAsyncErrorHandler
    async setPredictionJobState(enabled) {
        this.setState({enablePredictionButtonDisabled: true});

        const predictionJobId = this.props.jobs.prediction;
        const predictionJobResult = await axios.get(getUrl(`rest/jobs/${predictionJobId}`))
        const predictionJob = predictionJobResult.data;
        predictionJob.originalHash = predictionJob.hash;

        predictionJob.state = enabled ? JobState.ENABLED : JobState.DISABLED;

        await axios.put(getUrl(`rest/jobs/${predictionJobId}`), predictionJob);

        this.setState({enablePredictionButtonDisabled: false, predictionJob});
    }

    @withAsyncErrorHandler
    async enablePredictionJob() {
        await this.setPredictionJobState(true);
    }

    @withAsyncErrorHandler
    async disablePredictionJob() {
        await this.setPredictionJobState(false);
    }

    printTrainingResults() {
        if (!this.state.trainingResults) {
            return (<>
                <h3>Training results</h3>
                <p>{this.props.t('Training results are not yet available. When the training finishes, the results will appear here.')}</p>
            </>)
        }

        const tunedParams = this.state.trainingResults.tuned_parameters;
        const architectureParams = tunedParams.architecture_params;
        const architecture = tunedParams.architecture;
        const architectureSpec = NeuralNetworkArchitecturesSpecs[architecture];

        // helper function for rendering
        const render = (spec, value) => {
            if (spec.hasOwnProperty("render"))
                return spec.render(value)
            else
                return JSON.stringify(value, null, 2)
        }

        const rows = architectureSpec.params.map(spec => <tr key={spec.id}>
            <td>{spec.label}</td>
            <td>{render(spec, architectureParams[spec.id])}</td>
        </tr>);
        rows.push(...NeuralNetworksCommonParams.map(spec => <tr key={spec.id}>
            <td>{spec.label}</td>
            <td>{render(spec, tunedParams[spec.id])}</td>
        </tr>));


        return (<>
            <h3>Training results</h3>
            <h4>Best found hyperparameters</h4>
            <table className={"table col-4"}>
                <thead><tr>
                    <th>Hyperparameter</th>
                    <th>Best found value</th>
                </tr></thead>
                <tbody>
                    {rows}
                </tbody>
            </table>
            <TrialsHyperparametersTable trials={this.state.trainingResults.trials} architectureSpec={architectureSpec} tuned_parameters={this.state.trainingResults.tuned_parameters} />
        </>);
    }

    isTrainingCompleted() {
        return this.state.prediction.settings && this.state.prediction.settings.training_completed;
    }

    render() {
        const t = this.props.t;
        const prediction = this.state.prediction;
        const trainingJobId = this.props.jobs.training;
        const predictionJobId = this.props.jobs.prediction;

        let enablePredictionButton = null;
        if (this.state.predictionJob && this.isTrainingCompleted()) {
            if (this.state.predictionJob.state === JobState.DISABLED) {
                enablePredictionButton = <Button onClickAsync={::this.enablePredictionJob} label={"Enable automatic predictions"}
                                                 className="btn-primary" disabled={this.state.enablePredictionButtonDisabled}/>
            } else if (this.state.predictionJob.state === JobState.ENABLED) {
                enablePredictionButton = <Button onClickAsync={::this.disablePredictionJob} label={"Disable automatic predictions"}
                                                 className="btn-primary" disabled={this.state.enablePredictionButtonDisabled}/>
            }
        }

        return (
            <Panel title={t('Neural network model overview') + ": " + prediction.name}>
                <Toolbar className={"text-left"}>
                    {this.state.lastTrainingRun && !this.state.lastTrainingRun.finished_at &&
                        <Button onClickAsync={::this.stopTraining} label={"Stop training"} className="btn-danger" icon={"stop"} />}
                    <Button onClickAsync={::this.showRunTrainingModal} label={"Re-run training"} className="btn-danger" icon={"retweet"} />

                    {enablePredictionButton}
                    {this.state.predictionJob && this.isTrainingCompleted() &&
                        <Button onClickAsync={::this.showRunPredictionModal} label={"Generate predictions"} className="btn-secondary" icon={"play"}
                                disabled={this.state.lastPredictionRun && !this.state.lastPredictionRun.finished_at} />}

                    <LinkButton to={`/settings/signal-sets/${this.props.signalSet.id}/predictions/neural_network/create/${this.props.predictionId}`} label={"New model with same settings"} className="btn-primary" icon={"clone"} />
                    {this.isTrainingCompleted() && <LinkButton to={`/settings/signal-sets/${this.props.signalSet.id}/predictions/neural_network/create/${this.props.predictionId}/tuned`} label={"New model from tuned parameters"} className="btn-primary" icon={"clone"} />}
                </Toolbar>

                {prediction.description && <p><b>Description:</b> {prediction.description}</p>}

                {this.isTrainingCompleted() &&
                    <PredictionFutureLineChartsWithSelector prediction={this.props.prediction} signalSet={this.props.signalSet} lastPredictionRun={this.state.lastPredictionRun} />}

                {this.printTrainingResults()}

                <ModalDialog hidden={!this.state.runTrainingModalVisible} title={"Re-run training"} onCloseAsync={::this.hideRunTrainingModal} buttons={[
                    { label: t('no'), className: 'btn-primary', onClickAsync: ::this.hideRunTrainingModal },
                    { label: t('yes'), className: 'btn-danger', onClickAsync: ::this.runTraining }
                ]}>
                    Are you sure? This will delete the previously trained model.
                </ModalDialog>

                <ModalDialog hidden={!this.state.runPredictionModalVisible} title={"Generate predictions"} onCloseAsync={::this.hideRunPredictionModal} buttons={[
                    { label: t('no'), className: 'btn-primary', onClickAsync: ::this.hideRunPredictionModal },
                    { label: t('yes'), className: 'btn-secondary', onClickAsync: ::this.runPrediction }
                ]}>
                    This will generate new predictions now. Are you sure? This is usually not necessary if you have automatic predictions enabled.
                </ModalDialog>

                <h3>Training log</h3>
                <JobRunLog lastRun={this.state.lastTrainingRun} jobId={trainingJobId}
                           errorMessage={this.isTrainingCompleted() ? t("The training job has finished. The log is no longer available.") : t("The training job hasn't started yet.")} />

                {this.isTrainingCompleted() && <>
                    <h3>Prediction log</h3>
                    <JobRunLog lastRun={this.state.lastPredictionRun} jobId={predictionJobId}
                               errorMessage={t("The log of the prediction job is not available. It is possible that the prediction job was not executed yet. " +
                                   "It will be executed automatically if the automatic predictions are enabled.")} />
                </>}
            </Panel>
        );
    }
}

@withComponentMixins([
    withTranslation,
])
class TrialsHyperparametersTable extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        if (!this.props.trials)
            return null;

        const rows = [];

        // render the header
        const header = []
        for (const spec of this.props.architectureSpec.params) {
            header.push(<th key={spec.id}>{spec.label}</th>);
        }
        for (const spec of NeuralNetworksCommonParams)
            header.push(<th key={spec.id}>{spec.label}</th>);
        header.push(<th key={"val_loss"}>Validation loss</th>);

        // helper function for rendering
        const render = (hyperparameter, value) => {
            if (hyperparameter.hasOwnProperty("render"))
                return hyperparameter.render(value)
            else
                return JSON.stringify(value, null, 2)
        }

        // render the hyperparameters
        const formatLoss = d3Format.format(".4r")
        for (const [idx, trial] of this.props.trials.entries()) {
            const columns = []
            for (const spec of this.props.architectureSpec.params) {
                const trialParams = trial.architecture_params;
                const value = trialParams[spec.id];
                columns.push(<td key={spec.id}>{render(spec, value)}</td>);
            }
            for (const spec of NeuralNetworksCommonParams) {
                const optimizedParams = trial.optimized_parameters;
                const value = optimizedParams.hasOwnProperty(spec.id)
                    ? optimizedParams[spec.id]
                    : this.props.tuned_parameters[spec.id];
                columns.push(<td key={spec.id}>{render(spec, value)}</td>);
            }
            columns.push(<th key={"val_loss"}>{formatLoss(trial.val_loss)}</th>);

            rows.push(<tr key={idx}>
                {columns}
            </tr>)
        }

        return (
            <div>
                <h4>Trials</h4>
                <table className={'table table-striped table-bordered'}>
                    <thead><tr>
                        {header}
                    </tr></thead>
                    <tbody>
                        {rows}
                    </tbody>
                </table>
            </div>
        );
    }
}

@withComponentMixins([
    withTranslation,
])
class JobRunLog extends Component {
    constructor(props) {
        super(props);

        this.state = {
            collapsed: true,
        }
    }

    onClick() {
        this.setState({
            collapsed: !this.state.collapsed,
        });
    }

    render() {
        if (!this.props.lastRun) {
            return <p>{this.props.errorMessage}</p>;
        }

        if (this.state.collapsed)
            return (<>
                <ActionLink onClickAsync={::this.onClick} className={"text-muted"}>
                    Expand
                </ActionLink>
            </>);
        else
            return (<>
                <ActionLink onClickAsync={::this.onClick} className={"text-muted d-inline-block mb-2"}>
                    Collapse
                </ActionLink>
                <RunConsole jobId={this.props.jobId} runId={this.props.lastRun.id} key={this.props.lastRun.id} />
            </>);
    }
}

@withComponentMixins([
    withTranslation,
    withForm,
])
export class PredictionFutureLineChartsWithSelector extends Component {
    constructor(props) {
        super(props);

        this.state = {
            futureSet: null,
            signalCids: props.prediction.signals.main.map(s => s.cid),
            signals: [],
        }

        this.initForm({
            onChange: {
                signals: ::this.onSignalsChange,
            },
            leaveConfirmation: false,
        });
    }

    async fetchData() {
        const predictionId = this.props.prediction.id;
        const outputConfig = (await axios.get(getUrl(`rest/predictions-output-config/${predictionId}`))).data;
        this.setState({
            futureSet: outputConfig.future_set,
        });
    }

    componentDidMount() {
        this.populateFormValues({
            signals: [],
        });
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData();
    }

    onSignalsChange(state, key, oldValue, newValue) {
        if (oldValue !== newValue) {
            state.signals = newValue;
        }
    }

    groupSignalsByOriginalCid(signals) {
        const groups = new Map();
        for (const s of signals) {
            let originalSignal = s;
            /* If the signal ends with our aggregation mark and the signal without the mark also exists,
               the original signal should not contain the mark as it is not present in the original signal set. */
            if (originalSignal.endsWith("_min") || originalSignal.endsWith("_avg") || originalSignal.endsWith("_max")) {
                const signalWithoutAgg = originalSignal.slice(0, -4);
                if (this.state.signalCids.includes(signalWithoutAgg))
                    originalSignal = signalWithoutAgg;
            }

            if (!groups.has(originalSignal))
                groups.set(originalSignal, [])

            groups.get(originalSignal).push(s);
        }
        return groups;
    }

    render() {
        const t = this.props.t;
        const columns = [
            { data: 1, title: t('Id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
        ];

        const signalGroups = this.groupSignalsByOriginalCid(this.state.signals);
        const charts = [];
        for (const [original, signals] of signalGroups.entries()) {
            const getLabel = (sig) => {
                if (sig === original)
                    return 'future';
                else
                    return `future ${sig.slice(-3)}`;
            }
            const getColor = (sig) => {
                if (sig === original)
                    return '#9564BF';
                else {
                    switch (sig.slice(-3)) {
                        case 'min':
                            return '#1776B6';
                        case 'max':
                            return '#D8241F';
                        case 'avg':
                            return '#9564BF';
                    }
                }
            }

            const config = {
                signalSets: [
                    {
                        cid: this.state.futureSet,
                        signals: signals.map(s => ({
                            label: getLabel(s),
                            color: getColor(s),
                            cid: s,
                            enabled: true,
                        })),
                        tsSigCid: 'ts'
                    },
                    {
                        cid: this.props.signalSet.cid,
                        signals: [
                            {
                                label: 'original',
                                color: '#000000',
                                cid: original,
                                enabled: true
                            }
                        ],
                        tsSigCid: 'ts'
                    }
                ],
                yAxes: [{
                    visible: true,
                    label: this.props.prediction.signals.main.find(s => s.cid === original).name || original,
                }],
            }

            charts.push(<LineChart key={original}
                                   config={config}
                                   keepAggregationInterval={true}
                                   height={350}
            />);
        }

        let initialIntervalSpec;
        if (this.props.prediction.settings.hasOwnProperty("interval") && this.props.prediction.settings.interval > 0) {
            const interval = this.props.prediction.settings.interval / 1000;
            const aheadCount = this.props.prediction.ahead_count;
            initialIntervalSpec = new IntervalSpec(`now-${interval * aheadCount}s`, `now+${interval * aheadCount}s`, moment.duration(interval, 's'), null);
        } else {
            initialIntervalSpec = new IntervalSpec('now-7d', 'now+7d', null, null);
        }

        return (
            <>
                <h3>Latest predictions</h3>
                {this.props.lastPredictionRun && (this.props.lastPredictionRun.finished_at
                    ? <p>The latest predictions were generated on {moment(this.props.lastPredictionRun.finished_at).format('YYYY-MM-DD HH:mm:ss')}.</p>
                    : <p>The predictions are being generated now.</p>)}
                <Form stateOwner={this} >
                    {this.state.futureSet && <TableSelect
                        key="signals"
                        id="signals"
                        label={t("Signals")}
                        withHeader
                        dropdown
                        selectMode={TableSelectMode.MULTI}
                        selectionLabelIndex={2}
                        selectionKeyIndex={1}
                        dataUrl={`rest/signals-table-by-cid/${this.state.futureSet}`}
                        columns={columns}
                    />}
                </Form>

                <TimeContext initialIntervalSpec={initialIntervalSpec}>
                    {charts}
                    {charts.length > 0 && <TimeRangeSelector />}
                </TimeContext>
            </>
        );
    }
}
