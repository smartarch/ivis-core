'use strict';

const passport = require('../../lib/passport');
const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

const cloud_services = require('../../models/cloud_services');
const presets = require('../../models/presets');


router.postAsync('/cloud_services-table', passport.loggedIn, async (req, res) => {
    return res.json(await cloud_services.listDTAjax(req.context, req.body));
});

router.getAsync('/cloud/:serviceId', passport.loggedIn, async (req, res) => {
    const service = await cloud_services.getById(req.context, castToInteger(req.params.serviceId));

    if (service === undefined) {
        return res.status(404).json({});
    }

    service.hash = cloud_services.hash(service); // required by auto consistency check
    return res.json(service);
});

router.getAsync('/cloud/:serviceId/description', passport.loggedIn, async (req, res) => {
    const credentialDescription = await cloud_services.getCredDescById(req.context, castToInteger(req.params.serviceId));

    if (credentialDescription === undefined) {
        return res.status(404).json({});
    }

    return res.json(credentialDescription);
});

router.putAsync('/cloud/:serviceId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const service = req.body;
    service.id = castToInteger(req.params.serviceId);

    await cloud_services.updateWithConsistencyCheck(req.context, service);
    return res.json();
});

router.postAsync('/cloud_services-validate', passport.loggedIn, async (req, res) => {
    return res.json(await cloud_services.serverValidate(req.context, req.body));
});

router.postAsync('/cloud/:serviceId/preset-types', passport.loggedIn, async (req, res) => {
    const service = await cloud_services.getById(req.context, castToInteger(req.params.serviceId));

    if (service === undefined) {
        return res.status(404).json({});
    }

    return res.json(await cloud_services.listTypesDTAjax(req.context, req.body, castToInteger(req.params.serviceId)));
});

router.postAsync('/cloud/:serviceId/presets-table', passport.loggedIn, async (req, res) => {
    const service = await cloud_services.getById(req.context, castToInteger(req.params.serviceId));

    if (service === undefined) {
        return res.status(404).json({});
    }

    return res.json(await presets.listDTAjax(req.context, req.body, castToInteger(req.params.serviceId)));
});

router.getAsync('/cloud/:serviceId/preset/:presetId', passport.loggedIn, async (req, res) => {
    const preset = await presets.getById(req.context, castToInteger(req.params.presetId));

    if (preset === undefined) {
        return res.status(404).json({});
    }

    preset.hash = presets.hash(preset); // required by auto consistency check
    return res.json(preset);
});

router.postAsync('/cloud/:serviceId/preset-validate', passport.loggedIn, async (req, res) => {
    return res.json(await presets.serverValidate(req.context, req.body));
});

router.postAsync('/cloud/:serviceId/preset', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await presets.create(req.context, req.body));
});

router.getAsync('/cloud/:serviceId/preset-descriptions', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await cloud_services.getPresetDescsById(req.context, castToInteger(req.params.serviceId)));
});

router.putAsync('/cloud/:serviceId/preset/:presetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const preset = req.body;
    preset.id = castToInteger(req.params.presetId);

    await presets.updateWithConsistencyCheck(req.context, preset);
    return res.json();
});


router.deleteAsync('/cloud/:serviceId/preset/:presetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await presets.remove(req.context, castToInteger(req.params.presetId));
    return res.json();
});

router.postAsync('/cloud/:serviceId/proxy/:operation', passport.loggedIn, async (req, res) => {
    const serviceId = castToInteger(req.params.serviceId);

    const result = await cloud_services.getByProxy(req.context, serviceId, req.params.operation, req.body);
    if (!result) {
        return res.status(404).json({});
    }

    return res.json(result);
});

module.exports = router;