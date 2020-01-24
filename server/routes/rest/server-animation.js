'use strict';

const router = require('../../lib/router-async').create();
const moment = require('moment');
const log = require('../../lib/log');

const animationStatus = {
    STOPED: 0,
    PLAYING: 1,
    PAUSED: 2
}

class AnimationTest {
    constructor() {
        this._animationReset();
    }

    getStatus() {
        return this.animationStatus;
    }

    getData () {
        return this.animationData;
    }

    _updateData() {
        const jump = 10;

        this.animationData.currKeyframeData = this.animationData.nextKeyframeData;
        this.animationData.nextKeyframeData.distance =
            this.animationData.currKeyframeData.distance + jump;
        this.animationData.currKeyframeNum += 1;

        this.lastUpdateTS = moment();
    }

    _setPlayInterval() {
        this.playInterval = setInterval(
            this._updateData.bind(this),
            this.animationStatus.keyframeRefreshRate
        );
    }

    _animationReset() {
        this.lastUpdateTS = null;
        this.animationStatus = {
            ver: 0,
            keyframeRefreshRate: 500,
            numOfFrames: 20,
            playStatus: animationStatus.STOPED,
        };

        this.animationData = {
            currKeyframeNum: 0,
            currKeyframeData: {
                distance: 0
            },
            nextKeyframeData: {
                distance: 10
            }
        };
    }

    play() {
        switch (this.animationStatus.playStatus) {
            case animationStatus.PAUSED:
                {
                    const timeDiff = this.animationStatus.keyframeRefreshRate - (this.pausedTS.milliseconds() - this.lastUpdateTS.milliseconds());

                    setTimeout(() => {
                        this._updateData();
                        this._setPlayInterval();
                    }, timeDiff);

                    this.pausedTS = null;
                    break;
                }
            default:
                this._setPlayInterval();
                break;
        }

        this.animationStatus.playStatus = animationStatus.PLAYING;
        this.animationStatus.ver += 1;
    }

    pause() {
        if (this.animationStatus.playStatus === animationStatus.PLAYING) {
            this.animationStatus.playStatus = animationStatus.PAUSED;
            this.animationStatus.ver += 1;

            this.pausedTS = moment();
            clearInterval(this.playInterval);
        }
    }

    stop() {
        clearInterval(this.playInterval);
        this._animationReset();
    }
}

let currentAnimation = new AnimationTest();

router.get('/animation/server/status', (req, res) => {
    res.status(200).json(currentAnimation.getStatus());
});

router.get('/animation/server/data', (req, res) => {
    res.status(200).json(currentAnimation.getData());
});


router.post('/animation/server/play', (req, res) => {
    currentAnimation.play();
    res.sendStatus(200);
});

router.post('/animation/server/pause', (req, res) => {
    currentAnimation.pause();
    res.sendStatus(200);
});

router.post('/animation/server/reset', (req, res) => {
    currentAnimation.stop();
    res.sendStatus(200);
});

router.post('/animation/server/changeSpeed', (req, res) => {
    log.info("Animation", `Change of speed to ${req.body}`);
    res.sendStatus(200);
});

router.post('/animation/server/seek', (req, res) => {
    log.info("Animation", `Seek to ${req.body}`);
    res.sendStatus(200);
});


log.info("Animation", `Animation routes mounted.`);



module.exports = router;
