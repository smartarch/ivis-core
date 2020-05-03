import React, {Component} from "react";
import axios from "../lib/axios";
import {getUrl} from "../lib/urls";
import {Debug} from "./Debug";
import PropTypes from "prop-types";
import {AnimationStatusContext, AnimationControlContext} from "./Animation";
import {AnimatedBase} from "./AnimatedBase";


class ClientAnimation extends Component {
    static propTypes = {
        config: PropTypes.object,
        interpolFunc: PropTypes.func,
        children: PropTypes.node,
    }

    constructor(props) {
        super(props);

        this.dataAccess = new KeyframeAccess(this.props.config);

        this.state = {
            initialized: false,
            status: {
                isPlaying: false,
                isBuffering: true,
                position: this.props.config.beginTs,
                speedFactor: 1,
            },
            controls: {
                play: ::this.playHandler,
                pause: ::this.pauseHandler,
                seek: ::this.seekHandler,
                stop: ::this.stopHandler,
                jumpForward: ::this.jumpForwardHandler,
                jumpBackward: ::this.jumpBackwardHandler,
                changeSpeed: ::this.changePlaybackSpeed,
            },
            keyframes: {},
        };

        this.refreshRate = 1000;
        this.baseJump = 50;
        this.keyframes = [];

        this.playLoop = null;
    }

    componentDidMount() {
        this.seekHandler(this.props.config.beginTs);
    }


    playHandler() {
        this.setStatus({isPlaying: true});
        this.playLoop = setInterval(::this.positionRefresh, this.refreshRate);
    }

    pauseHandler() {
        clearInterval(this.playLoop);
        this.setStatus({isPlaying: false});
    }

    stopHandler() {
        this.pauseHandler();
        this.seekHandler(this.props.config.beginTs);
    }

    jumpForwardHandler(shiftMs) {
        this.seekHandler(this.state.status.position + shiftMs);
    }

    jumpBackwardHandler(shiftMs) {
        this.seekHandler(this.state.status.position - shiftMs);
    }

    async seekHandler(ts) {
        const clampedTs = this.clampPosition(ts);
        this.setStatus({isBuffering: true});


        let shouldPlayAfter = false;
        if (this.state.status.isPlaying) {
            clearInterval(this.playLoop);
            shouldPlayAfter = true;
        }
        this.keyframes = await this.dataAccess.reset(clampedTs);

        this.setStatus({isBuffering: false, position: clampedTs});
        if (shouldPlayAfter) this.playLoop = setInterval(::this.positionRefresh, this.refreshRate);
    }

    changePlaybackSpeed(factor) {
        this.dataAccess.changePlaybackSpeed(factor);
        this.setStatus({speedFactor: factor});
    }


    clampPosition(ts) {
        return Math.min(this.props.config.endTs, Math.max(this.props.config.beginTs, ts));
    }

    setStatus(nextStatus) {
        this.setState(prevState => {
            const newStatus = Object.assign({}, prevState.status, nextStatus);
            const newKeyframes = {curr: this.keyframes[0], next: this.keyframes[1]};

            return {status: newStatus, keyframes: newKeyframes};
        });
    }

    positionRefresh() {
        const nextPosition = this.state.status.position + (this.state.status.speedFactor * this.baseJump);
        if (nextPosition >= this.props.config.endTs) {
            this.setStatus({position: this.props.config.endTs});
            this.pauseHandler();
            return;
        }

        if (nextPosition > this.keyframes[1].ts) this.shiftKeyframes();
        this.setStatus({position: nextPosition});
    }

    async shiftKeyframes() {
        this.keyframes.shift();
        if (this.keyframes[1].ts === this.props.config.endTs) return;

        let nextKf = this.dataAccess.getNext();

        if (nextKf.promise) {
            clearInterval(this.playLoop);
            this.setStatus({isBuffering: true});
            nextKf = await nextKf.promise;
            this.setStatus({isBuffering: false});
            this.playLoop = setInterval(::this.positionRefresh, this.refreshRate);
        }

        this.keyframes.push(nextKf.keyframe);
    }


    render() {
        const functions = [
            {
                name: "play",
                call: ::this.playHandler,
            },
            {
                name: "pause",
                call: ::this.pauseHandler,
            },
            {
                name: "to begin",
                call: this.seekHandler.bind(this, this.props.config.beginTs),
            },
            {
                name: "jump forward",
                call: this.jumpForwardHandler.bind(this, 2000),
            },
            {
                name: "jump back",
                call: this.jumpBackwardHandler.bind(this, 2000),
            },
            {
                name: "double speed",
                call: this.changePlaybackSpeed.bind(this, this.state.status.speedFactor * 2),
            },
        ];

        return (
            <>
                <AnimationStatusContext.Provider value={this.state.status}>
                    <AnimationControlContext.Provider value={this.state.controls}>
                        <AnimatedBase
                            interpolFunc={this.props.interpolFunc}
                            status={this.state.status}
                            keyframes={this.state.keyframes}>

                            {this.props.children}
                        </AnimatedBase>
                    </AnimationControlContext.Provider>
                </AnimationStatusContext.Provider>

                <Debug
                    status={this.state.status}
                    funcs={functions}
                    thisKeyframes={this.keyframes}
                    keyframes={this.state.keyframes}
                />

            </>
        );
    }
}

class KeyframeAccess {
    constructor(animationConfig) {
        this.baseUrl = 'rest/animation/client/keyframes';

        this.endTs = animationConfig.endTs;

        this.chunkTime = 2000;
        this.startKeyframesCount = 3;

        //TODO: Better computations?
        this.avgFetchTime = null;
        this.fetchTimeMult = 3;

        this.timeCached = 0;
        this.timeSpeedMult = 1;

        this.maxKeyframeDuration = 2000;

        this.dataQueue = [];
        this.nextChunkPromise = null;
    }

    async reset(startingTs) {
        this.dataQueue = [];
        const startingKeyframes = await this._fetchStartingKeyframes(startingTs);

        await this._fillDataQueue();

        return startingKeyframes;
    }

    getNext() {
        if (this.dataQueue.length === 0 && this.nextChunkPromise) {
            const promise = this.nextChunkPromise.then(() => this.getNext());
            return { keyframe: null, promise };
        }

        const nextKf = this.dataQueue.pop();

        this._fillDataQueue();
        return {keyframe: nextKf, promise: null};
    }

    changePlaybackSpeed(mult) {
        this.timeSpeedMult = mult;

        this._fillDataQueue();
    }



    async _fillDataQueue() {
        while(!this._hasEnoughCached()) {
            await this._fetchNextChunk();
        }
    }

    _hasEnoughCached() {
        return (this.nextChunkBeginTs > this.endTs) ||
            this.dataQueue.length >= 1 && (this.timeCached - this.dataQueue[this.dataQueue.length - 1].duration) * this.timeSpeedMult > this.avgFetchTime * this.fetchTimeMult;
    }

    async _fetchStartingKeyframes(startingTs) {
        const res = await axios.get(this._getStartingKeyframesUrl(startingTs));

        this.nextChunkBeginTs = res.data[res.data.length - 1].ts + 1;

        const startingKeyframes = res.data.slice(0, this.startKeyframesCount);
        if (startingKeyframes.length < res.data.length) {
            const extraKfs = res.data.slice(this.startKeyframesCount, res.data.length);
            this._addKeyframes(extraKfs);
        }

        return startingKeyframes;
    }

    async _fetchNextChunk() {
        const fetchBeginTs = Date.now();

        this.nextChunkPromise = axios.get(this._getNextChunkUrl());
        const data = await this.nextChunkPromise;
        this.nextChunkPromise = null;

        const fetchTime = Date.now() - fetchBeginTs;

        this.avgFetchTime = this.avgFetchTime === null ? fetchTime : this.avgFetchTime + fetchTime/2;

        this._addKeyframes(data.data);
    }

    _addKeyframes(keyframes) {
        let lastTs = this.dataQueue[0] ? this.dataQueue[0].ts : keyframes[0].ts;
        for(let kf of keyframes) {
            kf.duration = kf.ts - lastTs;
            lastTs = kf.ts;

            this.timeCached += kf.duration;
            this.dataQueue.unshift(kf);
        }
        this.nextChunkBeginTs = lastTs + 1;

        console.log(this.dataQueue);
    }

    _getNextChunkUrl() {
        const chunkEndTs = Math.min(this.endTs, this.nextChunkBeginTs + this.chunkTime);
        return getUrl(this.baseUrl + '/ts/' + this.nextChunkBeginTs + '-' + chunkEndTs);
    }

    _getStartingKeyframesUrl(ts) {
        const endTs = Math.min(this.endTs, ts + this.maxKeyframeDuration * this.startKeyframesCount);
        return getUrl(this.baseUrl + '/ts/' + ts + '-' + endTs);
    }
}

export {
    ClientAnimation
};
