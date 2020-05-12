import React, {Component} from "react";
import {Debug} from "./Debug";
import PropTypes from "prop-types";
import {AnimationDataContext} from "../lib/animation-helpers";

class AnimatedBase extends Component {
    static propTypes = {
        interpolFunc: PropTypes.func,
        status: PropTypes.object,
        keyframes: PropTypes.object,
        children: PropTypes.node,
    };

    constructor(props) {
        super(props);
        this.state = {
            animData: {},
        };
    }
    interpolate(left, right, f, ratio) {
        const currValues = {};

        for (let mutableId in left.mutables) {
            const leftValue = left.mutables[mutableId];
            const rightValue = right.mutables[mutableId];

            if (rightValue === undefined ||
                typeof leftValue !== "number" || typeof rightValue !== "number") {
                currValues[mutableId] = leftValue;
            } else {
                currValues[mutableId] = f(leftValue, rightValue, ratio);
            }
        }

        return currValues;
    }

    refresh() {
        const kfCurr = this.props.keyframes.curr;
        const kfNext = this.props.keyframes.next;

        if (kfNext === undefined) {
            this.setState({animData: kfCurr.data});
            return;
        }

        const ratio = (this.props.status.position - kfCurr.ts) / (kfNext.ts - kfCurr.ts);
        // console.log("Refreshing", {ratio, current: kfCurr.ts, next: kfNext.ts, position: this.props.status.position});

        const mutables = this.interpolate(
            kfCurr.data,
            kfNext.data,
            this.props.interpolFunc,
            ratio
        );

        this.setState({animData: {base: kfCurr.data.base, mutables}});
    }

    componentDidUpdate(prevProps) {
        if (!this.props.status.isBuffering &&
            (prevProps.status.position !== this.props.status.position || prevProps.status.isBuffering)) {

            this.refresh();
            // console.log("AnimatedBase: position refresh", this.props.keyframes);
        }
    }

    componentDidMount() {
        if (!this.props.status.isBuffering) this.refresh();
    }

    render() {
        return (
            <>
                <AnimationDataContext.Provider value={this.state.animData}>
                    {this.props.children}
                </AnimationDataContext.Provider>

                <Debug
                    name={"Animated Base"}
                    status={this.props.status}
                    keyframes={this.props.keyframes}
                    animationData={this.state.animData}
                />
            </>
        );
    }
}

export {AnimatedBase};
