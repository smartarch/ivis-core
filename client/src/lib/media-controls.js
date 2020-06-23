"use strict";

import React, {Component} from "react";
import PropTypes from "prop-types";
import {select, mouse} from "d3-selection";
import {scaleLinear} from "d3-scale";
import {interpolateString} from "d3-interpolate";
import styles from "./media-controls.scss";
import {withAnimationControl} from "./animation-helpers";
import {withComponentMixins} from "./decorator-helpers";
import {Button, ButtonDropdown, Icon} from "./bootstrap-components";
import {utcMillisecond, utcSecond, utcMinute, utcHour, utcDay, utcMonth, utcYear} from "d3-time";

//TODO: default label format for both relative and absolute??

@withComponentMixins([withAnimationControl])
class PlayPauseButton extends Component {
    static propTypes = {
        animationControl: PropTypes.object,
        animationStatus: PropTypes.object,
        enabled: PropTypes.bool,
        visible: PropTypes.bool,

        className: PropTypes.string,
    }

    constructor(props) {
        super(props);

        this.state = {
            isPlaying: props.animationStatus.isPlaying,
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.animationStatus.isPlaying !== prevProps.animationStatus.isPlaying) {
            this.setState({isPlaying: this.props.animationStatus.isPlaying});
        }
    }

    handleClick() {
        if (this.state.isPlaying) {
            this.setState({isPlaying: false});
            this.props.animationControl.pause();
        } else {
            this.setState({isPlaying: true});
            this.props.animationControl.play();
        }
    }

    render() {
        if (!this.props.visible) return <></>;

        const icon = this.state.isPlaying ? "pause" : "play";
        const title = icon.charAt(0).toUpperCase() + icon.slice(1);

        return (
            <Button
                title={title}
                icon={icon}
                className={styles.mediaButton + " " + (this.props.className || "")}

                type={"button"}
                onClickAsync={::this.handleClick}
                disabled={!this.props.animationControl.play || !this.props.animationControl.pause || !this.props.enabled}
            />
        );
    }
}

@withComponentMixins([withAnimationControl])
class StopButton extends Component {
    static propTypes = {
        animationControl: PropTypes.object,
        animationStatus: PropTypes.object,
        enabled: PropTypes.bool,
        visible: PropTypes.bool,

        className: PropTypes.string,
    }

    render() {
        if (!this.props.visible) return <></>;

        return (
            <Button
                title={"Stop"}
                icon={"stop"}
                className={styles.mediaButton + " " + (this.props.className || "")}

                type={"button"}
                onClickAsync={this.props.animationControl.stop}
                disabled={!this.props.animationControl.stop || !this.props.enabled}
            />
        );
    }
}

@withComponentMixins([withAnimationControl])
class JumpForwardButton extends Component {
    static propTypes = {
        animationControl: PropTypes.object,
        animationStatus: PropTypes.object,

        enabled: PropTypes.bool,
        visible: PropTypes.bool,
        shiftMs: PropTypes.number,

        className: PropTypes.string,
    }

    render() {
        if (!this.props.visible) return <></>;

        return (
            <Button
                title={"Jump froward"}
                icon={"step-forward"}
                className={styles.mediaButton + " " + (this.props.className || "")}

                type={"button"}
                onClickAsync={this.props.animationControl.jumpForward && this.props.animationControl.jumpForward.bind(null, this.props.shiftMs)}
                disabled={!this.props.animationControl.jumpForward && this.props.enabled}
            />
        );
    }
}

@withComponentMixins([withAnimationControl])
class JumpBackwardButton extends Component {
    static propTypes = {
        animationControl: PropTypes.object,
        animationStatus: PropTypes.object,

        enabled: PropTypes.bool,
        visible: PropTypes.bool,
        shiftMs: PropTypes.number,

        className: PropTypes.string,
    }

    render() {
        if (!this.props.visible) return <></>;

        return (
            <Button
                title={"Jump backward"}
                icon={"step-backward"}
                className={styles.mediaButton + " " + (this.props.className || "")}

                type={"button"}
                onClickAsync={this.props.animationControl.jumpBackward && this.props.animationControl.jumpBackward.bind(null, this.props.shiftMs)}
                disabled={!this.props.animationControl.jumpBackward || !this.props.enabled}
            />
        );
    }
}

@withComponentMixins([withAnimationControl])
class ChangeSpeedButton extends Component {
    static propTypes = {
        animationControl: PropTypes.object,
        animationStatus: PropTypes.object,

        enabled: PropTypes.bool,
        visible: PropTypes.bool,
        steps: PropTypes.arrayOf(PropTypes.number),


        factorFormat: PropTypes.func,
        classNames: PropTypes.object,
    }

    static defaultProps = {
        classNames: {},
        factorFormat: (f) => f + "x",
    }

    constructor(props) {
        super(props);

        this.labelPrefix = "Speed: ";
        this.state = {
            factor: props.animationStatus.playbackSpeedFactor || 1,
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.animationStatus.playbackSpeedFactor !== prevProps.animationStatus.playbackSpeedFactor) {
            this.setState({factor: this.props.animationStatus.playbackSpeedFactor});
        }
    }

    handleSpeedChange(factor) {
        this.setState({factor});

        this.props.animationControl.changeSpeed(factor);
    }

    getStepComps() {
        const steps = this.props.steps;
        steps.sort((x, y) => x - y);

        const comps = [];
        for (let factor of steps) {
            const className = styles.changeSpeedMenuItem + " " +
                "dropdown-item" + " " +
                (factor === this.state.factor ? "active " + styles.active : "") + " " +
                (this.props.classNames.menuItem || "");

            const label = this.props.factorFormat(factor);

            comps.push(
                <Button
                    title={`Multiply time by ${label}`}
                    label={label}
                    className={className}

                    type={"button"}
                    onClickAsync={this.handleSpeedChange.bind(this, factor)}

                    key={factor}
                />
            );
        }

        return comps;
    }

    render() {
        if (!this.props.visible) return <></>;

        const disabled = !this.props.animationControl.changeSpeed || !this.props.enabled;
        const label = <>
            <Icon className={"btn-icon mr-2"} icon={"clock"} />
            {this.props.factorFormat(this.state.factor)}
            <span className={styles.spacer}/>
        </>;

        return (
            <ButtonDropdown
                label={label}
                className={styles.changeSpeedDropdown + " " + (this.props.classNames.dropdown || "")}
                buttonClassName={
                    styles.changeSpeedButton + " " +
                    (this.props.classNames.button || "") + " " +
                    (disabled ? "disabled" : "")
                }
                menuClassName={styles.changeSpeedMenu + " " + (this.props.classNames.menu || "")}>

                {this.getStepComps()}
            </ButtonDropdown>
        );
    }
}


class TimelineBase extends Component {
    static propTypes = {
        domain: PropTypes.arrayOf(PropTypes.number),
        position: PropTypes.number,
        setPosition: PropTypes.func,

        enabled: PropTypes.bool,

        labelFormat: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
        ticks: PropTypes.arrayOf(PropTypes.number),

        classNames: PropTypes.object,
    }

    static defaultProps = {
        tickInterval: 0,
        classNames: {},
    }

    constructor(props) {
        super(props);

        this.updateAxisRectBound = ::this.updateAxisRect;

        this.nodeRefs = {
            axis: null,
            pointer: null,
            positionLabel: null,
            ticks: null,
        };

        this.getPercScale = () => {
            return scaleLinear()
                .domain(this.props.domain)
                .range(["2%", "98%"])
                .interpolate(interpolateString)
                .clamp(true);
        };

        this.getLabelFormater = (key) => {
            if (typeof this.props.labelFormat === "object" && !!this.props.labelFormat[key]) {
                return this.props.labelFormat[key];
            } else {
                return this.props.labelFormat;
            }
        };

        this.state = {
            axisRect: null,
            position: props.position,
        };
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.enabled && !prevProps.enabled) this.enable();
        else if (prevProps.enabled && !this.props.enabled) this.disable();

        if (this.state.axisRect !== prevState.axisRect ||
            this.props.domain !== prevProps.domain ||
            this.props.ticks !== prevProps.ticks ||
            this.props.labelFormat !== prevProps.labelFormat) {
            this.updateTicks();
        }

        if (this.props.position !== prevProps.position && !this.sliding) {
            this.setState({position: this.props.position});
        }
    }

    componentDidMount() {
        if (this.props.enabled) this.enable();
        window.addEventListener("resize", this.updateAxisRectBound);

        this.updateAxisRect();
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.updateAxisRectBound);
    }

    enable() {
        const posLabelSel = select(this.nodeRefs.positionLabel);
        const hoverPosLabelSel = select(this.nodeRefs.hoverPositionLabel);
        const progressBarSel = select(this.nodeRefs.progressBar);
        const pointerSel = select(this.nodeRefs.pointer);
        const timelineSel = select(this.nodeRefs.timeline);

        const percScale = this.getPercScale();
        const getScale = () => {
            return scaleLinear()
                .domain(this.props.domain)
                .range([this.state.axisRect.x, this.state.axisRect.x + this.state.axisRect.width])
                .clamp(true);
        };

        const movePointer = (ts) => {
            const pos = ts || getScale().invert(mouse(this.nodeRefs.axis)[0]);
            const perc = percScale(pos);

            progressBarSel.attr("x2", perc);
            pointerSel.attr("cx", perc);

            posLabelSel.text(this.getLabelFormater("position")(pos));
        };
        const stopSliding = () => {
            this.sliding = false;
            timelineSel
                .on("mouseup.sliding mouseleave.sliding mousemove.sliding", null);

            posLabelSel.style("display", "none");
            hoverPosLabelSel.style("display", "block");

            const pos = getScale().invert(mouse(this.nodeRefs.axis)[0]);
            this.props.setPosition(pos);
        };
        const cancelSliding = () => {
            this.sliding = false;
            timelineSel.on("mouseup.sliding mousemove.sliding mouseleave.sliding", null);

            if (this.props.position !== this.state.position) {
                this.setState({position: this.props.position});
            } else {
                movePointer(this.state.position);
            }
        };
        const startSliding = () => {
            this.sliding = true;
            posLabelSel.style("display", "block");
            hoverPosLabelSel.style("display", "none");

            movePointer();

            timelineSel
                .on("mousemove.sliding", movePointer)
                .on("mouseup.sliding", stopSliding)
                .on("mouseleave.sliding", cancelSliding);
        };

        const updateHoverLabel = () => {
            const pos = getScale().invert(mouse(this.nodeRefs.axis)[0]);
            hoverPosLabelSel.text(this.getLabelFormater("position")(pos));
        };
        const stopTrackingHover = () => {
            pointerSel.style("display", "none");
            posLabelSel.style("display", "block");
            hoverPosLabelSel.style("display", "none");

            timelineSel.on("mousemove.tracking mouseleave.tracking", null);
        };
        const startTrackingHover = () => {
            pointerSel.style("display", "block");
            posLabelSel.style("display", "none");
            hoverPosLabelSel.style("display", "block");

            updateHoverLabel();

            timelineSel
                .on("mouseleave.tracking", stopTrackingHover)
                .on("mousemove.tracking", updateHoverLabel);

        };


        timelineSel
            .attr("cursor", "pointer")
            .on("mouseenter.tracking", startTrackingHover)
            .on("mousedown.sliding", startSliding);

        pointerSel
            .attr("cursor", "pointer")
            .on("mousedown.sliding", startSliding);
    }

    disable() {
        const pointerSel = select(this.nodeRefs.pointer);
        const timelineSel = select(this.nodeRefs.timeline);
        const posLabelSel = select(this.nodeRefs.positionLabel);
        const hoverPosLabelSel = select(this.nodeRefs.hoverPositionLabel);

        this.sliding = false;

        posLabelSel.style("display", "block");
        hoverPosLabelSel.style("display", "none");

        timelineSel
            .attr("cursor", "default")
            .on("mouseenter.tracking mousedown.sliding", null);

        pointerSel
            .attr("cursor", "default")
            .style("displa", "none")
            .on("mousedown.sliding", null);
    }

    getTicks() {
        const tickDefs = [];
        const lbFromat = this.getLabelFormater("tick");
        const percScale = this.getPercScale();

        tickDefs.push({
            type: "begin",
            label: lbFromat(this.props.domain[0]),
            x: percScale(this.props.domain[0])
        });


        //TODO: const in for loops
        for (const ts of this.props.ticks) {
            tickDefs.push({
                type: "middle",
                label: lbFromat(ts),
                x: percScale(ts)
            });
        }

        tickDefs.push({
            type: "end",
            label: lbFromat(this.props.domain[this.props.domain.length - 1]),
            x: percScale(this.props.domain[this.props.domain.length - 1]),
        });

        return tickDefs;
    }

    filterTicks() {
        const ticksSel = select(this.nodeRefs.ticks).selectAll("svg");

        const nodes = ticksSel.nodes();
        let i = 0;
        while (i < nodes.length - 1) {
            const lastNode = nodes[i];
            const rect = lastNode.getBoundingClientRect();
            const end = rect.x + rect.width;

            select(lastNode).select("text").attr("opacity", 1);

            let j = i + 1;
            while (j < nodes.length - 1 && end > nodes[j].getBoundingClientRect().x) {
                select(nodes[j]).select("text").attr("opacity", 0);
                j++;
            }

            if (j === nodes.length - 1 && end > nodes[j].getBoundingClientRect().x) {
                select(lastNode).select("text").attr("opacity", 0);
            }

            i = j;
        }
    }

    updateTicks() {
        const tickDefs = this.getTicks();

        const createTick = (sel) => {
            return sel.append("svg")
                .attr("pointer-events", "none")
                .call(sel => sel.append("line")
                    .classed(styles.tick, true)
                    .classed(this.props.classNames.tick, !!this.props.classNames.tick)
                    .attr("stroke-linecap", "round")
                )
                .call(sel => sel.append("text")
                    .classed(styles.tickLabel, true).classed(this.props.classNames.tickLabel, !!this.props.classNames.tickLabel)
                    .attr("dy", "1em")
                );
        };

        const axisTop = this.state.axisRect.y - this.state.axisRect.height/2;
        const axisBottom = this.state.axisRect.y + this.state.axisRect.height/2;

        const tickTop = axisTop + this.state.axisRect.height/4;
        const tickBottom = axisBottom - this.state.axisRect.height/4;

        const updates = {
            begin: {
                updateTickMark: (sel) => sel.attr("opacity", 0),
                updateLabel: (sel, d) => sel
                    .attr("dx", "-0.5em")
                    .attr("y", axisBottom)
                    .attr("text-anchor", "start")
                    .text(d.label),
            },
            end: {
                updateTickMark: (sel) => sel.attr("opacity", 0),
                updateLabel: (sel, d) => sel
                    .attr("dx", "0.5em")
                    .attr("y", axisBottom)
                    .attr("text-anchor", "end")
                    .text(d.label),
            },
            middle: {
                updateTickMark: (sel) => sel
                    .attr("opacity", 1)
                    .attr("y1", tickTop)
                    .attr("y2", tickBottom),
                updateLabel: (sel, d) => sel
                    .attr("y", axisBottom)
                    .attr("text-anchor", "middle")
                    .text(d.label),
            }
        };

        select(this.nodeRefs.ticks).selectAll("svg")
            .data(tickDefs)
            .join(createTick)
            .attr("x", d => d.x)
            .call(sel => sel.select("line")
                .each(function (d) {
                    updates[d.type].updateTickMark(select(this));
                })
            )
            .call(sel => sel.select("text")
                .each(function (d) {
                    updates[d.type].updateLabel(select(this), d);
                })
            );

        this.filterTicks();
    }

    updateAxisRect() {
        const axisSel = select(this.nodeRefs.axis);

        const rect = this.nodeRefs.axis.getBBox();
        rect.height = axisSel.attr("stroke-width") || Number.parseInt(axisSel.style("stroke-width"), 10);

        this.setState({axisRect: rect});
    }

    render() {
        const percScale = this.getPercScale();
        const percBegin = percScale.range()[0];
        const percEnd = percScale.range()[1];
        const percPosition = percScale(this.state.position);

        return (
            <svg ref={node => this.nodeRefs.timeline = node}
                className={styles.timeline + " " + (this.props.classNames.timeline || "")}
                xmlns={"http://www.w3.org/2000/svg"}>

                <line ref={node => this.nodeRefs.axis = node}
                    className={styles.axis + " " + (this.props.classNames.axis || "")}
                    x1={percBegin} y1={"50%"}
                    x2={percEnd} y2={"50%"}
                />
                <line ref={node => this.nodeRefs.progressBar = node}
                    className={styles.progressBar + " " + (this.props.classNames.progressBar || "")}
                    pointerEvents={"none"}
                    x1={percBegin} y1={"50%"}
                    x2={percPosition} y2={"50%"}
                />

                <g ref={node => this.nodeRefs.ticks = node}/>

                <text ref={node => this.nodeRefs.positionLabel = node}
                    className={styles.positionLabel + " " + (this.props.classNames.positionLabel || "")}
                    y={this.state.axisRect && this.state.axisRect.y || 0} x={"50%"} dy={"-2em"}
                    pointerEvents={"none"}
                    textAnchor={"middle"}
                >
                    {this.getLabelFormater("position")(this.state.position)}
                </text>
                <text ref={node => this.nodeRefs.hoverPositionLabel = node}
                    className={styles.hoverPositionLabel + " " + (this.props.classNames.hoverPositionLabel || "")}
                    y={this.state.axisRect && this.state.axisRect.y || 0} x={"50%"} dy={"-2em"}
                    pointerEvents={"none"}
                    textAnchor={"middle"}
                    style={{display:"none"}}
                />
                <circle ref={node => this.nodeRefs.pointer = node}
                    className={styles.pointer + " " + (this.props.classNames.pointer || "")}
                    cx={percPosition} cy={"50%"}
                    style={{display: "none"}}
                    r={this.state.axisRect && 2*this.state.axisRect.height/3 || 0}
                />
            </svg>
        );
    }
}

@withComponentMixins([withAnimationControl])
class Timeline extends Component {
    static propTypes = {
        animationControl: PropTypes.object.isRequired,
        animationStatus: PropTypes.object.isRequired,

        enabled: PropTypes.bool.isRequired,
        visible: PropTypes.bool.isRequired,

        labelFormat: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired,
        tickInterval: PropTypes.oneOfType([
            PropTypes.number,
            PropTypes.func,
            PropTypes.shape({
                name: PropTypes.string.isRequired,
                step: PropTypes.number.isRequired,
            })
        ]).isRequired,

        classNames: PropTypes.object,
    }

    constructor(props) {
        super(props);

        this.state = {
            ticks: this.getTicks(),
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.animationStatus.domain !== prevProps.animationStatus.domain ||
            this.props.tickInterval !== prevProps.tickInterval) {
            this.setState({ticks: this.getTicks()});
        }
    }

    getTicks() {
        //Definition of intervals can be done in three ways:
        //    - as millisecond gap repeating itself from 1970-01-01
        //    - as context aware d3.time interval
        //    - using a function that recieves the time domain of the animation
        //    and returns array of unix timestamps, where ticks should be
        //    placed.

        const domain = this.props.animationStatus.timeDomain;
        const interval = this.props.tickInterval;

        //TODO: think about utc vs local..?
        const intervals = {
            millisecond: utcMillisecond,
            second: utcSecond,
            minute: utcMinute,
            hour: utcHour,
            day: utcDay,
            month: utcMonth,
            year: utcYear,
        };

        const getTicksFromMsInterval = (msInterval) => {
            if (msInterval === 0) return [];

            const ticks = [];
            let pos = domain[0] + 1;
            pos += pos % msInterval === 0 ? 0 : msInterval - (pos % msInterval);

            while (pos < domain[1]) {
                ticks.push(pos);

                pos += this.props.tickInterval;
            }

            return ticks;
        };


        if (typeof interval === "function") return interval(domain);
        else if (typeof interval === "number") return getTicksFromMsInterval(interval);
        else {
            if (!Object.prototype.hasOwnProperty.call(intervals, interval.name) || interval.step <= 0) return [];

            return intervals[interval.name]
                .every(interval.step)
                .range(domain[0] + 1, domain[1])
                .map(d => d.valueOf());
        }
    }

    render() {
        if (!this.props.visible) return <></>;

        return (
            <TimelineBase
                domain={this.props.animationStatus.timeDomain}
                position={this.props.animationStatus.position}
                setPosition={this.props.animationControl.seek}

                enabled={this.props.enabled}

                labelFormat={this.props.labelFormat}
                ticks={this.state.ticks}

                classNames={this.props.classNames}
            />
        );
    }
}

class ButtonGroup extends Component {
    static propTypes = {
        playPause: PropTypes.object,
        stop: PropTypes.object,
        jumpForward: PropTypes.object,
        jumpBackward: PropTypes.object,
        changeSpeed: PropTypes.object,

        className: PropTypes.string,
    }


    render() {
        const comps = {
            jumpBackward: JumpBackwardButton,
            playPause: PlayPauseButton,
            stop: StopButton,
            jumpForward: JumpForwardButton,
            changeSpeed: ChangeSpeedButton,
        };

        return (
            <div role={"group"}
                className={"btn-group " + styles.mediaButtonGroup + " " + (this.props.className || "")}>
                {
                    Object.keys(comps).filter(btnKey => btnKey in this.props).map(btnKey => {
                        const Comp = comps[btnKey];

                        return <Comp {...this.props[btnKey]} key={btnKey} />;
                    })
                }
            </div>
        );
    }
}

class OnelineLayout extends Component {
    static propTypes = {
        playPause: PropTypes.object,
        stop: PropTypes.object,
        jumpForward: PropTypes.object,
        jumpBackward: PropTypes.object,
        changeSpeed: PropTypes.object,
        timeline: PropTypes.object,

        buttonGroupClassName: PropTypes.string,
        layoutClassName: PropTypes.string,
    }

    render() {
        const {timeline, ...buttons} = this.props;

        const buttonsCount = Object.keys(buttons).filter(buttonId => buttons[buttonId].visible).length;

        const buttonGroupWidth = Math.max(1, buttonsCount - 2);
        const timelineWidth = 12 - buttonGroupWidth;

        return (
            <div className={
                styles.onelineLayout + " " + (this.props.layoutClassName || "")
            }>
                <div className={"row"}>
                    {buttonsCount > 0 &&
                        <div className={`col-${buttonGroupWidth}`}>
                            <ButtonGroup {...buttons} className={this.props.buttonGroupClassName} />
                        </div>
                    }
                    {timeline && timeline.visible &&
                        <div className={`col-${timelineWidth}`}>
                            <Timeline
                                {...timeline}
                            />
                        </div>
                    }
                </div>
            </div>
        );
    }
}

export {
    PlayPauseButton,
    StopButton,
    JumpForwardButton,
    JumpBackwardButton,
    ChangeSpeedButton,

    ButtonGroup,
    Timeline,

    OnelineLayout,
};
