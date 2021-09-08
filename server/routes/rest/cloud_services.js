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
    //service.hash = cloud_services.hash(service); ??? TODO
    return res.json(service);
});

module.exports = router;