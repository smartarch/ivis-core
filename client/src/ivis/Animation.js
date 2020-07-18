import React, {Component} from "react";
import PropTypes from "prop-types";

import {withComponentMixins} from "../lib/decorator-helpers";
import {intervalAccessMixin, TimeContext} from "./TimeContext";
import {AnimationDataContext, withAnimationData, withAnimationStatus} from "../lib/animation-helpers";
import styles from "./Animation.scss";
import moment from "moment";
import {IntervalSpec} from "./TimeInterval";
import {linearInterpolation} from "../lib/animation-interpolations";
import _ from "lodash";

const defaultRefreshRate = 45;

@withComponentMixins([intervalAccessMixin()])
class Animation extends Component {
    //TODO: lodash shield where needed...
    static propTypes = {
        animationIntervalConfigPath: PropTypes.array,
        animationIntervalSpec: PropTypes.object,

        withIndependentTimeContext: PropTypes.bool,

        refreshRate: PropTypes.number,
        initialStatus: PropTypes.object,

        interpolations: PropTypes.object,

        animationControlComponent: PropTypes.elementType.isRequired,
        animationControlComponentProps: PropTypes.object,

        children: PropTypes.node,
    }

    static defaultProps = {
        refreshRate: defaultRefreshRate,
        animationIntervalConfigPath: ['animationTimeContext'],
        interpolations: {
            _default: linearInterpolation,
        },
    }

    constructor(props) {
        super(props);

        this.state = {
            initialStatus: this.ensureCompleteInitialStatus(),
            globalIntervalAbsolute: this.getIntervalAbsolute(),
            keyframeCount: this.getKeyframeCount(),
            withIntervalRefreshing: this.getIntervalSpec().refreshInterval !== null,
        };

        const from = this.props.animationIntervalSpec?.from || this.getIntervalSpec()?.from || 'now';
        const to = this.props.animationIntervalSpec?.to || this.getIntervalSpec()?.to || 'now';
        this.initialIntervalSpec = (new IntervalSpec(from, to, null, null)).freeze();
    }

    componentDidUpdate(prevProps) {
        const updateGlobalInterval = () => {
            this.setState({
                globalIntervalAbsolute: this.getIntervalAbsolute(),
                withIntervalRefreshing: this.getIntervalSpec().refreshInterval !== null
            });
        };

        const prevIntervalAbsolute = this.getIntervalAbsolute(prevProps);
        if (!this.props.withIndependentTimeContext && this.getIntervalAbsolute() !== prevIntervalAbsolute) {
            updateGlobalInterval();
        }

        if (!this.props.withIndependentTimeContext && prevProps.withIndependentTimeContext && this.state.globalIntervalAbsolute !== this.getIntervalAbsolute()) {
            updateGlobalInterval();
        }

        if (this.props.initialStatus !== prevProps.initialStatus) {
            this.setState({initialStatus: this.ensureCompleteInitialStatus()});
        }

        if (this.props.interpolations !== prevProps.interpolations && !_.isEqual(this.props.interpolations, prevProps.interpolations)) {
            this.setState({keyframeCount: this.getKeyframeCount()});
        }
    }

    ensureCompleteInitialStatus() {
        const is = this.props.initialStatus;
        const pos = moment(is.position);

        return {
            isPlaying: is.isPlaying || false,
            position: pos.isValid() ? pos.valueOf() : null,
            playbackSpeedFactor: Number.isInteger(is.playbackSpeedFactor) ? is.playbackSpeedFactor : 1,
            isLive: is.isLive || false,
        };
    }
    getKeyframeCount() {
        const keyframeCount = {};
        const intp = this.props.interpolations;
        //TODO: for in only in own properties
        for (const sigSetCid of Object.keys(intp)) {
            keyframeCount[sigSetCid] = intp[sigSetCid].arity;
        }

        return keyframeCount;
    }

    render() {
        const AnimationComp = this.props.animationControlComponent;
        const childrenRender = ({status, keyframes}) => {
            return (
                <AnimationKeyframeInterpolator
                    status={status}
                    keyframes={keyframes}
                    interpolations={this.props.interpolations}>

                    {this.props.children}
                </AnimationKeyframeInterpolator>
            );
        };

        return (
            <TimeContext
                initialIntervalSpec={this.initialIntervalSpec}
                configPath={this.props.animationIntervalConfigPath}>

                <AnimationComp
                    {...this.props.animationControlComponentProps}

                    globalIntervalAbsolute={this.state.globalIntervalAbsolute}
                    initialStatus={this.state.initialStatus}
                    refreshRate={this.props.refreshRate}
                    keyframeCount={this.state.keyframeCount}
                    withIntervalRefreshing={this.state.withIntervalRefreshing}

                    render={childrenRender}
                />
            </TimeContext>
        );
    }
}

//TODO: consistency of animationData
function animated(VisualizationComp) {
    @withComponentMixins([withAnimationData, withAnimationStatus])
    class AnimatedContent extends Component {
        static propTypes = {
            animationStatus: PropTypes.object.isRequired,
            animationData: PropTypes.object.isRequired,

            forwardRef: PropTypes.func,
            height: PropTypes.number,
            animationDataFormatter: PropTypes.func,
        }

        constructor(props) {
            super(props);

            this.lastValidData = null;
            this.visWidth = null;
            this.visHeight = props.height ? props.height : null;
        }

        componentDidUpdate() {
            this.updateContainerRect();
        }

        componentDidMount() {
            this.updateContainerRect();
        }

        updateContainerRect() {
            if (!this.lastValidData || this.props.animationStatus.isBuffering || this.props.animationStatus.error) return;

            const visRect = this.containerNode.getClientRects()[0];
            this.visWidth = visRect.width;
            this.visHeight = visRect.height;
        }

        render() {
            let message = null;
            let withSpinner = false;
            let data = this.props.animationData;
            if (this.props.animationStatus.error) {
                data = this.lastValidData;

                message = new String(this.props.animationStatus.error);
            } else if (this.props.animationStatus.isBuffering) {
                data = this.lastValidData;

                withSpinner = true;
                message =  "Loading...";
            } else if (data !== null) {
                data = this.props.animationDataFormatter ? this.props.animationDataFormatter(data) : data;
                this.lastValidData = data;
            }

            let width = this.visWidth + "px" || "100%";
            let height = this.visHeight + "px" || "100%";
            const overlayStyles = {
                width: width,
                height: height,
            };

            const msgContainerStyles = {
                paddingTop: this.visHeight/2 + "px" || "0px",
            };

            const {forwardRef, animationDataFormatter, ...visualizationProps} = this.props;

            return (
                <div ref={node => this.containerNode = node}>
                    {message &&
                        <div className={styles.loadingOverlay} style={overlayStyles}>
                            <div className={styles.loadingMsgContainer} style={msgContainerStyles}>
                                {withSpinner &&
                                    <div className={styles.loadingSpinner + " spinner-border"} role={"status"}>
                                        <span className={"sr-only"}>Loading</span>
                                    </div>
                                }
                                <span className={styles.loadingMsg}>{message}</span>
                            </div>
                        </div>
                    }
                    {data && <VisualizationComp {...visualizationProps} data={data} ref={this.props.forwardRef} />}
                </div>
            );
        }
    }

    return React.forwardRef(function AnimatedVisualization(props, ref) {
        return <AnimatedContent {...props} forwardRef={ref} />;
    });
}

class AnimationKeyframeInterpolator extends Component {
    static propTypes = {
        interpolations: PropTypes.object.isRequired,
        status: PropTypes.object.isRequired,
        keyframes: PropTypes.object.isRequired,

        children: PropTypes.node,
    };

    constructor(props) {
        super(props);
        this.state = {
            animationData: null,
        };

        this.prepareInterpolations();
    }

    componentDidUpdate(prevProps) {
        if (this.props.interpolations !== prevProps.interpolations || this.props.keyframes !== prevProps.keyframes) {
            this.prepareInterpolations();
        }

        if (!this.props.status.isBuffering &&
            (prevProps.status.position !== this.props.status.position || prevProps.status.isBuffering)) {

            this.refreshAll();
            // console.log("AnimatedBase: position refresh", this.props.keyframes);
        }
    }

    componentDidMount() {
        if (!this.props.status.isBuffering) this.refreshAll();
    }

    prepareInterpolations() {
        // console.log("preparing interpolations");

        const kfs = this.props.keyframes;
        const args = {};
        const intps = {};
        for (const sigSetCid of Object.keys(kfs)) {
            if (!kfs[sigSetCid]) continue;

            intps[sigSetCid] = this.props.interpolations[sigSetCid] || this.props.interpolations._default;

            const sigSetArgs = {};
            sigSetArgs.ts = kfs[sigSetCid].map(kf => kf.ts);
            sigSetArgs.data = {};
            for (const sigCid of Object.keys(kfs[sigSetCid][0].data)) {
                sigSetArgs.data[sigCid] = kfs[sigSetCid].map(kf => kf.data[sigCid]);
            }

            args[sigSetCid] = sigSetArgs;
        }

        this.intpArgs = args;
        this.intps = intps;
    }

    refreshAll() {
        // console.log("refreshing");

        const animationData = {};
        for (const sigSetCid of Object.keys(this.props.keyframes)) {
            animationData[sigSetCid] = this.refreshSigSet(sigSetCid);
        }

        this.setState({animationData});
    }

    refreshSigSet(sigSetCid) {
        // if (lastKf == undefined) {
        //     return firstKf.ts === position && !this.props.status.isPlaying ? firstKf.data : null;

        if (!this.props.keyframes[sigSetCid]) return null;

        const intp = this.intps[sigSetCid];
        const position = this.props.status.position;

        const firstKf = this.props.keyframes[sigSetCid][0];
        const lastKf = this.props.keyframes[sigSetCid][intp.arity - 1];

        if (position < firstKf.ts || position > lastKf.ts) return null;


        const interpolated = {};
        const xs = this.intpArgs[sigSetCid].ts;

        for (const signalCid of Object.keys(firstKf.data)) {
            const ys = this.intpArgs[sigSetCid].data[signalCid];
            interpolated[signalCid] = intp.func(xs, ys, position);
        }

        return interpolated;
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
export * from "../lib/animation-interpolations";
export {
    Animation,
    animated,
};
