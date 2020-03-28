'use strict';

import React, {Fragment} from "react";

export const dotShapes = <Fragment>
    <circle id="circle"  r={1} strokeWidth={0} />
    <path   id="diamond" d="M -1 0   L 0 1   L 1 0   L 0 -1   Z" strokeWidth={0}/>
    <path   id="square" d="M -0.707 -0.707   L -0.707 0.707   L 0.707 0.707   L 0.707 -0.707   Z" strokeWidth={0}/>
    <path   id="square_big" d="M -1 -1   L -1 1   L 1 1   L 1 -1   Z" strokeWidth={0} />
    <path   id="triangle" d="M 0 -1   L -0.866 0.5      L 0.866 0.5   Z" strokeWidth={0}/>
    <g id="plus" strokeWidth={2} fill={"none"} >
        <line x1={-1} y1={0} x2={1} y2={0} vectorEffect={"non-scaling-stroke"} />
        <line x1={0} y1={-1} x2={0} y2={1} vectorEffect={"non-scaling-stroke"} />
    </g>
    <g id="cross" strokeWidth={2} fill={"none"} >
        <line x1={-0.707} y1={0.707} x2={0.707} y2={-0.707} vectorEffect={"non-scaling-stroke"}  />
        <line x1={-0.707} y1={-0.707} x2={0.707} y2={0.707} vectorEffect={"non-scaling-stroke"} />
    </g>
    <g id="plus_fat" strokeWidth={5} fill={"none"} >
        <line x1={-1} y1={0} x2={1} y2={0} vectorEffect={"non-scaling-stroke"} />
        <line x1={0} y1={-1} x2={0} y2={1} vectorEffect={"non-scaling-stroke"} />
    </g>
    <g id="cross_fat" strokeWidth={5} fill={"none"} >
        <line x1={-0.707} y1={0.707} x2={0.707} y2={-0.707} vectorEffect={"non-scaling-stroke"} />
        <line x1={-0.707} y1={-0.707} x2={0.707} y2={0.707} vectorEffect={"non-scaling-stroke"} />
    </g>
    <circle id="circle_empty"  r={0.85} /* stroke is on both inside and outside => by setting lower radius, the outer size of circle will be 1; same for others */ strokeWidth={0.3} fill={"none"} />
    <path   id="diamond_empty" d="M -0.9 0   L 0 0.9   L 0.9 0   L 0 -0.9   Z" strokeWidth={0.2} fill={"none"} />
    <path   id="square_empty" d="M -0.607 -0.607   L -0.607 0.607   L 0.607 0.607   L 0.607 -0.607   Z" strokeWidth={0.2} fill={"none"} />
    <path   id="square_big_empty" d="M -0.85 -0.85   L -0.85 0.85   L 0.85 0.85   L 0.85 -0.85   Z" strokeWidth={0.3} fill={"none"} />
    <path   id="triangle_empty" d="M 0.676 0.39   L 0 -0.78   L -0.676 0.39   Z" strokeWidth={0.22} fill={"none"}/>
</Fragment>;

export const dotShapeNames = ["circle", "diamond", "square", "square_big", "triangle", "plus", "cross", "plus_fat", "cross_fat", "circle_empty", "diamond_empty", "square_empty", "square_big_empty", "triangle_empty", "none" ];