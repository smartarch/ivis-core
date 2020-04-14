"use strict";

import React, {Component} from "react";
import {ServerAnimationContext} from "../ivis/ServerAnimationContext";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {linear} from "../lib/animation-interpolations";
import {StopButton, PlayPauseButton, JumpForwardButton, JumpBackwardButton, PlaybackSpeedSlider, AnimationTimeline} from "../lib/media-controls";


class SampleAnimation extends Component {
    constructor(props) {
        super(props);

        this.animConfig = {
            timeline: {
                beginTs: 0,
                endTs: 1000*60*60*24,
                relative: true,
            },
            playbackSpeedSlider: {
                enabled: true,
                limits: [0.25, 5],
                step: 0.25,
            },
            jumpForwardButton: {
                jump: 10,
            },
            jumpBackwardButton: {
                jump: 10,
            },

            length: 1000*60*60*20,
        };

        this.animControl = {
            changeSpeed: (value) => console.log("AnimCtrl: speed changed to:", value),
            play: () => console.log("AnimCtrl: playing..."),
            pause: () => console.log("AnimCtrl: pausing..."),

            stop: () => console.log("AnimCtrl: stopping..."),
            jumpForward: (value) => console.log("AnimCtrl jumping forward by:", value),
            jumpBackward: (value) => console.log("AnimCtrl jumping backward by:", value),
        };

        this.animStatus = {
            position: 1000*60*60*5,
            playbackSpeedFactor: 1,
            isPlaying: true,
        };
    }
    render() {
        return (
            <>
                <ServerAnimationContext interpolFunc={linear} >
                    <div>
                        <PlayPauseButton
                            width={40}
                            height={40}
                            margin={{
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                            }}
                            isJoinedRight

                            animStatus={this.animStatus}
                            animControl={this.animControl}
                        />
                        <StopButton
                            width={40}
                            height={40}
                            margin={{
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                            }}
                            isJoinedLeft
                            isJoinedRight

                            animStatus={this.animStatus}
                            animControl={this.animControl}
                        />
                        <JumpForwardButton
                            width={40}
                            height={40}
                            margin={{
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                            }}
                            isJoinedLeft
                            isJoinedRight

                            animConfig={this.animConfig}
                            animStatus={this.animStatus}
                            animControl={this.animControl}
                        />
                        <JumpBackwardButton
                            width={40}
                            height={40}
                            margin={{
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                            }}
                            isJoinedLeft

                            animStatus={this.animStatus}
                            animControl={this.animControl}
                            animConfig={this.animConfig}
                        />

                        <AnimationTimeline
                            width={600}
                            animConfig={this.animConfig}
                            animStatus={this.animStatus}
                        />


                        <PlaybackSpeedSlider
                            width={110}
                            animConfig={this.animConfig}
                            animStatus={this.animStatus}
                            animControl={this.animControl}
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
