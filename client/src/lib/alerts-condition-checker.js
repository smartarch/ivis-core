'use strict';

import { evaluate } from "mathjs";
import axios from "./axios";
import { getUrl } from "./urls";

export default function checkCondition(condition, sigSetId){
    if (!sigSetId) return "You should fill in a signal set first!";

    if (sigSet !== sigSetId) setupScope(sigSetId);

    let evaluated;
    try {
        evaluated = evaluate(condition, scope);
    }
    catch(error){
        return error.message;
    }
    if (typeof evaluated === 'boolean') return "ok";
    else return "The expression does not return a boolean value!"
}

let sigSet;
let scope;

async function setupScope(sigSetId){
    sigSet = sigSetId;
    const result = await axios.get(getUrl(`rest/signals-simple-table/${sigSetId}`));
    scope = {};
    result.data.forEach(item => {
        scope['$' + item.cid] = 1;
    });
}
