'use strict';

const router = require('../../lib/router-async').create();
const log = require('../../lib/log');
const {castToInteger} = require('../../lib/helpers');

const keyframes = [
    {id: 0, ts: 0, data: 'some data of keyframe with id 0'},
    {id: 1, ts: 2000, data: 'some data of keyframe with id 1'},
    {id: 2, ts: 3000, data: 'some data of keyframe with id 2'},
    {id: 3, ts: 4000, data: 'some data of keyframe with id 3'},
    {id: 4, ts: 5000, data: 'some data of keyframe with id 4'},
    {id: 5, ts: 6000, data: 'some data of keyframe with id 5'},
    {id: 6, ts: 7000, data: 'some data of keyframe with id 6'},
    {id: 7, ts: 8000, data: 'some data of keyframe with id 7'},
    {id: 8, ts: 9000, data: 'some data of keyframe with id 8'},
    {id: 9, ts: 10000, data: 'some data of keyframe with id 9'},
    {id: 10, ts: 11000, data: 'some data of keyframe with id 10'},
    {id: 11, ts: 12000, data: 'some data of keyframe with id 11'},
    {id: 12, ts: 13000, data: 'some data of keyframe with id 12'},
    {id: 13, ts: 14000, data: 'some data of keyframe with id 13'},
    {id: 14, ts: 15000, data: 'some data of keyframe with id 14'},
];

function findBeginKeyframeByTs(ts) {
    if (ts > keyframes[keyframes.length - 1].ts) {
       return null;
    }

    let i = keyframes.length - 2;
    while (i >= 0 && keyframes[i].ts > ts) { i-= 1; }
    return i < 0 ? null : keyframes[i];
}

function findEndKeyframeByTs(ts) {
    if (ts < keyframes[0].ts) {
        return null;
    }

    let i = 1;
    while (i < keyframes.length && keyframes[i].ts < ts) { i+= 1; }
    return i === keyframes.length ? null : keyframes[i];
}


router.get('/animation/client/keyframes/id/:beginId-:endId', (req, res) => {
    const beginId = castToInteger(req.params.beginId);
    const endId = castToInteger(req.params.endId);

    const matchedKeyframes = keyframes.slice(beginId, endId + 1);
    res.status(200).json(matchedKeyframes);
});

router.get('/animation/client/keyframes/ts/:beginTs-:endTs', (req, res) => {
    const beginTs = castToInteger(req.params.beginTs);
    const endTs = castToInteger(req.params.endTs);

    const beginKf = findBeginKeyframeByTs(beginTs);
    const endKf = findEndKeyframeByTs(endTs);

    log.info("DEBUG", beginKf.id, endKf.id);
    const matchedKeyframes = keyframes.slice(beginKf.id, endKf.id + 1);
    res.status(200).json(matchedKeyframes);
});

module.exports = router;
