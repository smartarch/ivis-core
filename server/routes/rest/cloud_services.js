'use strict';

const passport = require('../../lib/passport');

const router = require('../../lib/router-async').create();

const cloud_services = require('../../models/cloud_services');
const {castToInteger} = require('../../lib/helpers');

router.postAsync('/cloud_services-table', passport.loggedIn, async (req, res) => {
    return res.json(await cloud_services.listDTAjax(req.context, req.body));
});

router.getAsync('/cloud/:serviceId', passport.loggedIn, async (req, res) => {
    const service = await cloud_services.getById(req.context, castToInteger(req.params.serviceId));
    service.hash = cloud_services.hash(service); // required by auto consistency check
    return res.json(service);
});

router.getAsync('/cloud/:serviceId/credDesc', passport.loggedIn, async (req, res) => {
    const credentialDescription = await cloud_services.getCredDescById(req.context, castToInteger(req.params.serviceId));
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

module.exports = router;