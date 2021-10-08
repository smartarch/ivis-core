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
import {NeuralNetworkArchitecturesSpecs} from "../../../../../shared/predictions-nn";
import * as d3Format from "d3-format";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    requiresAuthenticatedUser
])
export default class NNOverview extends Component {
    constructor(props) {
        super(props);

        this.state = {
            lastRun: null,
            runTrainingModalVisible: false,
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
        const lastRunResponse = await axios.get(getUrl(`rest/jobs/${trainingJobId}/last-run`))
        const lastRun = lastRunResponse.data;

        let timeout = null;
        if (this.state.timeout && lastRun.finished_at) { // last run finished
            clearTimeout(this.state.timeout);
        }
        else if (lastRun && !lastRun.finished_at) {  // last run not finished and timeout not yet set
            timeout = setTimeout(::this.fetchData, 1000);
        }

        const predictionJobId = this.props.jobs.prediction;
        const predictionJobResponse = await axios.get(getUrl(`rest/jobs/${predictionJobId}`))
        const predictionJob = predictionJobResponse.data;

        const predictionId = this.state.prediction.id;
        const predictionResponse = await axios.get(getUrl(`rest/predictions/${predictionId}`))
        const prediction = predictionResponse.data;

        let trainingResults = null;
        if (prediction.settings && prediction.settings.training_completed) {
            try {
                const trainingResultsResponse = await axios.get(getUrl(`files/job/file/${trainingJobId}/training_results.json`));
                trainingResults = trainingResultsResponse.data;
            } catch (error) {
                console.log("Training results not available.");
            }
        }

        this.setState({
            lastRun,
            timeout,
            predictionJob,
            prediction,
            trainingResults,
        });
    }

    @withAsyncErrorHandler
    async stopTraining() {
        if (this.state.lastRun)
            await axios.post(getUrl(`rest/job-stop/${this.state.lastRun.id}`));
    }

    showRunTrainingModal() {
        this.setState({runTrainingModalVisible: true});
    }

    hideRunTrainingModal() {
        this.setState({runTrainingModalVisible: false});
    }

    @withAsyncErrorHandler
    async runTraining() {
        this.hideRunTrainingModal()
        await axios.post(getUrl(`rest/job-run/${this.props.jobs.training}`));
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
                {this.props.t('Training results are not available. When the training finishes, the results will appear here.')}
            </>)
        }

        const architectureParams = this.state.trainingResults.tuned_parameters.architecture_params;
        const architecture = this.state.trainingResults.tuned_parameters.architecture;
        const architectureSpec = NeuralNetworkArchitecturesSpecs[architecture];

        const rows = architectureSpec.params.map(spec => <tr key={spec.id}>
            <td>{spec.label}</td>
            <td>{JSON.stringify(architectureParams[spec.id], null, 2)}</td>
        </tr>);

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
            <TrialsHyperparametersTable trials={this.state.trainingResults.trials} architectureSpec={architectureSpec} />
        </>);
    }

    render() {
        const t = this.props.t;
        const prediction = this.state.prediction;
        const trainingJobId = this.props.jobs.training;

        let enablePredictionButton = null;
        if (this.state.predictionJob && this.state.prediction.settings && this.state.prediction.settings.training_completed) {
            if (this.state.predictionJob.state === JobState.DISABLED) {
                enablePredictionButton = <Button onClickAsync={::this.enablePredictionJob} label={"Enable automatic predictions"} className="btn-primary" disabled={this.state.enablePredictionButtonDisabled}/>
            } else if (this.state.predictionJob.state === JobState.ENABLED) {
                enablePredictionButton = <Button onClickAsync={::this.disablePredictionJob} label={"Disable automatic predictions"} className="btn-primary" disabled={this.state.enablePredictionButtonDisabled}/>
            }
        }

        return (
            <Panel title={t('Neural network model overview') + ": " + prediction.name}>
                <Toolbar className={"text-left"}>
                    {this.state.lastRun && !this.state.lastRun.finished_at && <Button onClickAsync={::this.stopTraining} label={"Stop training"} className="btn-danger" icon={"stop"} />}
                    <Button onClickAsync={::this.showRunTrainingModal} label={"Re-run training"} className="btn-danger" icon={"retweet"} />
                    {enablePredictionButton}
                    <LinkButton to={`/settings/signal-sets/${this.props.signalSet.id}/predictions/neural_network/create/${this.props.predictionId}`} label={"New model with same settings"} className="btn-primary" icon={"clone"} />
                    {this.state.prediction.settings && this.state.prediction.settings.training_completed && <LinkButton to={`/settings/signal-sets/${this.props.signalSet.id}/predictions/neural_network/create/${this.props.predictionId}/tuned`} label={"New model from tuned parameters"} className="btn-primary" icon={"clone"} />}
                </Toolbar>

                {this.printTrainingResults()}

                <ModalDialog hidden={!this.state.runTrainingModalVisible} title={"Re-run training"} onCloseAsync={::this.hideRunTrainingModal} buttons={[
                    { label: t('no'), className: 'btn-primary', onClickAsync: ::this.hideRunTrainingModal },
                    { label: t('yes'), className: 'btn-danger', onClickAsync: ::this.runTraining }
                ]}>
                    Are you sure? This will delete the previously trained model.
                </ModalDialog>

                <h3>Training log</h3>
                <TrainingLog lastRun={this.state.lastRun} trainingJobId={trainingJobId} />
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
        header.push(<th key={"val_loss"}>Validation loss</th>);

        // render the hyperparameters
        const formatLoss = d3Format.format(".4r")
        for (const [idx, trial] of this.props.trials.entries()) {
            const columns = []
            for (const spec of this.props.architectureSpec.params) {
                const trialParams = trial.architecture_params;
                columns.push(<td key={spec.id}>{JSON.stringify(trialParams[spec.id], null, 2)}</td>);
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
class TrainingLog extends Component {
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
            return <p>{this.props.t("Not available")}</p>;
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
                <RunConsole jobId={this.props.trainingJobId} runId={this.props.lastRun.id} key={this.props.lastRun.id} />
            </>);
    }
}
