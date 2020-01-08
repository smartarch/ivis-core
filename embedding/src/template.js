'use strict';

const {VIRTUAL_WORKSPACE_ID, VIRTUAL_PANEL_ID} = require('../../shared/panels');
const {restCall, getAnonymousSandboxUrl: getAnonymousSandboxUrlHelper, getSandboxUrl: getSandboxUrlHelper} = require('./lib/helpers');

export function embedTemplate(domElementId, ivisSandboxUrlBase, templateId, config, accessToken, callbacks) {

    const getAnonymousSandboxUrl = (path) => getAnonymousSandboxUrlHelper(ivisSandboxUrlBase, path);
    const getSandboxUrl = (path) => getSandboxUrlHelper(ivisSandboxUrlBase, accessToken, path);

    let refreshAccessTokenTimeout = null;
    const scheduleRefreshAccessToken = () => {
        refreshAccessTokenTimeout = setTimeout(() => {
            restCall('PUT', getSandboxUrl('rest/embedded-entity-renew-restricted-access-token'), {token: accessToken}, () => {
                scheduleRefreshAccessToken();
            });
        }, 30 * 1000);
    };
    scheduleRefreshAccessToken();


    restCall('GET', getSandboxUrl(`rest/templates/${templateId}`), null, template => {
        let contentNodeIsLoaded = false;

        const sendMessage = (type, data) => {
            if (contentNodeIsLoaded) { // This is to avoid errors "common.js:45744 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://localhost:8081') does not match the recipient window's origin ('http://localhost:3000')"
                contentNode.contentWindow.postMessage({type, data}, getSandboxUrl());
            }
        };

        const receiveMessage = evt => {
            const msg = evt.data;

            if (msg.type === 'initNeeded') {
                // It seems that sometime the message that the content node does not arrive. However if the content root notifies us, we just proceed
                contentNodeIsLoaded = true;

                const panel = {
                    "id": VIRTUAL_PANEL_ID,
                    "name": config.name || "",
                    "description": config.description || "",
                    "workspace": VIRTUAL_WORKSPACE_ID,
                    "template": templateId,
                    "builtin_template": null,
                    "params": config.params,
                    "namespace": template.namespace,
                    "order": null,
                    "templateParams": template.settings.params,
                    "templateElevatedAccess": template.elevated_access,
                    "permissions": [
                        "edit",
                        "view"
                    ],
                    "orderBefore": 'none'
                };

                const contentProps = {
                    panel: panel
                };

                sendMessage('init', {accessToken, contentProps});

            } else if (msg.type === 'rpcRequest') {
                const method = msg.data.method;
                const params = msg.data.params;

                let ret;

                if (method === 'navigateTo') {
                    if (callbacks && callbacks.navigateTo) {
                        callbacks.navigateTo(params.path);
                    }
                }

                sendMessage('rpcResponse', {msgId: msg.data.msgId, ret});

            } else if (msg.type === 'clientHeight') {
                contentNode.height = msg.data;
            }
        };

        window.addEventListener('message', receiveMessage, false);

        const contentNode = document.createElement('iframe');
        contentNode.src = getAnonymousSandboxUrl('panel');
        contentNode.style.border = '0px none';
        contentNode.style.width = '100%';
        contentNode.style.overflow = 'hidden';
        contentNode.onload = () => contentNodeIsLoaded = true;

        document.getElementById(domElementId).appendChild(contentNode);
    });
}
