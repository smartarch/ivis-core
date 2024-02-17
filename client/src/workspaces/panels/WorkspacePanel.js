'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {Panel} from "../../lib/panel";
import {requiresAuthenticatedUser} from "../../lib/page";
import WorkspacePanelContent from "./WorkspacePanelContent";
import styles from "../../lib/styles.scss";
import {withComponentMixins} from "../../lib/decorator-helpers";
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
    extractPermanentLinkAndRedirect,
    getPermanentLinkConfigFromLocationState,
    getPermanentLinkStateFromLocationState,
    needsToExtractPermanentLinkAndRedirect
} from "../../lib/permanent-link";

import memoize from "memoize-one";

@withComponentMixins([
    requiresAuthenticatedUser
])
class WorkspacePanelBase extends Component {
    constructor(props) {
        super(props);

        this.state = {
            panelMenu: []
        };
    }

    static propTypes = {
        panel: PropTypes.object,
        navigate: PropTypes.func.isRequired,
        location: PropTypes.object.isRequired,
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
        extractPermanentLinkAndRedirect(this.props.location, this.props.navigate);
    }

    componentDidUpdate() {
        extractPermanentLinkAndRedirect(this.props.location, this.props.navigate);
    }

    render() {
        if (needsToExtractPermanentLinkAndRedirect(this.props.location)) {
            return null; // This will be handled by componentDidMount / componentDidUpdate and retried

        } else {
            const permanentLinkConfig = getPermanentLinkConfigFromLocationState(this.props.location);
            const permanentLinkState = getPermanentLinkStateFromLocationState(this.props.location);

            return (
                <Panel title={this.props.panel.name} panelMenu={this.state.panelMenu} onPanelMenuAction={async action => await this.contentNode.onPanelMenuAction(action)}>
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

function WorkspacePanel(props) {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();

    return <WorkspacePanelBase {...props} navigate={navigate} location={location} params={params} />;
}

export default { WorkspacePanel};