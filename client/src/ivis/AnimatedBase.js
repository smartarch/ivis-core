import React, {Component} from "react";
import {Debug} from "./Debug";
import PropTypes from "prop-types";

export class AnimatedBase extends Component {
    static propTypes = {
        interpolationFunc: PropTypes.func,
        keyframeContext: PropTypes.object
    };

    constructor(props) {
        super(props);

        this.state = {
        };
    }

    interpolate(left, right, f, ratio) {
        if (typeof left === "undefined" || typeof right === "undefined") {
            return 0;
        }
        else if (typeof left === "object" && typeof right === "object") {
            const ret = Object.assign({}, left, right);

            for(let key in ret) {
                ret[key] = this.interpolate(left[key], right[key], f, ratio);
            }
        }

        return f(left, right, ratio);
    }

    refresh() {
        const visDataCurr = this.context.currentKeyFrame.visualizationData;
        const visDataNext = this.context.nextKeyFrame.visualizationData;

        const ratio = this.context.numberOfFramesPerKeyframe / this.frameNum;
        const visualizationData = this.interpolate(
            visDataCurr,
            visDataNext,
            this.props.interpolationFunc,
            ratio
        );

        this.setState({visualizationData});
        this.frameNum += 1;
    }

    componentDidUpdate(prevProps) {
        if (prevProps.keyframeContext.shiftKeyframes != this.props.keyframeContext.shiftKeyframes) {
            this.props.keyframeContext.shiftKeyframes();
        }


        console.log("PrevProps:", prevProps);
        console.log("currentProps", this.props);
    }

    componentDidMount() {
    }

    render() {
        return (
            <>
                <Debug props={this.props} />
            </>
        );
    }
}

