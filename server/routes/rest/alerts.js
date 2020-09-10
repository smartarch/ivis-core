'use strict';

const passport = require('../../lib/passport');
const workspaces = require('../../models/workspaces');
const alerts = require('../../models/alerts');

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

router.getAsync('/alerts/:alertId', passport.loggedIn, async (req, res) => {
    const alert = await alerts.getById(req.context, castToInteger(req.params.alertId));
    alert.hash = alerts.hash(alert);
    return res.json(alert);
});

router.postAsync('/alerts', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await alerts.create(req.context, req.body));
});
/*
router.putAsync('/workspaces/:workspaceId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const workspace = req.body;
    workspace.id = castToInteger(req.params.workspaceId);

    await workspaces.updateWithConsistencyCheck(req.context, workspace);
    return res.json();
});
*/
router.deleteAsync('/alerts/:alertId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await alerts.remove(req.context, castToInteger(req.params.alertId));
    return res.json();
});

router.postAsync('/alerts-table', passport.loggedIn, async (req, res) => {
    return res.json(await alerts.listDTAjax(req.context, req.body));
});

module.exports = router;
