import {createComponentMixin} from "./decorator-helpers";
import React from "react";
import moment from "moment";


const AnimationStatusContext = React.createContext(null);
const AnimationControlContext = React.createContext(null);
const AnimationDataContext = React.createContext(null);

const withAnimationControl = createComponentMixin({
    contexts: [
        {context: AnimationStatusContext, propName: 'animationStatus'},
        {context: AnimationControlContext, propName: 'animationControl'}
    ]
});

const withAnimationStatus = createComponentMixin({
    contexts: [
        {context: AnimationStatusContext, propName: 'animationStatus'},
    ]
});

const withAnimationData = createComponentMixin({
    contexts: [ {context: AnimationDataContext, propName: 'animationData'} ]
});

class SignalInterpolator {
    constructor(signals, func, arity) {
        this.signals = signals;
        this.func = func;
        this.arity = arity;
        this.signalArgs = {};
        this.tsArgs = [];

        this.hasCachedArgs = false;
    }

    rebuildArgs(keyframes) {
        this.signalArgs = {};
        this.tsArgs = [];
        this.hasCachedArgs = false;

        if (keyframes.length < this.arity) return;
        const kfsWithArgs = keyframes.slice(0, this.arity);

        const getArgsForAgg = (sigCid, agg) => kfsWithArgs.map(kf => kf.data[sigCid][agg]);

        for (const sigCid of Object.keys(this.signals)) {
            const sigAggs = this.signals[sigCid];

            const args = {};
            for (const agg of sigAggs) {
                args[agg] = getArgsForAgg(sigCid, agg);
            }

            this.signalArgs[sigCid] = args;
        }

        this.tsArgs = kfsWithArgs.map(kf => moment.isMoment(kf.ts) ? kf.ts.valueOf() : kf.ts);
        this.hasCachedArgs = true;
    }

    interpolate(ts) {
        let forceNull = !this.hasCachedArgs || this.tsArgs[0] > ts || this.tsArgs[this.tsArgs.length - 1] < ts;

        const results = {};
        const interpolateAgg = (sigCid, agg) => forceNull ? null : this.func(this.tsArgs, this.signalArgs[sigCid][agg], ts);

        for (const sigCid of Object.keys(this.signals)) {
            const sigAggs = this.signals[sigCid];

            const sigResults = {};
            for (const agg of sigAggs) {
                sigResults[agg] = interpolateAgg(sigCid, agg);
            }

            results[sigCid] = sigResults;
        }

        return results;
    }
}

export {
    withAnimationStatus,
    withAnimationControl,
    withAnimationData,

    AnimationControlContext,
    AnimationStatusContext,
    AnimationDataContext,

    SignalInterpolator,
};
