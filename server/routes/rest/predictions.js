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

async function calcultateRMSE(from, to, sourceSetCid, predSetCid) {
}

router.postAsync('/predictions-rmse/', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const x = (await req).body;
    console.log(`req: ${JSON.stringify(x, null, 4)}`);
    const response = {
        from: x.from,//'2021-01-01T00:00:00.000Z',
        to: x.to,//'2021-01-01T00:00:00.000Z',
        min: `0 (${Date.now()})`,
        max: 'inf',
    }
    return res.json(response);
})

module.exports = router;
