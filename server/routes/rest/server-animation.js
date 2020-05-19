'use strict';

const router = require('../../lib/router-async').create();
const log = require('../../lib/log');
const em = require('../../lib/extension-manager');

const seeks = new Map();

function recordSeek(animationName, seekPosition) {
    const {count} = seeks.get(animationName) || {count: 0};
    seeks.set(animationName, {last: seekPosition, count: count + 1});

    log.info(`Storing new seek for ${animationName}, old count: ${count}, new count: ${count + 1}`);
    log.info(`Stored: ${JSON.stringify(seeks.get(animationName))}`);
}

function getSeekInfo(animationName) {
    return seeks.get(animationName) || {last: 0, count: 0};
}

router.use('/animation/:animationName', (req, res, next) => {
    const service = em.get('animation.' + req.params.animationName, null);
    if (!service) {
        res.status(404).send(`Animation named '${req.params.animationName}' not found`);
    } else {
        req.animationInstance = service;
        next();
    }
});

router.get('/animation/:animationName/status', (req, res) => {
    const currentStatus = req.animationInstance.getStatus();
    currentStatus.seek = getSeekInfo(req.params.animationName);
    res.status(200).json(currentStatus);
});

router.post('/animation/:animationName/:control(play|pause|seek|changeSpeed)', (req, res) => {
    try {
        req.animationInstance[req.params.control](req.body);

        if (req.params.control === 'seek') {
            recordSeek(req.params.animationName, req.body.position);
        }
    } catch (error) {
        log.error(`Animation ${req.params.control}`, error);
        res.sendStatus(500);
        return;
    }

    res.sendStatus(200);
});


module.exports = router;
