"use strict";

import React, {Component} from "react";
import {Animation, AnimationContent} from "../ivis/Animation";
import TestWorkspacePanel from "./panels/TestWorkspacePanel";
import PropTypes from "prop-types";
import {SVG} from "../ivis/SVG";

const svg = `
<svg viewBox="-20 0 145 120" xmlns="http://www.w3.org/2000/svg">

  <g id="s1">
      <text x="-20" y="15" dominant-baseline="middle" fill="black" style="font-size: 10px">s1:</text>
      <line x1="0" y1="15" x2="100" y2="15" stroke-width="2" stroke-linecap="round" stroke="black" />
      <circle class="pointer" cx="50" cy="15" fill="dodgerblue" r="6" />
      <text class="label" x="125" y="15" dominant-baseline="middle" text-anchor="end" fill="black" style="font-size: 10px"></text>
  </g>

  <g id="s2">
      <text x="-20" y="45" dominant-baseline="middle" fill="black" style="font-size: 10px">s2:</text>
      <line x1="0" y1="45" x2="100" y2="45" stroke-width="2" stroke-linecap="round" stroke="black" />
      <circle class="pointer" cx="50" cy="45" fill="dodgerblue" r="6" />
      <text class="label" x="125" y="45" dominant-baseline="middle" text-anchor="end" fill="black" style="font-size: 10px"></text>
  </g>

  <g id="s3">
      <text x="-20" y="75" dominant-baseline="middle" fill="black" style="font-size: 10px">s3:</text>
      <line x1="0" y1="75" x2="100" y2="75" stroke-width="2" stroke-linecap="round" stroke="black" />
      <circle class="pointer" cx="50" cy="75" fill="dodgerblue" r="6" />
      <text class="label" x="125" y="75" dominant-baseline="middle" text-anchor="end" fill="black" style="font-size: 10px"></text>
  </g>

  <g id="s4">
      <text x="-20" y="105" dominant-baseline="middle" fill="black" style="font-size: 10px">s4:</text>
      <line x1="0" y1="105" x2="100" y2="105" stroke-width="2" stroke-linecap="round" stroke="black" />
      <circle class="pointer" cx="50" cy="105" fill="dodgerblue" r="6" />
      <text class="label" x="125" y="105" dominant-baseline="middle" text-anchor="end" fill="black" style="font-size: 10px"></text>
  </g>
</svg>
`;

class SampleAnimation extends Component {
    static propTypes = {
        animationData: PropTypes.object,
    }

    constructor(props) {
        super(props);

        this.limits = {
            s1: [-8, 9],
            s2: [-9, 5],
            s3: [-24, 4],
            s4: [-2, 11],
        };
    }

    getDataFunc(key) {
        const limits = this.limits[key];
        const value = this.props.animationData[key];

        return (node) => {
            const pointer = node.select('.pointer');
            const label = node.select('.label');

            pointer.attr("cx", this.getPosition(limits, value));
            label.text(value.toFixed(2));
        };
    }

    getPosition(limits, value) {
        return (value - limits[0])*100/(limits[1] - limits[0]);
    }

    render() {
        return (
            <SVG
                source={svg}
                width={"100%"}
                height={"500px"}
                maxWidth={"100%"}
                maxHeight={"500px"}
                data={{
                    s1: this.getDataFunc('s1'),
                    s2: this.getDataFunc('s2'),
                    s3: this.getDataFunc('s3'),
                    s4: this.getDataFunc('s4'),
                }}
            />
        );
    }
}

class AnimationPanel extends Component {
    static propTypes = {
        params: PropTypes.object,
        panel: PropTypes.object,
    }

    render() {
        const render = (props) => {
            return <SampleAnimation {...props} />;
        };

        return (
            <Animation config={this.props.params}>
                <AnimationContent
                    width="90%"
                    height="500px"
                    margin="50px auto"
                    message="Loading"
                    render={render}
                />
            </Animation>
        );
    }
}


export default class AnimationSamplePanel4 extends Component {
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

            defaultPlaybackSpeedFactor: 50.5,

            sigSetCid: 'process1',
            signals: ['s1', 's2', 's3', 's4'],
            //client-specific


            //server-specific
            pollRate: 800,
            id: 'test',
            //server-specific

            controlGroup: 'playStop',
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
                    limits: [0.5, 20.5]
                },
                timeline: {
                    enabled: true,
                    relative: false,
                }
            },
        };

        return (
            <TestWorkspacePanel
                title="Client Animation: Panel 4"
                panel={{}}
                params={panelParams}
                content={AnimationPanel}
            />
        );
    }
}
