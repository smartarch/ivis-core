"use strict";

import React, {Component, useState, useEffect, useRef} from "react";
import PropTypes from "prop-types";
import {select, mouse} from "d3-selection";
import {scaleTime, scaleLinear} from "d3-scale";
import {timeFormat} from "d3-time-format";
import {scan} from "d3-array";
import {AnimationStatusContext, AnimationControlContext} from "../ivis/ServerAnimationContext";
import styles from "./media-controls.scss";
import {withComponentMixins, createComponentMixin} from "./decorator-helpers";

const withAnimationControl = createComponentMixin({
    contexts: [
        {context: AnimationStatusContext, propName: 'animStatus'},
        {context: AnimationControlContext, propName: 'animControl'}
    ]
});

class MediaButtonBase extends Component {
    static propTypes = {
        width: PropTypes.number,
        height: PropTypes.number,
        margin: PropTypes.shape({
            top: PropTypes.number,
            bottom: PropTypes.number,
            left: PropTypes.number,
            right: PropTypes.number,
        }),
        padding: PropTypes.shape({
            top: PropTypes.number,
            bottom: PropTypes.number,
            left: PropTypes.number,
            right: PropTypes.number,
        }),

        enabled: PropTypes.bool,
        onClick: PropTypes.func,

        innerRender: PropTypes.func,

        isJoinedRight: PropTypes.bool,
        isJoinedLeft: PropTypes.bool,
    }

    static defaultProps = {
        padding: {
            top: 7,
            bottom: 7,
            left: 7,
            right: 7,
        },
    }

    constructor(props) {
        super(props);

        this.rx = 2;
        this.borderWidth = 2;

        this.state = {
            mouseHover: false,
            mouseDown: false,
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.enabled && !prevProps.enabled) {
            this.attachEvents();
        } else if (!this.props.enabled && prevProps.enabled) {
            this.detachEvents();
        }
    }

    componentDidMount() {
        if (this.props.enabled) this.attachEvents();
    }

    attachEvents() {
        const frameSel = select(this.frameN);

        frameSel
            .attr("cursor", "pointer")
            .on("mouseenter", () => this.setState({mouseHover: true}))
            .on("mouseleave", () => this.setState({mouseHover: false, mouseDown: false}))
            .on("mousedown", () => this.setState({mouseDown: true}))
            .on("mouseup", () => {
                if (this.state.mouseDown) {
                    this.props.onClick();
                    this.setState({mouseDown: false});
                }
            });
    }

    detachEvents() {
        const frameSel = select(this.frameN);

        frameSel
            .attr("cursor", "pointer")
            .on("mouseenter mouseleave mousedown mouseup", null);
    }

    render() {
        const innerWidth = this.props.width - this.props.padding.left - this.props.padding.right;
        const innerHeight = this.props.height - this.props.padding.top - this.props.padding.bottom;

        const innerProps = {
            width: innerWidth,
            height: innerHeight,
            ...this.state
        };

        return (
            <svg xmlns="http://www.w3.org/2000/svg"
                width={this.props.margin.left + this.props.margin.right + this.props.width}
                height={this.props.margin.top + this.props.margin.bottom + this.props.height}
                className={styles.button}>

                <defs>
                    <clipPath id="borderLeftHalf">
                        <rect
                            x="0"
                            y="0"
                            width={this.props.width/2}
                            height={this.props.height}/>
                    </clipPath>
                    <clipPath id="borderRightHalf" >
                        <rect
                            x={this.props.width/2}
                            y="0"
                            width={this.props.width/2}
                            height={this.props.height}/>
                    </clipPath>
                </defs>

                <g ref={node => this.frameN = node}
                    className={styles.buttonFrame + " " +
                        (this.state.mouseHover ? styles.buttonFrameOnMouseHover : "")}
                    pointerEvents="bounding-box"
                    transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}>
                    <rect
                        x={this.props.isJoinedLeft ? 0 : this.borderWidth/2}
                        y={this.borderWidth/2}
                        width={this.props.isJoinedLeft ? this.props.width : this.props.width - this.borderWidth}
                        height={this.props.height - this.borderWidth}
                        clipPath="url(#borderLeftHalf)"
                        rx={this.props.isJoinedLeft ? 0 : this.rx}
                        stroke="currentColor"
                        strokeWidth={this.borderWidth}
                    />

                    <rect
                        x={this.props.isJoinedRight ? 0 : this.borderWidth/2}
                        y={this.borderWidth/2}
                        width={this.props.isJoinedRight ? this.props.width: this.props.width - this.borderWidth}
                        height={this.props.height - this.borderWidth}
                        clipPath="url(#borderRightHalf)"
                        rx={this.props.isJoinedRight ? 0 : this.rx}
                        stroke="currentColor"
                        strokeWidth={this.borderWidth}
                    />

                    <g transform={`translate(${this.props.padding.left}, ${this.props.padding.top})`}>
                        {this.props.innerRender && this.props.innerRender(innerProps)}
                    </g>
                </g>
            </svg>
        );
    }
}

class PlayPauseButton extends Component {
    static propTypes = {
        animStatus: PropTypes.object,
        animControl: PropTypes.object,

        width: PropTypes.number,
        height: PropTypes.number,
        margin: PropTypes.shape({
            top: PropTypes.number,
            bottom: PropTypes.number,
            right: PropTypes.number,
            left: PropTypes.number,
        }),

        isJoinedRight: PropTypes.bool,
        isJoinedLeft: PropTypes.bool,
    }

    constructor(props) {
        super(props);

        this.state = {
            isPlaying: this.props.animStatus.isPlaying,
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.animStatus.isPlaying !== prevProps.animStatus.isPlaying) {
            this.setState({isPlaying: this.props.animStatus.isPlaying});
        }
    }

    handleClick() {
        if (this.state.isPlaying) {
            this.setState({isPlaying: false});
            this.props.animControl.pause();
        } else {
            this.setState({isPlaying: true});
            this.props.animControl.play();
        }
    }


    render() {
        const innerRender = ({width, height, mouseDown, mouseHover}) => {
            return (
                <svg viewBox={mouseHover && !mouseDown ? "4 4 92 92" : "0 0 100 100"}
                    xmlns="http://www.w3.org/2000/svg"
                    height={height} width={width}>

                    {this.state.isPlaying &&
                        <g>
                            <rect width="25" height="76" fill="currentColor" rx="3"
                                x="16" y="12"
                            />

                            <rect width="25" height="76" fill="currentColor" rx="3"
                                x="59" y="12"
                            />
                        </g>
                    ||
                        <polygon points="22,14 84,50 22,86" strokeWidth="6" strokeLinejoin="round"
                            fill="currentColor"
                            stroke="currentColor"
                        />
                    }
                </svg>
            );
        };

        return (
            <MediaButtonBase
                width={this.props.width}
                height={this.props.height}
                margin={this.props.margin}

                isJoinedRight={this.props.isJoinedRight}
                isJoinedLeft={this.props.isJoinedLeft}

                enabled={this.props.animControl.play && this.props.animControl.pause && true || false}
                innerRender={innerRender}
                onClick={::this.handleClick}
            />
        );
    }
}

class StopButton extends Component {
    static propTypes = {
        animStatus: PropTypes.object,
        animControl: PropTypes.object,

        width: PropTypes.number,
        height: PropTypes.number,
        margin: PropTypes.shape({
            top: PropTypes.number,
            bottom: PropTypes.number,
            right: PropTypes.number,
            left: PropTypes.number,
        }),

        isJoinedRight: PropTypes.bool,
        isJoinedLeft: PropTypes.bool,
    }

    render() {
        const innerRender = ({width, height, mouseHover, mouseDown}) => {
            return (
                <svg viewBox={mouseHover && !mouseDown ? "4 4 92 92" : "0 0 100 100"}
                    xmlns="http://www.w3.org/2000/svg"
                    height={height} width={width}>

                    <rect width="70" height="70" x="15" y="15" rx="3" fill="currentColor"/>
                </svg>
            );
        };

        return (
            <MediaButtonBase
                width={this.props.width}
                height={this.props.height}
                margin={this.props.margin}

                isJoinedRight={this.props.isJoinedRight}
                isJoinedLeft={this.props.isJoinedLeft}

                enabled={this.props.animControl.stop && true || false}
                innerRender={innerRender}
                onClick={this.props.animControl.stop}
            />
        );
    }
}

class JumpForwardButton extends Component {
    static propTypes = {
        animStatus: PropTypes.object,
        animControl: PropTypes.object,
        animConfig: PropTypes.object,

        width: PropTypes.number,
        height: PropTypes.number,
        margin: PropTypes.shape({
            top: PropTypes.number,
            bottom: PropTypes.number,
            right: PropTypes.number,
            left: PropTypes.number,
        }),

        isJoinedRight: PropTypes.bool,
        isJoinedLeft: PropTypes.bool,
    }

    render() {
        const innerRender = ({width, height, mouseHover, mouseDown}) => {
            return (
                <svg viewBox={mouseHover && !mouseDown ? "4 4 92 92" : "0 0 100 100"}
                    xmlns="http://www.w3.org/2000/svg"
                    height={height} width={width}>

                    <polygon points="19,13 77,50 19,87" strokeWidth="6" strokeLinejoin="round"
                        fill="currentColor"
                        stroke="currentColor"
                    />
                    <rect width="20" height="80" y="10" x="65" rx="3" fill="currentColor" />
                </svg>
            );
        };

        return (
            <MediaButtonBase
                width={this.props.width}
                height={this.props.height}
                margin={this.props.margin}

                isJoinedRight={this.props.isJoinedRight}
                isJoinedLeft={this.props.isJoinedLeft}

                enabled={this.props.animControl.jumpForward && true || false}
                innerRender={innerRender}
                onClick={this.props.animControl.jumpForward.bind(null, this.props.animConfig.jumpForwardButton.jump)}
            />
        );
    }
}

class JumpBackwardButton extends Component {
    static propTypes = {
        animStatus: PropTypes.object,
        animControl: PropTypes.object,
        animConfig: PropTypes.object,

        width: PropTypes.number,
        height: PropTypes.number,
        margin: PropTypes.shape({
            top: PropTypes.number,
            bottom: PropTypes.number,
            right: PropTypes.number,
            left: PropTypes.number,
        }),

        isJoinedRight: PropTypes.bool,
        isJoinedLeft: PropTypes.bool,
    }

    render() {
        const innerRender = ({width, height, mouseHover, mouseDown}) => {
            return (
                <svg viewBox={mouseHover && !mouseDown ? "4 4 92 92" : "0 0 100 100"}
                    xmlns="http://www.w3.org/2000/svg"
                    height={height} width={width}>

                    <rect width="20" height="80" y="10" x="15" rx="3" fill="currentColor" />
                    <polygon points="81,13 23,50 81,87" strokeWidth="6" strokeLinejoin="round"
                        fill="currentColor"
                        stroke="currentColor"
                    />
                </svg>
            );
        };

        return (
            <MediaButtonBase
                width={this.props.width}
                height={this.props.height}
                margin={this.props.margin}

                isJoinedRight={this.props.isJoinedRight}
                isJoinedLeft={this.props.isJoinedLeft}

                enabled={this.props.animControl.jumpBackward && true || false}
                innerRender={innerRender}
                onClick={this.props.animControl.jumpBackward.bind(null, this.props.animConfig.jumpBackwardButton.jump)}
            />
        );
    }
}


class PlaybackSpeedSlider extends Component {
    static propTypes = {
        animConfig: PropTypes.object,
        animControl: PropTypes.object,
        animStatus: PropTypes.object,

        width: PropTypes.number,
        margin: PropTypes.shape({
            top: PropTypes.number,
            bottom: PropTypes.number,
            left: PropTypes.number,
            right: PropTypes.number,
        }),
    }

    constructor(props) {
        super(props);

        this.adjustMargin = (margin) => {
            let adjustedMargin = margin;
            if (!adjustedMargin) adjustedMargin = {top: 0, bottom: 0, left: 0, right: 0},

            adjustedMargin.top += 40;
            adjustedMargin.bottom += 10;
            adjustedMargin.right += 10;
            adjustedMargin.left += 10;

            return adjustedMargin;
        };

        this.state = {
            margin: this.adjustMargin(this.props.margin),
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.margin !== prevProps.margin) {
            this.setState({margin: this.adjustMargin(this.props.margin)});
        }
    }

    labelFormat(factor) {
        return factor.toFixed(2) + "x";
    }

    snapTo(factor) {
        const step = this.props.animConfig.playbackSpeedSlider.step;

        return Math.floor(factor/step) * step;
    }

    render() {

        return (
            <Slider
                sliderWidth={110}
                sliderHeight={17}
                margin={this.state.margin}

                enabled={this.props.animConfig.playbackSpeedSlider.enabled}
                domain={this.props.animConfig.playbackSpeedSlider.limits}

                value={this.props.animStatus.playbackSpeedFactor}
                setValue={this.props.animControl.changeSpeed}

                labelFormat={::this.labelFormat}
                snapTo={::this.snapTo}
            />
        );
    }
}

class Slider extends Component {
    static propTypes = {
        sliderWidth: PropTypes.number,
        sliderHeight: PropTypes.number,
        margin: PropTypes.shape({
            left: PropTypes.number,
            right: PropTypes.number,
            top: PropTypes.number,
            bottom: PropTypes.number,
        }),

        domain: PropTypes.arrayOf(PropTypes.number),

        snapTo: PropTypes.func,
        value: PropTypes.number,
        setValue: PropTypes.func,

        labelFormat: PropTypes.func,

        enabled: PropTypes.bool,
    }

    constructor(props) {
        super(props);

        this.state = {
            scale: null,
            value: this.props.value,
        };

        this.sliding = false;
    }

    componentDidUpdate(prevProps) {
        if (this.props.enabled && !prevProps.enabled) {
            this.attachEvents();
        } else if (!this.props.enabled && prevProps.enabled) {
            this.detachEvents();
        }

        if (this.props.domain !== prevProps.domain || this.props.sliderWidth !== prevProps.sliderWidth ||
            this.props.sliderHeight !== prevProps.sliderHeight) {
            this.scaleInit();
        }

        if (this.props.value !== prevProps.value && !this.sliding) {
            this.setState({value: this.props.value});
        }
    }

    componentDidMount() {
        this.scaleInit();
        if (this.props.enabled) this.attachEvents();
    }

    attachEvents() {
        const selectorSel = select(this.selectorN);
        const domainSel = select(this.domainN);
        const containerSel = select(this.domainContainerN);

        const getMouseValue = () => {
            const x = mouse(this.domainN)[0];
            const value = this.state.scale.invert(x);
            return this.props.snapTo(value);
        };

        const moveSelector = (val) => {
            selectorSel.attr("transform", `translate(${this.state.scale(val)}, 0)`);
            select(this.labelN).text(this.props.labelFormat(val));
        };

        const endSliding = () => {
            this.sliding = false;
            containerSel.on("mousemove mouseup mouseleave", null);
        };

        const startSliding = () => {
            this.sliding = true;
            containerSel
                .on("mousemove", () => {
                    const val = getMouseValue();
                    moveSelector(val);
                })
                .on("mouseup", () => {
                    endSliding();
                    const val = getMouseValue();
                    this.props.setValue(val);
                    this.setState({
                        value: val
                    });
                })
                .on("mouseleave", () => {
                    endSliding();
                    moveSelector(this.state.value);
                });
        };


        selectorSel
            .on("mousedown", startSliding)
            .attr("cursor", "pointer");

        domainSel
            .on("mousedown", startSliding)
            .attr("cursor", "pointer");
    }

    detachEvents() {
        const selectorSel = select(this.selectorN);
        const domainSel = select(this.domainN);
        const containerSel = select(this.domainContainerN);

        containerSel
            .on("mousedown mouseup mouseleave", null);
        domainSel
            .attr("cursor", "default")
            .on("mousedown", null);
        selectorSel
            .attr("cursor", "default")
            .on("mousedown", null);
    }

    scaleInit() {
        const scale = scaleLinear()
            .domain(this.props.domain)
            .range([0, this.props.sliderWidth - this.props.sliderHeight])
            .clamp(true);

        this.setState({scale});
    }

    render() {
        const adjustedSliderWidth = this.props.sliderWidth - this.props.sliderHeight;
        const adjustedSliderHeight = 0.5 * this.props.sliderHeight;
        const selectorShift = this.state.scale ? this.state.scale(this.state.value) : 0;

        return (
            <svg xmlns="http://www.w3.org/2000/svg"
                width={this.props.sliderWidth + this.props.margin.left + this.props.margin.right}
                height={this.props.sliderHeight + this.props.margin.top + this.props.margin.bottom}
                className={styles.slider}>

                <g transform={`translate(${this.props.margin.left + this.props.sliderHeight/2}, ${this.props.margin.top})`}
                    ref={node => this.domainContainerN = node}>
                    <rect
                        x="0"
                        y="0"
                        pointerEvents="bounding-box"
                        width={adjustedSliderWidth}
                        height={adjustedSliderHeight}
                        rx="2"
                        strokeWidth="2"
                        className={styles.sliderDomain}
                        ref={node => this.domainN = node}/>

                    <text
                        className={styles.label}
                        textAnchor="middle"
                        fill="currentColor"
                        x={adjustedSliderWidth/2}
                        y="0"
                        dy="-0.9em"
                        ref={node => this.labelN = node}>
                        {this.props.labelFormat(this.state.value)}
                    </text>

                    <rect transform={`translate(${selectorShift}, 0)`}
                        x={-this.props.sliderHeight/2}
                        y={adjustedSliderHeight/2 - this.props.sliderHeight/2}
                        width={this.props.sliderHeight}
                        height={this.props.sliderHeight}
                        strokeWidth="2"
                        rx="1"
                        className={styles.sliderSelector}
                        ref={node => this.selectorN = node}/>
                </g>
            </svg>
        );
    }
}


const durationBaseIntervals = {
    millisecond: 1,
    second:      1000,
    minute:      1000*60,
    hour:        1000*60*60,
    day:         1000*60*60*24,
    month:       1000*60*60*24*30,
    year:        1000*60*60*24*30*12,
};

function generateTimeUnitsUsedInLabel(maxTimeDiff, precision, delim) {
    const unitNames = ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'];
    const units = unitNames.map(key => durationBaseIntervals[key]);

    let i = 0;
    while (i < units.length && maxTimeDiff < units[i]) i++;

    let usedUnits = unitNames[i];

    i++;
    while (i < units.length && precision < units[i]) {
        usedUnits += delim + unitNames[i];
        i++;
    }

    if (usedUnits.indexOf(delim) >= 0 && i < units.length) {
        usedUnits += delim + unitNames[i];
    }

    return usedUnits;
}

function generateTimestampLabelFormat(maxTimeDiff, precision) {
    const replace = (match, replacement) => {return (str) => str.replace(match, replacement);};

    const delim = ';';
    const usedUnits = generateTimeUnitsUsedInLabel(maxTimeDiff, precision, delim);

    //Order matters, longest matches at the top
    const grammarRules = [
        replace('hour;minute;second;millisecond', '%H:%M:%S.%L'),
        replace('year;month;day', '%Y/%m/%d/'),
        replace('hour;minute;second', '%H:%M:%S'),
        replace('month;day', '%b %d, '),
        replace('second;millisecond', '%S.%Ls'),
        replace('year', '%Y'),
        replace('month', '%b'),
        replace('day', '%a %d'),
        replace('hour', '%Hh'),
        replace('minute', '%Mm'),
        replace('millisecond', '0.%Ls'),
        replace('second', '%Ss'),
    ];

    const formatStr = grammarRules.reduce((str, func) => func(str), usedUnits).replace(new RegExp(delim, 'g'), '\u00A0');
    return timeFormat(formatStr);
}

function generateDurationLabelFormat(durLenght, precision) {
    const usedUnits = generateTimeUnitsUsedInLabel(durLenght, precision, ',').split(',');

    const suffixes = {
        millisecond: 'ms',
        second: 's',
        minute: 'min',
        hour: 'h',
        day: 'd',
        month: 'mo',
        year: 'y',
    };

    const toDoubleDigits = (count) => count < 10 ? "0" + count : "" + count;

    const formatCount = {
        millisecond: toDoubleDigits,
        second: toDoubleDigits,
        minute: toDoubleDigits,
        hour: toDoubleDigits,
        day: toDoubleDigits,
        month: toDoubleDigits,
        year: (count) => "" + count,
    };

    const format = (ts) => {
        let str = "";
        let leftOverMs = ts;
        for (let i = 0; i < usedUnits.length; i++) {
            const unitName = usedUnits[i];
            const unitDuration = durationBaseIntervals[unitName];

            const count = Math.floor(leftOverMs / unitDuration);
            leftOverMs -= count * unitDuration;

            str += formatCount[unitName](count) + suffixes[unitName] + " ";
        }

        return str.substring(0, str.length - 1);
    };

    return format;
}


const Selector = React.forwardRef(function Selector(props, ref) {
    const [labelRect, setLabelRect] = useState(null);

    const labelRef = useRef(null);
    useEffect(() => {
        if (props.visible && props.label && labelRect === null) setLabelRect(labelRef.current.getBBox());
    }, [props.visible, props.label]);

    let labelShift = 0;
    let labelButtonRect = {width: 0, height: 0};
    const labelBaseline = -16.5;
    if (labelRect) {
        const leftLabelBoundary = props.boundaries[0] + labelRect.width/2;
        const rightLabelBoundary = props.boundaries[1] - labelRect.width/2;

        labelShift = Math.max(0, leftLabelBoundary - props.x) || Math.min(0, rightLabelBoundary - props.x);

        labelButtonRect = {
            width: 1.1*labelRect.width,
            height: 1.3*labelRect.height,
        };
    }

    return (
        <>
            {props.visible &&
                <g className={props.className} transform={`translate(${props.x}, ${props.y})`} ref={ref}
                    opacity={props.visible ? 1 : 0}>
                    <rect
                        transform={`translate(${labelShift}, 0)`}
                        x={-labelButtonRect.width/2}
                        y={labelBaseline - labelButtonRect.height + 5}
                        width={labelButtonRect.width}
                        height={labelButtonRect.height}
                        className={styles.labelButton}
                        fill="currentColor"
                        strokeWidth="2"
                        stroke="currentColor"
                        rx="2"/>

                    <text
                        transform={`translate(${labelShift}, 0)`}
                        ref={labelRef}
                        className={styles.label}
                        textAnchor="middle"
                        y={labelBaseline}
                        opacity={labelRect ? 1 : 0}>
                        {props.label}
                    </text>
                    <polygon className={styles.selector}
                        points="0,-3 -2,-6.464 2,-6.464" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
                </g>
            }
        </>
    );
});
Selector.propTypes = {
    className: PropTypes.string,
    visible: PropTypes.bool,
    x: PropTypes.number,
    y: PropTypes.number,
    label: PropTypes.string,
    boundaries: PropTypes.arrayOf(PropTypes.number),
};

function withHover(Selector) {
    class HoverSelector extends Component {
        static propTypes = {
            getTargetNode: PropTypes.func,
            enabled: PropTypes.bool,
        }

        constructor(props) {
            super(props);

            this.state = {
                visible: false,
                x: 0,
            };
        }

        componentDidUpdate(prevProps, prevState) {
            if (this.props.getTargetNode() !== this.state.targetNode) {
                this.setState({targetNode: this.props.getTargetNode()});
                return;
            }

            if ((this.state.targetNode !== prevState.targetNode || !prevProps.enabled) &&
                this.props.enabled) {
                this.attachHoverEvents();
            }else if (!this.props.enabled && prevProps.enabled) {
                this.detachHoverEvents();
            }
        }

        componentDidMount() {
            const targetNode = this.props.getTargetNode();
            if (this.props.enabled) this.setState({targetNode: targetNode});
        }

        componentWillUnmount() {
            this.detachHoverEvents();
            this.setState({visible: false});
        }

        attachHoverEvents() {
            select(this.state.targetNode)
                .on("mouseenter.selectorHover", () => this.setState({visible: true}))
                .on("mouseleave.selectorHover", () => this.setState({visible: false}))
                .on("mousemove.selectorHover", () =>
                    this.setState({visible: true, x: mouse(this.state.targetNode)[0]})
                );
        }

        detachHoverEvents() {
            this.setState({visible: false});
            select(this.state.targetNode)
                .on("mouseenter.selectorHover", null)
                .on("mouseleave.selectorHover", null)
                .on("mousemove.selectorHover", null);
        }

        render() {
            const {getTargetNode, enabled, ...rest} = this.props;

            return <Selector x={this.state.x} visible={this.state.visible} {...rest} />;
        }
    }

    return HoverSelector;
}

function withDrag(Selector) {
    class DraggableSelector extends Component {
        static propTypes = {
            setGlobal: PropTypes.func,

            onDragStart: PropTypes.func,
            onDragEnd: PropTypes.func,

            enabled: PropTypes.bool,

            parentNode: PropTypes.object,
            parentNodeXShift: PropTypes.number,

            getTargetNode: PropTypes.func,

            x: PropTypes.number,
            boundaries: PropTypes.arrayOf(PropTypes.number),
        }

        constructor(props) {
            super(props);

            this.state = {
                x: this.props.x,
                targetNode: null,
            };

            this.sliding = false;
        }

        componentDidUpdate(prevProps, prevState) {
            if (this.props.getTargetNode && this.props.getTargetNode() !== this.state.targetNode) {
                this.setState({targetNode: this.props.getTargetNode()});
                return;
            }

            if ((this.state.targetNode !== prevState.targetNode ||
                this.props.parentNode !== prevProps.parentNode || !prevProps.enabled) &&
                this.props.enabled) {

                this.attachDragEvents();
            } else if (!this.props.enabled && prevProps.enabled) {
                this.detachDragEvents();
            }

            if (this.props.x !== prevProps.x && !this.sliding) {
                this.setState({x: this.props.x});
            }
        }

        componentDidMount() {
            if (this.props.getTargetNode) this.setState({targetNode: this.props.getTargetNode()});
            else if (this.props.enabled) this.attachDragEvents();
        }

        componentWillUnmount() {
            this.detachDragEvents();
        }

        attachDragEvents() {
            const parentSel = select(this.props.parentNode);
            const selectorSel = select(this.selectorN);

            const endSliding = () => {
                this.sliding = false;
                if (this.props.onDragEnd) this.props.onDragEnd();
                parentSel
                    .on("mousemove.selectorDrag", null)
                    .on("mouseleave.selectorDrag", null)
                    .on("mouseup.selectorDrag", null);
            };

            const getClampedX = () => {
                const x = mouse(this.props.parentNode)[0] - this.props.parentNodeXShift;
                return Math.max(this.props.boundaries[0], Math.min(this.props.boundaries[1], x));
            };

            const startSliding = () => {
                this.sliding = true;
                if (this.props.onDragStart) this.props.onDragStart();
                this.setState({x: getClampedX()});

                parentSel
                    .on("mousemove.selectorDrag", () => {
                        this.setState({x: getClampedX()});
                    })
                    .on("mouseleave.selectorDrag", () => {
                        endSliding();
                        this.setState({x: this.props.x});
                    })
                    .on("mouseup.selectorDrag", () => {
                        endSliding();
                        this.props.setGlobal(getClampedX());
                    });
            };

            selectorSel
                .attr("cursor", "pointer")
                .on("mousedown", startSliding);

            select(this.state.targetNode)
                .attr("cursor", "pointer")
                .on("mousedown", startSliding);
        }

        detachDragEvents() {
            select(this.selectorN)
                .attr("cursor", "default")
                .on("mousedown", null);
            select(this.state.targetNode)
                .attr("cursor", "default")
                .on("mousedown", null);
            this.sliding = false;
        }

        render() {
            const {setGlobal, parentNode, enabled, x, ...rest} = this.props;

            return <Selector  {...rest} x={this.state.x} ref={node => this.selectorN = node}/>;
        }
    }

    return DraggableSelector;
}

function withLabel(Selector) {
    class LabeledSelector extends Component {
        static propTypes = {
            x: PropTypes.number,
            scale: PropTypes.func,

            forwardRef: PropTypes.func,
        }

        constructor(props) {
            super(props);

            this.state = {
                labelFormat: null,
            };

            this.selectorPrecision = 3;
        }

        componentDidUpdate(prevProps) {
            if (this.props.scale !== prevProps.scale) {
                this.getLabelFormat();
            }
        }

        componentDidMount() {
            this.getLabelFormat();
        }

        getLabelFormat() {
            const beginPos = this.props.scale.range()[0];
            const precision = this.props.scale.invert(beginPos + this.selectorPrecision) - this.props.scale.invert(beginPos);

            const labelFormat = this.props.scale.type === "relative" ?
                generateDurationLabelFormat(this.props.scale.domain()[1], precision) :
                generateTimestampLabelFormat(this.props.scale.domain()[1] - this.props.scale.domain()[0], precision);


            this.setState({labelFormat: (px) => labelFormat(this.props.scale.invert(px))});
        }

        render() {
            const {scale, forwardRef, ...rest} = this.props;

            return <Selector {...rest} ref={forwardRef} label={this.state.labelFormat && this.state.labelFormat(this.props.x)}/>;
        }
    }

    return React.forwardRef((props, ref) => {
        return <LabeledSelector {...props} forwardRef={ref} />;
    });
}

function withHighlightControl(Selector) {
    class SelectorAssocWithHighlight extends Component {
        static propTypes = {
            getHighlightNode: PropTypes.func,
            x: PropTypes.number,
            highlightAttr: PropTypes.string,

            forwardRef: PropTypes.func,
        }

        componentDidUpdate(prevProps) {
            if (this.props.x !== prevProps.x) {
                this.moveHighlight();
            }
        }

        componentDidMount() {
            this.moveHighlight();
        }

        moveHighlight() {
            select(this.props.getHighlightNode()).attr(this.props.highlightAttr, this.props.x);
        }

        render() {
            const {getHighlightNode, highlightAttr, forwardRef, ...rest} = this.props;

            return <Selector {...rest} ref={forwardRef} />;
        }
    }

    return React.forwardRef((props, ref) => {
        return <SelectorAssocWithHighlight {...props} forwardRef={ref} />;
    });
}

const PlaybackPositionSelector = withDrag(withHighlightControl(withLabel(Selector)));
const PlaybackHoverSelector = withHover(withLabel(Selector));

class PlaybackTimeline extends Component {
    static propTypes  = {
        relative: PropTypes.bool,
        beginTs: PropTypes.number, //TODO: can be relative and have beginTs?
        endTs: PropTypes.number,

        width: PropTypes.number,
        height: PropTypes.number,
        //TODO: maybe padding too? or consistency with top and bottom
        margin: PropTypes.shape({
            left: PropTypes.number,
            right: PropTypes.number,
            top: PropTypes.number,
            bottom: PropTypes.number,
        }),

        playbackPosition: PropTypes.number,
        playbackLength: PropTypes.number,

        setPlaybackPosition: PropTypes.func,
    };

    constructor(props) {
        super(props);

        this.state = {
            domainN: null,
            hoverSelectorEnabled: true,
            playbackHighlightNode: null,
        };

        this.axisHeight = 37;
        this.selectorBaseline = 0;
        this.axisHighlights = [
            {
                begin: 0,
                end: 0,
                className: styles.playedHighlight + " highlight",
                ref: (node) => this.playedHighlightN = node,
                key: "playedHighlight",
            }
        ];
    }

    componentDidUpdate(prevProps) {
        if (this.props.width !== prevProps.width || this.props.margin !== prevProps.margin ||
            this.props.playbackLength !== prevProps.playbackLength) {
            this.timeScaleInit();
        }
    }

    componentDidMount() {
        this.timeScaleInit();
    }

    relativeScaleInit() {
        const scale = scaleLinear()
            .domain([0, this.props.endTs])
            .range([0, this.props.width])
            .clamp(true);
        scale.type = "relative";

        return scale;
    }

    absoluteScaleInit() {
        const scale = scaleTime()
            .domain([this.props.beginTs, this.props.endTs])
            .range([0, this.props.width])
            .clamp(true);
        scale.type = "absolute";

        return scale;
    }

    timeScaleInit() {
        const timeScale = this.props.relative ? this.relativeScaleInit() : this.absoluteScaleInit();

        const playbackToPx = scaleLinear()
            .domain([0, this.props.playbackLength])
            .range([timeScale.range()[0], timeScale.range()[1]])
            .clamp(true);

        this.setState({timeScale, playbackToPx});
    }

    setPlaybackPosition(px) {

        const playbackPosition = this.state.playbackToPx.invert(px);
        this.props.setPlaybackPosition(playbackPosition);
    }

    render() {
        const axisTop = this.props.height - this.axisHeight;

        return (
            <svg className={styles.timeline} xmlns="http://www.w3.org/2000/svg"
                width={this.props.width + this.props.margin.left + this.props.margin.right}
                height={this.props.height + this.props.margin.bottom + this.props.margin.top}>

                <g ref={node => this.containerN = node}
                    pointerEvents="bounding-box"
                    transform={`translate(0, ${this.props.margin.top})`}>
                    <rect width={this.props.width + this.props.margin.left + this.props.margin.right} height={this.props.height} fill="none" />

                    { this.state.timeScale &&
                        <g transform={`translate(${this.props.margin.left}, ${axisTop})`}>
                            <TimeAxis
                                scale={this.state.timeScale}
                                axisWidth={this.props.width}
                                axisHeight={this.axisHeight}

                                domainRef={node => this.domainN = node}
                                highlights={this.axisHighlights}
                            />

                            <PlaybackPositionSelector
                                setGlobal={::this.setPlaybackPosition}
                                onDragStart={() => this.setState({hoverSelectorEnabled: false})}
                                onDragEnd={() => this.setState({hoverSelectorEnabled: true})}

                                enabled={true}
                                parentNode={this.containerN}
                                parentNodeXShift={this.props.margin.left}

                                getTargetNode={() => this.domainN}

                                x={this.state.playbackToPx(this.props.playbackPosition)}
                                y={this.selectorBaseline}

                                scale={this.state.timeScale}
                                boundaries={this.state.timeScale.range()}
                                visible={true}

                                getHighlightNode={() => this.playedHighlightN}
                                highlightAttr={"width"}

                                className={styles.playbackPositionSelector}
                            />
                            <PlaybackHoverSelector
                                enabled={this.state.hoverSelectorEnabled}

                                getTargetNode={() => this.domainN}

                                y={this.selectorBaseline}

                                scale={this.state.timeScale}
                                boundaries={this.state.timeScale.range()}

                                className={styles.hoverSelector}
                            />
                        </g>
                    }
                </g>
            </svg>
        );
    }
}

class TimeAxis extends Component {
    static propTypes = {
        axisWidth: PropTypes.number,
        axisHeight: PropTypes.number,

        scale: PropTypes.func,
        ticks: PropTypes.arrayOf(PropTypes.shape({
            ts: PropTypes.number,
            label: PropTypes.bool,
        })),

        domainRef: PropTypes.func,
        highlights: PropTypes.arrayOf(PropTypes.shape({
            begin: PropTypes.number,
            end: PropTypes.number,
            className: PropTypes.string,
            ref: PropTypes.func,
            key: PropTypes.string,
        })),
    };

    constructor(props) {
        super(props);

        this.state = {};

        this.defaultTickCount = 50;
        this.durationIntervals = [
            1, 10, 50, 250, 500,

            durationBaseIntervals.second,
            5*durationBaseIntervals.second,
            15*durationBaseIntervals.seconds,
            30*durationBaseIntervals.second,

            durationBaseIntervals.minute,
            5*durationBaseIntervals.minute,
            15*durationBaseIntervals.minute,
            30*durationBaseIntervals.minute,

            durationBaseIntervals.hour,
            3*durationBaseIntervals.hour,
            6*durationBaseIntervals.hour,
            12*durationBaseIntervals.hour,

            durationBaseIntervals.day,
            5*durationBaseIntervals.day,
            15*durationBaseIntervals.day,

            durationBaseIntervals.month,
            3*durationBaseIntervals.month,

            durationBaseIntervals.year,
        ];
    }

    componentDidUpdate(prevProps) {
        if (this.props.axisWidth !== prevProps.axisWidth || this.props.axisHeight !== prevProps.axisHeight ||
            this.props.scale !== prevProps.scale || this.props.ticks !== prevProps.ticks) {
            console.log("update, ticks");
            this.axisInit();
        }
    }

    componentDidMount() {
        if (this.props.scale) this.axisInit();
    }

    getDefaultRelativeTicks() {
        const minTickCount = this.defaultTickCount;
        const duration = this.props.scale.domain()[1];

        let i = this.durationIntervals.length - 1;
        while (i >= 0 && duration / this.durationIntervals[i] < minTickCount) i--;

        const ticks = [];
        const chosenInterval = this.durationIntervals[i];
        let lastTickTs = 0;
        while (lastTickTs <= duration) {
            ticks.push({ts: lastTickTs, label: true});
            lastTickTs += chosenInterval;
        }

        return ticks;
    }

    getRelativeTickFormat() {
        const suffixes = ['ms', 's', 'min', 'h', 'd', 'mo', 'y'];
        const durationBaseIntervalsArr = ['millisecond', 'second', 'minute', 'hour', 'day', 'month', 'year'].map(key => durationBaseIntervals[key]);

        const format = ({ts, label}) => {
            if (!label) return null;
            //TODO: get better formatter
            //probably from moment blug-in https://github.com/jsmreese/moment-duration-format
            let i = durationBaseIntervalsArr.length - 1;

            while (i > 0 && ts < durationBaseIntervalsArr[i]) i--;

            const count = ts / durationBaseIntervalsArr[i];
            const numberOfDecimalDigits = Number.isInteger(count) ? 0 : 2;
            return count.toFixed(numberOfDecimalDigits) + ' ' + suffixes[i];
        };

        return format;
    }

    relativeTicksInit() {
        const ticks = this.props.ticks ? this.props.ticks : this.getDefaultRelativeTicks();

        return {ticks, tickLabelFormat: this.getRelativeTickFormat()};
    }

    absoluteTicksInit() {
        const ticks = this.props.ticks ?
            this.props.ticks.map(({ts, label}) => ({ts: new Date(ts), label})) :
            this.props.scale.ticks(this.defaultTickCount).map(d => ({ts: d, label: true}));

        const defaultFormat = this.props.scale.tickFormat();
        const tickLabelFormat = ({ts, label}) => label ? defaultFormat(ts) : null;

        return {ticks, tickLabelFormat};
    }

    prepareTicks(ticks, tickLabelFormat) {
        const scale = this.props.scale;

        let includesBeginTick = false;
        let includesEndTick = false;
        let tickData = [];

        const createBeginTick = () => ( {
            pos: scale(scale.domain()[0]),
            label: tickLabelFormat({ts: scale.domain()[0], label: true}),
            role: "begin"
        });

        const createEndTick = () => ({
            pos: scale(scale.domain()[1]),
            label: tickLabelFormat({ts: scale.domain()[1], label: true}),
            role: "end"
        });

        for(let tick of ticks) {
            if (tick.ts === scale.domain()[0]) {
                tickData.push(createBeginTick());
                continue;
            }
            if (ticks.ts === scale.domain()[1]) {
                tickData.push(createEndTick());
                continue;
            }

            let role = tick.label ? "big" : "small";
            const pos = scale(tick.ts);
            let label = tickLabelFormat(tick);

            tickData.push({pos, label, role});
        }

        if (!includesBeginTick) tickData.push(createBeginTick());
        if (!includesEndTick) tickData.push(createEndTick());

        return tickData;
    }

    filterTicks(ticksData, maxLabelWidth) {
        const tickConf = {
            begin: {
                priority: 10,
                getBegin: (d) => d.pos,
                getEnd: (d, width) => d.pos + width,
            },
            end: {
                priority: 9,
                getBegin: (d, width) => d.pos - width,
                getEnd: (d) => d.pos,
            },
            big: {
                priority: 2,
                getBegin: (d, width) => d.pos - width/2,
                getEnd: (d, width) => d.pos + width/2,
            },
            small: {
                priority: 1,
            }
        };

        ticksData.sort((t1, t2) => t1.pos - t2.pos);

        let lastBigTick = ticksData[0];
        let lastTick = ticksData[0];
        const minSpace = 10;
        const labelMinSpace = 15;

        for(let i = 1; i < ticksData.length; i++) {
            const currTick = ticksData[i];
            const isSmallTick = currTick.role === "small";

            if (!isSmallTick &&
                tickConf[lastBigTick.role].getEnd(lastBigTick, maxLabelWidth) + labelMinSpace > tickConf[currTick.role].getBegin(currTick, maxLabelWidth)) {

                if (tickConf[currTick.role].priority <= tickConf[lastBigTick.role].priority) {
                    currTick.role = "small";
                } else {
                    lastBigTick.role = "small";
                    lastBigTick = currTick;
                }
            } else if (!isSmallTick) {
                lastBigTick = currTick;
            }

            if (lastTick.pos + minSpace > currTick.pos) {
                if (tickConf[currTick.role].priority <= tickConf[lastTick.role].priority) {
                    currTick.isOmitted = true;
                } else {
                    lastTick.isOmitted = true;
                    lastTick = currTick;
                }
            } else {
                lastTick = currTick;
            }
        }

        return ticksData.filter(d => !d.isOmitted);
    }

    generateTicks(ticksData, domainHeight, labelMarginTop) {
        const createTick = (sel) => {
            return sel.append("g")
                .classed("tick", true)
                .attr("pointer-events", "none")
                .call(sel => sel.append("line").attr("stroke", "currentColor").attr("stroke-width", 1.2))
                .call(sel => sel.append("text")
                    .classed(styles.tickLabel + " " + styles.label, true)
                    .attr("fill", "currentColor")
                    .attr("dy", "1em"));
        };

        const config = {
            begin: {
                updateTickMark: (sel) => sel.attr("y1", 0).attr("y2", 0),
                updateLabel: (sel, d) => sel
                    .attr("y", domainHeight + labelMarginTop)
                    .attr("text-anchor", "start")
                    .text(d.label),
            },
            end: {
                updateTickMark: (sel) => sel.attr("y1", 0).attr("y2", 0),
                updateLabel: (sel, d) => sel
                    .attr("y", domainHeight + labelMarginTop)
                    .attr("text-anchor", "end")
                    .text(d.label),
            },
            big: {
                updateTickMark: (sel) => sel
                    .attr("y1", domainHeight)
                    .attr("y2", domainHeight/2),
                updateLabel: (sel, d) => sel
                    .attr("y", domainHeight + labelMarginTop)
                    .attr("text-anchor", "middle")
                    .text(d.label),
            },
            small: {
                updateTickMark: (sel) => sel
                    .attr("y1", domainHeight)
                    .attr("y2", domainHeight*3/4),
                updateLabel: (sel) => sel.text(null),
            },
        };

        select(this.axisN).selectAll(".tick")
            .data(ticksData)
            .join(createTick)
            .attr("transform", d => `translate(${d.pos}, 0)`)
            .call(sel => sel.select("line")
                .each(function (d) {
                    config[d.role].updateTickMark(select(this));
                }))
            .call(sel => sel.select("text")
                .each(function (d) {
                    config[d.role].updateLabel(select(this), d);
                }));
    }

    getTickLabelRect(label) {
        let labelRect;
        select(this.testLabelN)
            .style("display", "block")
            .classed(styles.tickLabel, true)
            .text(label)
            .call(n => labelRect = n.node().getBBox())
            .style("display", "none")
            .classed(styles.tickLabel, false);

        return labelRect;
    }

    axisInit() {
        const {ticks, tickLabelFormat} = this.props.scale.type === "absolute" ? this.absoluteTicksInit() : this.relativeTicksInit();

        const ticksData = this.prepareTicks(ticks, tickLabelFormat);

        const longestLabelIdx = scan(ticksData, (d1, d2) => - d1.label.length + d2.label.length);
        const labelRect = this.getTickLabelRect(ticksData[longestLabelIdx].label);
        const filteredTicksData = this.filterTicks(ticksData, labelRect.width);

        const labelMarginTop = 3;
        const domainHeight = this.props.axisHeight - labelMarginTop - labelRect.height;
        this.generateTicks(filteredTicksData, domainHeight, labelMarginTop);

        this.setState({
            tickLabelFormat,
            ticks,
            domainHeight,
        });
    }

    render() {
        const highlightComp = (props) => (
            <rect
                x={props.begin}
                width={props.end - props.begin}
                className={props.className}
                ref={props.ref}
                rx="2"
                height={this.state?.domainHeight}
                key={props.key}/>
        );

        return (
            <g ref={node => this.axisN = node}
                pointerEvents="bounding-box">
                <text ref={node => this.testLabelN = node} opacity="0"/>
                {this.props.highlights && this.props.highlights.map(highlightComp)}
                <rect
                    fill="none"
                    rx="2"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    width={this.props.axisWidth}
                    height={this.state.domainHeight}
                    ref={node => {
                        if(this.props.domainRef) this.props.domainRef(node);
                        this.domainN = node;
                    }}
                />
            </g>
        );
    }
}

class AnimationTimeline extends Component {
    static propTypes = {
        animConfig: PropTypes.object,
        animControl: PropTypes.object,
        animStatus: PropTypes.object,

        width: PropTypes.number,
    }

    constructor(props) {
        super(props);

        this.state = {
            margin: {
                left: 20,
                right: 20,
                bottom: 10,
                top: 30,
            },
            playbackPosition: this.props.animStatus.position,
        };
    }


    render() {
        return (
            <>
                <PlaybackTimeline
                    {...this.props.animConfig.timeline}
                    width={this.props.width}
                    height={100}
                    margin={this.state.margin}

                    playbackPosition={this.state.playbackPosition}
                    playbackLength={this.props.animConfig.length}

                    setPlaybackPosition={(pos) => this.setState({playbackPosition: pos})}
                />
            </>
        );
    }
}

export {
    MediaButtonBase,
    PlayPauseButton,
    StopButton,
    JumpForwardButton,
    JumpBackwardButton,

    PlaybackSpeedSlider,

    PlaybackTimeline,
    AnimationTimeline,
};