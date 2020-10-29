'use strict';

const passport = require('../../lib/passport');
const {emitter, EventTypes} = require('../../lib/task-events');
const jobs = require('../../models/jobs')

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

const {initEventSource} = require('./helpers');

// RUNS

async function sendOutput(res, output) {
    res.write(`event: ${EventTypes.RUN_OUTPUT}\n`);
    res.write(`data: ${JSON.stringify(output)}\n\n`);
    res.flush();
}

router.getAsync('/jobs/:jobId/run/:runId', passport.loggedIn, async (req, res) => {
    // FIXME PERMS CHECK
    initEventSource(res);
    let initDone = false;
    const outputs = [];

    const send = output => {
        if (initDone) {
            sendOutput(res, output);
        } else {
            outputs.push(output);
        }
    }

    req.on("close", () => {
        emitter.removeListener(EventTypes.RUN_OUTPUT, send);
    });

    emitter.addListener(EventTypes.RUN_OUTPUT, send);

    jobs.getRunById(req.context, castToInteger(req.params.jobId), castToInteger(req.params.runId)).then((run) => {
        run.hash = jobs.hash(run);
        run.output = run.output || '' + outputs.join();
        res.write(`event: ${EventTypes.INIT}\n`);
        res.write(`data: ${JSON.stringify(run)}\n\n`);
        res.flush();
        initDone = true;
    }, (error)=>{
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify(error)}\n`);
    });

});

module.exports = router;
