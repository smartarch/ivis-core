import React, {Component} from "react";
import {Debug} from "./Debug";
import axios from "../lib/axios";
import {getUrl} from "../lib/urls";

export class ServerAnimationContext extends Component {
    constructor(props) {
        super(props);

        this.state = {
            settings: null,
            status: null
        };
    }

    static propTypes = {

    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.settings &&
           (!prevState.settings || prevState.settings.msBetweenFrames != this.state.settings.msBetweenFrames)) {

            if (this.fetchInterval) clearInterval(this.fetchInterval);
            this.fetchInterval = setInterval(
                                    ::this.fetchStatus,
                                    this.state.settings.msBetweenFrames);
        }
    }

    componentDidMount() {
        this.fetchSettings();
    }

    async fetchSettings() {
        const settings = await axios.get(getUrl("rest/animation/server/init"));
        this.setState({settings: settings.data});
    }

    async fetchStatus() {
        const status = await axios.get(getUrl("rest/animation/server/status"));
        this.setState({status: status.data});
    }

    async play() {
        try {
            await axios.post(getUrl("rest/animation/server/play"));
        }
        catch(err) {
            console.log(err);
        }
    }

    async pause() {
        await axios.post(getUrl("rest/animation/server/pause"));
    }

    async stop() {
        await axios.post(getUrl("rest/animation/server/reset"));
    }


    stopInterval() {
        clearInterval(this.fetchInterval);
    }

    componendDidUnmount() {
        this.stopInterval();
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
            name: "Stop fetch",
            call: ::this.stopInterval
        });


        return (
            <>
                <Debug
                    state={this.state}
                    animation_context={this.props}
                    funcs={functions}
                />
            </>
        );
    }
}

