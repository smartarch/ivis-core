"use strict";

import React, {Component} from "react";
import {ServerAnimationContext} from "../ivis/ServerAnimationContext";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {linear} from "../lib/animation-interpolations";
import {StopButton, PlayPauseButton, JumpForwardButton, JumpBackwardButton, PlaybackSpeedSlider, PlaybackTimeline, AnimationTimeline} from "../lib/media-controls";


class SampleAnimation extends Component {
    constructor(props) {
        super(props);

        this.animConfig = {
            timeline: {
                beginTs: 0,
                endTs: 1000*60*60*24,
                relative: true,
            },
            length: 1000*60*60*20,
        };

        this.animStatus = {
            position: 1000*60*60*5,
        };
    }
    render() {
        return (
            <>
                <ServerAnimationContext interpolFunc={linear} >
                    <div>
                        <PlayPauseButton
                            width={"40"}
                            height={"40"}
                            isJoinedLeft={false}
                            isJoinedRight={true}
                        />
                        <StopButton
                            width={"40"}
                            height={"40"}
                            isJoinedLeft={true}
                            isJoinedRight={true}
                        />
                        <JumpBackwardButton
                            width={"40"}
                            height={"40"}
                            isJoinedLeft={true}
                            isJoinedRight={true}
                            jump={200}
                        />
                        <JumpForwardButton
                            width={"40"}
                            height={"40"}
                            isJoinedLeft={true}
                            isJoinedRight={false}
                            jump={200}
                        />
                        <PlaybackSpeedSlider
                            minFactor={0.25}
                            maxFactor={2.25}
                        />


                        <AnimationTimeline
                            width={600}
                            animConfig={this.animConfig}
                            animStatus={this.animStatus}
                        />

                    </div>
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
