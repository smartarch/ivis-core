'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {rgb} from "d3-color";
import {ServerAnimationContext} from "../ivis/ServerAnimationContext.js";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";


export default class SamplePanel extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {};

        return (
            <TestWorkspacePanel
                title="Server Animation Panel"
                panel={{
                    id: 1,
                    template: 1
                }}
                params={panelParams}
                content={ServerAnimationContext}
            />
        );
    }
}
