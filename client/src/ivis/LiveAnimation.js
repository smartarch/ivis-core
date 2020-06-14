import React, {Component} from "react";
import {Debug} from "./Debug";
import axios from "../lib/axios";
import {getUrl} from "../lib/urls";
import PropTypes from "prop-types";
import {AnimationStatusContext, AnimationControlContext} from "../lib/animation-helpers";
import {withAsyncErrorHandler} from "../lib/error-handling";

//TODO: this file does not need to be in ivis, can be in libs
const statusChanges = {
    POSITION: 0,
    STARTED_PLAYING: 1,
    STOPED_PLAYING: 2,
    PLAYBACK_SPEED: 3,
    SEEK: 4,
    REACHED_END: 5,
};

class LiveAnimation extends Component {
    static propTypes = {
        timeDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
        refreshRate: PropTypes.number,
        initialStatus: PropTypes.object.isRequired,

        animationId: PropTypes.string.isRequired,

        pollRate: PropTypes.number.isRequired,

        render: PropTypes.func.isRequired,
    }

    render() {
        //TODO: unnecessary nested render props
        const childrenRender = (props) => {
            return (
                <LiveAnimationBase
                    timeDomain={this.props.timeDomain}
                    refreshRate={this.props.refreshRate}
                    initialStatus={this.props.initialStatus}

                    pollRate={this.props.pollRate}

                    animationId={this.props.animationId}
                    {...props}

                    render={this.props.render}
                />
            );
        };

        return (
            <StatusAccess
                timeDomain={this.props.timeDomain}
                animationId={this.props.animationId}
                pollRate={this.props.pollRate}

                render={childrenRender}
            />
        );
    }
}

class StatusAccess extends Component {
    static propTypes = {
        timeDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
        animationId: PropTypes.string.isRequired,

        pollRate: PropTypes.number.isRequired,

        render: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

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
        //TODO: on timeDomain change?
        if (this.props.pollRate !== prevProps.pollRate) {
            clearInterval(this.fetchInterval);
            this.fetchStatus();
            this.fetchInterval = setInterval(::this.fetchStatus, this.props.pollRate);
        }

        if (prevState.lastFetchedStatus !== this.state.lastFetchedStatus && this.accumulatedStatus) {
            // console.log("processing accumulated:", this.accumulatedStatus.position);
            const accumulatedStatus = this.accumulatedStatus;
            this.accumulatedStatus = null;
            this.processStatus(accumulatedStatus);
        }
    }

    componentDidMount() {
        this.fetchStatus();
        this.fetchInterval = setInterval(::this.fetchStatus, this.props.pollRate);
    }

    componentWillUnmount() {
        clearInterval(this.fetchInterval);
    }

    @withAsyncErrorHandler
    async fetchStatus() {
        const url = getUrl("rest/animation/" + this.props.animationId + "/status");
        const res = await axios.get(url);
        // console.log("Fetched status:", res.data);

        //TODO: wrong, what if seeked between beforeFirstStatus and
        //accumulatedStatus?
        const {data, ...status} = res.data;
        if (status.position > this.props.timeDomain[1] && this.state.lastFetchedStatus.status.position >= this.props.timeDomain[1]) return;

        if (status.position < this.props.timeDomain[0]) {
            // console.log("assigning beforeFirstStatus:", status.position);
            this.beforeFirstStatus = res.data;
            return;
        }

        let dataToProcess = res.data;
        if (status.position === this.props.timeDomain[0]) {
            this.beforeFirstStatus = null;
        } else if (status.position > this.props.timeDomain[0] && this.beforeFirstStatus) {
            // console.log("Using beforeFirstStatus, storing:", status.position);
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

        // console.log("diff", diffLog);
        return diffLog;
    }

    errorHandler(error) {
        clearInterval(this.fetchInterval);
        this.setState({error});

        return true;
    }

    render() {
        return this.props.render({...this.state});
    }
}

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
            this.storedDuration += keyframe.ts - this.innerBuffer[this.innerBuffer.length - 1].ts;
        }

        this.reachedEnd = keyframe.ts >= this.endTs;

        this.innerBuffer.push(keyframe);
    }

    shift() {
        if (this.innerBuffer.length > 1) this.storedDuration -= this.innerBuffer[1].ts - this.innerBuffer[0].ts;
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

    hasStartingDuration(playbackSpeedFactor) {
        return this.reachedEnd ? this.innerBuffer.length > 1 : (this.storedDuration*playbackSpeedFactor >= 1.2*this.minStoredDuration);
    }

    hasMinimalDuration(playbackSpeedFactor) {
        return this.reachedEnd ? this.innerBuffer.length > 1 : (this.storedDuration*playbackSpeedFactor >= this.minStoredDuration);
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

//TODO: needs thorough check, probably after server monitor panel...
class LiveAnimationBase extends Component {
    static propTypes = {
        timeDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
        refreshRate: PropTypes.number,
        initialStatus: PropTypes.object.isRequired,

        animationId: PropTypes.string.isRequired,

        pollRate: PropTypes.number.isRequired,


        lastFetchedStatus: PropTypes.object,
        lastFetchedKeyframe: PropTypes.object,
        statusFetchError: PropTypes.object,

        render: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);


        //TODO: transfer to keyframe count instead of time?
        this.buffer = new KeyframeBuffer(3*props.pollRate, props.timeDomain[1]);

        this.localPlayControl = false;

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
            status: { ...props.initialStatus, isBuffering: true, timeDomain: props.timeDomain},
            controls: {},
            keyframes: {},
        };
    }

    componentDidUpdate(prevProps) {
        //TODO: on refreshRate, timeDomain?, animationId?, initialStatus
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
        this.changePlaybackSpeed(this.state.status.playbackSpeedFactor);
        this.seek(this.state.status.position);

        if (this.state.status.isPlaying) this.play();
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

            return { status: newStatus, keyframes: newKeyframes };
        });
    }

    refresh() {
        // console.log("Refreshing");
        const getPositionJump = () => {
            const msPassed = this.savedInterval || Date.now() - this.lastRefreshTs;
            this.lastRefreshTs = Date.now();

            return this.state.status.playbackSpeedFactor*msPassed;
        };

        if (this.state.status.position === this.props.timeDomain[1]) {
            // console.log("reached end");
            this.localPlayControl = true;
            this.pause();

            return;
        }

        if (this.isBuffering && this.buffer.hasStartingDuration(this.state.status.playbackSpeedFactor)) {
            // console.log("Buffering finished");
            this.isBuffering = false;
            this.setStatus({isBuffering: false});
        }

        if (!this.isBuffering && !this.buffer.hasMinimalDuration(this.state.status.playbackSpeedFactor)) {
            // console.log("Buffering started");
            this.lastRefreshTs = Date.now();
            this.isBuffering = true;
            this.setStatus({isBuffering: true});
        } else if (!this.isBuffering && this.buffer.hasMinimalDuration(this.state.status.playbackSpeedFactor)) {
            // console.log("Continue playing");

            const nextPosition = Math.min(
                this.props.timeDomain[1],
                Math.max(this.buffer.current.ts, this.state.status.position + getPositionJump())
            );


            //
            while (this.buffer.hasMinimalDuration(this.state.status.playbackSpeedFactor) && nextPosition >= this.buffer.next.ts) {
                this.buffer.shift();
            }

            if (!this.buffer.hasMinimalDuration(this.state.status.playbackSpeedFactor)) {
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
        //TODO: try to get rid of this.isPlaying
        this.isPlaying = true;
        this.isBuffering = !this.buffer.hasStartingDuration(this.state.status.playbackSpeedFactor);

        nextStatus.isPlaying = true;
        nextStatus.isBuffering = this.isBuffering;
        this.lastRefreshTs = Date.now();
        this.playInterval = setInterval(::this.refresh, this.props.refreshRate);
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


    play() {
        const nextStatus = {};
        this.handlePlay(nextStatus);
        this.setStatus(nextStatus);

        if (!this.localPlayControl) this.controlRequest("play", {});
    }

    pause() {
        const nextStatus = {};
        this.handlePause(nextStatus);
        this.setStatus(nextStatus);

        if (!this.localPlayControl) this.controlRequest("pause", {});
    }

    stop() {
        if (this.state.status.isPlaying) this.pause();
        this.seek(this.props.timeDomain[0]);
    }

    seek(position) {
        const clampedPosition = Math.min(this.props.timeDomain[1], Math.max(this.props.timeDomain[0], position));

        const nextStatus = {};
        this.handleSeek(clampedPosition, nextStatus);
        this.setStatus(nextStatus);

        this.lastSeekTo = this.state.status.isPlaying ? Math.max(this.props.timeDomain[0], position - this.props.pollRate/4 * this.state.status.playbackSpeedFactor) : position;
        this.controlRequest("seek", {position: this.lastSeekTo});
    }

    changePlaybackSpeed(newFactor) {
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

    @withAsyncErrorHandler
    async controlRequest(controlName, params) {
        const url = getUrl("rest/animation/" + this.props.animationId + "/" + controlName);
        await axios.post(url, params);
    }


    render() {
        return (
            <>
                <AnimationStatusContext.Provider value={this.state.status}>
                    <AnimationControlContext.Provider value={this.state.controls}>
                        {this.props.render({status: this.state.status, keyframes: this.state.keyframes})}

                        <Debug
                            name={"Server Animation"}
                            state={this.state}
                            buffer={this.buffer._inner()}
                        />
                    </AnimationControlContext.Provider>
                </AnimationStatusContext.Provider>
            </>
        );
    }
}



export {
    LiveAnimation
};
