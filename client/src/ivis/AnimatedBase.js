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

        this.frameNum = -1;
    }

    interpolate(left, right, f, ratio) {
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

    refresh() {
        console.log("Refreshing, frame:", this.frameNum ,". Time from last frame", (Date.now() - this.lastFrameTS) / 1000);
        this.lastFrameTS = Date.now();
        this.paint();

        if (this.frameNum == this.props.keyframeContext.status.numOfFrames - 1) {
            this.props.keyframeContext.shiftKeyframes();
        }
        else {
            this.frameNum += 1;
        }
    }

    paint() {
        //console.log("Painting frame", this.frameNum);
        const visDataCurr = this.props.keyframeContext.currKeyframeData;
        const visDataNext = this.props.keyframeContext.nextKeyframeData;

        const ratio = this.frameNum / this.props.keyframeContext.status.numOfFrames;
        const visualizationData = this.interpolate(
            visDataCurr,
            visDataNext,
            this.props.interpolationFunc,
            ratio
        );

        this.setState({visualizationData});
    }

    play() {
        this.refresh();
        this.refreshInterval = setInterval(
            ::this.refresh,
            this.props.keyframeContext.status.keyframeRefreshRate / this.props.keyframeContext.status.numOfFrames
        );
    }

    componentDidUpdate(prevProps) {
        if(prevProps.keyframeContext.status?.playStatus != this.props.keyframeContext.status?.playStatus)
        {
            switch (this.props.keyframeContext.status.playStatus) {
                case "playing":
                    this.play();
                    break;
                case "buffering":
                    clearInterval(this.refreshInterval);
                    break;
                case "paused":
                case "stopped":
                    clearInterval(this.refreshInterval);
                    break;
                default:
                    break;
            }
        }

        if (prevProps.keyframeContext.currKeyframeNum != this.props.keyframeContext.currKeyframeNum) {
            this.frameNum = 0;
            console.log("Change of keyframes; before:", prevProps.keyframeContext.currKeyframeNum, "after:", this.props.keyframeContext.currKeyframeNum);
            console.log("Time from last kf change:", (Date.now() - this.lastKeyframeChange) / 1000);
            if (this.props.keyframeContext != "playing") this.paint();

            this.lastKeyframeChange = Date.now();
        }
    }

    render() {
        return (
            <>
                <Debug
                    props={this.props}
                    visData={this.state.visualizationData}
                />
            </>
        );
    }
}

