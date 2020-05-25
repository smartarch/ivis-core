import React, {Component} from "react";
import {Debug} from "./Debug";
import PropTypes from "prop-types";
import {AnimationStatusContext, AnimationControlContext} from "../lib/animation-helpers";
import {AnimatedBase} from "./AnimatedBase";
import {interpolFuncs} from "../lib/animation-interpolations";
import {withAsyncErrorHandler} from "../lib/error-handling";
import {dataAccess} from "./DataAccess";
import moment from "moment";


class ClientAnimation extends Component {
    static propTypes = {
        config: PropTypes.object,
        children: PropTypes.node,
    }

    constructor(props) {
        super(props);

        this.dataAccess = new KeyframeAccess(props.config, ::this.errorHandler);

        this.state = {
            status: {
                isPlaying: false,
                isBuffering: true,
                position: props.config.beginTs,
                playbackSpeedFactor: props.config.defaultPlaybackSpeedFactor,
            },
            controls: {
                play: ::this.playHandler,
                pause: ::this.pauseHandler,
                seek: ::this.seekHandler,
                stop: ::this.stopHandler,
                jumpForward: ::this.jumpForwardHandler,
                jumpBackward: ::this.jumpBackwardHandler,
                changeSpeed: ::this.changePlaybackSpeedHandler,
            },
            keyframes: {},
        };

        this.keyframes = [];

        this.playLoop = null;
    }

    componentDidMount() {
        this.seekHandler(this.props.config.beginTs);
    }


    errorHandler(error) {
        console.error(error);
        clearInterval(this.playLoop);
        this.setState({controls: {}});
        this.setStatus({isBuffering: true, error});

        return true;
    }

    playHandler() {
        this.setStatus({isPlaying: true});
        this.playLoop = setInterval(::this.positionRefresh, this.props.config.refreshRate);
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

    @withAsyncErrorHandler
    async seekHandler(ts) {
        const clampedTs = this.clampPosition(ts);
        this.setStatus({isBuffering: true});


        let shouldPlayAfter = false;
        if (this.state.status.isPlaying) {
            shouldPlayAfter = true;
            clearInterval(this.playLoop);
        }

        this.keyframes = await this.dataAccess.reset(clampedTs);

        this.setStatus({isBuffering: false, position: clampedTs});
        if (shouldPlayAfter) this.playLoop = setInterval(::this.positionRefresh, this.props.config.refreshRate);
    }

    changePlaybackSpeedHandler(factor) {
        this.dataAccess.changePlaybackSpeed(factor);
        this.setStatus({playbackSpeedFactor: factor});
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
        const nextPosition = this.state.status.position + (this.state.status.playbackSpeedFactor * this.props.config.refreshRate);

        if (nextPosition >= this.props.config.endTs) {
            this.setStatus({position: this.props.config.endTs});
            this.pauseHandler();
            return;
        }

        if (nextPosition > this.keyframes[1].ts) this.shiftKeyframes();
        this.setStatus({position: nextPosition});
    }

    @withAsyncErrorHandler
    async shiftKeyframes() {
        this.keyframes.shift();
        if (this.keyframes[1].ts === this.props.config.endTs) return;

        let nextKf = this.dataAccess.getNext();
        if (nextKf.promise) {
            clearInterval(this.playLoop);
            this.setStatus({isBuffering: true});

            nextKf = await nextKf.promise;

            this.setStatus({isBuffering: false});
            this.playLoop = setInterval(::this.positionRefresh, this.props.config.refreshRate);
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
                call: this.changePlaybackSpeedHandler.bind(this, this.state.status.playbackSpeedFactor * 2),
            },
        ];

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
                                name={"Client Animation"}
                                status={this.state.status}
                                funcs={functions}
                                thisKeyframes={this.keyframes}
                                keyframes={this.state.keyframes}
                            />
                        </AnimatedBase>
                    </AnimationControlContext.Provider>
                </AnimationStatusContext.Provider>

            </>
        );
    }
}

class KeyframeAccess {
    constructor(animationConfig, errorHandler) {
        this.errorHandler = errorHandler;

        this.config = animationConfig;

        this.maxFetchTime = null;
        this.fetchTimeMult = 2;

        this.timeCached = 0;
        this.timeSpeedMult = animationConfig.defaultPlaybackSpeedFactor;

        this.kfQueue = [];
        this.nextChunkPromise = null;
        this.nextChunkBeginTs = null;
        this.nextKeyframeCount = 0;
    }

    async reset(startingTs) {
        this.kfQueue = [];
        this.nextChunkBeginTs = startingTs;
        this.nextKeyframeCount = this.config.minBufferedKeyframeCount;

        const chunkData = await this._fetchNextChunk(true);

        this._fillDataQueue();

        return chunkData;
    }

    getNext() {
        if (this.kfQueue.length === 0 && this.nextChunkPromise) {
            const promise = this.nextChunkPromise.then(() => this.getNext());
            return { keyframe: null, promise };
        }

        const nextKf = this.kfQueue.shift();

        this._fillDataQueue();
        return {keyframe: nextKf, promise: null};
    }

    changePlaybackSpeed(mult) {
        this.timeSpeedMult = mult;

        this._fillDataQueue();
    }


    @withAsyncErrorHandler
    async _fillDataQueue() {
        while(!this._hasEnoughCached()) {
            // console.log("Filling queue");
            const chunkData = await this._fetchNextChunk(false);
            this._addKeyframes(chunkData);
        }
    }

    _hasEnoughCached() {
        return (this.nextChunkBeginTs >= this.config.endTs) ||
            this.kfQueue.length >= 1 && (this.timeCached - this.kfQueue[0].duration) * this.timeSpeedMult > this.maxFetchTime * this.fetchTimeMult;
    }

    async _fetchNextChunk(withFirstKeyframe) {
        const queries = [];
        if (withFirstKeyframe) queries.push(this._getFirstKfQuery());

        queries.push(this._getNextChunkQuery(withFirstKeyframe));

        const fetchBeginTs = Date.now();
        this.nextChunkPromise = dataAccess.query(queries);
        const data = await this.nextChunkPromise;
        this.nextChunkPromise = null;
        const fetchTime = Date.now() - fetchBeginTs;

        this.maxFetchTime = Math.max(this.maxFetchTime, fetchTime);

        this.nextKeyframeCount = Math.min(this.nextKeyframeCount * 2, this.config.maxBufferedKeyframeCount);
        // console.log({data});

        return [].concat(...data).map(::this._processData);
    }

    _processData(keyframeData) {
        const {ts, ...data} = keyframeData;
        const kf = {
            ts: moment.utc(ts).valueOf(),
            data
        };
        this.nextChunkBeginTs = kf.ts;

        return kf;
    }

    _addKeyframes(kfs) {
        let lastTs = this.kfQueue.length > 0 ? this.kfQueue[this.kfQueue.length - 1].ts : kfs[0].ts;
        for (let kf of kfs) {
            kf.duration = kf.ts - lastTs;
            lastTs = kf.ts;

            this.kfQueue.push(kf);
            this.timeCached += kf.duration;
        }
    }

    _getNextChunkQuery(withFirstKeyframe) {
        return {
            type: "docs",
            args: [
                this.config.sigSetCid,
                ["ts", ...this.config.signals],
                {
                    type: "range",
                    sigCid: "ts",
                    gt: moment.utc(this.nextChunkBeginTs).toISOString(),
                },
                [
                    {sigCid: "ts", order: "asc" }
                ],
                withFirstKeyframe ? this.nextKeyframeCount - 1 : this.nextKeyframeCount,
            ]
        };
    }

    _getFirstKfQuery() {
        return {
            type: "docs",
            args: [
                this.config.sigSetCid,
                ["ts", ...this.config.signals],
                {
                    type: "range",
                    sigCid: "ts",
                    lte: moment.utc(this.nextChunkBeginTs).toISOString(),
                },
                [
                    { sigCid: "ts", order: "desc", }
                ],
                1
            ]
        };
    }
}

export {
    ClientAnimation
};
