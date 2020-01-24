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
        this.displayedKeyframe = -1;
        this.state = {
            status: {
                ver: -1,
            },
            keyframeContext: {}
        };


        // status refresh rate - later from props/server..
        this.refreshRate = 500;
    }

    async fetchStatus() {
        const res = await axios.get(getUrl("rest/animation/server/status"));
        this.setState({status: res.data});
    }

    async fetchData() {
        const res = await axios.get(getUrl("rest/animation/server/data"));
        if (this.data.length == 0) {
            this.data[res.data.currKeyframeNum] = (res.data.currKeyframeData);
        }
        this.data[res.data.currKeyframeNum + 1] = (res.data.nextKeyframeData);

        if (this.displayedKeyframe == -1) {
            this.setState((prevState) => {
                const newKeyframeContext = Object.assign(
                    {},
                    prevState.keyframeContext,
                    {shiftKeyframes: ::this.shiftKeyframes}
                );

                return Object.assign(
                    {},
                    prevState,
                    {keyframeContext: newKeyframeContext}
                );
            });
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
        this.displayedKeyframe += 1;
        this.setState((prevState) => {
            const newKeyframeContext = Object.assign(
                {},
                prevState.keyframeContext,
                {
                    currKeyframeNum: this.displayedKeyframe,
                    currKeyframeData: this.data[this.displayedKeyframe],
                    nextKeyframeData: this.data[this.displayedKeyframe + 1]
                }
            );

            return Object.assign({}, prevState, {keyframeContext: newKeyframeContext});
        });
    }

    stopIntervals() {
        clearInterval(this.dataFetchInterval);
        clearInterval(this.statusFetchInterval);
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.status?.ver != this.state.status?.ver)
        {
            this.setState((prevState) => {
                const newkeyframeContext = Object.assign({}, prevState.keyframeContext, {status: prevState.status});
                return Object.assign({}, prevState, { keyframeContext: newkeyframeContext});
            });

//          For changing speed later
//          if (prevState.status.keyframeRefreshRate != this.state.status.keyframeRefreshRate)
//          {
//              if (this.dataFetchInterval) clearInterval(this.dataFetchInterval);
//              this.dataFetchInterval = setInterval(::this.fetchData, this.state.status.keyframeRefreshRate);
//          }


        }
    }

    componentDidMount() {
        this.statusFetchInterval = setInterval(::this.fetchStatus, this.refreshRate);
        this.fetchData();
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
                <AnimationKeyframeContext.Provider value={this.state.keyframeContext} >
                    <Debug
                        state={this.state}
                        funcs={functions}
                    />

                    {this.props.children}
                </AnimationKeyframeContext.Provider>
            </>
        );
    }
}

