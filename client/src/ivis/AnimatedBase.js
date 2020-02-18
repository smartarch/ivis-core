import React, {Component} from "react";
import {Debug} from "./Debug";
import PropTypes from "prop-types";
import {SVG} from "./SVG";

const svgImage = `<svg viewBox="0 0 200 100" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <line x1="10" y1="50" x2="190"  y2="50" stroke="purple" stroke-width="1"/>
  <circle id="circle" cx="10" cy="50" r="5" stroke="black" fill="transparent" stroke-width="1"/>
</svg>`;

export class AnimatedBase extends Component {
    static propTypes = {
        interpolationFunc: PropTypes.func,
        keyframeContext: PropTypes.object
    };

    constructor(props) {
        super(props);

        this.state = {
        };
    }

    interpolate(left, right, f, ratio) {
        if (right === undefined) {
            return left;
        }

        const interpolatedAttrs = {};
        for (const attrName in left) {
            const leftVal = left[attrName];
            const rightVal = right[attrName];

            interpolatedAttrs[attrName] = rightVal === undefined ? leftVal : f(leftVal, rightVal, ratio);
        }


        return interpolatedAttrs;
    }

    paint() {
        const visDataCurr = this.props.keyframeContext.currKeyframeData;
        const visDataNext = this.props.keyframeContext.nextKeyframeData;

        const ratio = (this.props.keyframeContext.status.position % this.props.keyframeContext.status.numOfFrames) / this.props.keyframeContext.status.numOfFrames;

        const visualizationData = {};
        for (const id in visDataCurr) {
            const attrsCurr = visDataCurr[id];
            const attrsNext = visDataNext[id];

            visualizationData[id] = this.interpolate(attrsCurr, attrsNext, this.props.interpolationFunc, ratio);
        }

        this.lastVisualizationData = this.state.visualizationData;
        this.setState({visualizationData});
    }

    componentDidUpdate(prevProps) {
        const c = this.props.keyframeContext;
        const prevC = prevProps.keyframeContext;
        if (c.status.position != prevC.status.position) {
            this.repaintNeeded = true;
        }

        if (this.repaintNeeded && c.currKeyframeNum !== undefined
            && Math.floor(c.status.position / c.status.numOfFrames) === c.currKeyframeNum) {
            this.repaintNeeded = false;
            this.paint();
        }
    }

    render() {
        return (
            <>
                <Debug
                    visData={this.state.visualizationData}
                />
                <SVG source={svgImage} update={this.state.visualizationData} />
            </>
        );
    }
}

