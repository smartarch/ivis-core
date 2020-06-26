import React, {Component} from "react";
import {Debug} from "./Debug";
import PropTypes from "prop-types";
import {AnimationStatusContext, AnimationControlContext} from "../lib/animation-helpers";
import {withAsyncErrorHandler} from "../lib/error-handling";
import {dataAccess} from "./DataAccess";
import moment from "moment";


//TODO: this file does not need to be in ivis, can be in libs

//When the tab is inactive, setIntervals and setTimeouts that are scheduled within less than 1s are triggered after
//1s. This means that we want to store at least 1s of keyframes ahead of the
//current position.
const maxRefreshRate = 1000;

//TODO: fill isRequired & optional
class RecordedAnimation extends Component {
    static propTypes = {
        timeDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
        refreshRate: PropTypes.number.isRequired,
        initialStatus: PropTypes.object.isRequired,

        minFetchedKeyframesCount: PropTypes.number,
        maxLoadAheadMs: PropTypes.number,

        sigSets: PropTypes.object.isRequired,

        render: PropTypes.func.isRequired,
    }

    //TODO: possibly confussing nested render props, also unnecessary
    render() {
        const childrenRender = (props) => {
            return (
                <RecordedAnimationBase
                    timeDomain={this.props.timeDomain}
                    refreshRate={this.props.refreshRate}
                    initialStatus={this.props.initialStatus}
                    {...props}

                    render={this.props.render}
                />
            );
        };

        return (
            <KeyframeAccess
                timeDomain={this.props.timeDomain}
                refreshRate={this.props.refreshRate}
                initialStatus={this.props.initialStatus}

                minFetchedKeyframesCount={this.props.minFetchedKeyframesCount}
                maxLoadAheadMs={this.props.maxLoadAheadMs}

                sigSets={this.props.sigSets}
                render={childrenRender}
            />
        );
    }
}

class SigSetKeyframeAccess {
    constructor(getStatus, sigSetCid, sensorCids, timestampCid) {
        this.getStatus = getStatus;

        this.sigSetCid = sigSetCid;
        this.timestampCid = timestampCid || 'ts';
        this.sensorCids = [...sensorCids, this.timestampCid];

        this.maxFetchTime = null;

        this.isInitialized = false;
    }

    async seek(ts) {
        this.lastSeekTo = ts;
        this.nextChunkBeginTs = ts;

        this._reset();

        const chunkData = await this._fetchNextChunk(true);

        const [kf_1, kf_2, kf_3, ...rest] = chunkData;

        if (this.lastSeekTo === ts) {
            this.kfQueue.push(...rest);

            this.startFillingDataQueue();
        }

        return {[this.sigSetCid]: [kf_1, kf_2, kf_3]};
    }

    getNext() {
        if (this.kfQueue.length === 0) {
            if (!this.nextChunkPromise) this.startFillingDataQueue();

            this.fetchTimeMult *= 2;
            return {keyframe: null, promise: this.nextChunkPromise.then(() => this.getNext())};
        }

        const nextKf = this.kfQueue.shift();

        this.startFillingDataQueue();
        return {keyframe: nextKf, promise: null};
    }

    startFillingDataQueue() {
        if (this.isInitialized && !this.nextChunkPromise) this._fillDataQueue();
    }

    async _fillDataQueue() {
        while(!this._hasEnoughLoaded()) {
            //TODO: test this with variable response time
            const fetchBeginTs = Date.now();

            this.nextChunkPromise = this._fetchNextChunk(false)
                .then(chunk => this.kfQueue.push(...chunk));

            try {
                await this.nextChunkPromise;
            }
            catch (error) {
                this.nextChunkPromise = Promise.reject(error);
                return;
            }

            this.nextChunkPromise = null;

            const fetchTime = Date.now() - fetchBeginTs;
            this.maxFetchTime = Math.max(this.maxFetchTime, fetchTime);
        }
    }

    _hasEnoughLoaded() {
        const storedTimeCushion = Math.max(maxRefreshRate, this.getStatus().refreshRate);
        const storedTime = this.kfQueue.length <= 1 ? 0 : this.kfQueue[this.kfQueue.length - 1].ts - this.kfQueue[1].ts;

        return (this.nextChunkBeginTs >= this.getStatus().timeDomain[1]) ||
            (storedTime - storedTimeCushion) / this.getStatus().timeSpeedFactor > this.maxFetchTime * this.fetchTimeMult;
    }

    _fetchNextChunk(withFirstKeyframe = false) {
        const queries = [];
        if (withFirstKeyframe) queries.push(this._getFirstKfQuery());
        queries.push(this._getNextChunkQuery());

        return dataAccess.query(queries)
            .then(data => {
                const dataArr = [].concat(...data);
                if (dataArr.length > 0)
                    return this._processData(dataArr);
                else
                    throw Error(`There are no data for sigSet '${this.sigSetCid}' after '${moment.utc(this.nextChunkBeginTs)}'`);
            });
    }

    _processData(keyframeData) {
        const kfs = [];
        for (let kfDatum of keyframeData) {
            const {[this.timestampCid]: ts, ...data} = kfDatum;
            const kf = {
                ts: moment.utc(ts).valueOf(),
                data
            };

            kfs.push(kf);
        }

        const timeFetched = kfs[kfs.length - 1][this.timestampCid] - kfs[0][this.timestampCid];
        if (timeFetched / this.getStatus().timeSpeedFactor < this.getStatus().maxLoadAheadMs) {
            this.nextKeyframeCount = this.nextKeyframeCount * 2;
        }

        this.nextChunkBeginTs = kfs[kfs.length - 1][this.timestampCid];

        return kfs;
    }

    _reset() {
        this.kfQueue = [];
        //TODO: better initialization without configuration (getting average
        //keyframe duration, with combination of that fetch time and playback
        //speed)
        this.nextKeyframeCount = this.getStatus().minFetchedKeyframesCount;
        this.fetchTimeMult = 2;

        this.isInitialized = true;
    }

    _getNextChunkQuery() {
        return {
            type: "docs",
            args: [
                this.sigSetCid,
                this.sensorCids,
                {
                    type: "range",
                    sigCid: this.timestampCid,
                    gt: moment.utc(this.nextChunkBeginTs).toISOString(),
                },
                [{sigCid: this.timestampCid, order: "asc" }],
                this.nextKeyframeCount,
            ]
        };
    }

    _getFirstKfQuery() {
        return {
            type: "docs",
            args: [
                this.sigSetCid,
                this.sensorCids,
                {
                    type: "range",
                    sigCid: this.timestampCid,
                    lte: moment.utc(this.nextChunkBeginTs).toISOString(),
                },
                [{ sigCid: this.timestampCid, order: "desc", }],
                1
            ]
        };
    }
}

class KeyframeAccess extends Component {
    static propTypes = {
        timeDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
        refreshRate: PropTypes.number.isRequired,
        initialStatus: PropTypes.object.isRequired,

        minFetchedKeyframesCount: PropTypes.number,
        maxLoadAheadMs: PropTypes.number,
        sigSets: PropTypes.object.isRequired,

        render: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            seek: ::this.seek,
            getNext: ::this.getNext,
            changePlaybackSpeed: ::this.changePlaybackSpeed,
        };

        this.timeSpeedFactor = this.props.initialStatus.playbackSpeedFactor;
        this.keyframeAccessesInit();

        this.forAllKfAccesses = (func) => Object.keys(this.keyframeAccesses).map(sigSetCid => func(this.keyframeAccesses[sigSetCid], sigSetCid));
    }

    componentDidUpdate(prevProps) {
        if (this.props.sigSets !== prevProps.sigSets) {
            this.keyframeAccessesInit();
            this.seek(this.lastSeekTo);
        }
    }

    async seek(ts) {
        this.lastSeekTo = ts;
        const keyframesArr = await Promise.all(this.forAllKfAccesses(kfAccess => kfAccess.seek(ts)));

        return keyframesArr.reduce((acc, keyframe) => Object.assign(acc, keyframe), {});
    }

    getNext(sigSetCid) {
        // console.log("getNext:", sigSetCid);
        return this.keyframeAccesses[sigSetCid].getNext();
    }

    changePlaybackSpeed(factor) {
        this.timeSpeedFactor = factor;

        this.forAllKfAccesses(kfAccess => kfAccess.startFillingDataQueue());
    }

    getStatus() {
        return {
            timeSpeedFactor: this.timeSpeedFactor,
            timeDomain: this.props.timeDomain,
            refreshRate: this.props.refreshRate,
            minFetchedKeyframesCount: this.props.minFetchedKeyframesCount || 3,
            maxLoadAheadMs: this.props.maxLoadAheadMs || 30000,
        };
    }


    keyframeAccessesInit() {
        this.keyframeAccesses = {};
        for (let sigSetCid of Object.keys(this.props.sigSets)) {
            this.keyframeAccesses[sigSetCid] = new SigSetKeyframeAccess(::this.getStatus, sigSetCid, this.props.sigSets[sigSetCid].sensors, this.props.sigSets[sigSetCid].timestampCid);
        }
    }

    render() {
        return this.props.render({...this.state});
    }
}

class RecordedAnimationBase extends Component {
    static propTypes = {
        timeDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
        refreshRate: PropTypes.number,
        initialStatus: PropTypes.object.isRequired,

        seek: PropTypes.func.isRequired,
        getNext: PropTypes.func.isRequired,
        changePlaybackSpeed: PropTypes.func.isRequired,

        render: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            status: {...props.initialStatus, isBuffering: true, timeDomain: props.timeDomain},
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

        this.keyframes = {};
        this.refreshTimeout = null;

        this.nextSeekPromise = null;
        this.nextKfPromises = new Map();
    }

    componentDidUpdate() {
        //TODO: on timeDomain, refreshRate change?
    }

    componentDidMount() {
        this.changePlaybackSpeedHandler(this.state.status.playbackSpeedFactor);
        this.seekHandler(this.state.status.position);

        if (this.state.status.isPlaying) this.playHandler();
    }

    componentWillUnmount() {
        this.stopRefreshing();
    }


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
        //TODO: should restore initialStatus?
        if (this.state.status.isPlaying) this.pauseHandler();
        this.seekHandler(this.props.initialStatus.position);
    }

    jumpForwardHandler(shiftMs) {
        this.seekHandler(this.state.status.position + shiftMs);
    }

    jumpBackwardHandler(shiftMs) {
        this.seekHandler(this.state.status.position - shiftMs);
    }

    changePlaybackSpeedHandler(factor) {
        this.props.changePlaybackSpeed(factor);
        this.setStatus({playbackSpeedFactor: factor});
    }

    @withAsyncErrorHandler
    async seekHandler(ts) {
        const clampedTs = Math.min(this.props.timeDomain[1], Math.max(this.props.timeDomain[0], ts));

        this.keyframes = {};
        this.setStatus({position: clampedTs, isBuffering: true});

        this.nextSeekPromise = this.props.seek(clampedTs);

        const keyframes = await this.nextSeekPromise;

        if (clampedTs === this.state.status.position) {
            this.nextSeekPromise = null;
            this.keyframes = keyframes;
            if (!this.refreshing) this.setStatus({isBuffering: false});
        }
    }


    refresh() {
        const notEnoughKfs = () => (
            Object.keys(this.keyframes).length === 0 ||
            Object.keys(this.keyframes).filter(sigSetCid => this.keyframes[sigSetCid].length < 3 && this.keyframes[sigSetCid][1].ts < this.props.timeDomain[1]).length > 0
        );

        const refreshPosition = (interval) => {
            const nextPosition = Math.min(
                this.props.timeDomain[1],
                this.state.status.position + (this.state.status.playbackSpeedFactor * interval)
            );


            this.tryShiftUntil(nextPosition);


            if (notEnoughKfs()) {
                // console.log("try shifting, not enough keyframes");
                this.savedInterval = interval;
                if (!this.state.status.isBuffering) this.setStatus({isBuffering: true});
            } else {
                // console.log("refreshing");
                this.setStatus({isBuffering: false, position: nextPosition});
            }
        };


        if (notEnoughKfs()) {
            // console.log("not enough kfs, starting to buffer");
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

        if (this.state.status.position !== this.props.timeDomain[1]) {
            this.refreshTimeout = setTimeout(::this.refresh, this.props.refreshRate);
        } else {
            this.refreshing = false;
            this.pauseHandler();
        }
    }

    tryShiftUntil(ts) {
        if (this.nextSeekPromise) return;

        const sigSetsToFetch = Object.keys(this.keyframes).filter(sigSetCid =>
            this.keyframes[sigSetCid][1].ts < this.props.timeDomain[1] &&
            this.keyframes[sigSetCid][1].ts < ts &&
            !this.nextKfPromises.has(sigSetCid)
        );

        for (let sigSetCid of sigSetsToFetch) {
            this.keyframes[sigSetCid].shift();

            if (this.keyframes[sigSetCid][1].ts < this.props.timeDomain[1]) {
                // console.log("gettin next for", sigSetCid);
                const {keyframe, promise} = this.props.getNext(sigSetCid);

                if (promise) {
                    const positionBefore = this.state.status.position;
                    const sigSetPromise = promise.then(({keyframe}) => {
                        if (this.state.status.position === positionBefore) {
                            this.keyframes[sigSetCid].push(keyframe);
                            // console.log("thrid keyframe came, same position");
                        }

                        // console.log("thrid keyframe came, different position");

                        this.nextKfPromises.delete(sigSetCid);
                    });

                    this.nextKfPromises.set(sigSetCid, sigSetPromise);
                } else {
                    this.keyframes[sigSetCid].push(keyframe);
                }
            }
        }
    }

    startRefreshing() {
        if (this.refreshing) return;

        this.lastRefreshTs = Date.now();
        this.refreshing = true;
        this.refreshTimeout = setTimeout(::this.refresh, this.props.refreshRate);
    }

    stopRefreshing() {
        this.refreshing = false;
        clearTimeout(this.refreshTimeout);
    }

    setStatus(nextStatus) {
        this.setState(prevState => {
            const newStatus = Object.assign({}, prevState.status, nextStatus);

            const newKeyframes = {};
            for (let sigSetCid in this.keyframes) {
                newKeyframes[sigSetCid] = [...this.keyframes[sigSetCid]];
            }

            return {status: newStatus, keyframes: newKeyframes};
        });
    }

    render() {
        return (
            <>
                <AnimationStatusContext.Provider value={this.state.status}>
                    <AnimationControlContext.Provider value={this.state.controls}>
                        {this.props.render({status: this.state.status, keyframes: this.state.keyframes})}

                        <Debug
                            name={"Client Animation"}
                            status={this.state.status}
                            thisKeyframes={this.keyframes}
                            keyframes={this.state.keyframes}
                        />
                    </AnimationControlContext.Provider>
                </AnimationStatusContext.Provider>
            </>
        );
    }
}


export {
    RecordedAnimation
};
