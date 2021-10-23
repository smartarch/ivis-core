'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const signalSets = require('../../models/signal-sets');
const signalSetsAggregations = require('../../models/signal-set-aggregations');
const signalSetsPredictions = require('../../models/signal-set-predictions');
const arima = require('../../models/predictions-arima');
const predictions_nn = require('../../models/predictions-nn');
const panels = require('../../models/panels');
const templates = require('../../models/templates');
const jobs = require('../../models/jobs');
const users = require('../../models/users');
const contextHelpers = require('../../lib/context-helpers');
const base64url = require('base64-url');

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

function getSignalsPermissions(allowedSignalsMap) {
    const signalSetsPermissions = {};
    const signalsPermissions = {};

    for (const setEntry of allowedSignalsMap.values()) {
        signalSetsPermissions[setEntry.id] = new Set(['query']);
        for (const sigId of setEntry.sigs.values()) {
            signalsPermissions[sigId] = new Set(['query']);
        }
    }

    return {signalSetsPermissions, signalsPermissions};
}

users.registerRestrictedAccessTokenMethod('job', async ({jobId}) => {
    const job = await jobs.getByIdWithTaskParams(contextHelpers.getAdminContext(), jobId, false);

    const ret = {
        permissions: {
            task: {
                [job.task]: new Set(['execute', 'viewFiles'])
            },
            job: {}
        }
    };

    // TODO this is way too broad, it needs to be selected based on the task parameters, specifically file param type
    ret.permissions.job['default'] = new Set(['view','viewFiles', 'execute', 'edit']);
    ret.permissions.job[job.id] = new Set(['view', 'viewFiles', 'manageFiles']);
    ret.permissions.prediction = {  // TODO: This is only necessary for the prediction connected to the job, not all of them (at least for neural network predictions). We should probably think of a way to add these permissions specifically for each system job type.
        'default': new Set(['view', 'edit']),
    }

    const allowedSignalsMap = await signalSets.getAllowedSignals(job.taskParams, job.params);

    const {signalSetsPermissions, signalsPermissions} = getSignalsPermissions(allowedSignalsMap);

    ret.permissions.signalSet = signalSetsPermissions;
    ret.permissions.signal = signalsPermissions;

    return ret;
});

users.registerRestrictedAccessTokenMethod('panel', async ({panelId}) => {
    const panel = await panels.getByIdWithTemplateParams(contextHelpers.getAdminContext(), panelId, false);

    const ret = {
        permissions: {
            template: {
                [panel.template]: new Set(['execute', 'viewFiles'])
            },
            panel: {}
        }
    };

    if (panel.templateElevatedAccess) {
        ret.permissions.signalSet = new Set(['view', 'query']);
        ret.permissions.signal = new Set(['view', 'query']);

        ret.permissions.panel['default'] = new Set(['view']);
        ret.permissions.panel[panel.id] = new Set(['view', 'edit']);

        ret.permissions.template[panel.template].add('view');

        ret.permissions.workspace = new Set(['view', 'createPanel']);
        ret.permissions.namespace = new Set(['view', 'createPanel']);

    } else {
        ret.permissions.panel[panel.id] = new Set(['view']);

        const allowedSignalsMap = await signalSets.getAllowedSignals(panel.templateParams, panel.params);

        const {signalSetsPermissions, signalsPermissions} = getSignalsPermissions(allowedSignalsMap);

        ret.permissions.signalSet = signalSetsPermissions;
        ret.permissions.signal = signalsPermissions;
    }

    return ret;
});

users.registerRestrictedAccessTokenMethod('template', async ({templateId, params}) => {
    const template = await templates.getById(contextHelpers.getAdminContext(), templateId, false);

    const ret = {
        permissions: {
            template: {
                [template.id]: new Set(['view', 'execute', 'viewFiles'])
            }
        }
    };

    if (template.elevated_access) {
        ret.permissions.signalSet = new Set(['view', 'query']);
        ret.permissions.signal = new Set(['view', 'query']);

        ret.permissions.workspace = new Set(['view', 'createPanel']);
        ret.permissions.namespace = new Set(['view', 'createPanel']);

    } else {
        const allowedSignalsMap = await signalSets.getAllowedSignals(template.settings.params, params);

        const {signalSetsPermissions, signalsPermissions} = getSignalsPermissions(allowedSignalsMap);

        ret.permissions.signalSet = signalSetsPermissions;
        ret.permissions.signal = signalsPermissions;
    }

    return ret;
});

router.getAsync('/signal-sets/:signalSetId', passport.loggedIn, async (req, res) => {
    const signalSet = await signalSets.getById(req.context, castToInteger(req.params.signalSetId));
    signalSet.hash = signalSets.hash(signalSet);
    return res.json(signalSet);
});

router.getAsync('/signal-sets-by-cid/:signalSetCid', passport.loggedIn, async (req, res) => {
    const signalSet = await signalSets.getByCid(req.context, req.params.signalSetCid, true, false);
    signalSet.hash = signalSets.hash(signalSet);
    return res.json(signalSet);
});

router.getAsync('/predictions/:modelId', passport.loggedIn, async (req, res) => {
    const predictionModel = await signalSetsPredictions.getById(req.context, req.params.modelId);
    predictionModel.hash = signalSetsPredictions.hash(predictionModel);
    return res.json(predictionModel);
});

router.getAsync('/predictions-output-config/:predictionId', passport.loggedIn, async (req, res) => {
    const outputConfig = await signalSetsPredictions.getOutputConfig(req.context, castToInteger(req.params.predictionId));
    return res.json(outputConfig);
});

router.postAsync('/signal-sets', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await signalSets.create(req.context, req.body));
});

router.putAsync('/signal-sets/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const signalSet = req.body;
    signalSet.id = castToInteger(req.params.signalSetId);

    await signalSets.updateWithConsistencyCheck(req.context, signalSet);
    return res.json();
});

router.deleteAsync('/signal-sets/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await signalSets.removeById(req.context, castToInteger(req.params.signalSetId));
    return res.json();
});

router.postAsync('/signal-sets-table', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.listDTAjax(req.context, req.body));
});

router.postAsync('/signal-sets-validate', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.serverValidate(req.context, req.body));
});

router.postAsync('/signal-set-reindex/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.index(req.context, castToInteger(req.params.signalSetId)));
});

router.postAsync('/signals-query', passport.loggedIn, async (req, res) => {
    //console.log(JSON.stringify(await signalSets.query(req.context, req.body), null, 4));
    res.json(await signalSets.query(req.context, req.body));
});

function base64Decode(str) {
    return base64url.decode(str);
}

router.postAsync('/signal-set-records-table/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.listRecordsDTAjax(req.context, castToInteger(req.params.signalSetId), req.body));
});

router.getAsync('/signal-set-records/:signalSetId/:recordIdBase64', passport.loggedIn, async (req, res) => {
    const sigSetWithSigMap = await signalSets.getById(req.context, castToInteger(req.params.signalSetId), false, true);
    const record = await signalSets.getRecord(req.context, sigSetWithSigMap, base64Decode(req.params.recordIdBase64));

    return res.json(record);
});

router.postAsync('/signal-set-records/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const sigSetWithSigMap = await signalSets.getById(req.context, castToInteger(req.params.signalSetId), false, true);
    await signalSets.insertRecords(req.context, sigSetWithSigMap, [req.body]);
    return res.json();
});

router.putAsync('/signal-set-records/:signalSetId/:recordIdBase64', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const sigSetWithSigMap = await signalSets.getById(req.context, castToInteger(req.params.signalSetId), false, true);

    const record = req.body;
    await signalSets.updateRecord(req.context, sigSetWithSigMap, base64Decode(req.params.recordIdBase64), record);

    return res.json();
});

router.deleteAsync('/signal-set-records/:signalSetId/:recordIdBase64', passport.loggedIn, async (req, res) => {
    const sigSet = await signalSets.getById(req.context, castToInteger(req.params.signalSetId), false);
    await signalSets.removeRecord(req.context, sigSet, base64Decode(req.params.recordIdBase64));
    return res.json();
});

router.postAsync('/signal-set-records-validate/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.serverValidateRecord(req.context, castToInteger(req.params.signalSetId), req.body));
});

router.postAsync('/signal-sets/:signalSetId/aggregations', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await signalSetsAggregations.create(req.context, castToInteger(req.params.signalSetId), req.body));
});

router.postAsync('/signal-set-aggregations-table/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSetsAggregations.listDTAjax(req.context, castToInteger(req.params.signalSetId), req.body));
});

router.deleteAsync('/signal-sets/:signalSetId/predictions/:predictionId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await signalSetsPredictions.removeById(req.context, castToInteger(req.params.signalSetId), castToInteger(req.params.predictionId));
    return res.json();
});

router.putAsync('/predictions/:predictionId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const prediction = req.body;
    prediction.id = castToInteger(req.params.predictionId);

    await signalSetsPredictions.update(req.context, prediction, true);
    return res.json();
});

router.postAsync('/signal-sets/:signalSetId/predictions/arima', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await arima.create(req.context, castToInteger(req.params.signalSetId), req.body));
})

router.postAsync('/signal-sets/:signalSetId/predictions/neural_network', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await predictions_nn.create(req.context, castToInteger(req.params.signalSetId), req.body));
})

router.postAsync('/signal-set-predictions-table/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSetsPredictions.listDTAjax(req.context, castToInteger(req.params.signalSetId), req.body));
});

/* This is for testing. Kept here as long as we are still making bigger changes to ELS query processor
router.getAsync('/test-query', async (req, res) => {
    const body = [
        {
            "bucketGroups": {
                "bbb": {
                    "maxBucketCount": 5
                },
                "ccc": {
                    "maxBucketCount": 5
                }
            },
            "sigSetCid": "tupras",
            "filter": {
                "type": "range",
                "sigCid":"ts",
                "lt":"2019-01-29T14:35:32.343Z",
                "gte":"2019-01-25T12:35:32.343Z"
            },
            "aggs": [
                {
                    "sigCid":"AOP_H2O2_input",
                    "bucketGroup": "bbb",
                    "minDocCount":1
                },
                {
                    "sigCid":"AOP_H2O2_output",
                    "bucketGroup": "ccc",
                    "minDocCount":1
                },
            ]
        }
    ];
    res.json(await signalSets.query(contextHelpers.getAdminContext(), body));
});
*/

module.exports = router;
