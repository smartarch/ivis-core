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

const es = require('../../lib/elasticsearch');
const knex = require('../../lib/knex');

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
});

async function getSigSetBoundaries(signalSetId, tsField='ts') {
    const signals = await knex.transaction(async tx => {
        return await signalSets.getSignalByCidMapTx(tx, { id: signalSetId });
    });
    const tsSigCid = `s${signals[tsField].id}`;

    const first = await es.search({
        index: `signal_set_${signalSetId}`,
        body: {
            query: {
                match_all: {},
            },
            size: 1,
            sort: {
                [tsSigCid]: 'asc'
            }
        }
    });

    const last = await es.search({
        index: `signal_set_${signalSetId}`,
        body: {
            query: {
                match_all: {},
            },
            size: 1,
            sort: {
                [tsSigCid]: 'desc'
            }
        }
    });

    console.log(tsSigCid);
    console.log(JSON.stringify(first.hits.hits, null, 4));
    console.log(JSON.stringify(first.hits.hits[0]['_source'], null, 4));

    return {
        first: first.hits.hits[0]['_source'][tsSigCid],
        last: last.hits.hits[0]['_source'][tsSigCid]
    };
}

router.getAsync('/predictions-set-boundaries/:signalSetId', passport.loggedIn, async (req, res) => {
    let response = {
        first: '',
        last: '',
    };

    const signalSetId = castToInteger(req.params.signalSetId);

    return res.json(await getSigSetBoundaries(signalSetId));
});

module.exports = router;
