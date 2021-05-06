'use strict';

import { evaluate } from "mathjs";
import axios from "./axios";
import { getUrl } from "./urls";
import { SignalType } from "../../../shared/signals";
import stats from "../../../shared/alerts-stats";

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
    else if (evaluated && evaluated.entries && evaluated.entries.length !== 0 && typeof evaluated.entries[evaluated.entries.length - 1] === 'boolean') return "ok";
    else return "The expression does not return a boolean value!"
}

let sigSet;
let scope;

async function setupScope(sigSetId){
    sigSet = sigSetId;
    const result = await axios.get(getUrl(`rest/signals-simple-table/${sigSetId}`));

    scope = {};
    let recordMock = {};
    result.data.forEach(item => {
        let tmp = getValueOfType(item.type);
        scope['$' + item.cid] = tmp;
        recordMock[item.cid] = tmp;
    });
    scope['$id'] = '9';
    recordMock['id'] = '9';

    let arr = [recordMock];
    scope.past = (cid, distance) => stats.past(arr, cid, distance);
    scope.avg = (cid, length) => stats.avg(arr, cid, length);
    scope.vari = (cid, length) => stats.vari(arr, cid, length);
    scope.min = (cid, length) => stats.min(arr, cid, length);
    scope.max = (cid, length) => stats.max(arr, cid, length);
    scope.qnt = (cid, length, q) => stats.qnt(arr, cid, length, q);

    console.log(result);
    console.log(scope);
    console.log(arr);
}

function getValueOfType(type){
    if (type === SignalType.KEYWORD || type === SignalType.TEXT) return 'text';
    if (type === SignalType.DATE_TIME) return '2021-05-06T14:28:56.000Z';
    if (type === SignalType.BOOLEAN) return true;
    return 1;
}
