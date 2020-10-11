'use strict';

import axios, {HTTPMethod} from '../../client/src/lib/axios';
import {getUrl} from "../../client/src/lib/urls";

const addUrl = 'rest/alerts-log';

async function testTrigger (alertId){
    await axios.method(HTTPMethod.POST, getUrl(addUrl), {alert: alertId, type: 'test'});
}

export {
    testTrigger
}
