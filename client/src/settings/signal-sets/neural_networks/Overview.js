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
import {Button, ModalDialog} from "../../../lib/bootstrap-components";
import {JobState} from "../../../../../shared/jobs";

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
        const lastRunResult = await axios.get(getUrl(`rest/jobs/${trainingJobId}/last-run`))
        const lastRun = lastRunResult.data;

        let timeout = null;
        if (this.state.timeout && lastRun.finished_at) { // last run finished
            clearTimeout(this.state.timeout);
        }
        else if (lastRun && !lastRun.finished_at) {  // last run not finished and timeout not yet set
            timeout = setTimeout(::this.fetchData, 1000);
        }

        const predictionJobId = this.props.jobs.prediction;
        const predictionJobResult = await axios.get(getUrl(`rest/jobs/${predictionJobId}`))
        const predictionJob = predictionJobResult.data;

        this.setState({
            lastRun,
            timeout,
            predictionJob,
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

    render() {
        const t = this.props.t;
        const prediction = this.props.prediction;
        const trainingJobId = this.props.jobs.training;

        let enablePredictionButton = null;
        if (this.state.predictionJob) {
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
                </Toolbar>

                <ModalDialog hidden={!this.state.runTrainingModalVisible} title={"Re-run training"} onCloseAsync={::this.hideRunTrainingModal} buttons={[
                    { label: t('no'), className: 'btn-primary', onClickAsync: ::this.hideRunTrainingModal },
                    { label: t('yes'), className: 'btn-danger', onClickAsync: ::this.runTraining }
                ]}>
                    Are you sure? This will delete the previously trained model.
                </ModalDialog>

                <h3>Training log</h3>
                {this.state.lastRun !== null
                    ? <RunConsole jobId={trainingJobId} runId={this.state.lastRun.id} key={this.state.lastRun.id} />
                    : "Not available."
                }
            </Panel>
        );
    }
}