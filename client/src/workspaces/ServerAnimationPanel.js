"use strict";

import React, {Component} from "react";
import {ServerAnimationContext, AnimationKeyframeContext} from "../ivis/ServerAnimationContext";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {AnimatedBase} from "../ivis/AnimatedBase";
import {linear} from "../lib/animation-interpolations";

class SampleAnimation extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <>
                <ServerAnimationContext>
                    <AnimationKeyframeContext.Consumer>
                        {value =>
                            <AnimatedBase
                                interpolationFunc={linear}
                                fromPanel={this.props}
                                animationKeyframeContext={value}
                            />
                        }
                    </AnimationKeyframeContext.Consumer>
                </ServerAnimationContext>
            </>
        );
    }
}

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
                content={SampleAnimation}
            />
        );
    }
}
