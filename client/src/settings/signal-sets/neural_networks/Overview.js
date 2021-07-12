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

        this.setState({
            lastRun,
            timeout,
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

    render() {
        const t = this.props.t;
        const prediction = this.props.prediction;
        const trainingJobId = this.props.jobs.training;

        return (
            <Panel title={t('Neural network model overview') + ": " + prediction.name}>
                <Toolbar className={"text-left"}>
                    {this.state.lastRun && !this.state.lastRun.finished_at && <Button onClickAsync={::this.stopTraining} label={"Stop training"} className="btn-danger" icon={"stop"} />}
                    <Button onClickAsync={::this.showRunTrainingModal} label={"Re-run training"} className="btn-danger" icon={"retweet"} />
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