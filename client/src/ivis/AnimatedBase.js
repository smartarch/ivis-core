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

        this.frameNum = 0;
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
        const visDataCurr = this.props.keyframeContext.currentKeyFrameData;
        const visDataNext = this.props.keyframeContext.nextKeyFrameData;

        const ratio = this.props.keyframeContext.numOfFrames / this.frameNum;
        const visualizationData = this.interpolate(
            visDataCurr,
            visDataNext,
            this.props.interpolationFunc,
            ratio
        );

        this.setState({visualizationData});
        if (this.frameNum == this.props.keyframeContext.status.numOfFrames) {
            this.props.keyframeContext.shiftKeyframes();
            this.frameNum = 0;
        }
        else {
            this.frameNum += 1;
        }
    }

    onPlayStatusChange(playStatus) {

        switch (playStatus) {
            case "playing":
                this.refreshInterval = setInterval(
                    ::this.refresh,
                    this.props.keyframeContext.status.keyframeRefreshRate / this.props.keyframeContext.status.numOfFrames
                );
                break;
            case "paused":
            case "stoped":
                clearInterval(this.refreshInterval);
                break;
            default:
                break;
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.keyframeContext.shiftKeyframes != this.props.keyframeContext.shiftKeyframes) {
            this.props.keyframeContext.shiftKeyframes();
        }

        if(prevProps.keyframeContext.status?.playStatus != this.props.keyframeContext.status?.playStatus)
        {
            console.log("PlayStatus changed to:", this.props.keyframeContext.status.playStatus);
            console.log("PlayStatus changed from:", prevProps.keyframeContext.status?.playStatus);
            this.onPlayStatusChange(this.props.keyframeContext.status.playStatus);
        }


        console.log("PrevProps:", prevProps);
        console.log("currentProps", this.props);
    }

    componentDidMount() {
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

