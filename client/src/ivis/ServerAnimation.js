import React, {Component} from "react";
import {Debug} from "./Debug";
import axios from "../lib/axios";
import {getUrl} from "../lib/urls";
import PropTypes from "prop-types";
import {AnimationStatusContext, AnimationControlContext} from "../lib/animation-helpers";
import {AnimatedBase} from "./AnimatedBase";
import {interpolFuncs} from "../lib/animation-interpolations";
import {withAsyncErrorHandler} from "../lib/error-handling";

const statusChanges = {
    POSITION: 0,
    STARTED_PLAYING: 1,
    STOPED_PLAYING: 2,
    PLAYBACK_SPEED: 3,
    SEEK: 4,
    REACHED_END: 5,
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

        this.reachedEnd = keyframe.ts >= this.endTs;

        this.innerBuffer.push(keyframe);
    }

    shift() {
        if (this.innerBuffer.length > 1) this.storedDuration -= this.innerBuffer[1].realtimeTs - this.innerBuffer[0].realtimeTs;
        return this.innerBuffer.shift();
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

    get current() {
        return this.innerBuffer[0];
    }

    get next() {
        return this.innerBuffer[1];
    }

    get length() {
        return this.innerBuffer.length;
    }

    didReachEnd() {
        return this.reachedEnd;
    }

    _inner() {
        return [...this.innerBuffer];
    }
}

//TODO: needs thorough check
class ServerAnimation extends Component {
    static propTypes = {
        children: PropTypes.node,
        config: PropTypes.object,
        lastFetchedStatus: PropTypes.object,
        lastFetchedKeyframe: PropTypes.object,
        statusFetchError: PropTypes.object,
    }

    constructor(props) {
        super(props);

        this.baseUrl = "rest/animation/" + props.config.id + "/";

        this.buffer = new KeyframeBuffer(3*props.config.pollRate, props.config.endTs);

        this.localPlayControl = false;

        this.animControls = {
            play: ::this.play,
            pause: ::this.pause,
            stop: ::this.stop,
            jumpForward: (shiftMs) => this.seek(Math.min(props.config.endTs, this.state.status.position + shiftMs)),
            jumpBackward: (shiftMs) => this.seek(Math.max(props.config.beginTs, this.state.status.position - shiftMs)),
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
        //TODO: on config change???
        let nextStatus = {};
        if (prevProps.lastFetchedStatus !== this.props.lastFetchedStatus) {
            // console.log("New status",{old: prevProps.lastFetchedStatus, new: this.props.lastFetchedStatus});
            nextStatus = this.handleStatusChange();

            if (this.initialStatus) {
                this.initialStatus = false;
                this.setState({controls: this.animControls});
            }
        }

        if (prevProps.lastFetchedKeyframe !== this.props.lastFetchedKeyframe) {
            // console.log("New keyframe", {old: prevProps.lastFetchedKeyframe, new: this.props.lastFetchedKeyframe});
            this.buffer.push(this.props.lastFetchedKeyframe);
            if (!this.isPlaying && (nextStatus.isBuffering || this.state.status.isBuffering)) nextStatus.isBuffering = false;
        }

        if (Object.keys(nextStatus).length > 0) this.setStatus(nextStatus);

        if (this.props.statusFetchError && !prevProps.statusFetchError) {
            this.errorHandler(this.props.statusFetchError);
        }
    }

    componentDidMount() {
        this.seek(this.props.config.beginTs);
    }

    componentWillUnmount() {
        clearInterval(this.playInterval);
    }


    handleStatusChange() {
        const newStatus = this.props.lastFetchedStatus.status;
        const diffLog = this.props.lastFetchedStatus.diffLog;
        const nextStatus = {};

        // console.log("Status change", {current: this.state.status, new: newStatus, newDiff: diffLog});

        if (this.localPlayControl) {
            this.synchronize(newStatus);
        }

        if (diffLog.has(statusChanges.SEEK) && this.lastSeekTo !== newStatus.seek.last) {
            this.handleSeek(newStatus.position, nextStatus);
        }

        if (diffLog.has(statusChanges.PLAYBACK_SPEED) && this.state.status.playbackSpeedFactor !== newStatus.playbackSpeedFactor) {
            this.handlePlaybackSpeedChange(newStatus.playbackSpeedFactor, nextStatus);
        }

        if (diffLog.has(statusChanges.STARTED_PLAYING) && !this.isPlaying) {
            this.handlePlay(nextStatus);
        }

        if (diffLog.has(statusChanges.STOPED_PLAYING) && !diffLog.has(statusChanges.REACHED_END) && this.isPlaying) {
            this.handlePause(nextStatus);
        }

        if (diffLog.has(statusChanges.REACHED_END)) {
            this.localPlayControl = true;
        }

        return nextStatus;
    }

    setStatus(status) {
        this.setState((prevState) => {
            const newStatus = Object.assign({}, prevState.status, status);
            const newKeyframes = {curr: this.buffer.current, next: this.buffer.next};

            // console.log({"pushed status": newStatus});
            return { status: newStatus, keyframes: newKeyframes };
        });
    }

    refresh() {
        // console.log("Refreshing");
        const getPositionJump = () => {
            //TODO: getting rid of realtimeTs, instead calculating realTime by
            //multiplication with speed factor

            const jump = this.savedInterval || Date.now() - this.lastRefreshTs;
            this.lastRefreshTs = Date.now();

            const jumpPerMs = (this.buffer.next.ts - this.buffer.current.ts)/(this.buffer.next.realtimeTs - this.buffer.current.realtimeTs);
            return jumpPerMs*jump;
        };

        if (this.state.status.position === this.props.config.endTs) {
            // console.log("reached end");
            this.localPlayControl = true;
            this.pause();

            return;
        }

        if (this.isBuffering && this.buffer.hasStartingDuration()) {
            // console.log("Buffering finished");
            this.isBuffering = false;
            this.setStatus({isBuffering: false});
        }

        if (!this.isBuffering && !this.buffer.hasMinimalDuration()) {
            // console.log("Buffering started");
            this.lastRefreshTs = Date.now();
            this.isBuffering = true;
            this.setStatus({isBuffering: true});
        } else if (!this.isBuffering && this.buffer.hasMinimalDuration()) {
            // console.log("Continue playing");

            const nextPosition = Math.min(
                this.props.config.endTs,
                Math.max(this.buffer.current.ts, this.state.status.position + getPositionJump())
            );


            //
            while (this.buffer.hasMinimalDuration() && nextPosition >= this.buffer.next.ts) {
                this.buffer.shift();
            }

            if (!this.buffer.hasMinimalDuration()) {
                this.isBuffering = true;
                this.setStatus({isBuffering: true});
            } else {
                this.setStatus({ position: nextPosition });
            }
        } else {
            this.lastRefreshTs = Date.now();
        }
    }

    synchronize(serverStatus) {
        const localStatus = this.state.status;

        // console.log("Synchronizing", {local: localStatus, server: serverStatus});

        if (localStatus.isPlaying && !serverStatus.isPlaying) {
            this.controlRequest("play", {});
        } else if (!localStatus.isPlaying && serverStatus.isPlaying) {
            this.play();
        }

        this.localPlayControl = false;
    }

    errorHandler(error) {
        clearInterval(this.playInterval);
        this.setState({controls: {}});
        this.setStatus({error, isBuffering: true});

        return true;
    }


    handlePlay(nextStatus) {
        this.isPlaying = true;
        this.isBuffering = !this.buffer.hasStartingDuration();

        nextStatus.isPlaying = true;
        nextStatus.isBuffering = this.isBuffering;
        this.lastRefreshTs = Date.now();
        this.playInterval = setInterval(::this.refresh, this.props.config.refreshRate);
    }

    handlePause(nextStatus) {
        this.isPlaying = false;

        clearInterval(this.playInterval);
        nextStatus.isPlaying = false;
        nextStatus.isBuffering = false;
    }

    handleSeek(position, nextStatus) {
        this.buffer.invalidate();
        nextStatus.position = position;
        nextStatus.isBuffering = true;
    }

    handlePlaybackSpeedChange(factor, nextStatus) {
        this.buffer.invalidate();
        nextStatus.isBuffering = true;
        nextStatus.playbackSpeedFactor = factor;
    }

    @withAsyncErrorHandler
    async play() {
        const nextStatus = {};
        this.handlePlay(nextStatus);
        this.setStatus(nextStatus);

        if (!this.localPlayControl) await this.controlRequest("play", {});
    }

    @withAsyncErrorHandler
    async pause() {
        const nextStatus = {};
        this.handlePause(nextStatus);
        this.setStatus(nextStatus);

        if (!this.localPlayControl) await this.controlRequest("pause", {});
    }

    async stop() {
        if (this.state.status.isPlaying) this.pause();
        this.seek(this.props.config.beginTs);
    }

    @withAsyncErrorHandler
    async seek(position) {
        const nextStatus = {};
        this.handleSeek(position, nextStatus);
        this.setStatus(nextStatus);

        this.lastSeekTo = this.state.status.isPlaying ? Math.max(this.props.config.beginTs, position - this.props.config.pollRate/4 * this.state.status.playbackSpeedFactor) : position;
        await this.controlRequest("seek", {position: this.lastSeekTo});
    }

    @withAsyncErrorHandler
    async changePlaybackSpeed(newFactor) {
        const isPlaying = this.state.status.isPlaying;
        const nextStatus = {};
        const currKeyframe = isPlaying ? null : this.buffer.shift();

        //TODO: weird
        this.handlePlaybackSpeedChange(newFactor, nextStatus);
        if (currKeyframe) {
            this.buffer.push(currKeyframe);
            nextStatus.isBuffering = false;
        }
        this.setStatus(nextStatus);

        this.controlRequest("changeSpeed", {factor: newFactor});
        if (isPlaying) this.seek(this.state.status.position);
    }

    async controlRequest(controlName, params) {
        await axios.post(getUrl(this.baseUrl + controlName), params);
    }


    render() {
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

            this.statusUrl = "rest/animation/" + props.config.id + "/status";

            this.accumulatedStatus = null;
            this.beforeFirstStatus = null;

            this.state = {
                lastFetchedStatus: {
                    status: {},
                },
                lastFetchedKeyframe: {},
                error: null,
            };
        }

        componentDidUpdate(prevProps, prevState) {
            //TODO: on config change???
            if (prevState.lastFetchedStatus !== this.state.lastFetchedStatus && this.accumulatedStatus) {
                console.log("processing accumulated:", this.accumulatedStatus.position);
                const accumulatedStatus = this.accumulatedStatus;
                this.accumulatedStatus = null;
                this.processStatus(accumulatedStatus);
            }
        }

        componentDidMount() {
            this.fetchStatus();
            this.fetchInterval = setInterval(::this.fetchStatus, this.props.config.pollRate);
        }

        componentWillUnmount() {
            clearInterval(this.fetchInterval);
        }

        @withAsyncErrorHandler
        async fetchStatus() {
            const res = await axios.get(getUrl(this.statusUrl));
            // console.log("Fetched status:", res.data);

            const {data, ...status} = res.data;
            if (status.position > this.props.config.endTs && this.state.lastFetchedStatus.status.position >= this.props.config.endTs) return;
            if (status.position < this.props.config.beginTs) {
                console.log("assigning beforeFirstStatus:", status.position);
                this.beforeFirstStatus = res.data;
                return;
            }

            let dataToProcess = res.data;
            if (status.position === this.props.config.beginTs) {
                this.beforeFirstStatus = null;
            } else if (status.position > this.props.config.beginTs && this.beforeFirstStatus) {
                console.log("Using beforeFirstStatus, storing:", status.position);
                this.accumulatedStatus = res.data;
                dataToProcess = this.beforeFirstStatus;
                this.beforeFirstStatus = null;
            }

            this.processStatus(dataToProcess);
        }

        processStatus(statusData) {
            const {data, ...status} = statusData;
            const diffLog = this.runStatusDiff(status);

            if (diffLog.size === 0) return;


            const nextState = {};
            if (diffLog.has(statusChanges.POSITION) || diffLog.has(statusChanges.SEEK)) {
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

            if (this.lastPosition !== newStatus.position) {
                diffLog.add(statusChanges.POSITION);
            }

            if (oldStatus.isPlaying && !newStatus.isPlaying ) {
                diffLog.add(statusChanges.STOPED_PLAYING);
            } else if (!oldStatus.isPlaying && newStatus.isPlaying) {
                diffLog.add(statusChanges.STARTED_PLAYING);
            }

            if (oldStatus.playbackSpeedFactor !== newStatus.playbackSpeedFactor) {
                diffLog.add(statusChanges.PLAYBACK_SPEED);
            }

            if (!oldStatus.seek || newStatus.seek.count !== oldStatus.seek.count) {
                diffLog.add(statusChanges.SEEK);
            }

            if (!oldStatus.reachedEnd && newStatus.reachedEnd) {
                diffLog.add(statusChanges.REACHED_END);
            }

            return diffLog;
        }

        errorHandler(error) {
            clearInterval(this.fetchInterval);
            this.setState({error});

            return true;
        }

        render() {
            const {forwardRef, ...propsRest} = this.props;

            return (
                <AnimationComp
                    {...propsRest}
                    ref={forwardRef}
                    lastFetchedStatus={this.state.lastFetchedStatus}
                    lastFetchedKeyframe={this.state.lastFetchedKeyframe}
                    statusFetchError={this.state.error}
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
