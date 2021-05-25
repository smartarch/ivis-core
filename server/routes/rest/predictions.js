'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const signalSets = require('../../models/signal-sets');
const signalSetsAggregations = require('../../models/signal-set-aggregations');
const signalSetsPredictions = require('../../models/signal-set-predictions');
const arima = require('../../models/predictions-arima');
const panels = require('../../models/panels');
const templates = require('../../models/templates');
const users = require('../../models/users');
const contextHelpers = require('../../lib/context-helpers');
const base64url = require('base64-url');
const router = require('../../lib/router-async').create();
const { castToInteger } = require('../../lib/helpers');
const { getSigSetBoundaries, calculateRMSE } = require('../../lib/predictions-helpers');

router.postAsync('/predictions-rmse/', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const body = (await req).body;
    if (!body.sourceSetCid) { // ignore invalid request (signal set not specified)
        return res.json();
    }
    const response = await calculateRMSE(req.context, body.from, body.to, body.sourceSetCid, body.predSetCid, body.signalCid);
    return res.json(response);
});

router.getAsync('/predictions-set-boundaries/:signalSetId', passport.loggedIn, async (req, res) => {
    const signalSetId = castToInteger(req.params.signalSetId);

    return res.json(await getSigSetBoundaries(signalSetId));
});

module.exports = router;
