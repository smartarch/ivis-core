import React, {Component} from "react";
import {AnimationStatusContext, AnimationControlContext, AnimationDataContext} from "../lib/animation-helpers";
import {withAsyncErrorHandler} from "../lib/error-handling";
import {DataAccessSession} from "./DataAccess";
import {withComponentMixins} from "../lib/decorator-helpers";
import {intervalAccessMixin, TimeContext} from "./TimeContext";
import {IntervalSpec} from "./TimeInterval";
import {bisector} from "d3-array";
import moment from "moment";
import _ from "lodash";
import PropTypes from "prop-types";


//When the tab is inactive, setIntervals and setTimeouts that are scheduled within less than 1s are triggered after
//1s. This means that we want to store at least 1s of keyframes ahead of the
//current position.
const minTimeLoadedAhead = 1000;

const defaultMaxLoadAheadMs = 30000;
const defaultMinFramesPerKeyframe = 5;
const defaultRefreshRate = 45;


//TODO: fill isRequired & optional
class RecordedAnimation extends Component {
    static propTypes = {
        dataSources: PropTypes.object.isRequired,

        initialIntervalSpec: PropTypes.object,
        intervalConfigPath: PropTypes.arrayOf(PropTypes.string),
        defaultGetMinAggregationInterval: PropTypes.func,

        initialStatus: PropTypes.object,
        refreshRate: PropTypes.number,

        children: PropTypes.node,
    }

    static defaultProps = {
        initialIntervalSpec: new IntervalSpec('now-6d', 'now', null, null),
        intervalConfigPath: ['animationTimeContext'],
        refreshRate: defaultRefreshRate,
        initialStatus: {
            isPlaying: false,
            playbackSpeedFactor: 1,
            position: null,
        },
    }

    render() {
        const childrenRender = (props) => {
            return (
                <RecordedAnimationBase
                    refreshRate={this.props.refreshRate}
                    initialStatus={this.props.initialStatus}
                    {...props}
                >
                    {this.props.children}
                </RecordedAnimationBase>
            );
        };

        return (
            <TimeContext
                initialIntervalSpec={this.props.initialIntervalSpec}
                configPath={this.props.intervalConfigPath}
                getMinAggregationInterval={this.props.defaultGetMinAggregationInterval}
            >

                <AnimationDataAccess
                    refreshRate={this.props.refreshRate}

                    dataSources={this.props.dataSources}
                    render={childrenRender}
                />
            </TimeContext>
        );
    }
}

class SignalInterpolation {
    constructor(signals, func, arity) {
        this.signals = signals;
        this.func = func;
        this.arity = arity;
        this.signalArgs = {};
        this.tsArgs = [];

        this.hasCachedArgs = false;
    }

    rebuildArgs(keyframes) {
        this.signalArgs = {};
        this.tsArgs = [];
        this.hasCachedArgs = false;

        if (keyframes.length < this.arity) return;
        const kfsWithArgs = keyframes.slice(0, this.arity);

        const getArgsForAgg = (sigCid, agg) => kfsWithArgs.map(kf => kf.data[sigCid][agg]);

        for (const sigCid of Object.keys(this.signals)) {
            const sigAggs = this.signals[sigCid];

            const args = {};
            for (const agg of sigAggs) {
                args[agg] = getArgsForAgg(sigCid, agg);
            }

            this.signalArgs[sigCid] = args;
        }

        this.tsArgs = kfsWithArgs.map(kf => moment.isMoment(kf.ts) ? kf.ts.valueOf() : kf.ts);
        this.hasCachedArgs = true;
    }

    interpolate(ts) {
        let forceNull = !this.hasCachedArgs || this.tsArgs[0] > ts || this.tsArgs[this.tsArgs.length - 1] < ts;

        const results = {};
        const interpolateAgg = (sigCid, agg) => forceNull ? null : this.func(this.tsArgs, this.signalArgs[sigCid][agg], ts);

        for (const sigCid of Object.keys(this.signals)) {
            const sigAggs = this.signals[sigCid];

            const sigResults = {};
            for (const agg of sigAggs) {
                sigResults[agg] = interpolateAgg(sigCid, agg);
            }

            results[sigCid] = sigResults;
        }

        return results;
    }
}

class GenericDataSource {
    constructor(config, dataAccess) {
        this.dataAccess = dataAccess;

        const parseConfig = () => {
            const conf = {
                sigSetCid: config.sigSetCid,
                tsSigCid: config.tsSigCid,
                signals: config.signals,

                kfCount: config.interpolation.arity,

                maxLoadAheadMs: config.maxLoadAheadMs || defaultMaxLoadAheadMs,
                minFramesPerKeyframe: config.minFramesPerKeyframe || defaultMinFramesPerKeyframe,

                withHistory: config.withHistory || false,
            };

            let getAggStep = null;
            if (conf.withHistory) {
                getAggStep = () => this.dataAccess.getIntervalAbsolute().aggregationInterval;
            } else {
                getAggStep = () => this.dataAccess.getPlaybackSpeedFactorBasedAggStep(conf.minFramesPerKeyframe);
            }

            const getAggOffset = (aggStep) => moment.duration(this.dataAccess.getIntervalAbsolute().from.valueOf() % aggStep.asMilliseconds());

            conf.getAggStep = getAggStep;
            conf.getAggOffset = getAggOffset;

            return conf;
        };

        this.conf = parseConfig();

        this.kfBuffer = [];
        this.history = [];
        this.missedFetches = 1;

        this.nextChunkBeginTs = null;

        this.intp = new SignalInterpolation(this.conf.signals, config.interpolation.func, this.conf.kfCount);
    }

    canShiftTo(ts) {
        console.log("can shift to", {hasMoreData: this.hasMoreData, lastTs: this.kfBuffer.length > 0 ? moment(this.kfBuffer[this.kfBuffer.length - 1].ts).toString() : "empty buffer", shiftTs: moment(ts).toString()});
        return !this.hasMoreData || this.kfBuffer[this.kfBuffer.length - 1].ts >= ts;
    }

    shiftTo(ts) {
        console.log("shifting ", this.conf.sigSetCid);

        if (this.conf.withHistory) {
            const historyLastTs = this.history.length > 0 ? this.history[this.history.length - 1].ts : this.dataAccess.getIntervalAbsolute().from.valueOf() - 1;
            const kfsToHistory = this.kfBuffer.filter(kf => kf.ts < ts && kf.ts > historyLastTs);
            this.history.push(...kfsToHistory);
        }

        if (this.kfBuffer.length < this.conf.kfCount) {
            console.log("buffer has insufficent length");
            while (this.kfBuffer.length > 0 && this.kfBuffer[0].ts < ts)
                this.kfBuffer.shift();

            this.intp.rebuildArgs(this.kfBuffer);

        } else if (this.kfBuffer[this.kfBuffer.length - 1].ts < ts) {
            console.log("entire buffer is outdated");

            this.kfBuffer = [];

            this.intp.rebuildArgs(this.kfBuffer);

        } else if (this.kfBuffer[this.conf.kfCount - 1].ts < ts) {
            console.log("buffer is shifting");

            while (this.kfBuffer[this.conf.kfCount - 1].ts < ts) {
                const newBeginIdx = Math.min(
                    this.kfBuffer.length - this.conf.kfCount,
                    this.conf.kfCount - 1
                );

                console.log("shift by ", newBeginIdx);

                this.kfBuffer = this.kfBuffer.slice(newBeginIdx);
            }

            this.intp.rebuildArgs(this.kfBuffer);
        } else if (!this.intp.hasCachedArgs) {
            console.log("rebuildArgs");

            this.intp.rebuildArgs(this.kfBuffer);
        }

        console.log("--------- shifting", this.conf.sigSetCid);


        if (this.conf.withHistory) {
            return [...this.history, {ts, data: this.intp.interpolate(ts)}];
        } else {
            return this.intp.interpolate(ts);
        }
    }

    didMissFetch() {
        this.missedFetches += 1;
    }
    hasEnoughLoaded(maxPredictedFetchTime) {
        const kfBuffer = this.kfBuffer;
        const storedTime = kfBuffer.length <= 2*this.conf.kfCount ? 0 : kfBuffer[kfBuffer.length - 1].ts - kfBuffer[2*this.conf.kfCount].ts;

        return !this.hasMoreData || (storedTime - minTimeLoadedAhead) / this.dataAccess.playbackSpeedFactor > this.missedFetches * maxPredictedFetchTime;
    }

    getSeekQueries(ts) {
        const queries = [];

        this.nextChunkBeginTs = ts;
        this.nextKeyframeCount = 2*this.conf.kfCount;

        if (this.conf.withHistory) queries.push(this._getHistoryQuery());
        queries.push(this._getFirstKeyframeQuery());
        queries.push(this._getNextKeyframesQuery());

        return queries;
    }
    processSeekQueries(qryResults) {
        this.hasMoreData = true;

        const realKeyframeCount = qryResults[qryResults.length - 1][0].buckets.length;
        if (realKeyframeCount < this.nextKeyframeCount) {
            this.hasMoreData = false;
        }

        if (this.conf.withHistory) {
            const historyRes = qryResults.shift()[0].buckets;
            this.history = this._processHistory(historyRes);
        }

        let keyframesRes = [].concat(...qryResults.map(result => result[0].buckets));
        this.kfBuffer = this._processKeyframes(keyframesRes);
    }

    getNextChunkQueries() {
        return [ this._getNextKeyframesQuery() ];
    }
    processNextChunkQueries(qryResults) {
        const buckets = qryResults[0][0].buckets;
        if (buckets.length < this.nextKeyframeCount) {
            this.hasMoreData = false;
        }

        let keyframes = this._processKeyframes(buckets);

        this.kfBuffer.push(...keyframes);
    }

    _processKeyframes(buckets) {
        const kfs = this._procesBuckets(buckets);

        this.nextChunkBeginTs = kfs.length > 0 ? kfs[kfs.length - 1].ts : this.nextChunkBeginTs;

        const timeFetched = kfs.length <= 1 ? 0 : kfs[kfs.length - 1].ts - kfs[0].ts;
        if (timeFetched / this.dataAccess.playbackSpeedFactor < this.conf.maxLoadAheadMs) {
            this.nextKeyframeCount = this.nextKeyframeCount * 2;
        }

        return kfs;
    }
    _processHistory(buckets) {
        return this._procesBuckets(buckets);
    }
    _procesBuckets(buckets) {
        const formattedBuckets = [];

        for (const bucket of buckets) {
            const ts = moment(bucket.key).valueOf();
            const data = bucket.values;

            formattedBuckets.push({ ts, data});
        }

        return formattedBuckets;
    }

    _getNextKeyframesQuery() {
        return {
            type: "aggs",
            args: [
                this.conf.sigSetCid,
                {
                    type: "range",
                    sigCid: this.conf.tsSigCid,
                    gt: moment(this.nextChunkBeginTs).toISOString(),
                },
                this._getQueryAggs(this.nextKeyframeCount, "asc")
            ]
        };
    }
    _getFirstKeyframeQuery() {
        return {
            type: "aggs",
            args: [
                this.conf.sigSetCid,
                {
                    type: "range",
                    sigCid: this.conf.tsSigCid,
                    lte: moment(this.nextChunkBeginTs).toISOString(),
                },
                this._getQueryAggs(1, "desc")
            ]
        };
    }
    _getHistoryQuery() {
        return {
            type: "aggs",
            args: [
                this.conf.sigSetCid,
                {
                    type: "range",
                    sigCid: this.conf.tsSigCid,
                    lt: moment(this.nextChunkBeginTs).toISOString(),
                    gte: this.dataAccess.getIntervalAbsolute().from.toISOString(),
                },
                this._getQueryAggs(null, 'asc')
            ]
        };
    }

    _getQueryAggs(limit, order) {
        const step = this.conf.getAggStep();
        const offset = this.conf.getAggOffset(step);

        return [
            {
                sigCid: this.conf.tsSigCid,
                step: step.toString(),
                offset: offset.toString(),
                minDocCount: 1,
                signals: this.conf.signals,
                limit,
                order,
            }
        ] ;
    }
}

class TimeSeriesDataSource {
    constructor(config, dataAccess) {
        this.dataAccess = dataAccess;

        const parseConfig = () => {
            const conf = {
                sigSetCid: config.sigSetCid,
                tsSigCid: config.tsSigCid,
                signals: config.signals,

                kfCount: config.interpolation.arity,

                getAggStep: () => this.dataAccess.getIntervalAbsolute().aggregationInterval,
                getAggOffset: (aggStep) => moment.duration(this.dataAccess.getIntervalAbsolute().from.valueOf() % aggStep.asMilliseconds()),
            };

            return conf;
        };

        this.conf = parseConfig();
        this.data = null;
        this.kfStartIdx = null;
        this.lastMainEndIdx = null;
        this.intp = new SignalInterpolation(this.conf.signals, config.interpolation.func, this.conf.kfCount);

        this.lastSeekInterval = null;
    }

    canShiftTo() {
        return true;
    }

    shiftTo(ts) {
        const main = this.data.main;

        console.log("timeSeries", "shift start", moment(ts).toString(), this.data.main);

        if (main.length === 0 || ts < main[0].ts.valueOf()) {
            console.log("timeSeries", "ts before main");
            return {
                [this.conf.sigSetCid]: { main: [] }
            };
        } else if (ts >= main[main.length - 1].ts.valueOf()) {
            console.log("timeSeries", "ts after main");
            const data = {
                main: this.data.main
            };

            if (this.data.prev) data.prev = this.data.prev;
            if (this.data.next) data.next = this.data.next;

            return {
                [this.conf.sigSetCid]: data
            };
        }

        const maxKfStartIdx = main.length - this.conf.kfCount;

        let mainEndIdx;
        if (this.lastMainEndIdx === null) {
            console.log("timeSeries", "new main idx");
            mainEndIdx = bisector((kf) => kf.ts.valueOf()).left(main, ts);
        } else {
            console.log("timeSeries", "shifting main idx");
            mainEndIdx = this.lastMainEndIdx;
            while (mainEndIdx < main.length - 1 && main[mainEndIdx + 1].ts.valueOf() < ts) {
                mainEndIdx++;
            }
        }
        this.lastMainEndIdx = mainEndIdx;
        console.log("timeSeries", mainEndIdx);

        if (this.kfStartIdx === null) {
            console.log("timeSeries", "new kfStartIdx");
            if (mainEndIdx > maxKfStartIdx) {
                this.kfStartIdx = maxKfStartIdx;
            } else {
                this.kfStartIdx = main[mainEndIdx + 1].ts.valueOf() === ts ? mainEndIdx + 1 : mainEndIdx;
            }

            this.intp.rebuildArgs(main.slice(this.kfStartIdx, this.kfStartIdx + this.conf.kfCount));

        } else if (main[this.kfStartIdx + this.conf.kfCount - 1].ts.valueOf() < ts) {
            while (main[this.kfStartIdx + this.conf.kfCount - 1].ts.valueOf() < ts) {
                this.kfStartIdx = Math.min(
                    maxKfStartIdx,
                    this.kfStartIdx + this.conf.kfCount - 1
                );

                console.log("timeSeries", "shifting kfs");
            }

            this.intp.rebuildArgs(main.slice(this.kfStartIdx, this.kfStartIdx + this.conf.kfCount));
        } else if (!this.intp.hasCachedArgs) {
            console.log("timeSeries", "rebuildArgs");
            this.intp.rebuildArgs(main.slice(this.kfStartIdx, this.kfStartIdx + this.conf.kfCount));
        }

        console.log("timeSeries", "shift end", main.slice(this.kfStartIdx, this.kfStartIdx + this.conf.kfCount));
        const data = {
            main: main.slice(0, mainEndIdx + 1),
        };
        console.log("timeSeries", "main", data.main);

        data.main.push({ts: moment(ts), data: this.intp.interpolate(ts)});

        if (this.data.prev) data.prev = this.data.prev;

        return {[this.conf.sigSetCid]: data};
    }

    didMissFetch() {}
    hasEnoughLoaded() {
        return true;
    }

    getSeekQueries() {
        const intvAbs = this.dataAccess.getIntervalAbsolute();

        const sameAggregationInterval = () => {
            const prev = this.lastSeekInterval.aggregationInterval;
            const curr = intvAbs.aggregationInterval;

            return (prev === null && curr === null) || (prev !== null && curr !== null && prev.asMilliseconds() === curr.asMilliseconds());
        };

        if (this.lastSeekInterval &&
            this.lastSeekInterval.from === intvAbs.from.valueOf() &&
            this.lastSeekInterval.to === intvAbs.to.valueOf() &&
            sameAggregationInterval()) {

            return [];
        }

        const sigSets = {
            [this.conf.sigSetCid]: {
                tsSigCid: this.conf.tsSigCid,
                signals: this.conf.signals,
            },
        };

        const queries = [
            {
                type: "timeSeries",
                args: [ sigSets, intvAbs ]
            }
        ];

        return queries;
    }
    processSeekQueries(qryResults, queries) {
        if (qryResults.length === 0) return;

        const intvAbs = queries[0].args[1];
        this.lastSeekInterval = {
            from: intvAbs.from.valueOf(),
            to: intvAbs.to.valueOf(),
            aggregationInterval: intvAbs.aggregationInterval
        };


        this.kfStartIdx = null;
        this.lastMainEndIdx = null;

        this.data = qryResults[0][this.conf.sigSetCid];
    }

    getNextChunkQueries() {
        return [];
    }
    processNextChunkQueries() {}
}

const dataSources = {
    generic: GenericDataSource,
    timeSeries: TimeSeriesDataSource,
};

@withComponentMixins([intervalAccessMixin()])
class AnimationDataAccess extends Component {
    static propTypes = {
        refreshRate: PropTypes.number.isRequired,
        dataSources: PropTypes.object.isRequired,
        render: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            seek: ::this.seek,
            refreshTo: ::this.refreshTo,
            setPlaybackSpeedFactor: ::this.setPlaybackSpeedFactor,

            fetchError: null,
            needsReseek: false,
        };

        this.maxFetchTime = 0;

        this.mapDataSources = (func) => Object.keys(this.dataSources).map(dsKey => func(this.dataSources[dsKey], dsKey));
        this.reset();
    }

    componentDidUpdate(prevProps) {
        if (!_.isEqual(this.props.dataSources, prevProps.dataSources)) {
            this.reset();
            this.setState({needsReseek: true});
        }
    }

    async seek(ts) {
        if (this.state.needsReseek) this.setState({needsReseek: false});

        console.log("seeking to ", moment(ts).toString());

        const wasLatestFetch = await this.runQueries(Object.keys(this.dataSources), "getSeekQueries", [ts], "processSeekQueries");

        if (!wasLatestFetch) return null;

        return this.shiftTo(ts);
    }

    refreshTo(ts) {
        if (this.state.needsReseek || this.nextFetchPromise) return {data: null};

        console.log("refreshing to ", moment(ts).toString());
        const dataSourcesToFetch = Object.keys(this.dataSources).filter(dataSrcKey => !this.dataSources[dataSrcKey].canShiftTo(ts));

        if (dataSourcesToFetch.length === 0) {
            return {data: this.shiftTo(ts)};
        }

        dataSourcesToFetch.map(dtSrcKey => this.dataSources[dtSrcKey].didMissFetch());
        console.log("data sources with not enough data", dataSourcesToFetch);
        this.runQueries(dataSourcesToFetch, "getNextChunkQueries", [], "processNextChunkQueries");
        const promise = this.nextFetchPromise.then(wasLatestFetch => {
            if (!wasLatestFetch) return null;

            return this.shiftTo(ts);
        });

        return {promise};
    }


    async runQueries(dataSrcKeys, getQueriesFuncName, getQueriesFuncArgs, processQueriesFuncName) {
        const _runQueries = async () => {
            const lengths = [];
            const querySetOwners = [];
            const queries = [];

            for (const dataSrcKey of dataSrcKeys) {
                const querySet = this.dataSources[dataSrcKey][getQueriesFuncName](...getQueriesFuncArgs);
                queries.push(...querySet);
                lengths.push(querySet.length);
                querySetOwners.push(dataSrcKey);
            }

            const results = await this.dataAccSession.getLatestMixed(queries);

            if (results === null) return false;

            let i = 0;
            while (i < querySetOwners.length) {
                const owner = this.dataSources[querySetOwners[i]];
                const querySetLength = lengths[i];
                const resultSet = results.splice(0, querySetLength);
                const querySet = queries.splice(0, querySetLength);

                owner[processQueriesFuncName](resultSet, querySet);

                i++;
            }

            return true;
        };

        this.nextFetchPromise = _runQueries();
        const beforeFetchTs = Date.now();

        const wasLatestFetch = await this.nextFetchPromise;

        this.nextFetchPromise = null;
        this.maxFetchTime = Math.max(this.maxFetchTime, Date.now() - beforeFetchTs);

        return wasLatestFetch;
    }
    shiftTo(ts) {
        const data = {};

        for (const dataSrcKey of Object.keys(this.dataSources)) {
            data[dataSrcKey] = this.dataSources[dataSrcKey].shiftTo(ts);
        }

        console.log("shift", {ts: moment(ts).toString(), data});
        this.startPreFetching();
        return data;
    }
    @withAsyncErrorHandler
    async startPreFetching() {
        if (this.state.needsReseek || this.nextFetchPromise) return;

        console.log("starting to prefetch");
        let needFetch = Object.keys(this.dataSources).filter(dataSrcKey => !this.dataSources[dataSrcKey].hasEnoughLoaded(this.maxFetchTime));
        while (needFetch.length > 0) {
            console.log("prefetch", {needFetch});
            const wasLatestFetch = await this.runQueries(needFetch, "getNextChunkQueries", [], "processNextChunkQueries");

            if (!wasLatestFetch) return;

            needFetch = Object.keys(this.dataSources).filter(dataSrcKey => !this.dataSources[dataSrcKey].hasEnoughLoaded(this.maxFetchTime));
        }

        console.log("prefetch ended");
    }

    setPlaybackSpeedFactor(factor) {
        this.playbackSpeedFactor = factor;
    }
    errorHandler(error) {
        this.setState({fetchError: error, needsReseek: true});

        return true;
    }
    getPlaybackSpeedFactorBasedAggStep(minFramesPerKeyframe) {
        return moment.duration(minFramesPerKeyframe * this.props.refreshRate * this.playbackSpeedFactor);
    }

    reset() {
        this.dataAccSession = new DataAccessSession();
        this.nextFetchPromise = null;

        this.dataSources = {};
        for (let dataSrcKey of Object.keys(this.props.dataSources)) {
            const config = this.props.dataSources[dataSrcKey];
            const DataSourceType = dataSources[config.type] || "generic";

            this.dataSources[dataSrcKey] = new DataSourceType(config, this);
        }
    }

    render() {
        return this.props.render({...this.state});
    }
}

@withComponentMixins([intervalAccessMixin()])
class RecordedAnimationBase extends Component {
    static propTypes = {
        refreshRate: PropTypes.number.isRequired,
        initialStatus: PropTypes.object.isRequired,

        seek: PropTypes.func.isRequired,
        refreshTo: PropTypes.func.isRequired,
        setPlaybackSpeedFactor: PropTypes.func.isRequired,

        needsReseek: PropTypes.bool,

        fetchError: PropTypes.object,

        children: PropTypes.node,
    }

    constructor(props) {
        super(props);

        this.state = {
            status: this.resetStatus(false),
            controls: {
                play: ::this.playHandler,
                pause: ::this.pauseHandler,
                seek: ::this.seekHandler,
                stop: ::this.stopHandler,
                jumpForward: ::this.jumpForwardHandler,
                jumpBackward: ::this.jumpBackwardHandler,
                changeSpeed: ::this.changePlaybackSpeedHandler,
            },
            animationData: {},
        };

        this.refreshTimeout = null;
        this.inRefresh = false;
    }

    componentDidUpdate(prevProps) {
        if (this.props.fetchError && !prevProps.fetchError) {
            this.errorHandler(this.props.fetchError);
            return;
        }

        const prevIntvSpec = this.getIntervalSpec(prevProps);
        const currIntvSpec = this.getIntervalSpec();
        const sameIntv = prevIntvSpec.from === currIntvSpec.from && prevIntvSpec.to === currIntvSpec.to;
        if (!sameIntv) {
            this.seekHandler(this.getIntervalAbsolute().from.valueOf());
        } else if (this.props.needsReseek && !prevProps.needsReseek) {
            this.seekHandler(this.state.status.position);
        }
    }

    componentWillUnmount() {
        this.stopRefreshing();
    }

    componentDidMount() {
        this.changePlaybackSpeedHandler(this.state.status.playbackSpeedFactor);
        this.seekHandler(this.state.status.position);

        if (this.state.status.isPlaying) this.playHandler();
    }

    resetStatus(withUpdate) {
        const is = this.props.initialStatus;
        const startingPos = is.position !== null ?
            this.clampPos(is.position) :
            this.getIntervalAbsolute().from.valueOf()
        ;

        const newStatus = {
            isBuffering: true,
            isPlaying: is.isPlaying,
            playbackSpeedFactor: is.playbackSpeedFactor,
            position: startingPos,
        };

        if (withUpdate) {
            this.changePlaybackSpeedHandler(newStatus.playbackSpeedFactor);
            this.seekHandler(newStatus.position);

            if (newStatus.isPlaying) this.playHandler();
        }

        return newStatus;
    }

    clampPos(pos) {
        const minPosition = this.getIntervalAbsolute().from.valueOf();
        const maxPosition = this.getIntervalAbsolute().to.valueOf();
        return Math.min(maxPosition, Math.max(minPosition, pos));
    }


    errorHandler(error) {
        console.error(error);

        this.stopRefreshing();
        this.setState({controls: {}});
        this.setStatus({error});

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
        this.seekHandler(this.getIntervalAbsolute().from.valueOf());
    }

    jumpForwardHandler(shiftMs) {
        this.seekHandler(this.state.status.position + shiftMs);
    }

    jumpBackwardHandler(shiftMs) {
        this.seekHandler(this.state.status.position - shiftMs);
    }

    changePlaybackSpeedHandler(factor) {
        this.props.setPlaybackSpeedFactor(factor);
        this.setStatus({playbackSpeedFactor: factor});
    }

    @withAsyncErrorHandler
    async seekHandler(ts) {
        const clampedTs = this.clampPos(ts);

        this.setStatus({position: clampedTs, isBuffering: true});

        const animData = await this.props.seek(clampedTs);

        if (animData !== null) {
            this.setState({animationData: animData});
            this.setStatus({isBuffering: this.state.status.isPlaying});
        }
    }


    @withAsyncErrorHandler
    async refresh() {
        this.inRefresh = true;

        const interval = Date.now() - this.lastRefreshTs;
        console.log("_refresh", interval);
        this.lastRefreshTs = Date.now();

        const endPosition = this.getIntervalAbsolute().to.valueOf();
        const nextPosition = Math.min(
            endPosition,
            this.state.status.position + (this.state.status.playbackSpeedFactor * interval)
        );


        let {data, promise} = this.props.refreshTo(nextPosition);

        if (promise) {
            if (!this.state.status.isBuffering)
                this.setStatus({isBuffering: true});

            data = await promise;
            this.lastRefreshTs = Date.now();
        }

        if (data !== null) {
            this.setStatus({
                isBuffering: false,
                position: nextPosition,
            });

            this.setState({
                animationData: data,
            });
        }


        if (nextPosition !== endPosition && this.isRefreshing) {
            const computeTime = Date.now() - this.lastRefreshTs;
            this.refreshTimeout = setTimeout(::this.refresh, Math.max(0, this.props.refreshRate - computeTime));
        } else {
            this.pauseHandler();
        }

        this.inRefresh = false;
    }

    startRefreshing() {
        if (this.isRefreshing) return;

        this.isRefreshing = true;
        if (this.inRefresh) return;

        this.lastRefreshTs = Date.now();
        this.refreshTimeout = setTimeout(::this.refresh, this.props.refreshRate);
    }

    stopRefreshing() {
        this.isRefreshing = false;
        clearTimeout(this.refreshTimeout);
    }

    setStatus(nextStatus) {
        this.setState(prevState => {
            const newStatus = Object.assign({}, prevState.status, nextStatus);

            return {status: newStatus};
        });
    }

    render() {
        return (
            <>
                <AnimationStatusContext.Provider value={this.state.status}>
                    <AnimationControlContext.Provider value={this.state.controls}>
                        <AnimationDataContext.Provider value={this.state.animationData}>
                            {this.props.children}
                        </AnimationDataContext.Provider>
                    </AnimationControlContext.Provider>
                </AnimationStatusContext.Provider>
            </>
        );
    }
}

export {
    RecordedAnimation
};
