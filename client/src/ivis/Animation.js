import React, {Component} from "react";
import PropTypes from "prop-types";

import {withComponentMixins} from "../lib/decorator-helpers";
import {AnimationDataContext, withAnimationData, withAnimationStatus} from "../lib/animation-helpers";
import {interpolFuncs} from "../lib/animation-interpolations";
import {RecordedAnimation} from "./RecordedAnimation";
import {LiveAnimation} from "./LiveAnimation";
import styles from "./Animation.scss";
import {Debug} from "./Debug";

const defaultRefreshRate = 45;

class Animation extends Component {
    static propTypes = {
        timeDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
        refreshRate: PropTypes.number,
        initialStatus: PropTypes.object,

        interpolationFuncId: PropTypes.string.isRequired,

        live: PropTypes.bool.isRequired,

        children: PropTypes.node,
    }

    static defaultProps = {
        refreshRate: defaultRefreshRate,
    }

    constructor(props) {
        super(props);

        this.state = {
            initialStatus: this.ensureCompleteInitialStatus(),
            timeDomain: this.ensureCorrectTimeDomain(),
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.timeDomain !== prevProps.timeDomain) {
            this.setState({timeDomain: this.ensureCorrectTimeDomain()});
        }

        if (this.props.initialStatus !== prevProps.initialStatus) {
            this.setState({initialStatus: this.ensureCompleteInitialStatus()});
        }
    }

    ensureCompleteInitialStatus() {
        const is = this.props.initialStatus;

        return {
            isPlaying: is.isPlaying || false,
            position: Number.isInteger(is.position)  ? is.position : this.props.timeDomain[0],
            playbackSpeedFactor: is.position || 1,
        };
    }

    ensureCorrectTimeDomain() {
        //TODO: throw more detailed, concrete error
        if (this.props.timeDomain.length < 2) throw new TypeError("Animation: Time domain in incorrect format");

        return [Math.min(...this.props.timeDomain), Math.max(...this.props.timeDomain)];
    }

    render() {
        const {children, live, timeDomain, initialStatus, ...props} = this.props;
        const AnimationComp = this.props.live ? LiveAnimation : RecordedAnimation;
        const interpolationFunc = interpolFuncs[this.props.interpolationFuncId];

        const childrenRender = ({status, keyframes}) => {
            return (
                <AnimationKeyframeInterpolator
                    status={status}
                    keyframes={keyframes}
                    interpolFunc={interpolationFunc}>

                    {children}
                </AnimationKeyframeInterpolator>
            );
        };

        return (
            <AnimationComp {...props} timeDomain={this.state.timeDomain} initialStatus={this.state.initialStatus} render={childrenRender} />
        );
    }
}

//TODO: style this
@withComponentMixins([withAnimationData, withAnimationStatus])
class AnimatedContent extends Component {
    static propTypes = {
        animationStatus: PropTypes.object,
        animationData: PropTypes.object,
        className: PropTypes.string,
        messageClassName: PropTypes.string,

        children: PropTypes.node,
    }

    constructor(props) {
        super(props);

        this.loadingMsg = "Loading...";
    }

    render() {
        const isLoading = this.props.animationData === null;
        const message = this.props.animationStatus.error ? String(this.props.animationStatus.error) : this.loadingMsg;

        const content = isLoading ?
            <div className={styles.loadingOverlay + " " + (this.props.className || "")}>
                <div className={styles.loadingMsgContainer}>
                    <div className={"spinner-border"} role={"status"}>
                        <span className={"sr-only"}>Loading</span>
                    </div>
                    <span className={styles.loadingMsg + " " + (this.props.messageClassName || "")}>{message}</span>
                </div>
            </div>
            :
            this.props.children
        ;


        return (
            <div className={this.props.className}>
                {content}
            </div>
        );
    }
}

function animated(VisualizationComp) {
    return React.forwardRef(function AnimatedVisualization(props, ref) {
        return (
            <AnimationDataContext.Consumer>
                {
                    value => <VisualizationComp {...props} data={value} ref={ref} />
                }
            </AnimationDataContext.Consumer>
        );
    });
}

class AnimationKeyframeInterpolator extends Component {
    static propTypes = {
        interpolFunc: PropTypes.func.isRequired,
        status: PropTypes.object.isRequired,
        keyframes: PropTypes.object.isRequired,

        children: PropTypes.node,
    };

    constructor(props) {
        super(props);
        this.state = {
            animationData: null,
        };
    }

    interpolate(left, right, f, ratio) {
        const interpolated = {};

        for (let key in left) {
            const shouldInterpolate = right[key] != undefined && typeof right[key] === "number" && typeof left[key] === "number";

            interpolated[key] = shouldInterpolate ? f(left[key], right[key], ratio) : left[key];
        }

        return interpolated;
    }

    refreshSigSet(sigSetCid) {
        const kfCurr = this.props.keyframes[sigSetCid][0];
        const kfNext = this.props.keyframes[sigSetCid][1];

        if (kfNext === undefined) {
            return kfCurr.data;
        }

        const ratio = (this.props.status.position - kfCurr.ts) / (kfNext.ts - kfCurr.ts);
        // console.log("Refreshing", {ratio, current: kfCurr.ts, next: kfNext.ts, position: this.props.status.position});

        return this.interpolate(
            kfCurr.data,
            kfNext.data,
            this.props.interpolFunc,
            ratio
        );
    }

    refreshAll() {
        const animationData = {};
        for (let sigSetCid in this.props.keyframes) {
            animationData[sigSetCid] = this.refreshSigSet(sigSetCid);
        }

        this.setState({animationData});
    }

    componentDidUpdate(prevProps) {
        if (!this.props.status.isBuffering &&
            (prevProps.status.position !== this.props.status.position || prevProps.status.isBuffering)) {

            this.refreshAll();
            // console.log("AnimatedBase: position refresh", this.props.keyframes);
        }

        if (this.props.status.isBuffering && !prevProps.status.isBuffering) {
            this.setState({animationData : null});
        }
    }

    componentDidMount() {
        if (!this.props.status.isBuffering) this.refreshAll();
    }

    render() {
        return (
            <>
                <AnimationDataContext.Provider value={this.state.animationData}>
                    {this.props.children}
                </AnimationDataContext.Provider>

                {/* <Debug */}
                {/*     name={"Animated Base"} */}
                {/*     status={this.props.status} */}
                {/*     keyframes={this.props.keyframes} */}
                {/*     animationData={this.state.animationData} */}
                {/* /> */}
            </>
        );
    }
}

export * from "../lib/media-controls";
export {
    Animation,
    AnimatedContent,
    animated
};
