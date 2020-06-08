"use strict";

import React, {Component} from "react";
import PropTypes from "prop-types";
import {select, mouse} from "d3-selection";
import {scaleLinear} from "d3-scale";
import {interpolateString} from "d3-interpolate";
import styles from "./media-controls.scss";
import {withAnimationControl} from "./animation-helpers";
import {withComponentMixins} from "./decorator-helpers";
import {Button, ButtonDropdown} from "./bootstrap-components";
import moment from "moment";

class PlaybackSpeedSlider extends Component {
    static propTypes = {
        width: PropTypes.number,
        height: PropTypes.number,
        margin: PropTypes.shape({
            top: PropTypes.number,
            bottom: PropTypes.number,
            left: PropTypes.number,
            right: PropTypes.number,
        }),

        borderWidth: PropTypes.number,
        sliderRadius: PropTypes.number,

        animConfig: PropTypes.object,
        animControl: PropTypes.object,
        animStatus: PropTypes.object,
    }

    static defaultConfig = {
        margin: {
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
    }

    labelFormat(factor) {
        return factor.toFixed(2) + "x";
    }

    snapTo(factor) {
        const step = this.props.animConfig.controls.playbackSpeed.step;

        const lowerBoundary = this.props.animConfig.controls.playbackSpeed.limits[0];
        const factorShifted = factor - lowerBoundary;

        return lowerBoundary + (Math.floor(factorShifted/step) * step);
    }

    render() {
        return (
            <Slider
                width={this.props.width}
                height={this.props.height}
                margin={this.props.margin}

                borderWidth={this.props.borderWidth}
                sliderRadius={this.props.sliderRadius}

                enabled={!!this.props.animControl.changeSpeed && this.props.animConfig.controls.playbackSpeed.enabled}
                domain={this.props.animConfig.controls.playbackSpeed.limits}

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
        width: PropTypes.number,
        height: PropTypes.number,
        sliderRadius: PropTypes.number,
        margin: PropTypes.shape({
            left: PropTypes.number,
            right: PropTypes.number,
            top: PropTypes.number,
            bottom: PropTypes.number,
        }),

        borderWidth: PropTypes.number,

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

        if (this.props.domain !== prevProps.domain || this.props.width !== prevProps.width ||
            this.props.sliderRadius !== prevProps.sliderRadius) {
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
            selectorSel.classed(styles.sliderSelectorOnMouseHover, false);
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
                    this.setState({
                        value: val
                    });
                    this.props.setValue(val);
                })
                .on("mouseleave", () => {
                    endSliding();
                    moveSelector(this.state.value);
                });
        };


        selectorSel
            .on("mouseenter", () => selectorSel.classed(styles.sliderSelectorOnMouseHover, true))
            .on("mouseleave", () => !this.sliding && selectorSel.classed(styles.sliderSelectorOnMouseHover, false))
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
            .classed(styles.sliderSelectorOnMouseHover, false)
            .attr("cursor", "default")
            .on("mouseenter mouseleave mousedown", null);
    }

    getDomainWidth() {
        return this.props.width - 2*this.props.sliderRadius;
    }

    scaleInit() {
        const scale = scaleLinear()
            .domain(this.props.domain)
            .range([0, this.getDomainWidth()])
            .clamp(true);

        this.setState({scale});
    }

    render() {
        const domainWidth = this.getDomainWidth();
        const domainTop = this.props.margin.top + this.props.height/2;
        const selectorShift = this.state.scale ? this.state.scale(this.state.value) : 0;

        return (
            <svg xmlns="http://www.w3.org/2000/svg"
                width={this.props.width + this.props.margin.left + this.props.margin.right}
                height={this.props.height + this.props.margin.top + this.props.margin.bottom}
                className={styles.slider + " " + (this.props.enabled ? "" : styles.disabled)}
                ref={node => this.domainContainerN = node}>

                <text className={styles.label}
                    textAnchor="middle"
                    dominantBaseline="ideographic"
                    fill="currentColor"
                    x={this.props.margin.left + this.props.width/2}
                    y={this.props.margin.top}
                    ref={node => this.labelN = node}>
                    {this.props.labelFormat(this.state.value)}
                </text>

                <g transform={`translate(${this.props.margin.left + this.props.sliderRadius}, ${domainTop})`}
                    color="currentColor">
                    <line
                        className={styles.sliderDomain}
                        x1="0"
                        y1="0"
                        x2={domainWidth}
                        y2="0"
                        strokeWidth={this.props.borderWidth*2}
                        stroke="currentColor"
                        strokeLinecap="round"
                        ref={node => this.domainN = node}/>

                    <circle transform={`translate(${selectorShift}, 0)`}
                        className={styles.sliderSelector}
                        cx={0}
                        cy={0}
                        r={this.props.sliderRadius - 2*this.props.borderWidth}
                        strokeWidth={this.props.borderWidth}
                        stroke="currentColor"
                        ref={node => this.selectorN = node}/>
                </g>
            </svg>
        );
    }
}


class PlayPauseButton extends Component {
    static propTypes = {
        control: PropTypes.object,
        status: PropTypes.object,
        config: PropTypes.object,

        className: PropTypes.string,
    }

    constructor(props) {
        super(props);

        this.state = {
            isPlaying: props.status.isPlaying,
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.status.isPlaying !== prevProps.status.isPlaying) {
            this.setState({isPlaying: this.props.status.isPlaying});
        }
    }

    handleClick() {
        if (this.state.isPlaying) {
            this.setState({isPlaying: false});
            this.props.control.pause();
        } else {
            this.setState({isPlaying: true});
            this.props.control.play();
        }
    }

    render() {
        const icon = this.state.isPlaying ? "pause" : "play";
        const title = icon.charAt(0).toUpperCase() + icon.slice(1);

        return (
            <Button
                title={title}
                icon={icon}
                className={this.props.className}

                type={"button"}
                onClickAsync={::this.handleClick}
                disabled={!this.props.control.play || !this.props.control.pause || !this.props.config.enabled}
            />
        );
    }
}

class StopButton extends Component {
    static propTypes = {
        control: PropTypes.object,
        status: PropTypes.object,
        config: PropTypes.object,

        className: PropTypes.string,
    }

    render() {
        return (
            <Button
                title={"Stop"}
                icon={"stop"}
                className={this.props.className}

                type={"button"}
                onClickAsync={this.props.control.stop}
                disabled={!this.props.control.stop || !this.props.config.enabled}
            />
        );
    }
}

class JumpForwardButton extends Component {
    static propTypes = {
        control: PropTypes.object,
        status: PropTypes.object,
        config: PropTypes.object,

        className: PropTypes.string,
    }

    render() {
        return (
            <Button
                title={"Jump froward"}
                icon={"step-forward"}
                className={this.props.className}

                type={"button"}
                onClickAsync={this.props.control.jumpForward && this.props.control.jumpForward.bind(null, this.props.config.shiftMs)}
                disabled={!this.props.control.jumpForward && this.props.config.enabled}
            />
        );
    }
}

class JumpBackwardButton extends Component {
    static propTypes = {
        control: PropTypes.object,
        status: PropTypes.object,
        config: PropTypes.object,

        className: PropTypes.string,
    }

    render() {
        return (
            <Button
                title={"Jump backward"}
                icon={"step-backward"}
                className={this.props.className}

                type={"button"}
                onClickAsync={this.props.control.jumpBackward && this.props.control.jumpBackward.bind(null, this.props.config.shiftMs)}
                disabled={!this.props.control.jumpBackward || !this.props.config.enabled}
            />
        );
    }
}

class ChangeSpeedButton extends Component {
    static propTypes = {
        control: PropTypes.object,
        status: PropTypes.object,
        config: PropTypes.object,

        factorFormat: PropTypes.func,
        classNames: PropTypes.object,
    }

    constructor(props) {
        super(props);

        this.labelPrefix = "Speed: ";
        this.state = {
            factor: props.status.playbackSpeedFactor || 1,
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.status.playbackSpeedFactor !== prevProps.status.playbackSpeedFactor) {
            this.setState({factor: this.props.status.playbackSpeedFactor});
        }
    }

    handleSpeedChange(factor) {
        this.setState({factor});

        this.props.control.changeSpeed(factor);
    }

    getStepComps() {
        const steps = this.props.config.steps;
        steps.sort((x, y) => x - y);

        const comps = [];
        for (let factor of steps) {
            const className = styles.changeSpeedMenuItem + " " +
                "dropdown-item" + " " +
                (factor === this.state.factor ? "active " + styles.active : "") + " " +
                (this.props.classNames.menuItem || "");

            comps.push(
                <li key={factor}>
                    <button
                        type={"button"}
                        onClick={this.handleSpeedChange.bind(this, factor)}
                        className={className}>

                        {this.props.factorFormat(factor)}
                    </button>
                </li>
            );
        }

        return comps;
    }

    render() {
        const enabled = this.props.control.changeSpeed && this.props.config.enabled;
        const label = this.labelPrefix + this.props.factorFormat(this.state.factor);

        if (enabled) {
            return (
                <ButtonDropdown
                    label={label}
                    className={styles.changeSpeedDropdown + " " + (this.props.classNames.dropdown || "")}
                    buttonClassName={styles.changeSpeedButton + " " + (this.props.classNames.button || "")}
                    menuClassName={styles.changeSpeedMenu + " " + (this.props.classNames.menu || "")}>

                    {this.getStepComps()}
                </ButtonDropdown>
            );

        } else {
            return (
                <Button
                    title={"Playback speed"}
                    label={label}
                    className={this.props.classNames.button}

                    type={"button"}
                    disabled={true}
                    onClickAsync={null}
                />
            );
        }
    }
}


class Timeline extends Component {
    static propTypes = {
        domain: PropTypes.arrayOf(PropTypes.number),
        position: PropTypes.number,
        setPosition: PropTypes.func,
        enabled: PropTypes.bool,

        labelFormat: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
        tickInterval: PropTypes.number,

        classNames: PropTypes.object,
    }

    static defaultProps = {
        tickInterval: 0,
        classNames: {},
    }

    constructor(props) {
        super(props);

        this.updateAxisRectBound = () => this.setState({axisRect: this.getAxisRect()});

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

        this.getLabelFromater = (key) => {
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
        else if (!this.props.enabled && prevProps.enabled) this.disable();

        if (this.state.axisRect !== prevState.axisRect ||
            this.props.domain !== prevProps.domain ||
            this.props.tickInterval !== prevProps.tickInterval ||
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

        this.setState({axisRect: this.getAxisRect()});
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.updateAxisRectBound);
    }

    enable() {
        const posLabelSel = select(this.nodeRefs.positionLabel);
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

            posLabelSel.text(this.getLabelFromater("position")(pos));
        };
        const stopSliding = () => {
            this.sliding = false;
            timelineSel
                .on("mouseup.sliding mouseleave.sliding mousemove.sliding", null);

            posLabelSel.classed(styles.positionHoverLabel, true);
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
            posLabelSel.classed(styles.positionHoverLabel, false);

            movePointer();

            timelineSel
                .on("mousemove.sliding", movePointer)
                .on("mouseup.sliding", stopSliding)
                .on("mouseleave.sliding", cancelSliding);
        };

        const stopTrackingHover = () => {
            pointerSel.style("display", "none");
            posLabelSel.classed(styles.positionHoverLabel, false);

            timelineSel.on("mousemove.tracking mouseleave.tracking", null);
        };
        const startTrackingHover = () => {
            pointerSel.style("display", "block");
            posLabelSel.classed(styles.positionHoverLabel, true);

            timelineSel
                .on("mouseleave.tracking", stopTrackingHover)
                .on("mousemove.tracking", () => {
                    const pos = getScale().invert(mouse(this.nodeRefs.axis)[0]);
                    posLabelSel.text(this.getLabelFromater("position")(pos));
                });

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

        timelineSel
            .attr("cursor", "default")
            .on("mouseenter.tracking mousedown.sliding", null);

        pointerSel
            .attr("cursor", "default")
            .on("mousedown.sliding", null);
    }

    getTicks() {
        const tickDefs = [];
        const lbFromat = this.getLabelFromater("tick");
        const percScale = this.getPercScale();

        tickDefs.push({
            type: "begin",
            label: lbFromat(this.props.domain[0]),
            x: percScale(this.props.domain[0])
        });

        if (this.props.tickInterval !== 0) {
            let pos = this.props.domain[0] + 1;
            while (pos % this.props.tickInterval !== 0) pos++;

            while (pos < this.props.domain[this.props.domain.length - 1]) {
                tickDefs.push({
                    type: "middle",
                    label: lbFromat(pos),
                    x: percScale(pos)
                });

                pos += this.props.tickInterval;
            }
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

    getAxisRect() {
        const axisSel = select(this.nodeRefs.axis);

        const rect = this.nodeRefs.axis.getBBox();
        rect.height = axisSel.attr("stroke-width") || Number.parseInt(axisSel.style("stroke-width"), 10);
        return rect;
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
                    {this.getLabelFromater("position")(this.state.position)}
                </text>
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

//TODO: move to panel template
@withComponentMixins([withAnimationControl])
class FullControlLayout extends Component {
    static propTypes = {
        animationConf: PropTypes.object,
        animationStatus: PropTypes.object,
        animationControl: PropTypes.object,
    }

    constructor(props) {
        super(props);

        this.labelFormatBound = ::this.timelineLabelFormat;
    }

    getButtonComps() {
        const buttonTypes = {
            jumpBackward: JumpBackwardButton,
            playPause: PlayPauseButton,
            stop: StopButton,
            jumpForward: JumpForwardButton,
        };

        const buttons = [];
        const config = this.props.animationConf;

        const props = {
            //TODO: figure out how to include these classes in mine
            className: "btn-dark px-1 py-0 " + styles.mediaButton,
            status: this.props.animationStatus,
            control: this.props.animationControl,
        };

        for (let buttonTypeKey in buttonTypes) {
            if (config.controls[buttonTypeKey] && config.controls[buttonTypeKey].visible) {
                const Comp = buttonTypes[buttonTypeKey];
                buttons.push(
                    <Comp {...props} config={config.controls[buttonTypeKey]} key={buttonTypeKey} />
                );
            }
        }

        if (config.controls.changeSpeed && config.controls.changeSpeed.visible) {
            buttons.push(
                <ChangeSpeedButton
                    status={props.status}
                    control={props.control}
                    classNames={{
                        button: props.className,
                        menu: styles.darkChangeSpeedMenu,
                        menuItem: styles.darkChangeSpeedMenuItem,
                    }}
                    factorFormat={(f) => f + "x"}
                    config={config.controls.changeSpeed}
                    key={"changeSpeed"}
                />
            );
        }

        return buttons;
    }

    getTimelineComp() {
        const config = this.props.animationConf;

        if (!config.controls.timeline || !config.controls.timeline.visible) return null;

        return (
            <Timeline
                domain={[config.beginTs, config.endTs]}

                position={this.props.animationStatus.position}
                setPosition={this.props.animationControl.seek}
                enabled={this.props.animationControl.seek && config.controls.timeline.enabled}

                labelFormat={this.labelFormatBound}
                tickInterval={config.controls.timeline.tickInterval}
            />
        );
    }

    timelineLabelFormat(ts) {
        return moment.utc(ts).toISOString();
    }

    render() {
        const buttons = this.getButtonComps();
        const timeline = this.getTimelineComp();

        const buttonGroupWidth = Math.max(1, buttons.length - 2);
        const timelineWidth = 12 - buttonGroupWidth;

        return (
            <div className={"mb-4 mt-1 rounded container-fluid " + styles.controlGroup}>
                <div className={"row my-4"}>
                    {buttons.length > 0 &&
                        <div className={`col-${buttonGroupWidth}`}>
                            <div className={"btn-group " + styles.mediaButtonGroup} role={"group"}>
                                {buttons}
                            </div>
                        </div>
                    }
                    {!!timeline &&
                        <div className={`col-${timelineWidth}`}>
                            {timeline}
                        </div>
                    }
                </div>
            </div>
        );

    }
}


const controlLayouts = {
    full: FullControlLayout,
};

export {
    controlLayouts
};
