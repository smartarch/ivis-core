"use strict";

import React, {Component} from "react";
import PropTypes from "prop-types";
import {SVG} from "../ivis/SVG";
import {select, mouse} from "d3-selection";
import {scaleTime, scaleLinear} from "d3-scale";
import {utcMillisecond, utcSecond, utcMinute, utcHour, utcDay, utcWeek, utcMonth, utcYear} from "d3-time";
import {timeFormat} from "d3-time-format";
import {AnimationStatusContext, AnimationControlContext} from "../ivis/ServerAnimationContext";
import moment from "moment";
import {withTranslation} from "./i18n";
import styles from "./media-controls.scss";
import {withComponentMixins, createComponentMixin} from "./decorator-helpers";

const withAnimationControl = createComponentMixin({
    contexts: [
        {context: AnimationStatusContext, propName: 'animStatus'},
        {context: AnimationControlContext, propName: 'animControl'}
    ]
});

//Should not be a problem that rerender of MediaButton will force update
//underlying SVG. In case of needed performence boost use React.memo
function MediaButton(props) {
    //TODO: There is need to touch the div in SVG cuz of styling... Or just give
    //the div "media-button-wrapper" class and thats it...
    const isDisabled = !props.onClick;
    const color = isDisabled ? "grey" : "black";
    const accColor = '#20a8d8';

    const baseButton = `<svg class="${styles["media-button"]}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <clipPath id="border-left-half">
                    <rect
                        x="0"
                        y="0"
                        width="50"
                        height="100" />
                </clipPath>
                <clipPath id="border-right-half">
                    <rect
                        x="50"
                        y="0"
                        width="50"
                        height="100"/>
                </clipPath>
            </defs>

            <g id="border" style="cursor: ${isDisabled ? 'not-allowed' : 'pointer'}"; color="white">
                <rect
                    ${props.isJoinedLeft ? 'x="0" width="100"' : 'x="2" rx="10" width="96"'}
                    y="2"
                    height="96"
                    fill="currentColor"
                    stroke-width="4"
                    stroke=${color}
                    clip-path="url(#border-left-half)" />

                <rect
                    ${props.isJoinedRight ? 'x="0" width="100"' : 'x="2" rx="10" width="96"'}
                    y="2"
                    height="96"
                    fill="currentColor"
                    stroke=${color}
                    stroke-width="4"
                    clip-path="url(#border-right-half)" />
            </g>
            ${props.innerSvg}
        </svg>`;

    return (
        <SVG
            width={props.width}
            height={props.height}
            source={baseButton}
            init={node => {
                const innerSVG = select(node).select("#innerSvg");
                const border = select(node).select("#border");

                select(node.parentNode).
                    classed("media-button-wrapper", true);

                innerSVG.
                    attr('width', 70).
                    attr('height', 70).
                    attr('x', 15).
                    attr('y', 15).
                    attr('color', color).
                    attr('pointer-events', 'none');

                if (!isDisabled) {
                    border.
                        on('click', () => props.onClick(node)).
                        on('mouseenter', () => border.attr('color', accColor)).
                        on('mouseleave', () => border.attr('color', 'white'));
                }
            }}
        />
    );
}
MediaButton.propTypes = {
    height: PropTypes.string,
    width: PropTypes.string,
    isJoinedLeft: PropTypes.bool,
    isJoinedRight: PropTypes.bool,
    innerSvg: PropTypes.string,
    onClick: PropTypes.func,
};

@withComponentMixins([
    withAnimationControl
])
class PlayPauseButton extends Component {
    static propTypes = {
        height: PropTypes.string,
        width: PropTypes.string,
        isJoinedLeft: PropTypes.bool,
        isJoinedRight: PropTypes.bool,
        animStatus: PropTypes.object,
        animControl: PropTypes.object,
    }
    constructor(props) {
        super(props);

        this.playButt = `<svg
                id="innerSvg"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg">

                <polygon points="26,18 80,50 26,82" stroke-width="10" stroke-linejoin="round"
                    fill="currentColor"
                    stroke="currentColor"
                />
            </svg>`;
        this.pauseButt = `<svg
                id="innerSvg"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg">

                <g>
                    <rect width="30" height="76" fill="currentColor" rx="10"
                        x="15" y="12"
                    />

                    <rect width="30" height="76" fill="currentColor" rx="10"
                        x="55" y="12"
                    />
                </g>
            </svg>`;
    }

    onPress() {
        if (this.props.animStatus.isPlaying || this.props.animStatus.isBuffering)
            this.props.animControl.pause();
        else
            this.props.animControl.play();
    }

    render() {
        const innerSvg = this.props.animStatus.isPlaying || this.props.animStatus.isBuffering ? this.pauseButt : this.playButt;

        return (
            <MediaButton
                height={this.props.height}
                width={this.props.width}
                isJoinedLeft={this.props.isJoinedLeft}
                isJoinedRight={this.props.isJoinedRight}
                innerSvg={innerSvg}
                onClick={this.props.animControl.play && this.props.animControl.pause && ::this.onPress}
            />
        );
    }
}

@withComponentMixins([
    withAnimationControl
])
class StopButton extends Component {
    static propTypes = {
        height: PropTypes.string,
        width: PropTypes.string,
        isJoinedLeft: PropTypes.bool,
        isJoinedRight: PropTypes.bool,
        animStatus: PropTypes.object,
        animControl: PropTypes.object,
    }

    constructor(props) {
        super(props);
        this.button = `<svg
                id="innerSvg"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg">

            <rect width="70" height="70" x="15" y="15" rx="10" fill="currentColor"/>
        </svg>`;
    }

    render() {
        return (
            <MediaButton
                height={this.props.height}
                width={this.props.width}
                isJoinedLeft={this.props.isJoinedLeft}
                isJoinedRight={this.props.isJoinedRight}
                innerSvg={this.button}
                onClick={this.props.animControl.stop}/>
        );
    }
}

@withComponentMixins([
    withAnimationControl
])
class JumpForwardButton extends Component {
    static propTypes = {
        height: PropTypes.string,
        width: PropTypes.string,
        isJoinedLeft: PropTypes.bool,
        isJoinedRight: PropTypes.bool,
        animStatus: PropTypes.object,
        animControl: PropTypes.object,
        jump: PropTypes.number,
    }

    constructor(props) {
        super(props);
        this.button = `<svg
                id="innerSvg"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg">

            <polygon points="26,20 70,50 26,80" stroke-width="20" stroke-linejoin="round"
                fill="currentColor"
                stroke="currentColor"
            />
            <rect width="20" height="80" y="10" x="65" rx="10" fill="currentColor" />
        </svg>`;
    }

    render() {
        return (
            <MediaButton
                height={this.props.height}
                width={this.props.width}
                isJoinedLeft={this.props.isJoinedLeft}
                isJoinedRight={this.props.isJoinedRight}
                innerSvg={this.button}
                onClick={() => this.props.animControl.jumpForward(this.props.jump)}/>
        );
    }
}

@withComponentMixins([
    withAnimationControl
])
class JumpBackwardButton extends Component {
    static propTypes = {
        height: PropTypes.string,
        width: PropTypes.string,
        isJoinedLeft: PropTypes.bool,
        isJoinedRight: PropTypes.bool,
        animStatus: PropTypes.object,
        animControl: PropTypes.object,
        jump: PropTypes.number,
    }

    constructor(props) {
        super(props);
        this.button = `<svg
                id="innerSvg"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg">

            <rect width="20" height="80" y="10" x="15" rx="10" fill="currentColor" />
            <polygon points="74,20 30,50 74,80" stroke-width="20" stroke-linejoin="round"
                fill="currentColor"
                stroke="currentColor"
            />
        </svg>`;
    }

    render() {
        return (
            <MediaButton
                height={this.props.height}
                width={this.props.width}
                isJoinedLeft={this.props.isJoinedLeft}
                isJoinedRight={this.props.isJoinedRight}
                innerSvg={this.button}
                onClick={() => this.props.animControl.jumpBackward(this.props.jump)}/>
        );
    }
}

@withComponentMixins([
    withAnimationControl
])
class PlaybackSpeedSlider extends Component {
    static propTypes = {
        maxFactor: PropTypes.number,
        minFactor: PropTypes.number,
        animControl: PropTypes.object,
        animStatus: PropTypes.object,
    }

    constructor(props) {
        super(props);

        this.state = {
            nodes: {},
            enabled: false,
        };

        this.minPos = 10;
        this.maxPos = 115;
    }

    componentDidUpdate(prevProps) {
        if (prevProps.minFactor !== this.props.minFactor || prevProps.maxFactor !== this.props.maxFactor) {
            this.setState({scale: this.generateScale()});
        }

        if (prevProps.animControl.changeSpeed !== this.props.animControl.changeSpeed) {
            this.setState({enabled: !!this.props.animControl.changeSpeed});
        }
    }

    componentDidMount() {
        this.init();
    }

    init() {
        // TODO: extra enable and extra disable props on SliderBase
        // const pointerSel = select(this.pointerN);
        // pointerSel
        //     .on("mouseenter", () => pointerSel.attr("fill", "yellow"))
        //     .on("mouseleave", () => pointerSel.attr("fill", "white"));

        this.setState({
            nodes: {
                slider: select(this.sliderN),
                scale: select(this.scaleN),
                pointer: select(this.pointerN),
                label: select(this.labelN)
            },
            enabled: !!this.props.animControl.changeSpeed,
            scale: this.generateScale(),
        });
    }

    generateScale() {
        return scaleLinear()
            .domain([this.props.minFactor, this.props.maxFactor])
            .range([this.minPos, this.maxPos])
            .clamp(true);
    }

    render() {
        return (
            <SliderBase
                nodes={this.state.nodes}

                enabled={this.state.enabled}

                valueToPos={this.state.scale}
                posToValue={this.state.scale && this.state.scale.invert}

                value={this.props.animStatus.speedFactor && this.props.animStatus.speedFactor}
                setValue={value => this.props.animControl.changeSpeed(value)}
                printValue={value => value.toFixed(2) + "x"}
                snapToValue={value => Math.round(value/0.25) * 0.25}>

                <svg viewBox="0 0 125 50" xmlns="http://www.w3.org/2000/svg" color="grey" ref={node => this.sliderN = node}>
                    <defs>
                        <circle id="circle"
                            cy="40" r="6" cx="0" stroke="currentColor" strokeWidth="2"/>
                    </defs>
                    <line id="scale"
                        x1="10" y1="40" x2="115" y2="40"
                        stroke="currentColor" strokeWidth="5" strokeLinecap="round"
                        ref={node => this.scaleN = node}/>
                    <text id="label"
                        textAnchor="middle" fill="currentColor"
                        x="50%" y="20" ref={node => this.labelN = node}/>
                    <use id="pointer" x={this.minPos} href="#circle" fill="white" ref={(node) => this.pointerN = node}/>
                </svg>

            </SliderBase>
        );
    }
}

class TimelineD3 extends Component {
    static propTypes = {
        relative: PropTypes.bool,
        beginTs: PropTypes.number,
        endTs: PropTypes.number,
        length: PropTypes.number,
        position: PropTypes.number,
        axis: PropTypes.func,
    }

    static defaultProps = {
        beginTs: 0,
    }

    constructor(props) {
        super(props);

        this.state = {
            enabled: false,
            labelFormat: null,
        };

        this.viewBox = {width: 800, height: 70};
        this.refreshRate = 500;
    }

    componentDidUpdate(prevProps) {
        if (this.props.relative != prevProps.relative || this.props.beginTs != prevProps.beginTs ||
            this.props.length != prevProps.length) {
            this.axisInit();
        }
    }

    componentDidMount() {
        this.axisInit();
        window.addEventListener("resize", ::this.axisInit);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", ::this.axisInit);
    }


    axisInit() {
        const beginDate = new Date(this.props.beginTs);
        const endDate = new Date(this.props.endTs);
        const valueToRealtime = scaleTime()
            .domain([beginDate, endDate])
            .range([0, this.props.length])
            .clamp(true);

        const minTimeStep = (this.refreshRate / this.props.length) * (this.props.endTs - this.props.beginTs);

        const labelFormat = generateTimestampLabelFormat(this.props.endTs - this.props.beginTs, minTimeStep);
        // this.setState({labelFormat: generateTimestampLabelFormat(this.props.length, minNoticableDiff)});
        select(this.labelN).text(labelFormat(valueToRealtime.invert(this.props.position)));

        const labelRect = this.labelN.getBBox();
        const axisMargins = {left: labelRect.width + labelRect.x + 20, top: 40, bottom: 10, right: 20};


        const scale = scaleTime()
            .domain([beginDate, endDate])
            .range([0, this.viewBox.width - axisMargins.left - axisMargins.right])
            .clamp(true);

        const defaultTicks = scale.ticks();
        const defaultFormat = scale.tickFormat();

        select(this.pointerN)
            .attr("transform", `translate(${axisMargins.left}, ${axisMargins.top})`);

        select(this.hoverPointerN)
            .attr("transform", `translate(${axisMargins.left}, ${axisMargins.top})`)
            .style("display", "none");

        select(this.timelineN)
            .attr("transform", `translate(${axisMargins.left}, ${axisMargins.top})`)
            .call(this.props.axis(scale).tickValues(defaultTicks).tickFormat(defaultFormat))
            .call(g => g
                .attr("font-size", null)
                .attr("font-family", null)
                .attr("pointer-events", "bounding-box")
                .classed("timeline-axis", true)
            );


        this.setState({
            nodes: {
                slider: select(this.svgN),
                scale: select(this.timelineN),
                label: select(this.labelN),
                pointer: select(this.pointerN),
                hoverPointer: select(this.hoverPointerN),
                hoverLabel: select(this.hoverLabelN),
            },
            enabled: true,
            valueToPos: scale,
            posToValue: scale.invert,
            labelFormat,
            valueToRealtime,
        });
    }

    render() {

        return (
            <SliderBase
                nodes={this.state.nodes}
                enabled={this.state.enabled}
                withHover={true}

                posToValue={this.state.posToValue}
                valueToPos={this.state.valueToPos}

                value={this.state.valueToRealtime && this.state.valueToRealtime.invert(this.props.position)}
                setValue={() => true}
                printValue={this.state.labelFormat}
            >

                <svg viewBox={`0 0 ${this.viewBox.width} ${this.viewBox.height}`} xmlns="http://www.w3.org/2000/svg"
                    ref={node => this.svgN = node}>
                    <defs>
                        {/* <filter x="-0.10" y="-0.08" width="1.20" height="1.16" id="solid"> */}
                        {/*     <feFlood floodColor="white"></feFlood> */}
                        {/*     <feComposite in="SourceGraphic" operator="over"></feComposite> */}
                        {/* </filter> */}
                        {/* <filter x="0" y="-0.18" width="1" height="1.36" id="solid-outer"> */}
                        {/*     <feFlood floodColor="black"></feFlood> */}
                        {/*     <feComposite in="SourceGraphic" operator="over"></feComposite> */}
                        {/* </filter> */}
                        <g id="pointerDef">
                            {/* <line y2="-6" stroke="currentColor"/> */}
                            <polygon className="triangle" points={`0,-3 -2,${-3-Math.sqrt(3)*2} 2,${-3-Math.sqrt(3)*2}`} fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
                        </g>
                        <g id="hoverPointerDef">
                            <text id="hoverLabel" className="label" textAnchor="middle" y="-13.5" fill="currentColor" ref={node => this.hoverLabelN = node}>Label</text>

                            <polygon className="triangle"
                                points={`0,-3 -2,${-3-Math.sqrt(3)*2} 2,${-3-Math.sqrt(3)*2}`} fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
                        </g>

                    </defs>

                    <text id="label" className="label" y="40" x="5" dominantBaseline="hanging" fill="currentColor" ref={node => this.labelN = node}>Label</text>
                    <g ref={node => this.timelineN = node}/>
                    <use href="#pointerDef" color="black" ref={node => this.pointerN = node}/>
                    <use href="#hoverPointerDef" color="#808080" ref={node => this.hoverPointerN = node} />
                </svg>

            </SliderBase>
        );
    }
}

const timeIntervals = {
    year: moment.duration(1, 'years').asMilliseconds(),
    month: moment.duration(1, 'months').asMilliseconds(),
    day: moment.duration(1, 'days').asMilliseconds(),
    hour: moment.duration(1, 'hours').asMilliseconds(),
    minute: moment.duration(1, 'minutes').asMilliseconds(),
    second: moment.duration(1, 'seconds').asMilliseconds(),
    millisecond: 1,
};

function generateTimeUnitsUsedInLabel(maxTimeDiff, minTimeDiff, delim) {
    const units = Object.keys(timeIntervals).map(key => timeIntervals[key]);
    const unitNames = ['_year', '_month', '_day', '_hour', '_minute', '_second', '_millisecond'];

    let i = 0;
    while (i < units.length && maxTimeDiff < units[i]) i++;

    let usedUnits = unitNames[i];

    i++;
    while (i < units.length && minTimeDiff < units[i]) {
        usedUnits += delim + unitNames[i];
        i++;
    }

    if (usedUnits.indexOf(delim) >= 0 && i < units.length) {
        usedUnits += delim + unitNames[i];
    }

    return usedUnits;
}

function generateTimestampLabelFormat(maxTimeDiff, minTimeDiff) {
    const replace = (match, replacement) => {return (str) => str.replace(match, replacement);};

    const delim = ';';
    const usedUnits = generateTimeUnitsUsedInLabel(maxTimeDiff, minTimeDiff, delim);

    //Order matters, longest matches at the top
    const grammarRules = [
        replace('_hour;_minute;_second;_millisecond', '%H:%M:%S.%L'),
        replace('_year;_month;_day', '%Y/%m/%d/'),
        replace('_hour;_minute;_second', '%H:%M:%S'),
        replace('_month;_day', '%b %d, '),
        replace('_second;_millisecond', '%S.%Ls'),
        replace('_year', '%Y'),
        replace('_month', '%b'),
        replace('_day', '%a %d'),
        replace('_hour', '%Hh'),
        replace('_minute', '%Mm'),
        replace('_second', '%Ss'),
        replace('_millisecond', '0.%Ls'),
    ];

    const formatStr = grammarRules.reduce((str, func) => func(str), usedUnits).replace(new RegExp(delim, 'g'), '\u00A0');
    //DO not know if sccepts timestamps
    return timeFormat(formatStr);
}



// function generateDurationLabelFormat(durLenght, minTimeDiff) {
//     const replace = (match, replacement) => {return (str) => str.replace(match, replacement);};

//     const usedUnits = generateTimeUnitsUsedInLabel(durLenght, minTimeDiff, ',');

//     const getValues = {};
//     for(let intervalKey of Object.keys(timeIntervals)) {
//         getValues[intervalKey] = (ts) => Math.floor();
//     }

//     function decompose(ts) {
//         const d = moment.duration(ts);
//         const addLeadingZero = (n) => n < 10 ? "0" + n : "" + n;

//         return {
//             hoursMinutesSeconds: d.hours() + ":" + addLeadingZero(d.minutes()) + ":" + addLeadingZero(d.seconds()),
//             secondsMilliseconds: d.seconds() + "." + d.milliseconds().toFixed(3) + "s",
//             milliseconds: "0." + d.milliseconds().toFixed(3) + "s",
//             seconds: d.seconds() + "s",
//             minutes: d.minutes() + "min",
//             hours:   d.hours() + "h",
//             days:   d.days() + "d",
//             months: d.months() + "mo",
//             years:  d.years() + "y",
//         };

//     }

//     function format(ts) {
//         const d = decompose(ts);

//         const grammarRules = [
//             replace('hour,minute,second', d.hoursMinutesSeconds),
//             replace('second,millisecond', d.secondsMilliseconds),
//             replace('year', d.years),
//             replace('month', d.months),
//             replace('day', d.days),
//             replace('hour', d.hours),
//             replace('minute', d.minutes),
//             replace('second', d.seconds),
//             replace('millisecond', d.milliseconds)
//         ];

//         return grammarRules.reduce((acc, func) => func(acc), usedUnits).replace(/,/, ' ');
//     }

//     return format;
// }

const timeIntervals_ = [
    moment.duration(1, 'seconds').asMilliseconds(),
    moment.duration(5, 'seconds').asMilliseconds(),
    moment.duration(10, 'seconds').asMilliseconds(),
    moment.duration(30, 'seconds').asMilliseconds(),
    moment.duration(1, 'minutes').asMilliseconds(),
    moment.duration(5, 'minutes').asMilliseconds(),
    moment.duration(10, 'minutes').asMilliseconds(),
    moment.duration(30, 'minutes').asMilliseconds(),
    moment.duration(1, 'hours').asMilliseconds(),
    moment.duration(6, 'hours').asMilliseconds(),
    moment.duration(12, 'hours').asMilliseconds(),
    moment.duration(1, 'days').asMilliseconds(),
    moment.duration(3, 'days').asMilliseconds(),
    moment.duration(1, 'weeks').asMilliseconds(),
    moment.duration(2, 'weeks').asMilliseconds(),
    moment.duration(1, 'months').asMilliseconds(),
    moment.duration(3, 'months').asMilliseconds(),
    moment.duration(6, 'months').asMilliseconds(),
    moment.duration(1, 'years').asMilliseconds(),
];

export const timeContext = {
    SECOND: 0,
    MINUTE: 1,
    HOUR: 2,
    DAY: 3,
    MONTH: 4,
    YEAR: 5,
    ETERNITY: 6,
};

// Objects describing label formatting func
// formattingFunc: accepting timestamp(num of ms), returning formatted string
// argForMaxLabel: timestamp(num of ms) for which formattingFunc will give label
// of maximum length
function LabelFormat(formattingFunc, argForMaxLabel) {
    this.format = formattingFunc;
    this.maxLabel = formattingFunc(argForMaxLabel);
}

// Generates LabelFormat for duration based time points
// maxDuration: max duration of animation as ms or as moment.duration
// commonTimeContext: common time context of the duration
// t: translate function
function generateDurationFormat(maxDuration, commonTimeContext, t) {

    function getDecomposition(wholeMomDuration) {
        const addLeadingZeros = (n) => n < 10 ? "0" + n : "" + n;

        return {
            asMilliseconds: wholeMomDuration.asMilliseconds().toFixed(3),
            seconds: addLeadingZeros(wholeMomDuration.seconds()),
            minutes: addLeadingZeros(wholeMomDuration.minutes()),
            hours:   addLeadingZeros(wholeMomDuration.hours()),
            days:   wholeMomDuration.days(),
            months: wholeMomDuration.months(),
            years:  wholeMomDuration.years(),
        };
    }

    function tWithCount(word, count) {
        console.log(t("seconds", {count: 7}));
        return count + " " + t(word, {count: count});
    }

    let formattingFunc;
    switch (commonTimeContext) {
        case timeContext.ETERNITY:
            formattingFunc = (d) =>
                `${d.years && tWithCount("year", d.years)} ` +
                `${d.months && tWithCount("month", d.months)} ` +
                `${tWithCount("day", d.days)}`;
            break;

        case timeContext.YEAR:
            formattingFunc = (d) =>
                `${d.months && tWithCount("month", d.months)} ${tWithCount("day", d.days)}`;
            break;

        case timeContext.MONTH:
            formattingFunc = (d) =>
                `${d.days && tWithCount("day", d.days)} ${d.hours}:${d.minutes}`;
            break;

        case timeContext.DAY:
            //adding seconds for clarity
            formattingFunc = (d) => `${d.hours}:${d.minutes}:${d.seconds}`;
            break;


        case timeContext.HOUR:
            formattingFunc = (d) => `${d.minutes}:${d.seconds}`;
            break;

        case timeContext.MINUTE:
            formattingFunc = (d) => tWithCount("second", d.seconds);
            break;

        default:
            formattingFunc = (d) => tWithCount("second", d.asMilliseconds);
    }

    const maxLabelLengthFor = moment.duration({
        seconds: 59,
        minutes: 59,
        hours: 23,
        days: 29,
        months: 11,
        years: maxDuration.years(),
    }).asMilliseconds();

    const formattingFuncWrapper = (ts) => {
        const decompDuration = getDecomposition(moment.duration(ts));
        return formattingFunc(decompDuration);
    };

    return new LabelFormat(formattingFuncWrapper, maxLabelLengthFor);
}

// Generates LabelFormat for timestamp based time points
// commonTimeContext: time context shared by both time points
// TODO: add locale support
// TODO: think about differentiating hours vs minutes vs seconds
function generateTimestampFormat(commonTimeContext) {
    console.log(commonTimeContext);
    let formatStr;
    let afterFormat = null;

    switch(commonTimeContext) {
        case timeContext.ETERNITY:
            formatStr = "ll"; //Sep 4, 1986
            break;

        case timeContext.YEAR:
            formatStr = "MMM D"; //Sep 4
            break;

        case timeContext.MONTH:
            formatStr = "D, LT"; //4, 8:30 PM
            break;

        case timeContext.DAY:
            formatStr = "LTS"; //8:30:25 PM
            break;

        case timeContext.HOUR:
            formatStr = "mm:ss"; //30:25
            break;

        case timeContext.MINUTE:
            formatStr = "ss"; //25
            afterFormat = (strTime) => strTime + " sec.";
            break;

        default:
            formatStr = "ss.SSS"; //25.123
            afterFormat = (strTime) => strTime + " sec.";
            break;
    }

    const formatFunc = (ts) => {
        const momentTs = moment(ts);
        return afterFormat ?
            afterFormat(momentTs.format(formatStr)) : momentTs.format(formatStr);
    };

    const maxLabelLengthFor = moment({
        milliseconds: 999,
        seconds: 59,
        minutes: 59,
        hours: 23,
        days: 31,
        months: 0, //Zero based months
        years: 2020,
    }).valueOf();

    return new LabelFormat(formatFunc, maxLabelLengthFor);
}

function getCommonTimeContextForTimestamps(ts1, ts2) {
    const momentTimeContexts = Object.keys(timeContext).map(key => key.toLowerCase());

    let mtc;
    for (mtc of momentTimeContexts) {
        if (mtc === "eternity" || ts1.isSame(ts2, mtc)) break;
    }

    return timeContext[mtc.toUpperCase()];
}

function getCommonTimeContextForDuration(duration) {
    if (duration.years() > 0) return timeContext.ETERNITY;
    if (duration.months() > 0) return timeContext.YEAR;
    if (duration.days() > 0) return timeContext.MONTH;
    if (duration.hours() > 0) return timeContext.DAY;
    if (duration.minutes() > 0) return timeContext.HOUR;
    if (duration.seconds() > 0) return timeContext.MINUTE;
    return timeContext.SECOND;
}

@withComponentMixins([
    withTranslation
])
class Timeline extends Component {
    static propTypes = {
        length: PropTypes.number,
        beginTs: PropTypes.number,
        width: PropTypes.string,

        bigTickMargin: PropTypes.number,
        smallTickMargin: PropTypes.number,
        labelFontSize: PropTypes.string,
        timeIntervals: PropTypes.arrayOf(PropTypes.number),
        t: PropTypes.func,
    }

    static defaultProps = {
        timeIntervals: timeIntervals_,
    }

    constructor(props) {
        super(props);
        this.state = {
            value: 0,
        };

        this.minPos = 30;
        this.maxPos = 770;

        this.pointerSide = 5;
        this.pointerHeight = 0.5 * Math.sqrt(3) * this.pointerSide;

        this.scaleY = 30;
        this.labelHeight = 16;
        this.innerSvg = `
            <svg id="innerSvg" viewBox="0 0 800 70" xmlns="http://www.w3.org/2000/svg">
                <filter x="-0.08" y="0" width="116%" height="100%" id="solid">
                    <feFlood flood-color="black"></feFlood>
                    <feComposite in="SourceGraphic" operator="over"></feComposite>
                </filter>
                <text id="test-label"
                    x="0" y="0" fill-opacity="0" dominant-baseline="hanging" style="display: none"/>
                <text id="begin-label"
                    text-anchor="start" x="10" y="${this.scaleY}" dominant-baseline="hanging" />
                <g id="scale">
                </g>
                <g id="pointer" style="display: none">
                    <text id="label" class="label" text-anchor="middle" y="${this.labelHeight}"></text>
                    <polygon class="triangle"
                        points="" fill="black" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                </g>
                <g id="hover-pointer" style="display:none" color="#707070">
                    <text id="hover-label" class="label"
                        text-anchor="middle" y="${this.labelHeight}"
                        fill="white" filter="url(#solid)"></text>
                    <polygon class="triangle"
                        points="" fill="black" stroke="black" stroke-width="2" stroke-linejoin="round" />
                </g>
                <text id="end-label"
                    text-anchor="end" x="790" y="${this.scaleY}"
                    dominant-baseline="hanging" />
            </svg>`;
    }

    componentDidUpdate(prevProps) {
        // if (prevProps.width !== this.props.width ||
        //     prevProps.beginTs !== this.props.beginTs) {
        //     this.generateTicks();
        // }
    }

    componentDidMount() {
        this.renderTestLabel();
        // this.renderEndpointLabels();
        // this.generateTicks();
        //window.addEventListener("resize", ::this.generateTicks);
    }

    componentWillUnmount() {
        // window.removeEventListener("resize", ::this.generateTicks);
    }

    renderTestLabel() {
        this.generateLabelFormat();
        this.getLabelClientRect();
        this.renderTimeline();
    }

    generateLabelFormat() {
        const isRelative = this.props.beginTs === undefined || this.props.beginTs === null;

        if (isRelative) {
            const duration = moment.duration(this.props.length);
            const timeContext = getCommonTimeContextForDuration(duration);
            console.log({duration, timeContext});
            this.labelFormat = generateDurationFormat(duration, timeContext, this.props.t);
        } else {
            const ts1 = moment(this.props.beginTs);
            const ts2 = moment(this.props.beginTs + this.props.length);
            const timeContext = getCommonTimeContextForTimestamps(ts1, ts2);
            this.labelFormat = generateTimestampFormat(timeContext);
        }
    }

    getLabelClientRect() {
        this.testLabelNode.
            text(this.labelFormat.maxLabel).
            style("font-size", this.props.labelFontSize).
            style("display", "block");

        const testLabelRect = this.testLabelNode.node().getBoundingClientRect();
        this.labelClientRect = {width: testLabelRect.width, height: testLabelRect.height};

        this.testLabelNode.style("display", "none");
    }

    renderTimeline() {
        this.scaleNode.selectAll(".tick").remove();

        const isRelative = this.props.beginTs === undefined || this.props.beginTs === null;

        const beginTime = isRelative ? 0 : this.props.beginTs;
        const endTime = beginTime + this.props.length;

        //TODO: vyporadat se s vyskou
        this.beginLabelNode.
            text(this.labelFormat.format(beginTime)).
            style("font-size", this.props.labelFontSize);
        this.endLabelNode.
            text(this.labelFormat.format(endTime)).
            style("font-size", this.props.labelFontSize);

        const containerWidth = this.svgNodeSel.node().getBoundingClientRect().width;
        const scalePadding = 10;
        const scaleWidth = containerWidth - 2*this.labelClientRect.width - 2*scalePadding;
        this.minPos = this.beginLabelNode.attr("x");
    }

    movePointer(pointerNode, position) {
        const pointerY = this.scaleY - 5;

        const leftUp =`${position - (this.pointerSide*0.5)},${pointerY - this.pointerHeight}`;
        const rightUp = `${position + (this.pointerSide*0.5)},${pointerY - this.pointerHeight}`;
        const down = `${position},${pointerY}`;

        pointerNode.select(".triangle").attr("points", `${leftUp} ${rightUp} ${down}`);
        pointerNode.select(".label").attr("x", position);
    }

    getMsWidth() {
        const currWidth = this.svgNodeSel.node().getBoundingClientRect().width;
        return ((this.maxPos - this.minPos) / this.props.length) * (currWidth / 800);
    }

    computeTickFrequency() {
        const msWidth = this.getMsWidth();

        let i = 0;
        while (i < this.props.timeIntervals.length && this.props.timeIntervals[i] * msWidth < this.props.bigTickMargin) i++;

        let bigTickFactor = 1;
        if (i === this.props.timeIntervals.length) {
            i--;
            while (this.props.timeIntervals[i] * msWidth * bigTickFactor < this.props.bigTickMargin) bigTickFactor++;
        }

        const bigTickFreq = this.props.timeIntervals[i]*bigTickFactor; //could be bigger than this.length

        let smallTicksCount = 2;
        while ((bigTickFreq/(smallTicksCount + 1)) * msWidth > this.props.smallTickMargin) smallTicksCount++;

        return {bigTickFreq, smallTicksCount};
    }

    generateTicks() {
        const scaleNode = this.svgNodeSel.select("#scale");
        scaleNode.selectAll(".tick").remove();

        const {bigTickFreq, smallTicksCount} = this.computeTickFrequency();
        const msWidth = this.getMsWidth();
        const smallTickFreq = bigTickFreq / smallTicksCount;

        let nextTickPos = this.minPos + msWidth*smallTickFreq; //if relative, find last spot
        console.log({bigTickFreq, smallTicksCount, msWidth, nextTickPos});

        let tickCount = 1;
        while (nextTickPos < this.maxPos) {
            if (tickCount % smallTicksCount === 0) {
                this.drawBigTick(scaleNode, nextTickPos);
            }
            else {
                this.drawSmallTick(scaleNode, nextTickPos);
            }

            nextTickPos += msWidth*smallTickFreq;
            tickCount++;
        }

        this.drawBigTick(scaleNode, this.minPos);
        this.drawBigTick(scaleNode, this.maxPos);
    }

    drawSmallTick(scaleNode, pos) {
        console.log("drawSmallTick");
        const tickLength = 8;

        scaleNode.append("line").classed("tick", true).
            attr("x1", pos).
            attr("x2", pos).
            attr("y1", this.scaleY).
            attr("y2", this.scaleY + tickLength).
            attr("stroke", "black").
            attr("stroke-width", "2").
            attr("stroke-linecap", "round");

    }

    drawBigTick(scaleNode, pos) {
        console.log("drawBigTick");
        const tickLength = 12;

        scaleNode.append("line").classed("tick", true).
            attr("x1", pos).
            attr("x2", pos).
            attr("y1", this.scaleY).
            attr("y2", this.scaleY + tickLength).
            attr("stroke", "black").
            attr("stroke-width", "4").
            attr("stroke-linecap", "round");
    }


    render() {
        console.log(this.props.t("dog", {count: 2}));
        console.log(styles);
        return (
            <SliderBase
                width={this.props.width}
                height={"auto"}

                innerSvg={this.innerSvg}
                minPos={this.minPos}
                maxPos={this.maxPos}

                value={this.state.value}
                setValue={(value) => this.setState({value})}
                printValue={(value) => value.toFixed(2)}

                snapTo={(value) => value}
                movePointer={::this.movePointer}
                moveHoverPointer={::this.movePointer}

                init={(node) => {
                    this.svgNodeSel = select(node);
                    this.testLabelNode = this.svgNodeSel.select("#test-label");
                    this.beginLabelNode = this.svgNodeSel.select("#begin-label");
                    this.endLabelNode = this.svgNodeSel.select("#end-label");
                    this.scaleNode = this.svgNodeSel.select("#scale");
                }}
                data={{
                }}
            />
        );
    }
}

//Implementation of slider logic
class SliderBase extends Component {
    static propTypes = {
        nodes: PropTypes.object,

        enabled: PropTypes.bool,
        withHover: PropTypes.bool,

        valueToPos: PropTypes.func,
        posToValue: PropTypes.func,

        value: PropTypes.any,
        setValue: PropTypes.func,
        printValue: PropTypes.func,
        snapToValue: PropTypes.func,

        children: PropTypes.node,
    }

    static defaultProps = {
        nodes: {},
        withHover: false,
        enabled: false,
    }

    constructor(props) {
        super(props);

        this.isSliding = false;
        this.state = {
            value: props.value || 0,
            hoverValue: 0,
        };
    }

    componentDidUpdate(prevProps) {
        if (!this.props.enabled && prevProps.enabled) {
            this.disable();
            return;
        }

        if (this.props.enabled && !prevProps.enabled)
            this.enable();
        else if (this.props.enabled && this.props.withHover && !prevProps.withHover)
            this.enableHover();
        else if (this.props.enabled && !this.props.withHover && prevProps.withHover)
            this.disableHover();


        if (prevProps.value !== this.props.value && this.props.value && !this.isSliding) {
            this.setState({value: this.props.value});
        }
    }

    componentDidMount() {
        if (this.props.enabled) this.enable();
    }

    enable() {
        const sliderNode = this.props.nodes.slider;
        const scaleNode = this.props.nodes.scale;
        const labelNode = this.props.nodes.label;
        const pointerNode = this.props.nodes.pointer;

        const terminateSliding = () => {
            sliderNode.on("mousemove", null);
            scaleNode.attr("pointer-events", this.scaleNodePointerEvents);
            labelNode.attr("pointer-events", this.labelNodePointerEvents);
        };

        const startSliding = () => {
            this.isSliding = true;
            this.scaleNodePointerEvents = scaleNode.attr("pointer-events");
            this.labelNodePointerEvents = labelNode.attr("pointer-events");
            labelNode.attr("pointer-events", "none");
            scaleNode.attr("pointer-events", "none");

            sliderNode.on("mousemove", () => {
                this.setState({value: this.getMouseValue()});
            });
        };

        //---Slider---
        sliderNode.
            on("mouseup", () => {
                if (!this.isSliding) return;

                terminateSliding();

                this.sendChangeUp();
                this.isSliding = false;
            }).
            on("mouseleave", () => {
                if (!this.isSliding) return;
                terminateSliding();

                this.setState({value: this.props.value});
                this.isSliding = false;
            }).
            attr("color", "black");

        //---Scale---
        scaleNode
            .on("click", () => {
                this.setState({value: this.getMouseValue()});
                this.sendChangeUp();
            })
            .style("cursor", "pointer")
            .style("user-select", "none");

        //---Pointer---
        pointerNode.
            style("cursor", "pointer").
            on("mousedown", startSliding);

        //---Label---
        labelNode
            .style("user-select", "none");

        if (this.props.withHover) this.enableHover();
    }

    enableHover() {
        const hoverLabelNode = this.props.nodes.hoverLabel;
        const hoverPointerNode = this.props.nodes.hoverPointer;
        const scaleNode = this.props.nodes.scale;

        hoverLabelNode.style("user-select", "none");
        scaleNode.
            on("mouseenter", () => hoverPointerNode.style("display", "block")).
            on("mouseleave", () => hoverPointerNode.style("display", "none")).
            on("mousemove", () => this.setState({hoverValue: this.getMouseValue()}));
    }

    disable() {
        const sliderNode = this.props.nodes.slider;
        const pointerNode = this.props.nodes.pointer;
        const scaleNode = this.props.nodes.scale;

        if (sliderNode) {
            sliderNode.
                on("mouseleave mouseup", null).
                attr("color", "grey");
        }

        if (pointerNode) {
            pointerNode.
                style("cursor", "not-allowed").
                on("mousedown", null);
        }

        if (scaleNode) {
            scaleNode.
                style("cursor", "not-allowed").
                on("click", null);
        }

        if (this.props.withHover) this.disableHover();
    }

    disableHover() {
        const scaleNode = this.props.nodes.scale;
        if (scaleNode) scaleNode.on("mouseenter mouseleave mousemove", null);
    }


    getMouseValue() {
        const x = mouse(this.props.nodes.scale.node())[0];
        const value = this.props.posToValue(x);
        return this.props.snapToValue ? this.props.snapToValue(value) : value;
    }

    sendChangeUp() {
        const success = this.props.setValue(this.state.value);
        if (!success) this.setState({value: this.props.value});
    }

    render() {
        if (this.props.nodes.pointer && this.props.valueToPos)
            this.props.nodes.pointer.attr("x", this.props.valueToPos(this.state.value));
        if (this.props.nodes.label && this.props.printValue)
            this.props.nodes.label.text(this.props.printValue(this.state.value));

        if (this.props.enabled && this.props.withHover) {
            this.props.nodes.hoverPointer.attr("x", this.props.valueToPos(this.state.hoverValue));
            this.props.nodes.hoverLabel.text(this.props.printValue(this.state.hoverValue));
        }

        return (
            <>
                { this.props.children }
            </>
        );
    }

}

export {MediaButton, PlayPauseButton, StopButton, JumpForwardButton, JumpBackwardButton, PlaybackSpeedSlider, SliderBase, Timeline, TimelineD3};
