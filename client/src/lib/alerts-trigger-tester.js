'use strict';

import axios, {HTTPMethod} from './axios';
import {getUrl} from "./urls";

const addUrl = 'rest/alerts-log';

export default async function testTrigger (alertId){
    await axios.method(HTTPMethod.POST, getUrl(addUrl), {alert: alertId, type: 'test'});
}
