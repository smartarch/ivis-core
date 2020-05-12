"use strict";

import React, {Component} from "react";
import {Animation} from "../ivis/Animation";
import TestWorkspacePanel from "./panels/TestWorkspacePanel";


class SampleAnimation extends Component {
    constructor(props) {
        super(props);

        this.config_1 = {
            beginTs: 0,
            endTs: 16000,
            type: 'server',
            realTimeDuration: 16000,

            timeline: {
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
        };

        this.config_2 = {
            beginTs: 0,
            endTs: 15000,
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
                <Animation>
                </Animation>
            </>
        );
    }
}

export default class SamplePanel extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {
            controlGroup: 'full',
            controlsPlacement: 'before',

            controls: {
                jumpForward: {
                    enabled: false
                },
            },
        };

        return (
            <TestWorkspacePanel
                title="Server Animation Panel"
                panel={{}}
                params={panelParams}
                content={Animation}
            />
        );
    }
}
