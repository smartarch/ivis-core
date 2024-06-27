'use strict';

import em from '../lib/extension-manager';
import React from "react";
import HelloWorld from "./HelloWorld";

em.set('client.builtinTemplates.routes.hello', (panel, t, panelUrl, isFullscreen) => ({
    // resolve: { ... },
    panelRender: props => <HelloWorld panel={panel} panelUrl={panelUrl} message={panel.params.message} />,  // message from panel configuration
    children: {
        ':message': {
            link: params => `${panelUrl}/${params.message}`,
            panelRender: props => <HelloWorld panel={panel} panelUrl={panelUrl} message={props.params.message} />,  // message from url parameter
            title: resolved => resolved.panel.name,
            panelInFullScreen: isFullscreen,
        }
    }
}));
