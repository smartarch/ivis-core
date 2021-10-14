'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const signalSets = require('../../models/signal-sets');
const signalSetsAggregations = require('../../models/signal-set-aggregations');
const signalSetsPredictions = require('../../models/signal-set-predictions');
const arima = require('../../models/predictions-arima');
const nn = require('../../models/predictions-nn')
const panels = require('../../models/panels');
const templates = require('../../models/templates');
const users = require('../../models/users');
const contextHelpers = require('../../lib/context-helpers');
const base64url = require('base64-url');
const router = require('../../lib/router-async').create();
const { castToInteger } = require('../../lib/helpers');
const { getSigSetBoundaries, calculateRMSE, getModelAggregationInterval} = require('../../lib/predictions-helpers');
const config = require('../../lib/config');

router.getAsync('/available-predictions/', passport.loggedIn, async (req, res) => {
    return res.json(config.predictions || {});
});

router.postAsync('/predictions-rmse/', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const body = (await req).body;
    if (!body.sourceSetCid) { // ignore invalid request (signal set not specified)
        return res.json();
    }

    let interval = null;
    if (body.predictionId)
        interval = await getModelAggregationInterval(req.context, body.predictionId);

    const response = await calculateRMSE(req.context, body.from, body.to, body.sourceSetCid, body.predSetCid, body.signalCid, interval);
    return res.json(response);
});

router.getAsync('/predictions-set-boundaries/:signalSetId', passport.loggedIn, async (req, res) => {
    const signalSetId = castToInteger(req.params.signalSetId);

    return res.json(await getSigSetBoundaries(signalSetId));
});

router.getAsync('/predictions-arima-job-state/:predictionId', passport.loggedIn, async (req, res) => {
    const predictionId = castToInteger(req.params.predictionId);
    const arimaJobState = await arima.getJobState(req.context, predictionId);

    return res.json(await arimaJobState);
});

router.getAsync('/predictions-nn-jobs/:predictionId', passport.loggedIn, async (req, res) => {
    const predictionId = castToInteger(req.params.predictionId);
    const predictionJobs = await nn.getJobsIds(req.context, predictionId);
    return res.json(predictionJobs);
});

router.postAsync('/predictions-nn-finished/:predictionId', passport.loggedIn, async (req, res) => {
    return res.json(await nn.trainingFinished(req.context, castToInteger(req.params.predictionId), req.body));
})

module.exports = router;
