"use strict";

import React, {Component} from "react";
import {Animation} from "../ivis/Animation";
import TestWorkspacePanel from "./panels/TestWorkspacePanel";


class SampleAnimation extends Component {
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
    render() {
        const panelParams = {
            type: 'client',
            beginTs: Date.parse('2017-01-01T01:00:00.000Z'),
            endTs: Date.parse('2017-01-01T03:59:50.000Z'),

            interpolFunc: 'linear',
            refreshRate: 45,

            //client-specific
            minBufferedKeyframeCount: 3,
            maxBufferedKeyframeCount: 24,

            defaultPlaybackSpeedFactor: 2.5,

            sigSetCid: 'process1',
            signals: ['s1', 's2', 's3', 's4'],
            //client-specific


            //server-specific
            pollRate: 800,
            id: 'test',
            //server-specific

            controlGroup: 'full',
            controlsPlacement: 'before',
            controls: {
                jumpBackward: {
                    shiftMs: 2000,
                    enabled: true,
                },
                jumpForward: {
                    shiftMs: 2000,
                    enabled: true,
                },
                playPause: {
                    enabled: true,
                },
                stop: {
                    enabled: true,
                },
                playbackSpeed: {
                    enabled: true,
                    step: 2.5,
                    limits: [0.5, 10.5]
                },
                timeline: {
                    enabled: true,
                    relative: false,
                }
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
