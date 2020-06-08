import React, {Component} from "react";
import {Debug} from "./Debug";
import PropTypes from "prop-types";
import {AnimationStatusContext, AnimationControlContext} from "../lib/animation-helpers";
import {AnimatedBase} from "./AnimatedBase";
import {interpolFuncs} from "../lib/animation-interpolations";
import {withAsyncErrorHandler} from "../lib/error-handling";
import {dataAccess} from "./DataAccess";
import moment from "moment";


//When the tab is inactive, setIntervals and setTimeouts that are scheduled within less than 1s are triggered after
//1s. This means that we want to store at least 1s of keyframes ahead of the
//current position.
const maxRefreshRate = 1000;

class ClientAnimation extends Component {
    static propTypes = {
        config: PropTypes.object,
        children: PropTypes.node,
    }

    constructor(props) {
        super(props);

        this.keyframeAccess = new KeyframeAccess(props.config, ::this.errorHandler);

        this.state = {
            status: {
                isPlaying: false,
                isBuffering: true,
                position: props.config.beginTs,
                playbackSpeedFactor: props.config.controls.changeSpeed.initial || 1,
            },
            controls: {
                //TODO: handling of enabled/disabled here?
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

    //TODO: on config change???

    errorHandler(error) {
        console.error(error);

        this.stopRefreshing();
        this.setState({controls: {}});
        this.setStatus({isBuffering: true, error});

        return true;
    }

    playHandler() {
        this.startRefreshing();
        this.setStatus({isPlaying: true});
    }

    pauseHandler() {
        this.stopRefreshing();
        this.setStatus({isPlaying: false});
    }

    stopHandler() {
        if (this.state.status.isPlaying) this.pauseHandler();
        this.seekHandler(this.props.config.beginTs);
    }

    jumpForwardHandler(shiftMs) {
        this.seekHandler(this.state.status.position + shiftMs);
    }

    jumpBackwardHandler(shiftMs) {
        this.seekHandler(this.state.status.position - shiftMs);
    }

    changePlaybackSpeedHandler(factor) {
        this.keyframeAccess.changePlaybackSpeed(factor);
        this.setStatus({playbackSpeedFactor: factor});
    }

    @withAsyncErrorHandler
    async seekHandler(ts) {
        const clampedTs = this.clampPosition(ts);

        this.keyframes = [];
        this.setStatus({position: clampedTs, isBuffering: true});

        const dataPromise = this.keyframeAccess.seek(clampedTs);
        this.nextKfPromise = dataPromise;

        const keyframes = await dataPromise;

        if (clampedTs === this.state.status.position) {
            this.nextKfPromise = null;
            this.keyframes = keyframes;
            if (!this.refreshing) this.setStatus({isBuffering: false});
        }
    }


    refresh() {
        const refreshPosition = (interval) => {
            const nextPosition = Math.min(
                this.props.config.endTs,
                this.state.status.position + (this.state.status.playbackSpeedFactor * interval)
            );

            this.tryShiftUntil(nextPosition);

            if (this.keyframes.length < 3 && this.keyframes[1].ts < this.props.config.endTs) {
                this.savedInterval = interval;
                if (!this.state.status.isBuffering) this.setStatus({isBuffering: true});
            } else {
                this.setStatus({isBuffering: false, position: nextPosition});
            }
        };

        if (this.keyframes.length < 3) {
            if(!this.state.status.isBuffering) {
                this.setStatus({isBuffering: true});
            }

            if (!this.savedInterval) {
                this.savedInterval = Date.now() - this.lastRefreshTs;
            }
        } else {
            let interval;
            if (this.savedInterval) {
                interval = this.savedInterval;
                this.savedInterval = null;
            } else {
                interval = Date.now() - this.lastRefreshTs;
            }
            this.lastRefreshTs = Date.now();

            refreshPosition(interval);
        }

        if (this.state.status.position !== this.props.config.endTs) {
            this.refreshTimeout = setTimeout(::this.refresh, this.props.config.refreshRate);
        } else {
            this.refreshing = false;
        }
    }

    tryShiftUntil(ts) {
        while (!this.nextKfPromise && this.keyframes.length >= 3 && ts > this.keyframes[1].ts) {
            this.keyframes.shift();
            if (this.keyframes[1].ts < this.props.config.endTs) {
                const {keyframe, promise} = this.keyframeAccess.getNext();

                if (promise) {
                    const positionBefore = this.state.status.position;
                    this.nextKfPromise = promise.then(({keyframe}) => {
                        if (this.state.status.position === positionBefore) {
                            this.keyframes.push(keyframe);
                        }

                        this.nextKfPromise = null;
                    });
                } else {
                    this.keyframes.push(keyframe);
                }
            }
        }
    }

    startRefreshing() {
        if (this.refreshing) return;

        this.lastRefreshTs = Date.now();
        this.refreshing = true;
        this.refreshTimeout = setTimeout(::this.refresh, this.props.config.refreshRate);
    }

    stopRefreshing() {
        this.refreshing = false;
        clearTimeout(this.refreshTimeout);
    }

    setStatus(nextStatus) {
        this.setState(prevState => {
            const newStatus = Object.assign({}, prevState.status, nextStatus);
            const newKeyframes = {curr: this.keyframes[0], next: this.keyframes[1]};

            return {status: newStatus, keyframes: newKeyframes};
        });
    }

    clampPosition(ts) {
        return Math.min(this.props.config.endTs, Math.max(this.props.config.beginTs, ts));
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
                                name={"Client Animation"}
                                status={this.state.status}
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

        this._reset();
    }

    async seek(startingTs) {
        this.lastSeekTo = startingTs;
        this.nextChunkBeginTs = startingTs;

        this._reset();

        const chunkData = await this._fetchNextChunk(true);

        const [kf_1, kf_2, kf_3, ...rest] = chunkData;

        if (this.lastSeekTo === startingTs) {
            this._addKeyframes(rest);

            this._startFillingDataQueue();
        }

        return [kf_1, kf_2, kf_3];
    }

    getNext() {
        if (this.kfQueue.length === 0) {
            if (!this.nextChunkPromise) this._startFillingDataQueue();

            this.fetchTimeMult *= 2;
            return {keyframe: null, promise: this.nextChunkPromise.then(() => this.getNext())};
        }

        const nextKf = this.kfQueue.shift();
        this.timeLoaded -= nextKf.duration;

        this._startFillingDataQueue();
        return {keyframe: nextKf, promise: null};
    }

    changePlaybackSpeed(mult) {
        this.timeSpeedFactor = mult;

        this._startFillingDataQueue();
    }

    _startFillingDataQueue() {
        if (!this.fillingQueue) this._fillDataQueue();
    }

    @withAsyncErrorHandler
    async _fillDataQueue() {
        this.fillingQueue = true;

        while(!this._hasEnoughLoaded()) {
            //TODO: test this with variable response time
            const fetchBeginTs = Date.now();

            this.nextChunkPromise = this._fetchNextChunk(false)
                .then(::this._addKeyframes);
            await this.nextChunkPromise;
            this.nextChunkPromise = null;

            const fetchTime = Date.now() - fetchBeginTs;
            this.maxFetchTime = Math.max(this.maxFetchTime, fetchTime);
        }

        this.fillingQueue = false;
    }

    _hasEnoughLoaded() {
        const minBufferedTime = Math.max(maxRefreshRate, this.config.refreshRate);

        return (this.nextChunkBeginTs >= this.config.endTs) ||
            this.kfQueue.length >= 1 && (this.timeLoaded - this.kfQueue[0].duration - minBufferedTime) / this.timeSpeedFactor > this.maxFetchTime * this.fetchTimeMult;
    }

    _fetchNextChunk(withFirstKeyframe) {
        const queries = [];
        if (withFirstKeyframe) queries.push(this._getFirstKfQuery());
        queries.push(this._getNextChunkQuery(withFirstKeyframe));

        return dataAccess.query(queries)
            .then(data => {
                const dataArr = [].concat(...data);
                if (dataArr.length > 0)
                    return this._processData(dataArr);
                else
                    throw Error(`There are no data for sigSet '${this._getSignalSetCid()}' after '${moment.utc(this.nextChunkBeginTs)}'`);
            });
    }

    _processData(keyframeData) {
        const kfs = [];
        for (let kfDatum of keyframeData) {
            const {ts, ...data} = kfDatum;
            const kf = {
                ts: moment.utc(ts).valueOf(),
                data
            };

            kfs.push(kf);
        }

        const timeFetched = kfs[kfs.length - 1].ts - kfs[0].ts;
        this.nextKeyframeCount = timeFetched / this.timeSpeedFactor < this.approxMaxFetchedTime ? this.nextKeyframeCount * 2 : this.nextKeyframeCount;

        this.nextChunkBeginTs = kfs[kfs.length - 1].ts;

        return kfs;
    }

    _addKeyframes(kfs) {
        if (kfs.length === 0) return;

        let lastTs = this.kfQueue.length > 0 ? this.kfQueue[this.kfQueue.length - 1].ts : kfs[0].ts;
        for (let kf of kfs) {
            kf.duration = kf.ts - lastTs;
            lastTs = kf.ts;

            this.kfQueue.push(kf);
            this.timeLoaded += kf.duration;
        }

    }

    _reset() {
        this.kfQueue = [];
        this.timeLoaded = 0;
        this.nextKeyframeCount = this.config.initialKfCount || 3;
        this.fetchTimeMult = 2;

        this.approxMaxFetchedTime = this.config.approxMaxFetchedTime || 30000;

        this.timeSpeedFactor = this.config.controls.changeSpeed.initial || 1;
    }


    _getSignalCids() {
        return this.config.data.sensors.map(s => s.cid);
    }

    _getSignalSetCid() {
        return this.config.data.sigSet;
    }

    _getNextChunkQuery(withFirstKeyframe) {
        return {
            type: "docs",
            args: [
                this._getSignalSetCid(),
                this._getSignalCids(),
                {
                    type: "range",
                    sigCid: "ts",
                    gt: moment.utc(this.nextChunkBeginTs).toISOString(),
                },
                [{sigCid: "ts", order: "asc" }],
                withFirstKeyframe ? this.nextKeyframeCount - 1 : this.nextKeyframeCount,
            ]
        };
    }

    _getFirstKfQuery() {
        return {
            type: "docs",
            args: [
                this._getSignalSetCid(),
                this._getSignalCids(),
                {
                    type: "range",
                    sigCid: "ts",
                    lte: moment.utc(this.nextChunkBeginTs).toISOString(),
                },
                [{ sigCid: "ts", order: "desc", }],
                1
            ]
        };
    }
}

export {
    ClientAnimation
};
