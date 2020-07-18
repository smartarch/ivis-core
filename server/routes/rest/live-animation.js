'use strict';

const router = require('../../lib/router-async').create();
const log = require('../../lib/log');
const em = require('../../lib/extension-manager');

router.use('/animation/:animationName', (req, res, next) => {
    const service = em.get('animation.' + req.params.animationName, null);
    if (!service) {
        res.status(404).send(`Animation with the id of: '${req.params.animationName}' was not found.`);
    } else {
        req.animationInstance = service;
        next();
    }
});

router.get('/animation/:animationName/status', (req, res) => {
    try {
        const currentStatus = req.animationInstance.getStatus();
        res.status(200).json(currentStatus);
    } catch (error) {
        log.error(`Animation '${req.params.animationName}'`, error);
        res.sendStatus(500);
    }
});

router.post('/animation/:animationName/:control(play|pause)', (req, res) => {
    try {
        req.animationInstance[req.params.control]();
    } catch (error) {
        log.error(`Animation '${req.params.animationName}'`, error);
        res.sendStatus(500);
        return;
    }

    res.sendStatus(200);
});

module.exports = router;
