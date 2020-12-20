'use strict';

import { evaluate } from "mathjs";
import axios from "./axios";
import { getUrl } from "./urls";
import { SignalType } from "../../../shared/signals";

export default function checkCondition(condition, sigSetId){
    if (!sigSetId) return "You should fill in a signal set first!";

    if (sigSet !== sigSetId) setupScope(sigSetId);
    if (!scope) return "ok";

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
    result.data.forEach(item => scope['$' + item.cid] = getValueOfType(item.type));
    scope['$id'] = 'text';
    scope.past = (cid, distance) => { checkNotNegInt(distance); return getValueByCid(result.data, cid); };
    scope.avg = (cid, length) => { checkPositiveInt(length); checkNumericSignal(result.data, cid); return getValueByCid(result.data, cid); };
    scope.var = (cid, length) => scope.avg(cid, length);
    scope.min = (cid, length) => { checkPositiveInt(length); return getValueByCid(result.data, cid); }
    scope.max = (cid, length) => scope.min(cid, length);
    scope.qnt = (cid, length, q) => { checkPositiveInt(length); if (typeof q !== 'number' || q > 1 || q < 0)
    throw new Error('Quantile q should be a number from 0 to 1!'); return getValueByCid(result.data, cid); };
}

function checkNotNegInt(x){
    if (!Number.isInteger(x) || x < 0) throw new Error('The argument should be a not negative integer!');
}

function checkPositiveInt(x){
    if (!Number.isInteger(x) || x <= 0) throw new Error('The argument should be a positive integer!');
}

function checkNumericSignal(list, cid){
    if (typeof getValueByCid(list, cid) !== 'number') throw new Error('The signal is not numeric!');
}

function getValueByCid(list, cid){
    for (let i = 0; i < list.length; i++) if (list[i].cid === cid) return getValueOfType(list[i].type);
    throw new Error('The signal id passed to the function is invalid!');
}

function getValueOfType(type){
    if (type === SignalType.KEYWORD || type === SignalType.TEXT || type === SignalType.DATE_TIME) return 'text';
    else if (type === SignalType.BOOLEAN) return true;
    else return 1;
}
