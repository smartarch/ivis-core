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
            <>
                <SliderBase
                    nodes={this.state.nodes}

                    enabled={this.state.enabled}

                    valueToPos={this.state.scale}
                    posToValue={this.state.scale && this.state.scale.invert}

                    value={this.props.animStatus.speedFactor && this.props.animStatus.speedFactor}
                    setValue={value => this.props.animControl.changeSpeed(value)}
                    printValue={value => value.toFixed(2) + "x"}
                    snapToValue={value => Math.round(value/0.25) * 0.25}
                    movePointer={(pointer, pos) => pointer.attr("x", pos)}
                />

                <svg viewBox="0 0 125 50" xmlns="http://www.w3.org/2000/svg" color="black" ref={node => this.sliderN = node}>
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

            </>
        );
    }
}

class TimelineD3 extends Component {
    static propTypes = {
        relative: PropTypes.bool,
        beginTs: PropTypes.number,
        endTs: PropTypes.number,
        ticks: PropTypes.object,
        margin: PropTypes.object,

        length: PropTypes.number,
        position: PropTypes.number,
        id: PropTypes.number,
    }

    static defaultProps = {
        beginTs: 0,
    }

    constructor(props) {
        super(props);

        this.state = {
            enabled: false,
            axis: null,
        };

        this.labelRefreshRate = 500;

        this.durationBaseIntervals = {
            millisecond: 1,
            second:      1000,
            minute:      1000*60,
            hour:        1000*60*60,
            day:         1000*60*60*24,
            month:       1000*60*60*24*30,
            year:        1000*60*60*24*30*12,
        };

        this.durationIntervals = [
            1, 10, 50, 250, 500,

            this.durationBaseIntervals.second,
            5*this.durationBaseIntervals.second,
            15*this.durationBaseIntervals.seconds,
            30*this.durationBaseIntervals.second,

            this.durationBaseIntervals.minute,
            5*this.durationBaseIntervals.minute,
            15*this.durationBaseIntervals.minute,
            30*this.durationBaseIntervals.minute,

            this.durationBaseIntervals.hour,
            3*this.durationBaseIntervals.hour,
            6*this.durationBaseIntervals.hour,
            12*this.durationBaseIntervals.hour,

            this.durationBaseIntervals.day,
            5*this.durationBaseIntervals.day,
            15*this.durationBaseIntervals.day,

            this.durationBaseIntervals.month,
            3*this.durationBaseIntervals.month,

            this.durationBaseIntervals.year,
        ];
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.relative !== prevProps.relative || this.props.beginTs !== prevProps.beginTs ||
            this.props.length !== prevProps.length || this.props.endTs !== this.props.endTs ||
            this.props.ticks !== prevProps.ticks || this.props.margin !== prevProps.margin) {
            this.init();
        }

        if (prevState.scaleDef !== this.state.scaleDef) {
            this.axisInit();
        }
    }

    componentDidMount() {
        window.addEventListener("resize", ::this.init);
        this.init();
    }

    componentWillUnmount() {
        window.removeEventListener("resize", ::this.init);
    }


    generateTimeUnitsUsedInLabel(maxTimeDiff, minTimeDiff, delim) {
        const unitNames = ['year', 'month', 'day', 'minute', 'second', 'millisecond'];
        const units = unitNames.map(key => this.durationBaseIntervals[key]);

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

    generateTimestampLabelFormat(maxTimeDiff, minTimeDiff) {
        const replace = (match, replacement) => {return (str) => str.replace(match, replacement);};

        const delim = ';';
        const usedUnits = this.generateTimeUnitsUsedInLabel(maxTimeDiff, minTimeDiff, delim);

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

    generateDurationLabelFormat(durLenght, minTimeDiff) {
        const usedUnits = this.generateTimeUnitsUsedInLabel(durLenght, minTimeDiff, ',').split(',');
        console.log(usedUnits);

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
                const unitDuration = this.durationBaseIntervals[unitName];

                const count = Math.floor(leftOverMs / unitDuration);
                leftOverMs -= count * unitDuration;

                str += formatCount[unitName](count) + suffixes[unitName] + " ";
            }

            return str.substring(0, str.length - 1);
        };

        return format;
    }

    getLabelFormat() {
        const minTimeStep = (this.labelRefreshRate / this.props.length) * (this.props.endTs - this.props.beginTs);

        if (this.props.relative) {
            return this.generateDurationLabelFormat(this.props.endTs, minTimeStep);
        } else {
            return this.generateTimestampLabelFormat(this.props.endTs - this.props.beginTs, minTimeStep);
        }
    }


    getDefaultRelativeTicks(scale) {
        const scaleRange = scale.range();
        const scaleDomain = scale.domain();

        const minTickCount = scaleRange[scaleRange.length - 1] / 125;
        const duration = scaleDomain[scaleDomain.length - 1];

        let i = this.durationIntervals.length - 1;
        while (i >= 0 && duration / this.durationIntervals[i] < minTickCount) i--;

        const ticks = [];
        const chosenInterval = this.durationIntervals[i];
        let lastTick = 0;
        while (lastTick <= duration) {
            ticks.push(lastTick);
            lastTick += chosenInterval;
        }

        return ticks;
    }

    getDefaultRelativeTickFormat() {
        const suffixes = ['ms', 's', 'min', 'h', 'd', 'mo', 'y'];
        const durationBaseIntervalsArr = Object.keys(this.durationBaseIntervals).map(key => this.durationBaseIntervals[key]);

        const format = (ts) => {
            let i = durationBaseIntervalsArr.length - 1;

            while (i >= 0 && ts % durationBaseIntervalsArr[i] !== 0) i--;

            const count = ts / durationBaseIntervalsArr[i];
            return count + ' ' + suffixes[i];
        };

        return format;
    }

    relativeScaleInit() {
        const containerWidth = this.svgN.getClientRects()[0].width;
        const scale = scaleLinear()
            .domain([0, this.props.endTs])
            .range([0, containerWidth - this.props.margin.left - this.props.margin.right])
            .clamp(true);

        const ticks = this.props.ticks?.values ? this.props.ticks.values.sort() : this.getDefaultRelativeTicks(scale);
        if (ticks[0] !== 0) ticks.unshift(0);
        if (ticks[ticks.length - 1] !== this.props.endTs) ticks.push(this.props.endTs);

        const tickLabels = new Set(this.props.ticks?.labels);
        tickLabels.add(0);
        tickLabels.add(this.props.endTs);

        const defaultTickFormat = this.getDefaultRelativeTickFormat();

        const tickLabelFormat = this.props.ticks?.labels ?
            (ts) => tickLabels.has(ts) ? defaultTickFormat(ts) : null :
            defaultTickFormat;

        return {scale, ticks, tickLabelFormat};
    }

    absoluteScaleInit() {
        const containerWidth = this.svgN.getClientRects()[0].width;
        const scale = scaleTime()
            .domain([new Date(this.props.beginTs), new Date(this.props.endTs)])
            .range([0, containerWidth - this.props.margin.left - this.props.margin.right])
            .clamp(true);

        const ticks = this.props.ticks?.values ? this.props.ticks.values.map(ts => new Date(ts)).sort() : scale.ticks();
        if (ticks[0].valueOf() !== this.props.beginTs) ticks.unshift(new Date(this.props.beginTs));
        if (ticks[ticks.length - 1].valueOf() !== this.props.endTs) ticks.push(new Date(this.props.endTs));

        const labels = new Set(this.props.ticks?.labels);
        labels.add(this.props.beginTs);
        labels.add(this.props.endTs);

        const defaultFormat = scale.tickFormat();
        const tickLabelFormat = this.props.ticks?.labels ?
            (date) => labels.has(date.valueOf()) ? defaultFormat(date) : null :
            defaultFormat;

        return {scale, ticks, tickLabelFormat};
    }


    axisInit() {
        select(this.axisN)
            .attr("pointer-events", "bounding-box")
            .classed("timeline-axis", true)
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${this.props.margin.left}, ${this.props.margin.top})`)
            .call(sel => sel.select("#domain").remove())
            .call(sel => sel
                .append("line")
                .attr("id", "domain")
                .attr("x2", this.state.scaleDef.scale.range()[1])
                .attr("stroke", "currentColor")
            )
            .call(sel => sel.select("#playback-line").remove())
            .call(sel => this.playbackLineSel = sel.append("line").attr("id", "playback-line").attr("stroke", "red"));


        const ticksData = this.state.scaleDef.ticks.map((t, i, arr) => {
            const label = this.state.scaleDef.tickLabelFormat(t);
            const isBeginTick = i == 0;
            const isEndTick = i == arr.length - 1;

            const priority = isBeginTick ? 10 :
                             isEndTick ? 9 :
                             label.length > 0 ? 1 :
                             0;
            const textAnchor = isBeginTick ? "start" :
                               isEndTick ? "end" :
                               "middle";
            return {
                pos: this.state.scaleDef.scale(t),
                label,
                priority,
                textAnchor,
            };
        });

        this.generateTicksFromData(ticksData);

        const filteredTicksData = this.filterTicks();
        this.generateTicksFromData(filteredTicksData);

        this.setState(prevState => ({
            nodes: {
                ...prevState.nodes,
                axis: select(this.axisN),
            }
        }));
    }

    generateTicksFromData(ticksData) {
        const createTick = (sel) => {
            return sel.append("g")
                .classed("tick", true)
                .call(g => g.append("line").attr("stroke", "currentColor").attr("y2", "6"))
                .call(g =>
                    g.append("text").classed("tick-label", true).attr("fill", "currentColor").attr("y", 9).attr("dy", "0.71em")
                );
        };


        select(this.axisN).selectAll(".tick")
            .data(ticksData)
            .join(createTick)
            .attr("transform", d => `translate(${d.pos}, 0)`)
            .select(".tick-label")
                .text(d => d.label)
            .attr("text-anchor", d => d.textAnchor);
    }

    filterTicks() {
        const tickDataArr = [];
        select(this.axisN).selectAll(".tick").each(function (d, i) {
            const bbox = this.getBBox();
            const begin = d.textAnchor === "start" ? d.pos :
                          d.textAnchor === "end" ? d.pos - bbox.width :
                          d.pos - bbox.width/2;
            tickDataArr[i] = {
                ...d,
                begin,
                end: begin + bbox.width,
            };
        });

        let lastBigTick = tickDataArr[0];
        let lastTick = tickDataArr[0];
        const minSpace = 8;
        for(let i = 1; i < tickDataArr.length; i++) {
            const currTick = tickDataArr[i];
            const isBigTick = currTick.label.length > 0;

            // console.log({lastBigTick, lastTick, currTick});
            if (isBigTick && lastBigTick.end + minSpace > currTick.begin) {
                if (currTick.priority <= lastBigTick.priority) {
                    currTick.label = "";
                } else {
                    lastBigTick.label = "";
                    lastBigTick = currTick;
                }

                // console.log("Big tick collision", {lastBigTick, currTick});
            } else if (isBigTick) {
                lastBigTick = currTick;
            }

            if (lastTick.pos + minSpace > currTick.pos) {
                if (currTick.priority <= lastTick.priority) {
                    currTick.isOmitted = true;
                } else {
                    lastTick.isOmitted = true;
                    lastTick = currTick;
                }

                // console.log("Small tick collision", {lastTick, currTick});
            } else {
                lastTick = currTick;
            }
        }

        return tickDataArr.filter(d => !d.isOmitted).map(d => ({
            pos: d.pos,
            label: d.label,
            priority: d.priority,
            id: d.id,
            textAnchor: d.textAnchor
        }));
    }


    init() {
        const {scale, ticks, tickLabelFormat} = this.props.relative ? this.relativeScaleInit() : this.absoluteScaleInit();

        const realtimeToPosition = scaleTime()
            .domain([0, this.props.length])
            .range(scale.range())
            .clamp(true);

        const labelFormat = this.getLabelFormat();

        let labelWidth;
        select(this.testLabelN)
            .style("display", "block")
            .text(labelFormat(scale.domain()[0]))
            .call( g => labelWidth = g.node().getBBox().width)
            .style("display", "none");

        select(this.pointerN)
            .attr("transform", `translate(${this.props.margin.left}, ${this.props.margin.top})`);

        select(this.hoverPointerN)
            .attr("transform", `translate(${this.props.margin.left}, ${this.props.margin.top})`)
            .style("display", "none");


        this.setState({
            nodes: {
                slider: select(this.svgN),
                pointer: select(this.pointerN),
                hoverPointer: select(this.hoverPointerN),
            },
            enabled: true,
            labelDef: {
                labelFormat,
                labelWidth,
            },
            realtimeToPosition,
            scaleDef: {
                scale,
                tickLabelFormat,
                ticks,
            },
        });
    }

    render() {
        const clampPos = this.state.scaleDef?.scale ? (pos) => Math.min(this.state.scaleDef.scale.range()[1], Math.max(this.state.scaleDef.scale.range()[0], pos)) : pos => pos;
        const getLabelShiftFor = (posC) => {
            return -(Math.min(0, posC - this.state.labelDef.labelWidth/2) || Math.max(0, posC + this.state.labelDef.labelWidth/2 - this.state.scaleDef.scale.range()[1]));
        };

        const nodes = this.state.nodes?.slider && this.state.nodes?.axis && this.state.nodes?.pointer && this.state.nodes?.hoverPointer && this.state.nodes;
        return (
            <>
                <SliderBaseEvents
                    nodes={nodes}
                    events={{
                        onPointerMoveTo: (pointerNode, pos) => {
                            const posC = clampPos(pos);

                            pointerNode.attr("x", posC);
                            this.playbackLineSel.attr("x2", posC);

                            select(this.labelN)
                                .text(this.state.labelDef.labelFormat(this.state.scaleDef.scale.invert(posC)))
                                .attr("x", getLabelShiftFor(posC));
                        },
                        onHoverPointerMoveTo: (pointerNode, pos, pointerPosC) => {
                            const posC = clampPos(pos);

                            pointerNode.attr("x", posC);
                            const labelShift = getLabelShiftFor(posC);
                            select(this.hoverLabelN)
                                .text(this.state.labelDef.labelFormat(this.state.scaleDef.scale.invert(posC)))
                                .attr("x", labelShift);

                            const pointerLabelPos = pointerPosC + getLabelShiftFor(pointerPosC);
                            if (Math.abs(pointerLabelPos - (posC + labelShift)) <= this.state.labelDef.labelWidth + 5) {
                                select(this.labelN).style("display", "none");
                            } else {
                                select(this.labelN).style("display", "block");
                            }
                        },
                        onPointerSetTo: (pos) => {
                        },
                        onHoverPointerAppear: (hoverPointerNode) => {
                            hoverPointerNode.style("display", "block");
                        },
                        onHoverPointerDisappear: (hoverPointerNode) => {
                            hoverPointerNode.style("display", "none");
                            select(this.labelN).style("display", "block");
                        },
                    }}
                    enabled={this.state.enabled}
                    value={this.state.realtimeToPosition && this.state.realtimeToPosition(this.props.position)}
                />

                {/*TODO: heigh??*/}
                <svg xmlns="http://www.w3.org/2000/svg" ref={node => this.svgN = node} width="100%" height="100%">
                    <defs>
                        <g id={`pointerDef_${this.props.id}`}>
                            <text id="label" className="label" y="-13" dominantBaseline="baseline" textAnchor="middle" fill="currentColor" ref={node => this.labelN = node}></text>
                            <polygon className="triangle" points={`0,-3 -2,${-3-Math.sqrt(3)*2} 2,${-3-Math.sqrt(3)*2}`} fill="red" stroke="red" strokeWidth="3" strokeLinejoin="round"/>
                        </g>
                        <g id={`hoverPointerDef_${this.props.id}`}>
                            <text id="hoverLabel" className="label" textAnchor="middle" y="-13.5" fill="currentColor" ref={node => this.hoverLabelN = node}></text>

                            <polygon className="triangle"
                                points={`0,-3 -2,${-3-Math.sqrt(3)*2} 2,${-3-Math.sqrt(3)*2}`} fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
                        </g>

                    </defs>
                    <text className="label" ref={node => this.testLabelN = node} opacity="0"/>

                    <g ref={node => this.axisN = node}/>
                    <use href={`#pointerDef_${this.props.id}`} color="black" ref={node => this.pointerN = node}/>
                    <use href={`#hoverPointerDef_${this.props.id}`} color="black" ref={node => this.hoverPointerN = node} />
                </svg>
            </>
        );
    }
}

class BottomAxis extends Component {
    static propTypes = {
        scaleRefFunc: PropTypes.func,
        scaleDefinition: PropTypes.shape({
            ticks: PropTypes.arrayOf(PropTypes.any),
            tickLabelFormat: PropTypes.func,
            scale: PropTypes.func,
        }),
    }

    constructor(props) {
        super(props);

        this.tickLength = 6;
    }

    componentDidUpdate(prevProps) {
        if (this.props.scaleDefinition !== prevProps.scaleDefinition) this.init();
    }

    componentDidMount() {
        if (this.props.scaleDefinition) this.init();
    }

    init() {
        const tickArr = this.props.scaleDefinition.ticks.map(t => ({pos: this.props.scaleDefinition.scale(t), label: this.props.scaleDefinition.tickLabelFormat(t)}));
        this.generateTicks(tickArr);
    }

    generateTicks(tickArr) {
        const createTick = (sel) => {
            sel.append("g")
                .classed("tick", true)
                .call(g =>
                    g.append("line").attr("stroke", "currentColor").attr("y2", this.tickLength)
                )
                .call( g=>
                    g.append("text").classed("tick-label", true).attr("fill", "currentColor").attr("y", 9).attr("dy", "0.71em")
                );
        };

        select(this.gN).selectAll(".tick")
            .data(tickArr)
            .join(createTick)
            .attr("transform", d => `translate(${d.pos}, 0)`)
            .select("tick-label").text(d => d.label);

        select(this.gN)
            .call(g => g
                .attr("pointer-events", "bounding-box")
                .classed("timeline-axis", true)
            ).call(g => g.select(".domain")

            ).call(g =>
                this.playbackLineSel = g
                    .append("line")
                    .attr("stroke", "red")
            );
    }

    render() {
        return (
            <g ref={node => {this.gN = node; this.props.scaleRefFunc(node);}}>
            </g>
        );
    }
}

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

class SliderBaseEvents extends Component {
    static propTypes = {
        nodes: PropTypes.shape({
            slider: PropTypes.object.isRequired,
            pointer: PropTypes.object.isRequired,
            axis: PropTypes.object.isRequired,

            hoverPointer: PropTypes.object,
        }),
        events: PropTypes.object,
        enabled: PropTypes.bool,
        value: PropTypes.any,
    }

    static defaultProps = {
        enabled: false,
        events: {},
    }

    constructor(props) {
        super(props);

        this.state = {
            position: this.props.value || 0,
            hoverPosition: 0,
            hoverPointerVisisible: false,
        };

        this.sliding = false;
        this.eventHandlersAttached = false;
    }

    componentDidUpdate(prevProps) {
        if ((this.props.nodes !== prevProps.nodes || !prevProps.enabled) && this.props.enabled && this.props.nodes) {
            this.attachEventHandlers();
        }

        if (!this.props.enabled && prevProps.enabled) {
            this.detachEventHandlers();
        }

        if (this.props.value !== prevProps.value && !this.sliding) {
            this.setState({position: this.props.value});
        }
    }

    componentDidMount() {
        if (this.props.nodes && this.props.enabled) {
            this.attachEventHandlers();
        }
    }

    getMousePos() {
        return mouse(this.props.nodes.axis.node())[0];
    }

    emit(event, ...args) {
        this.props.events[event] && this.props.events[event](...args);
    }

    attachEventHandlers() {
        const sliderNode = this.props.nodes.slider;
        const axisNode = this.props.nodes.axis;
        const pointerNode = this.props.nodes.pointer;

        const terminateSliding = () => {
            sliderNode.on("mousemove", null);
            axisNode.attr("pointer-events", this.axisNodePointerEvents);
            this.sliding = false;
        };

        const startSliding = () => {
            this.sliding = true;
            this.axisNodePointerEvents = axisNode.attr("pointer-events");
            axisNode.attr("pointer-events", "none");

            sliderNode.on("mousemove", () => this.setState({position: this.getMousePos()}));
        };

        //---Slider---
        sliderNode.
            on("mouseup", () => {
                if (!this.sliding) return;
                terminateSliding();
                this.emit("onPointerSetTo", this.state.position);
            }).
            on("mouseleave", () => {
                if (!this.sliding) return;
                terminateSliding();
                this.setState({position: this.props.value});
            });

        //---axis---
        axisNode
            .on("click", () => {
                const mousePos = this.getMousePos();
                this.setState({position: mousePos});
                this.emit("onPointerSetTo", mousePos);
            })
            .style("cursor", "pointer")
            .style("user-select", "none");

        //---Pointer---
        pointerNode
            .style("cursor", "pointer")
            .on("mousedown", startSliding)
            .on("mouseenter", () => this.emit("onPointerMouseEnter", pointerNode))
            .on("mouseleave", () => this.emit("onPointerMouseLeave", pointerNode));

        //---Hover---
        if (this.props.nodes.hoverPointer) {
            axisNode
                .on("mouseenter", () => {
                    this.emit("onHoverPointerAppear", this.props.nodes.hoverPointer);
                    this.setState({hoverPointerVisible: true});
                })
                .on("mouseleave", () => {
                    this.emit("onHoverPointerDisappear", this.props.nodes.hoverPointer);
                    this.setState({hoverPointerVisible: false});
                })
                .on("mousemove", () => this.setState({hoverPosition: this.getMousePos()}));
        }
    }

    detachEventHandlers() {
        const sliderNode = this.props.nodes?.slider;
        const pointerNode = this.props.nodes?.pointer;
        const axisNode = this.props.nodes?.axis;

        sliderNode && sliderNode.on("mouseleave mouseup", null);
        pointerNode && pointerNode.on("mousedown", null);

        if (axisNode) {
            const eventsRegistered = this.props.nodes?.hoverPointer ? "mouseenter mouseleave mousemove click" : "click";
            axisNode.
                on(eventsRegistered, null);
        }
    }

    render() {
        this.props.nodes?.pointer && this.emit("onPointerMoveTo", this.props.nodes.pointer, this.state.position);
        this.state.hoverPointerVisible && this.props.nodes?.hoverPointer && this.emit("onHoverPointerMoveTo", this.props.nodes.hoverPointer, this.state.hoverPosition, this.state.position);

        return <></>;
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
        // snapToValue: PropTypes.func,

        movePointer: PropTypes.func,
        moveHoverPointer: PropTypes.func,
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

        if (this.props.enabled && !prevProps.enabled) {
            this.enable();
        } else if (this.props.enabled && this.props.withHover && !prevProps.withHover) {
            this.enableHover();
        } else if (this.props.enabled && !this.props.withHover && prevProps.withHover) {
            this.disableHover();
        }

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
            });

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
        const labelNode = this.props.nodes.label;

        hoverLabelNode.style("user-select", "none");
        scaleNode.
            on("mouseenter", () => {
                hoverPointerNode.style("display", "block");
                labelNode.style("display", "none");
            }).
            on("mouseleave", () => {
                hoverPointerNode.style("display", "none");
                labelNode.style("display", "block");
            }).
            on("mousemove", () => this.setState({hoverValue: this.getMouseValue()}));
    }

    disable() {
        const sliderNode = this.props.nodes.slider;
        const pointerNode = this.props.nodes.pointer;
        const scaleNode = this.props.nodes.scale;

        if (sliderNode) {
            sliderNode
                .on("mouseleave mouseup", null);
        }

        if (pointerNode) {
            pointerNode
                .on("mousedown", null);
        }

        if (scaleNode) {
            scaleNode.
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
        if (this.props.printValue && this.props.valueToPos) {
            if (this.props.nodes.pointer && this.props.movePointer)
                this.props.movePointer(this.props.nodes.pointer, this.props.valueToPos(this.state.value));
            if (this.props.nodes.label)
                this.props.nodes.label.text(this.props.printValue(this.state.value));

            if (this.props.moveHoverPointer && this.props.withHover && this.props.valueToPos) {
                this.props.moveHoverPointer(this.props.nodes.hoverPointer, this.props.valueToPos(this.state.hoverValue));
                this.props.nodes.hoverLabel.text(this.props.printValue(this.state.hoverValue));
            }
        }

        return (
            <></>
        );
    }

}

export {MediaButton, PlayPauseButton, StopButton, JumpForwardButton, JumpBackwardButton, PlaybackSpeedSlider, SliderBase, Timeline, TimelineD3};
