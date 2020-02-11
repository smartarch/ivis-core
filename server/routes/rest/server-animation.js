'use strict';

const router = require('../../lib/router-async').create();
const log = require('../../lib/log');

class AnimationTest {
    constructor() {
        this._animationReset();
    }

    _updateData(begin) {
        const beginKeyframeNum = 3;

        this.animationStatus.currFrameNum += 1;

        if (this.animationStatus.currFrameNum === this.animationStatus.numOfFrames - 1) {
            this.animationStatus.currFrameNum = 0;

            if (begin) {
                this.animationData = [];
                for (let i = 0; i < beginKeyframeNum; i += 1) {
                    this.animationData.push(this._advanceOneKeyframe());
                }
            } else {
                this.animationData = this._advanceOneKeyframe();
            }

        }

        this.animationStatus.ver += 1;

        this.lastUpdateTS = Date.now();
    }

    _advanceOneKeyframe() {
        const jump = 10;
        const nextData = {
            currKeyframeData: {},
            nextKeyframeData: {},
        };

        this.currKeyframeNum += 1;

        nextData.currKeyframeData.distance = this.currKeyframeNum * jump;
        nextData.nextKeyframeData.distance = (this.currKeyframeNum + 1) * jump;
        nextData.currKeyframeNum = this.currKeyframeNum;

        log.info("Animation", "Current keyframe:" + this.currKeyframeNum, (this.lastKeyframeChangeTS - Date.now()) / 1000);
        this.lastKeyframeChangeTS = Date.now();
        return nextData;
    }

    _animationReset() {
        this.lastUpdateTS = null;
        this.animationStatus = {
            ver: 0,
            frameRefreshRate: 1000,
            numOfFrames: 5,
            numOfKeyframes: 200,
            playStatus: "stopped",
            currFrameNum: 0,
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
        this.currKeyframeNum = 0;
        this.defaultRefreshRate = 1000;
    }

    getStatus() {
        return this.animationStatus;
    }

    getData () {
        return this.animationData;
    }

    play() {
        log.info("Animation", "Started play sequence");
        log.info("Debug", this.animationStatus.playStatus);

        if (this.animationStatus.playStatus !== "playing") {
            this._updateData(this.animationStatus.playStatus === "stopped");
            this.refreshInterval = setInterval(
                this._updateData.bind(this, false),
                this.animationStatus.frameRefreshRate
            );

            this.animationStatus.playStatus = "playing";
            this.animationStatus.ver += 1;
        }

        log.info("Animation", "Play sequence ended");
    }

    pause() {
        if (this.animationStatus.playStatus === "playing") {
            clearInterval(this.refreshInterval);
            log.info("Animation", "Interval cleared, paused at frame num" + this.animationStatus.currFrameNum);

            this.animationStatus.playStatus = "paused";
            this.animationStatus.ver += 1;
        }
    }

    reset() {
        clearInterval(this.refreshInterval);
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
    currentAnimation.reset();
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
