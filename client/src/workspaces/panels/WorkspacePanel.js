'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {Panel} from "../../lib/panel";
import {requiresAuthenticatedUser} from "../../lib/page";
import WorkspacePanelContent from "./WorkspacePanelContent";
import styles from "../../lib/styles.scss";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withRouter} from "react-router-dom";
import {
    extractPermanentLinkAndRedirect,
    getPermanentLinkConfigFromLocationState,
    getPermanentLinkStateFromLocationState,
    needsToExtractPermanentLinkAndRedirect
} from "../../lib/permanent-link";

import memoize from "memoize-one";

@withRouter
@withComponentMixins([
    requiresAuthenticatedUser
])
export default class WorkspacePanel extends Component {
    constructor(props) {
        super(props);

        this.state = {
            panelMenu: []
        };
    }

    static propTypes = {
        panel: PropTypes.object
    }

    panel = memoize(
        (panel, permanentLinkConfig, permanentLinkState) => {
            const params = {
                ...panel.params
            };

            if (permanentLinkConfig) {
                Object.assign(params, permanentLinkConfig);
            }

            return {
                ...panel,
                params,
                state: permanentLinkState
            };
        }
    );

    async setPanelMenu(menu) {
        this.setState({
            panelMenu: menu
        });
    }

    componentDidMount() {
        extractPermanentLinkAndRedirect(this.props.location, this.props.history);
    }

    componentDidUpdate() {
        extractPermanentLinkAndRedirect(this.props.location, this.props.history);
    }

    render() {
        if (needsToExtractPermanentLinkAndRedirect(this.props.location)) {
            return null; // This will be handled by componentDidMount / componentDidUpdate and retried

        } else {
            const permanentLinkConfig = getPermanentLinkConfigFromLocationState(this.props.location);
            const permanentLinkState = getPermanentLinkStateFromLocationState(this.props.location);

            return (
                <Panel title={this.props.panel.name} panelMenu={this.state.panelMenu} onPanelMenuAction={action => this.contentNode.onPanelMenuAction(action)}>
                    <div className={styles.panelUntrustedContentWrapper}>
                        <WorkspacePanelContent
                            ref={node => this.contentNode = node}
                            panel={this.panel(this.props.panel, permanentLinkConfig, permanentLinkState)}
                            setPanelMenu={::this.setPanelMenu}
                        />
                    </div>
                </Panel>
            );
        }
    }
}