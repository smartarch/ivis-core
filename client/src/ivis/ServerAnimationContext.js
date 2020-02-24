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

        this.position = null;
        this.seeking = false;

        // status refresh rate - later from props/server..
        this.refreshRate = 500;
        this.minBufferLength = 1;
        this.safeBufferLength = 2;

        // For debug purposes
        this.sabotageDataFetch = false;
    }

    componentDidUpdate(prevProps, prevState) {
        const nextStatusOverride = {};
        if (prevState.status.ver === -1 && this.state.status.ver >= 0) {
            //Initial assigning of immutable values
            nextStatusOverride.numOfFrames = this.state.status.numOfFrames;
            nextStatusOverride.numOfKeyframes = this.state.status.numOfKeyframes;
        }

        if (prevState.status.isPlaying != this.state.status.isPlaying) {
            console.log("PlayStatus from:", prevState.status.isPlaying);
            console.log("PlayStatus to:", this.state.status.isPlaying);

            if (this.state.status.isPlaying) {
                if (this.data.length >= this.safeBufferLength) {
                    nextStatusOverride.isPlaying = true;
                } else {
                    nextStatusOverride.isPlaying = false;
                    nextStatusOverride.isBuffering = true;
                    this.buffering = true;
                }

                this.refreshInterval = setInterval(::this.refresh, this.state.status.refreshRate);
                this.fetchDataLoop();
            } else {
                nextStatusOverride.isPlaying = false;
                nextStatusOverride.isBuffering = false;
                clearInterval(this.refreshInterval);
                clearTimeout(this.dataFetchTimeout);
            }
        }

        if (this.position === null ||
           (prevState.status.ver != this.state.status.ver && this.state.status.ver === this.state.status.didSeekOn)) {
            //On seek or initial fetch...
            console.log("Seek to", this.state.status.position);
            this.position = this.state.status.position;
            nextStatusOverride.position = this.state.status.position;
            this.dataRefetch();
        }

        if (Object.keys(nextStatusOverride).length > 0) {
            nextStatusOverride.ver = this.state.status.ver;
            this.pushStatus(nextStatusOverride);
        }
    }

    componentDidMount() {
        this.statusFetchInterval = setInterval(::this.fetchStatus, this.refreshRate);
    }

    componendDidUnmount() {
        this.stopIntervals();
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
        const data = res.data.data;

        console.log("Data fetch:", data, "last data fetch before:", (Date.now() - this.lastDataFetchTS) / 1000);
        this.lastDataFetchTS = Date.now();

        this.data.push(data);
        this.setState({lastFetchedKeyframe: data.currKeyframeNum});
    }

    async fetchDataLoop() {
        if (this.sabotageDataFetch) return;

        const res = await axios.get(getUrl("rest/animation/server/data"));
        const data = res.data.data;
        const timeoutDelay = res.data.newDataIn;

        console.log("Data fetch:", data, "last data fetch before:", (Date.now() - this.lastDataFetchTS) / 1000);
        this.lastDataFetchTS = Date.now();

        if (data.currKeyframeNum !== this.state.lastFetchedKeyframe) {
            this.data.push(data);
            this.setState({lastFetchedKeyframe: data.currKeyframeNum});
        }

        if (timeoutDelay > 0 && this.state.status.isPlaying) {
            console.log("New data in:", timeoutDelay);
            this.dataFetchTimeout = setTimeout(::this.fetchDataLoop, timeoutDelay);
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

    async jumpForward() {
        if (this.seeking) {
            console.log("attempted double seek");
            return;
        }

        await axios.post(getUrl("rest/animation/server/seek"), { to: this.position + this.state.status.numOfFrames });
    }

    async jumpBackward() {
        if (this.seeking) {
            console.log("attempted double seek");
            return;
        }

        await axios.post(getUrl("rest/animation/server/seek"), { to: this.position - this.state.status.numOfFrames });
    }

    async dataRefetch() {
        this.seeking = true;
        this.pushStatus({isPlaying: false, isBuffering: true});
        const wasPlaying = this.state.keyframeContext.status.isPlaying;
        if (wasPlaying) {
            clearInterval(this.refreshInterval);
            clearTimeout(this.dataFetchTimeout);
        }

        this.data = [];
        await this.fetchData();
        this.shiftKeyframes();

        if (wasPlaying) {
            this.refreshInterval = setInterval(::this.refresh, this.state.status.refreshRate);
            this.fetchDataLoop();
        }

        this.pushStatus({isPlaying: wasPlaying, isBuffering: false});
        this.seeking = false;
    }

    shiftKeyframes() {
        console.log("Keyframes shift", {currKeyframe: this.data[0]});
        this.setState((prevState) => {
            const newKeyframeContext = Object.assign({}, prevState.keyframeContext, this.data.shift());
            return { keyframeContext: newKeyframeContext };
        });
    }

    stopIntervals() {
        clearInterval(this.refreshInterval);
        clearInterval(this.statusFetchInterval);
        clearTimeout(this.dataFetchTimeout);
    }

    pushStatus(status) {
        this.setState((prevState) => {
            const newKeyframeContext = {...prevState.keyframeContext};
            newKeyframeContext.status = Object.assign({}, prevState.keyframeContext.status, status);
            return { keyframeContext: newKeyframeContext };
        });
    }

    sabotageDataFetchFunc() {
        this.sabotageDataFetch = true;
    }

    refresh() {
        if (this.buffering && this.data.length >= this.safeBufferLength) {
            this.buffering = false;
            this.pushStatus({isPlaying: true, isBuffering: false});
        }

        if (!this.buffering && this.data.length < this.minBufferLength) {
            this.pushStatus({isPlaying: false, isBuffering: true});
            this.buffering = true;
        } else if (!this.buffering && this.data.length >= this.minBufferLength) {
            this.position += 1;
            this.pushStatus({ position: this.position });

            if (this.position % this.state.status.numOfFrames === this.state.status.numOfFrames - 1) {
                this.shiftKeyframes();
            }
        }
    }

    render() {
        const functions = [];

        functions.push({
            name: "Jump Backward",
            call: ::this.jumpBackward
        });

        functions.push({
            name: "Play",
            call: ::this.play
        });

        functions.push({
            name: "Pause",
            call: ::this.pause
        });

        functions.push({
            name: "Jump Forward",
            call: ::this.jumpForward
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
                <AnimationKeyframeContext.Provider value={this.state.keyframeContext} >
                    {this.props.children}
                </AnimationKeyframeContext.Provider>

                <Debug
                    state={this.state}
                    funcs={functions}
                    data={this.data}
                />
            </>
        );
    }
}

