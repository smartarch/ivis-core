import React, {Component} from "react";
import {Debug} from "./Debug";
import axios from "../lib/axios";
import {getUrl} from "../lib/urls";
import PropTypes from "prop-types";
import {AnimationDataContext, AnimatedBase} from "./AnimatedBase";

const AnimationControlContext = React.createContext(null);
const AnimationStatusContext = React.createContext(null);

class ServerAnimationContext extends Component {
    static propTypes = {
        children: PropTypes.node,
        interpolFunc: PropTypes.func,
    }

    constructor(props) {
        super(props);

        this.buffer = [];
        this.state = {
            lastFetchedStatus: {
            },
            status: {
                isPlaying: false,
                isBuffering: true,
                position: -1,
            },
            keyframes: {},
            controls: {
                play: () => axios.post(getUrl("rest/animation/server/play")),
                pause: () => axios.post(getUrl("rest/animation/server/pause")),
                stop: () => axios.post(getUrl("rest/animation/server/stop")),
                jumpForward: (shiftMs) => axios.post(getUrl("rest/animation/server/seek"), {to: this.state.status.position + shiftMs}),
                jumpBackward: (shiftMs) => axios.post(getUrl("rest/animation/server/seek"), {to: this.state.status.position - shiftMs}),
                seek: (targetPosition) => axios.post(getUrl("rest/animation/server/seek"), {to: targetPosition}),
                changeSpeed: (factor) => axios.post(getUrl("rest/animation/server/changeSpeed"), {to: factor}),
            }
        };

        this.frameNum = 0;

        // status refresh rate - later from props/server..
        this.refreshRate = 2000;
        this.framesInKeyframeContext = 2;
        this.minBufferLength = 3;
        this.safeBufferLength = 4;
        this.frameRefreshRate = 1000/2;
        // should be whole number..
        this.framesCount = this.refreshRate / this.frameRefreshRate;
        this.timingError = 50; //in ms, look how its used

        // For debug purposes
        this.sabotageDataFetch = false;
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.lastFetchedStatus.id !== this.state.lastFetchedStatus.id) {
            const nextStatus = {};

            if (this.state.lastFetchedStatus.didSeek) {
                this.buffer = [this.buffer.pop()];
                nextStatus.position = this.state.lastFetchedStatus.position;

                if (this.state.lastFetchedStatus.isPlaying &&
                    this.buffer.length - this.framesInKeyframeContext < this.minBufferLength) {
                    nextStatus.isPlaying = false;
                    nextStatus.isBuffering = true;

                    this.buffering = true;
                }
            }

            if (prevState.lastFetchedStatus.isPlaying != this.state.lastFetchedStatus.isPlaying) {
                if (this.state.lastFetchedStatus.isPlaying) {
                    const goingToPlay = this.buffer.length - this.framesInKeyframeContext >= this.safeBufferLength;

                    nextStatus.isPlaying = goingToPlay;
                    nextStatus.isBuffering = !goingToPlay;
                    this.buffering = !goingToPlay;

                    this.playInterval = setInterval(::this.refresh, this.frameRefreshRate);
                } else {
                    nextStatus.isPlaying = false;
                    nextStatus.isBuffering = false;
                    this.buffering = false;

                    clearInterval(this.playInterval);
                }
            }

            if(prevState.lastFetchedStatus.speedFactor != this.state.lastFetchedStatus.speedFactor) {
                nextStatus.speedFactor = this.state.lastFetchedStatus.speedFactor;
            }

            if (Object.keys(nextStatus).length > 0) {
                console.log("nextStatus:", nextStatus);
                this.pushStatus(nextStatus);
            }
        }
    }

    componentDidMount() {
        this.statusFetchInterval = setInterval(::this.fetchStatus, this.refreshRate);
    }

    componendDidUnmount() {
        this.stopIntervals();
    }

    didSeek(prevStatus, currStatus) {
        if (!prevStatus.isPlaying && !currStatus.isPlaying) {
            return prevStatus.position != currStatus.position;
        } else if (prevStatus.isPlaying && currStatus.isPlaying) {
            return Math.abs(prevStatus.position + this.refreshRate - currStatus.position) > this.timingError;
        } else {
            return currStatus.position < prevStatus.position || currStatus.position > prevStatus.position + this.refreshRate + this.timingError;
        }
    }

    async fetchStatus() {
        const res = await axios.get(getUrl("rest/animation/server/status"));
        const status = res.data;

        if (this.state.lastFetchedStatus.position != status.position) {
            this.buffer.push({data: status.data, ts: status.position});
        }

        status.didSeek = this.didSeek(this.state.lastFetchedStatus, status);
        status.id = ((this.state.lastFetchedStatus.id || 0) + 1) % Number.MAX_SAFE_INTEGER;

        console.log({
            "position delta": Math.abs(this.state.lastFetchedStatus.position + this.refreshRate - status.position),
            "difference in positions": status.position - this.state.lastFetchedStatus.position,
            "did seek?": status.didSeek,
            "statuses": this.state.lastFetchedStatus.isPlaying + " " + status.isPlaying,
        });

        this.setState({lastFetchedStatus: status});
    }

    pushStatus(status) {
        this.setState((prevState) => {
            const newStatus = Object.assign({}, prevState.status, status);
            const newKeyframes = {curr: this.buffer[0], next: this.buffer[1]};

            if (newStatus.length === undefined)
                newStatus.length = this.state.lastFetchedStatus.length;

            return { status: newStatus, keyframes: newKeyframes };
        });
    }

    refresh() {
        if (this.buffering && this.buffer.length >= this.safeBufferLength) {
            this.buffering = false;
            this.pushStatus({isPlaying: true, isBuffering: false});
        }

        if (!this.buffering && this.buffer.length < this.minBufferLength) {
            this.buffering = true;
            this.pushStatus({isPlaying: false, isBuffering: true});
        } else if (!this.buffering && this.buffer.length >= this.minBufferLength) {
            if (this.frameNum === 0) {
                this.buffer.shift();
            }

            const ratio = this.frameNum / this.framesCount;
            const position = this.buffer[0].ts * (1 - ratio) + this.buffer[1].ts * (ratio);
            this.pushStatus({ position });

            this.frameNum += 1;
            if (this.frameNum === this.framesCount) this.frameNum = 0;
        }
    }

    stopIntervals() {
        clearInterval(this.playInterval);
        clearInterval(this.statusFetchInterval);
    }

    sabotageDataFetchFunc() {
        this.sabotageDataFetch = true;
    }

    render() {
        const functions = [];

        return (
            <>
                <AnimationStatusContext.Provider value={this.state.status}>
                    <AnimationControlContext.Provider value={this.state.controls}>
                        <AnimatedBase
                            interpolFunc={this.props.interpolFunc}
                            status={this.state.status}
                            keyframes={this.state.keyframes}
                        >
                            {this.props.children}
                        </AnimatedBase>
                    </AnimationControlContext.Provider>
                </AnimationStatusContext.Provider>

                <Debug
                    state={this.state}
                    funcs={functions}
                    buffer={this.buffer}
                />
            </>
        );
    }
}


export {
    AnimationStatusContext,
    AnimationDataContext,
    AnimationControlContext,
    ServerAnimationContext
};
