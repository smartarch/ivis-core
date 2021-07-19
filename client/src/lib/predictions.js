"use strict";

import axios from "axios";
import { getUrl } from "./urls";

export async function fetchPrediction(modelId) {
    const resp = await axios.get(getUrl(`rest/predictions/${modelId}`));
    return resp.data;
}

export async function fetchPredictionOutputConfig(modelId) {
    const resp = await axios.get(getUrl(`rest/predictions-output-config/${modelId}`));
    return resp.data;
}

export async function fetchSignalSetBoundaries(sigSetId) {
    const resp = await axios.get(getUrl(`rest/predictions-set-boundaries/${sigSetId}`));
    return resp.data;
}

export async function fetchSignalSetBoundariesByCid(sigSetCid) {
    const signalSet = (await axios.get(getUrl(`rest/signal-sets-by-cid/${sigSetCid}`))).data;

    return fetchSignalSetBoundaries(signalSet.id);
}
