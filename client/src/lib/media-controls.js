"use strict";

import React, {Component} from "react";
import PropTypes from "prop-types";
import {SVG} from "../ivis/SVG";
import {select, mouse} from "d3-selection";
import {scaleTime, scaleLinear} from "d3-scale";
import {timeFormat} from "d3-time-format";
import {AnimationStatusContext, AnimationControlContext} from "../ivis/ServerAnimationContext";
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

class Timeline extends Component {
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
        this.defaultTickCount = 50;

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
        const scaleDomain = scale.domain();

        const minTickCount = this.defaultTickCount;
        const duration = scaleDomain[1];

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

        const ticks = this.props.ticks?.values ? this.props.ticks.values.map(ts => new Date(ts)).sort() : scale.ticks(this.defaultTickCount);
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

        const generateDataForTick = (t, i, arr) => {
            const label = this.state.scaleDef.tickLabelFormat(t);
            const role = i === 0 ? "begin" :
                i === arr.length - 1 ? "end" :
                label.length > 0 ? "big" :
                "small";

            return {pos: this.state.scaleDef.scale(t), label, role};
        };

        const ticksData = this.state.scaleDef.ticks.map(generateDataForTick);

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
                .call(g => g.append("line").attr("stroke", "currentColor"))
                .call(g =>
                    g.append("text").classed("tick-label", true).attr("fill", "currentColor").attr("dy", "0.71em")
                );
        };

        const config = {
            begin: {
                size: 10,
                textAnchor: "start",
            },
            end: {
                size: 10,
                textAnchor: "end",
            },
            big: {
                size: 10,
                textAnchor: "middle",
            },
            small: {
                size: 3,
                textAnchor: null,
            },
        };

        select(this.axisN).selectAll(".tick")
            .data(ticksData)
            .join(createTick)
            .attr("transform", d => `translate(${d.pos}, 0)`)
            .call(sel => sel.select("line").attr("y2", d => config[d.role].size))
            .select(".tick-label")
                .text(d => d.label)
                .attr("y", d => config[d.role].size + 3)
                .attr("text-anchor", d => config[d.role].textAnchor);
    }

    filterTicks() {
        const priorityConf = {
            begin: 10,
            end: 9,
            big: 2,
            small: 1
        };

        const tickDataArr = [];
        select(this.axisN).selectAll(".tick").each(function (d, i) {
            const box = this.getBoundingClientRect();
            tickDataArr[i] = {
                ...d,
                begin: box.x,
                end: box.x + box.width,
                priority: priorityConf[d.role],
            };
        });

        let lastBigTick = tickDataArr[0];
        let lastTick = tickDataArr[0];
        const minSpace = 8;
        for(let i = 1; i < tickDataArr.length; i++) {
            const currTick = tickDataArr[i];
            const isSmallTick = currTick.role === "small";

            console.log({lastBigTick, lastTick, currTick});
            if (!isSmallTick && lastBigTick.end + minSpace > currTick.begin) {
                if (currTick.priority <= lastBigTick.priority) {
                    currTick.role = "small";
                } else {
                    lastBigTick.role = "small";
                    lastBigTick = currTick;
                }

                console.log("Big tick collision", {lastBigTick, currTick});
            } else if (!isSmallTick) {
                lastBigTick = currTick;
            }

            if (lastTick.pos + minSpace > currTick.pos) {
                if (currTick.priority <= lastTick.priority) {
                    currTick.isOmitted = true;
                } else {
                    lastTick.isOmitted = true;
                    lastTick = currTick;
                }

                console.log("Small tick collision", {lastTick, currTick});
            } else {
                lastTick = currTick;
            }
        }

        console.log("---------------END");
        return tickDataArr.filter(d => !d.isOmitted).map(d => {
            // delete d.begin;
            // delete d.end;
            if (d.role === "small") d.label = "";
            return d;
        });
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

export {MediaButton, PlayPauseButton, StopButton, JumpForwardButton, JumpBackwardButton, PlaybackSpeedSlider, SliderBase, Timeline};
