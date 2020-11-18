'use strict';

import { evaluate } from "mathjs";
import axios from "./axios";
import { getUrl } from "./urls";

export default async function checkCondition(condition, sigSetId){
    if (!sigSetId) return "You should fill in a signal set first!";

    const result = await axios.get(getUrl(`rest/signals-simple-table/${sigSetId}`));
    const scope = {};
    result.data.forEach(item => {
        scope['$' + item.cid] = 1;
    });

    let evaluated;
    try {
        evaluated = evaluate(condition, scope);
    }
    catch(error){
        return error.message;
    }
    if (typeof evaluated === 'boolean') return true;
    else return "The expression does not return a boolean value!"
}
