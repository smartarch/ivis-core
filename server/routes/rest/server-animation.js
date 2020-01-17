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
    constructor(settings) {
        this.animationSett = {
            id: 1,
            numberOfKeyframes: 10,
            msBetweenFrames: 500,
        };

        this.boundUpdateStatus = this._updateData.bind(this);

        if (settings) {
            Object.assign(this.animationSett, settings);
        }

        this._reset();
    }

    getInfo() {
        return this.animationSett;
    }

    getStatus() {
        return this.animData;

    }

    _updateData() {
        const jump = 10;

        this.animData.currentFrame = this.animData.nextFrame;
        this.animData.nextFrame = {
            order: this.animData.currentFrame.order + 1,
            distance: this.animData.currentFrame.distance + jump
        };

        this.lastUpdateTS = moment();
    }

    _setPlayInterval() {
        this.playInterval = setInterval(
            this._updateData.bind(this),
            this.animationSett.msBetweenFrames
        );
    }

    _reset() {
        this.lastUpdateTS = null;
        this.animData = {
            status: animationStatus.STOPED,
            currentFrame: {
                order: 0,
                distance: 0
            },
            nextFrame: {
                order: 1,
                distance: 10
            }
        }
    }

    play() {
        switch (this.animData.status) {
            case animationStatus.PAUSED:
                {
                    const timeDiff = this.animationSett.msBetweenFrames - (this.pausedTS.milliseconds() - this.lastUpdateTS.milliseconds());

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

        this.animData.status = animationStatus.PLAYING;
    }

    pause() {
        if (this.animData.status === animationStatus.PLAYING) {
            this.animData.status = animationStatus.PAUSED;
            this.pausedTS = moment();
            clearInterval(this.playInterval);
        }
    }

    stop() {
        clearInterval(this.playInterval);
        this._reset();
    }
}

let currentAnimation = new AnimationTest();

router.get('/animation/server/init', (req, res) => {
    res.json(currentAnimation.getInfo());
});

router.get('/animation/server/status', (req, res) => {
    res.json(currentAnimation.getStatus());
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
