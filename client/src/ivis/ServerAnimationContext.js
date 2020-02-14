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

        // status refresh rate - later from props/server..
        this.refreshRate = 500;
        this.minBufferLength = 3;
        this.safeBufferLength = 5;

        // For debug purposes
        this.sabotageDataFetch = false;
    }

    componentDidUpdate(prevProps, prevState) {
        //console.log("Context update");
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
                    console.log("Not enough keyframes loaded[safe], waiting", this.data.length);
                    nextStatusOverride.isPlaying = false;
                    nextStatusOverride.isBuffering = true;
                    this.buffering = true;
                }

                this.refreshInterval = setInterval(::this.refresh, this.state.status.refreshRate);
            } else {
                clearInterval(this.refreshInterval);
                nextStatusOverride.isPlaying = false;
                nextStatusOverride.isBuffering = false;
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

        console.log("Data fetch:", res.data, "last data fetch before:", (Date.now() - this.lastDataFetchTS) / 1000);
        this.lastDataFetchTS = Date.now();

        this.data.push(res.data);
        this.setState({lastFetchedKeyframe: res.data.currKeyframeNum});
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
        await axios.post(getUrl("rest/animation/server/seek"), { to: this.position + 20 });
    }

    async jumpBackward() {
        await axios.post(getUrl("rest/animation/server/seek"), { to: this.position - 20 });
    }

    async dataRefetch() {
        const wasPlaying = this.state.keyframeContext.status.isPlaying;
        if (wasPlaying) clearInterval(this.refreshInterval);

        this.data = [];
        await this.fetchData();
        this._shiftKeyframes();

        if (wasPlaying) this.refreshInterval = setInterval(::this.refresh, this.state.status.refreshRate);
    }

    shiftKeyframes() {
        this._shiftKeyframes();
    }

    _shiftKeyframes() {
        console.log("Keyframes shift", {currKeyframe: this.data[0]});
        this.setState((prevState) => {
            const newKeyframeContext = Object.assign({}, prevState.keyframeContext, this.data.shift());
            return { keyframeContext: newKeyframeContext };
        });
    }

    stopIntervals() {
        clearInterval(this.refreshInterval);
        clearInterval(this.statusFetchInterval);
    }

    mergeStatus() {
        this.setState((state) => {
            const newKeyframeContext = {...state.keyframeContext};
            newKeyframeContext.status = {
                ver: state.status.ver,
                isPlaying: state.status.isPlaying,
                numOfFrames: state.status.numOfFrames,
                numOfKeyframes: state.status.numOfKeyframes,
                refreshRate: state.status.refreshRate,

                position: this.position,
            };
            //console.log("Merging status prevkfContext:", state.keyframeContext, "futurekfContext", newKeyframeContext);
            return {keyframeContext: newKeyframeContext};
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

    sabotageDataFetchFunc() {
        this.sabotageDataFetch = true;
    }

    refresh() {
        if (this.buffering && this.data.length >= this.safeBufferLength) {
            console.log("Enough keyframes loaded[safe], started playing", this.data.length);
            this.buffering = false;
            this.pushStatus({isPlaying: true, isBuffering: false});
        }

        if (!this.buffering && this.data.length < this.minBufferLength) {
            console.log("Not enough keyframes loaded[min], waiting", this.data.length);
            this.pushStatus({isPlaying: false, isBuffering: true});
            this.buffering = true;
        } else if (!this.buffering && this.data.length >= this.minBufferLength) {
            console.log("Enough keyframes loaded[min], playing", this.data.length);

            this.position += 1;
            this.pushStatus({ position: this.position });

            if (this.position % this.state.status.numOfFrames === this.state.status.numOfFrames - 1) {
                this.shiftKeyframes();
            }
        }

        if (this.state.status.position % this.state.status.numOfFrames === 0) {
            this.fetchData();
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
                <Debug
                    state={this.state}
                    funcs={functions}
                    data={this.data}
                />

                <AnimationKeyframeContext.Provider value={this.state.keyframeContext} >
                    {this.props.children}
                </AnimationKeyframeContext.Provider>
            </>
        );
    }
}

