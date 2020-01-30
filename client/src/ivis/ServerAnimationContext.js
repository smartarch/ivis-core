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
        this.waitingForKeyframes = false;
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
        this.keyframeBufferLength = 5;
    }

    async fetchStatus() {
        const res = await axios.get(getUrl("rest/animation/server/status"));
        this.setState({status: res.data});
    }

    async fetchData() {
        const res = await axios.get(getUrl("rest/animation/server/data"));
        console.log("Data fetch:", res.data);
        if (Array.isArray(res.data)) {
            this.data.push(...res.data);
            this.setState({lastFetchedKeyframe: res.data[res.data.length - 1].currKeyframeNum});
        } else {
            this.data.push(res.data);
            this.setState({lastFetchedKeyframe: res.data.currKeyframeNum});
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
        console.log("Keyframes shift", {currKeyframe: this.data[0]});
        this.setState((prevState) => {
            const newKeyframeContext = Object.assign({}, prevState.keyframeContext, this.data.shift());
            if (prevState.keyframeContext.shiftKeyframes === undefined) newKeyframeContext.shiftKeyframes = ::this.shiftKeyframes;

            return { keyframeContext: newKeyframeContext };
        });
    }

    stopIntervals() {
        clearInterval(this.dataFetchInterval);
        clearInterval(this.statusFetchInterval);
    }

    mergeStatus(statusOverride) {
        console.log("Merging status");
        this.setState((prevState) => {
            const newKeyframeContext = {...prevState.keyframeContext};
            newKeyframeContext.status = Object.assign({}, prevState.status, statusOverride);

            return { keyframeContext: newKeyframeContext};
        });
    }

    async handleStop() {
        clearInterval(this.dataFetchInterval);
        this.data = [];
        await this.fetchData();
        this.mergeStatus();
        this.shiftKeyframes();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.waitingForKeyframes && this.state.lastFetchedKeyframe >= 1 + this.keyframeBufferLength + (this.state.keyframeContext.currKeyframe || -1)) {
            this.waitingForKeyframes = false;
            this.mergeStatus();
        }

        if (prevState.status.playStatus != this.state.status.playStatus) {
            console.log("PlayStatus from:", prevState.status.playStatus);
            console.log("PlayStatus to:", this.state.status.playStatus);

            switch(this.state.status.playStatus) {
                case "playing":
                    this.fetchData();
                    this.dataFetchInterval = setInterval(::this.fetchData, this.state.status.keyframeRefreshRate);
                    this.waitingForKeyframes = true;
                    this.mergeStatus({playStatus: "buffering"});
                    break;
                case "paused":
                    clearInterval(this.dataFetchInterval);
                    this.mergeStatus();
                    break;
                case "stoped":
                    this.handleStop();
                    break;
                default:
                    break;
            }
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

        return (
            <>
                <Debug
                    state={this.state}
                    funcs={functions}
                    misc={{
                        waitingForKeyframes: this.waitingForKeyframes
                    }}
                    data={this.data}
                />

                <AnimationKeyframeContext.Provider value={this.state.keyframeContext} >
                    {this.props.children}
                </AnimationKeyframeContext.Provider>
            </>
        );
    }
}

