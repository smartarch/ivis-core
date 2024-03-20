'use strict';

import './lib/public-path';

import React from 'react';
import ReactDOM from 'react-dom';
import {TranslationRoot} from './lib/i18n';

import {Section} from './lib/page-sandbox';
import WorkspacePanelSandbox from './workspaces/panels/WorkspacePanelSandbox';
import {parentRPC, UntrustedContentRoot} from "./lib/untrusted";
import {setRestrictedAccessTokenFromPath} from "./lib/urls";
import {extractPermanentLink} from "./lib/permanent-link";

setRestrictedAccessTokenFromPath(window.location.pathname);

parentRPC.init();

const getStructure = t => {

    return {
        children: {
            panel: {
                panelRender: props =>{
                    return <UntrustedContentRoot render={props => <WorkspacePanelSandbox {...props} />} />;
                },
                insideIframe: true,

                children: {
                    ':panelId': {
                        resolve: {
                            panel: params => `rest/panels/${params.panelId}`
                        },

                        panelRender: props => {
                            const {config, state} = extractPermanentLink(props.location);

                            const panelParams = {
                                ...props.resolved.panel.params
                            };

                            if (config) {
                                Object.assign(panelParams, config);
                            }

                            const panelState = {
                                ...props.resolved.panel.state
                            };

                            if (state) {
                                Object.assign(panelState, state);
                            }

                            const panel = {
                                ...props.resolved.panel,
                                params: panelParams,
                                state: panelState
                            };

                            return <WorkspacePanelSandbox panel={panel} />;
                        }
                    }
                }
            }
        }
    };
};

ReactDOM.render(
    <TranslationRoot><Section root='/' structure={getStructure} /></TranslationRoot>,
    document.getElementById('root')
);


