'use strict';

import axios, {HTTPMethod} from "./axios";
import {getUrl} from "./urls";

const addUrl = 'rest/alerts-log';

let testReady = true;

export default async function testTrigger (alertId){
    if (!testReady) return false;
    testReady = false;
    axios.method(HTTPMethod.POST, getUrl(addUrl), {alert: alertId, type: 'test'});
    setTimeout(() => testReady = true, 60 * 1000);
    return true;
}
