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
        }
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchData();
    }

    async fetchData() {
        const trainingJobId = this.props.jobs.training;
        const lastRun = await axios.get(getUrl(`rest/jobs/${trainingJobId}/last-run`))
        this.setState({
            lastRun: lastRun.data,
        });
    }

    render() {
        const t = this.props.t;
        const prediction = this.props.prediction;
        const trainingJobId = this.props.jobs.training;

        return (
            <Panel
                title={t('Neural network model overview')}
            >
                {/*<Toolbar>
                    <LinkButton
                        to={`/settings/signal-sets/${prediction.set}/predictions/${prediction.type}/${prediction.id}/delete`}
                        className="btn-danger"
                        icon="trash-alt"
                        label={t('Delete')} />
                </Toolbar>*/}

                <h3>Training log</h3>
                {this.state.lastRun !== null
                    ? <RunConsole jobId={trainingJobId} runId={this.state.lastRun.id} />
                    : "Not available."
                }

            </Panel>
        );
    }
}