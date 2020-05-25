import {createComponentMixin} from "./decorator-helpers";
import React from "react";


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

export {
    withAnimationStatus,
    withAnimationControl,
    withAnimationData,

    AnimationControlContext,
    AnimationStatusContext,
    AnimationDataContext,
};
