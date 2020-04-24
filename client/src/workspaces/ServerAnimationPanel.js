"use strict";

import React, {Component} from "react";
import {ServerAnimationContext} from "../ivis/ServerAnimationContext";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {linear} from "../lib/animation-interpolations";
import {PlayStopControlGroup, FullControlGroup} from "../lib/media-controls";


class SampleAnimation extends Component {
    constructor(props) {
        super(props);

        this.animConfig = {
            timeline: {
                beginTs: 1000*60*1.43687890679,
                endTs: 1000*60*5,
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
                        <FullControlGroup
                            animConfig={this.animConfig}
                            animStatus={this.animStatus}
                            animControl={this.animControl}
                        />
                        <PlayStopControlGroup
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
