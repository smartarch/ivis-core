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
        console.log("Interpoalte with args:", left, right, f, ratio);
        if (left === undefined || right === undefined) {
            return 0;
        }

        if (typeof left === "object" && typeof right === "object") {
            const ret = Object.assign({}, left, right);

            for(let key in ret) {
                ret[key] = this.interpolate(left[key], right[key], f, ratio);
            }

            return ret;
        }

        return f(left, right, ratio);
    }

    paint() {
        console.log("Painting frame", this.props.keyframeContext.status.position);
        const visDataCurr = this.props.keyframeContext.currKeyframeData;
        const visDataNext = this.props.keyframeContext.nextKeyframeData;

        const ratio = (this.props.keyframeContext.status.position % this.props.keyframeContext.status.numOfFrames) / this.props.keyframeContext.status.numOfFrames;

        const visualizationData = this.interpolate(
            visDataCurr,
            visDataNext,
            this.props.interpolationFunc,
            ratio
        );

        this.lastVisualizationData = this.state.visualizationData;
        this.setState({visualizationData});
    }

    componentDidUpdate(prevProps) {
        const c = this.props.keyframeContext;
        const prevC = prevProps.keyframeContext;
        if (c.status.position != prevC.status.position) {
            this.repaintNeeded = true;
            console.log("Repaint needed");
        }

        if (this.repaintNeeded && c.currKeyframeNum !== undefined
            && Math.floor(c.status.position / c.status.numOfFrames) === c.currKeyframeNum) {
            this.repaintNeeded = false;
            this.paint();
        }
    }

    render() {
        return (
            <>
                <Debug
                    context={this.props.keyframeContext}
                    visData={this.state.visualizationData}
                    lastVisData={this.lastVisualizationData}
                />
            </>
        );
    }
}

