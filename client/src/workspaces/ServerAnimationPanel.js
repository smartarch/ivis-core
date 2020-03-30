"use strict";

import React, {Component} from "react";
import {ServerAnimationContext} from "../ivis/ServerAnimationContext";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";
import {linear} from "../lib/animation-interpolations";
import {axisBottom} from "d3-axis";
import {StopButton, PlayPauseButton, JumpForwardButton, JumpBackwardButton, PlaybackSpeedSlider, SliderBase, TimelineD3} from "../lib/media-controls";


class SampleAnimation extends Component {
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

                        <TimelineD3
                            id={0}
                            length={1000*60*30}
                            beginTs={0}
                            endTs={1000*60*60*24*30*6}
                            position={1000*60*4}
                            axis={axisBottom}
                            ticks={{
                                values: [1000*60*60*24*30*3, 1000*60*60*24*30*2],
                                labels: [0, 1000*60*60*24*30*3, 1000*60*60*24*30*6],
                            }}
                        />

                        <TimelineD3
                            id={1}
                            length={1000*60*30}
                            beginTs={0}
                            relative
                            endTs={1000*60*60*24*30*6}
                            position={1000*60*4}
                            axis={axisBottom}
                        />

                        {/* <Timeline */}
                        {/*     length={2.5*60*60*1000} */}
                        {/*     width={"100%"} */}
                        {/*     bigTickMargin={100} */}
                        {/*     smallTickMargin={15} */}
                        {/*     labelFontSize={"89px"} */}
                        {/*     begin={Date.now()} */}
                        {/* /> */}
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
