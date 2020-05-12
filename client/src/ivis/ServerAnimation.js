import React, {Component} from "react";
import {Debug} from "./Debug";
import axios from "../lib/axios";
import {getUrl} from "../lib/urls";
import PropTypes from "prop-types";
import {AnimationStatusContext, AnimationControlContext} from "../lib/animation-helpers";
import {AnimatedBase} from "./AnimatedBase";
import {interpolFuncs} from "../lib/animation-interpolations";

const statusChanges = {
    POSITION: 0,
    STARTED_PLAYING: 1,
    STOPED_PLAYING: 2,
    PLAYBACK_SPEED: 3,
    SEEK: 4,
};

class KeyframeBuffer {
    constructor(minStoredDuration, endTs) {
        this.minStoredDuration = minStoredDuration;
        this.endTs = endTs;

        this.innerBuffer = [];
        this.storedDuration = 0;

        this.reachedEnd = false;
    }

    push(keyframe) {
        if (this.innerBuffer.length > 0) {
            this.storedDuration += keyframe.realtimeTs - this.innerBuffer[this.innerBuffer.length - 1].realtimeTs;
        }

        this.reachedEnd = keyframe.ts === this.endTs;

        this.innerBuffer.push(keyframe);
    }

    shift() {
        this.storedDuration -= this.innerBuffer[1].realtimeTs - this.innerBuffer[0].realtimeTs;
        this.innerBuffer.shift();
    }

    invalidateExceptLast() {
        this.innerBuffer = [this.innerBuffer.pop()];
        this.storedDuration = 0;
    }

    invalidate() {
        this.storedDuration = 0;
        this.innerBuffer = [];
        this.reachedEnd = false;
    }

    hasStartingDuration() {
        return this.reachedEnd ? this.innerBuffer.length > 1 : (this.storedDuration >= 1.2*this.minStoredDuration);
    }

    hasMinimalDuration() {
        return this.reachedEnd ? this.innerBuffer.length > 1 : (this.storedDuration >= this.minStoredDuration);
    }

    current() {
        return this.innerBuffer[0];
    }

    next() {
        return this.innerBuffer[1];
    }

    didReachEnd() {
        return this.reachedEnd;
    }

    _inner() {
        return [...this.innerBuffer];
    }
}

class ServerAnimation extends Component {
    static propTypes = {
        children: PropTypes.node,
        config: PropTypes.object,
        lastFetchedStatus: PropTypes.object,
        lastFetchedKeyframe: PropTypes.object,
    }

    constructor(props) {
        super(props);

        this.baseUrl = "rest/animation/server/" + props.config.id + "/";

        this.buffer = new KeyframeBuffer(3*props.config.pollRate, props.config.endTs);

        this.localStatusDiff = new Set();

        this.animControls = {
            play: ::this.play,
            pause: ::this.pause,
            stop: ::this.stop,
            jumpForward: (shiftMs) => this.seek(this.state.status.position + shiftMs),
            jumpBackward: (shiftMs) => this.seek(this.state.status.position - shiftMs),
            seek: ::this.seek,
            changeSpeed: ::this.changePlaybackSpeed,
        };

        this.initialStatus = true;

        this.state = {
            status: {
                isPlaying: false,
                isBuffering: true,
                position: this.props.config.beginTs,
                playbackSpeedFactor: 1,
            },
            controls: {},
        };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.lastFetchedStatus !== this.props.lastFetchedStatus) {
            console.log("New status",{old: prevProps.lastFetchedStatus, new: this.props.lastFetchedStatus});
            const optionalCurrKeyframe = prevProps.lastFetchedKeyframe !== this.props.lastFetchedKeyframe && this.props.lastFetchedKeyframe;
            this.handleStatusChange(optionalCurrKeyframe);

            if (this.initialStatus) {
                this.initialStatus = false;
                this.setState({controls: this.animControls});
            }
        } else if (prevProps.lastFetchedKeyframe !== this.props.lastFetchedKeyframe) {
            console.log("New keyframe", {old: prevProps.lastFetchedKeyframe, new: this.props.lastFetchedKeyframe});
            this.buffer.push(this.props.lastFetchedKeyframe);
        }
    }

    componendDidUnmount() {
        clearInterval(this.playInterval);
    }

    handleStatusChange(optionalCurrKeyframe) {
        const newStatus = this.props.lastFetchedStatus.status;
        const diffLog = this.props.lastFetchedStatus.diffLog;
        const nextStatus = {};

        if (diffLog.has(statusChanges.SEEK)) {
            if (this.localStatusDiff.has(statusChanges.SEEK) && this.state.status.position === newStatus.position) this.localStatusDiff.delete(statusChanges.SEEK);
            else this.handleSeek(newStatus.position, nextStatus);
        }

        if (diffLog.has(statusChanges.PLAYBACK_SPEED)) {
            console.log("seeing new speed", optionalCurrKeyframe);
            if (this.localStatusDiff.has(statusChanges.PLAYBACK_SPEED) && this.state.status.playbackSpeedFactor === newStatus.playbackSpeedFactor)
                this.localStatusDiff.delete(statusChanges.PLAYBACK_SPEED);
            else
                this.handlePlaybackSpeedChange(newStatus.playbackSpeedFactor, nextStatus);
        }

        if (diffLog.has(statusChanges.STARTED_PLAYING)) {
            if (this.localStatusDiff.has(statusChanges.STARTED_PLAYING)) this.localStatusDiff.delete(statusChanges.STARTED_PLAYING);
            else this.handlePlay(nextStatus);
        }

        if (diffLog.has(statusChanges.STOPED_PLAYING) && newStatus.position !== this.props.config.endTs) {
            if (this.localStatusDiff.has(statusChanges.STOPED_PLAYING)) this.localStatusDiff.delete(statusChanges.STOPED_PLAYING);
            else this.handlePause(nextStatus);
        }

        if (optionalCurrKeyframe) {
            this.buffer.push(optionalCurrKeyframe);
        }

        this.pushStatus(nextStatus);
    }

    pushStatus(status) {
        this.setState((prevState) => {
            const newStatus = Object.assign({}, prevState.status, status);
            const newKeyframes = {curr: this.buffer.current(), next: this.buffer.next()};

            console.log({"pushed status": newStatus});
            return { status: newStatus, keyframes: newKeyframes };
        });
    }

    handlePlay(nextStatus) {
        this.isBuffering = this.buffer.hasStartingDuration();
        nextStatus.isPlaying = true;
        nextStatus.isBuffering = this.isBuffering;
        this.playInterval = setInterval(::this.refresh, this.props.config.refreshRate);
    }

    handlePause(nextStatus) {
        clearInterval(this.playInterval);
        nextStatus.isPlaying = false;
        nextStatus.isBuffering = false;
    }

    handleSeek(position, nextStatus) {
        this.buffer.invalidate();
        nextStatus.position = position;
        nextStatus.isBuffering = this.state.status.isPlaying ? !this.buffer.hasMinimalDuration() : false;
    }

    handlePlaybackSpeedChange(factor, nextStatus) {
        this.buffer.invalidate();
        nextStatus.isBuffering = this.state.status.isPlaying ? !this.buffer.hasMinimalDuration() : false;
        nextStatus.playbackSpeedFactor = factor;
    }

    refresh() {
        console.log("Refreshing");
        const getPositionJump = () => {
            const jumpPerMs = (this.buffer.next().ts - this.buffer.current().ts)/(this.buffer.next().realtimeTs - this.buffer.current().realtimeTs);
            return jumpPerMs*this.props.config.refreshRate;
        };

        if (this.state.status.position === this.props.config.endTs) {
            console.log("reached end");
            clearInterval(this.playInterval);
            this.pushStatus({isPlaying: false});
            return;
        }

        if (this.isBuffering && this.buffer.hasStartingDuration()) {
            console.log("Buffering finished");
            this.isBuffering = false;
            this.pushStatus({isBuffering: false});
        }

        if (!this.isBuffering && !this.buffer.hasMinimalDuration()) {
            console.log("Buffering started");
            this.isBuffering = true;
            this.pushStatus({isBuffering: true});
        } else if (!this.isBuffering && this.buffer.hasMinimalDuration()) {
            console.log("Continue playing");

            const nextPosition = Math.min(
                this.props.config.endTs,
                Math.max(this.buffer.current().ts, this.state.status.position + getPositionJump())
            );


            if (nextPosition >= this.buffer.next().ts) {
                this.buffer.shift();
            }

            this.pushStatus({ position: nextPosition });
        }
    }

    async play() {
        this.localStatusDiff.add(statusChanges.STARTED_PLAYING);

        const nextStatus = {};
        this.handlePlay(nextStatus);
        this.pushStatus(nextStatus);

        await axios.post(getUrl(this.baseUrl + "play"));
    }

    async pause() {
        this.localStatusDiff.add(statusChanges.STOPED_PLAYING);

        const nextStatus = {};
        this.handlePause(nextStatus);
        this.pushStatus(nextStatus);

        await axios.post(getUrl(this.baseUrl + "pause"));
    }

    async stop() {
        this.localStatusDiff.add(statusChanges.STOPED_PLAYING);
        this.localStatusDiff.add(statusChanges.SEEK);

        const nextStatus = {};
        this.handlePause(nextStatus);
        this.handleSeek(this.props.config.beginTs, nextStatus);
        this.pushStatus(nextStatus);

        await axios.post(getUrl(this.baseUrl + "reset"));
    }

    async seek(position) {
        this.localStatusDiff.add(statusChanges.SEEK);

        const nextStatus = {};
        this.handleSeek(position, nextStatus);

        const targetPosition = this.state.status.isPlaying ? position - this.props.config.pollRate/2 : position;
        await axios.post(getUrl(this.baseUrl + "seek"), {to: targetPosition});
    }

    async changePlaybackSpeed(newFactor) {
        this.localStatusDiff.add(statusChanges.PLAYBACK_SPEED);

        const nextStatus = {};

        this.handlePlaybackSpeedChange(newFactor, nextStatus);
        this.pushStatus(nextStatus);

        axios.post(getUrl(this.baseUrl + "changeSpeed"), {to: newFactor});
        if (this.state.status.isPlaying) this.seek(this.state.status.position);
    }


    render() {
        const functions = [];

        const interpolFunc = interpolFuncs[this.props.config.interpolFunc];
        return (
            <>
                <AnimationStatusContext.Provider value={this.state.status}>
                    <AnimationControlContext.Provider value={this.state.controls}>
                        <AnimatedBase
                            interpolFunc={interpolFunc}
                            status={this.state.status}
                            keyframes={this.state.keyframes}>

                            {this.props.children}
                            <Debug
                                name={"Server Animation"}
                                state={this.state}
                                funcs={functions}
                                config={this.props.config}
                                buffer={this.buffer._inner()}
                            />
                        </AnimatedBase>
                    </AnimationControlContext.Provider>
                </AnimationStatusContext.Provider>
            </>
        );
    }
}

function withStatusPoll(AnimationComp) {
    class StatusPoll extends Component {
        static propTypes = {
            config: PropTypes.object,
            forwardRef: PropTypes.func,
        }

        constructor(props) {
            super(props);

            this.url = "rest/animation/server/" + props.config.id + "/status";
            this.lastStatusId = -1;

            this.state = {
                lastFetchedStatus: {
                    status: {},
                },
                lastFetchedKeyframe: {},
            };
        }

        componentDidMount() {
            this.fetchStatus();
            this.fetchInterval = setInterval(::this.fetchStatus, this.props.config.pollRate);
        }

        componentWillUnmount() {
            clearInterval(this.fetchInterval);
        }

        async fetchStatus() {
            const res = await axios.get(getUrl(this.url));

            const {data, ...status} = res.data;
            const diffLog = this.runStatusDiff(status);

            if (diffLog.size === 0) return;

            const nextState = {};
            if (diffLog.has(statusChanges.POSITION)) {
                nextState.lastFetchedKeyframe = {
                    ts: status.position,
                    realtimeTs: status.realtimePosition,
                    data,
                };
            }

            if (diffLog.size > (diffLog.has(statusChanges.POSITION) ? 1 : 0)) {
                nextState.lastFetchedStatus = {
                    status,
                    diffLog,
                };
            }

            if (Object.keys(nextState).length > 0) {
                this.setState(nextState);
            }

            this.lastPosition = status.position;
            this.lastRealtimePosition = status.realtimePosition;
        }

        runStatusDiff(newStatus) {
            const oldStatus = this.state.lastFetchedStatus.status;
            const diffLog = new Set();

            const didSeek = () => {
                if (!oldStatus.isPlaying && !newStatus.isPlaying)
                    return diffLog.has(statusChanges.POSITION);

                if (this.lastRealtimePosition === undefined) return true;
                const timingError = this.props.config.pollRate;
                const estimated = this.lastRealtimePosition + this.props.config.pollRate;

                console.log({
                    estimated,
                    pos: newStatus.position,
                    real: newStatus.realtimePosition,
                    lastReal: this.lastRealtimePosition,
                    difference: Math.abs(estimated - newStatus.realtimePosition),
                    "allowed difference":timingError,
                });

                if (newStatus.position === this.props.config.endTs) {
                    return this.lastRealtimePosition > newStatus.realtimePosition || newStatus.realtimePosition > estimated + timingError/2;
                } else {
                    return Math.abs(estimated - newStatus.realtimePosition) > timingError;
                }
            };

            if (this.lastPosition !== newStatus.position) {
                diffLog.add(statusChanges.POSITION);
            }

            if (oldStatus.isPlaying && !newStatus.isPlaying ) {
                diffLog.add(statusChanges.STOPED_PLAYING);
            } else if (!oldStatus.isPlaying && newStatus.isPlaying) {
                diffLog.add(statusChanges.STARTED_PLAYING);
            }

            if (oldStatus.playbackSpeedFactor !== newStatus.playbackSpeedFactor) {
                console.log("new speed");
                diffLog.add(statusChanges.PLAYBACK_SPEED);
            }

            if (didSeek()) {
                diffLog.add(statusChanges.SEEK);
            }

            return diffLog;
        }

        render() {
            const {forwardRef, ...propsRest} = this.props;

            return (
                <AnimationComp
                    {...propsRest}
                    ref={forwardRef}
                    lastFetchedStatus={this.state.lastFetchedStatus}
                    lastFetchedKeyframe={this.state.lastFetchedKeyframe}
                />
            );
        }
    }

    return React.forwardRef((props, ref) =>
        (<StatusPoll {...props} forwardRef={ref} />)
    );
}


const ServerAnimationWithStatusPoll = withStatusPoll(ServerAnimation);

export {
    ServerAnimationWithStatusPoll as ServerAnimation
};
