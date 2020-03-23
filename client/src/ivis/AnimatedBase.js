import React, {Component} from "react";
import {Debug} from "./Debug";
import PropTypes from "prop-types";

const AnimationDataContext = React.createContext(null);

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

        for (let mutableId of Object.keys(left.mutables)) {
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

        const ratio = 1 - ((this.props.status.position - kfCurr.ts) / (kfNext.ts - kfCurr.ts));
        console.log("Refreshing", {ratio});

        const newData = this.interpolate(
            kfCurr.data,
            kfNext.data,
            this.props.interpolFunc,
            ratio
        );

        this.setState({animData: newData});
    }

    componentDidUpdate(prevProps) {
        if (prevProps.status.position != this.props.status.position) {
            if (this.props.status.isPlaying)
                this.refresh();
            else
                this.setState({animData: this.props.keyframes.curr.data.mutables});
        }
    }

    render() {
        return (
            <>
                <AnimationDataContext.Provider value={this.state.animData}>
                    {this.props.children}
                </AnimationDataContext.Provider>

                <Debug
                    status={this.props.status}
                    keyframes={this.props.keyframes}
                    animationData={this.state.animData}
                />
            </>
        );
    }
}

export {AnimationDataContext, AnimatedBase};
