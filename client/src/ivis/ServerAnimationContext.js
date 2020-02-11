import React, {Component} from "react";
import {Debug} from "./Debug";
import axios from "../lib/axios";
import {getUrl} from "../lib/urls";
import PropTypes from "prop-types";

export const AnimationKeyframeContext = React.createContext(null);
export const AnimationControlContext = React.createContext(null);

export class ServerAnimationContext extends Component {
    static propTypes = {
        children: PropTypes.node,
    }

    constructor(props) {
        super(props);

        this.data = [];
        this.state = {
            status: {
                ver: -1,
            },
            keyframeContext: {
                status: {},
            },
            lastFetchedKeyframe: -1,
        };


        // status refresh rate - later from props/server..
        this.refreshRate = 500;
        this.minBufferLength = 5;
        this.safeBufferLength = 2;

        // For debug purposes
        this.sabotageDataFetch = false;

    }

    async fetchStatus() {
        const res = await axios.get(getUrl("rest/animation/server/status"));
        this.setState(state => {
            if (state.status.ver == res.data.ver) return null;
            else return {status: res.data};
        });
    }

    async fetchData() {
        if (this.sabotageDataFetch) return;

        const res = await axios.get(getUrl("rest/animation/server/data"));
        const animData = res.data;

        console.log("Data fetch:", res.data, "last data fetch before:", (Date.now() - this.lastDataFetchTS) / 1000);
        this.lastDataFetchTS = Date.now();

        if (Array.isArray(animData)) {
            this.data.push(...animData);
            this.setState({lastFetchedKeyframe: animData[animData.length - 1].currKeyframeNum});
        } else {
            this.data.push(animData);
            this.setState({lastFetchedKeyframe: animData.currKeyframeNum});
        }
    }

    async play() {
        await axios.post(getUrl("rest/animation/server/play"));
    }

    async pause() {
        await axios.post(getUrl("rest/animation/server/pause"));
    }

    async stop() {
        await axios.post(getUrl("rest/animation/server/reset"));
    }

    shiftKeyframes() {
        if (this.state.status.playStatus != "playing") {
            console.log("Trying to shift when status is:", this.state.status.playStatus);
            return;
        }

        if (!this.enoughKeyframesBuffered(false)) {
            this.delayedKeyframesShift = true;
            this.pushStatus({playStatus: "buffering"});
            return;
        }

        if(this.delayedKeyframesShift) {
            this.delayedKeyframesShift = false;
            this.pushStatus({playStatus: "playing"});
        }

        this._shiftKeyframes();
    }

    _shiftKeyframes() {
        console.log("Keyframes shift", {currKeyframe: this.data[0]});
        this.setState((prevState) => {
            const newKeyframeContext = Object.assign({}, prevState.keyframeContext, this.data.shift());
            if (prevState.keyframeContext.shiftKeyframes === undefined) newKeyframeContext.shiftKeyframes = ::this.shiftKeyframes;

            return { keyframeContext: newKeyframeContext };
        });
    }

    enoughKeyframesBuffered(strict) {
        const bufferedKfNum = this.state.lastFetchedKeyframe + (strict ? 0 : this.safeBufferLength);
        const neededKfNum = 1 + this.minBufferLength + (this.state.keyframeContext.currKeyframeNum || -1);
        console.log("Keyframe buffer check, bufferedNum:", bufferedKfNum, "neededKfNum:", neededKfNum,
            "lastFetchedKeyframe:", this.state.lastFetchedKeyframe, "currKeyframe", this.state.keyframeContext.currKeyframeNum,
            "strict", strict);
        return bufferedKfNum >= neededKfNum;
    }

    stopIntervals() {
        clearInterval(this.dataFetchInterval);
        clearInterval(this.statusFetchInterval);
    }

    mergeStatus() {
        this.setState((prevState) => {
            const newKeyframeContext = {...prevState.keyframeContext};
            newKeyframeContext.status = Object.assign({}, prevState.status);

            //console.log("Merging status prevkfContext:", prevState.keyframeContext, "futurekfContext", newKeyframeContext);
            return { keyframeContext: newKeyframeContext};
        });
    }

    pushStatus(status) {
        console.log("Pushing status:", status);
        this.setState((prevState) => {
            const newKeyframeContext = {...prevState.keyframeContext};
            newKeyframeContext.status = Object.assign({}, prevState.keyframeContext.status, status);
            return { keyframeContext: newKeyframeContext };
        });
    }

    async handleStopAsync() {
        clearInterval(this.dataFetchInterval);
        this.data = [];
        this.mergeStatus();
        await this.fetchData();
        this._shiftKeyframes();
    }

    sabotageDataFetchFunc() {
        this.sabotageDataFetch = true;
    }

    componentDidUpdate(prevProps, prevState) {
        //console.log("Context update");
        if (prevState.status.playStatus != this.state.status.playStatus) {
            console.log("PlayStatus from:", prevState.status.playStatus);
            console.log("PlayStatus to:", this.state.status.playStatus);

            switch(this.state.status.playStatus) {
                case "playing":
                    if (prevState.status.playStatus == "stopped") this.fetchData();
                    this.dataFetchInterval = setInterval(
                        ::this.fetchData,
                        this.state.status.frameRefreshRate * this.state.status.numOfFrames
                    );
                    this.mergeStatus();
                    break;
                case "paused":
                    clearInterval(this.dataFetchInterval);
                    this.mergeStatus();
                    break;
                case "stopped":
                    this.handleStopAsync();
                    break;
                default:
                    break;
            }
        }

        if (this.state.status.playStatus === "playing" &&
            this.state.keyframeContext.status.playStatus === "buffering" &&
            this.enoughKeyframesBuffered(true))
        {
            this.pushStatus({ playStatus: "playing" });
        }
    }

    componentDidMount() {
        this.statusFetchInterval = setInterval(::this.fetchStatus, this.refreshRate);
    }

    componendDidUnmount() {
        this.stopIntervals();
    }

    render() {
        const functions = [];

        functions.push({
            name: "Play",
            call: ::this.play
        });

        functions.push({
            name: "Pause",
            call: ::this.pause
        });

        functions.push({
            name: "Stop",
            call: ::this.stop
        });

        functions.push({
            name: "Stop all fetch",
            call: ::this.stopIntervals
        });

        functions.push({
            name: "Sabotage data fetch",
            call: ::this.sabotageDataFetchFunc
        });

        return (
            <>
                <Debug
                    state={this.state}
                    funcs={functions}
                    data={this.data}
                />

                {/*<AnimationKeyframeContext.Provider value={this.state.keyframeContext} >
                    {this.props.children}
                </AnimationKeyframeContext.Provider>*/}
            </>
        );
    }
}

