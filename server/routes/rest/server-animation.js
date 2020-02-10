'use strict';

const router = require('../../lib/router-async').create();
const log = require('../../lib/log');

class AnimationTest {
    constructor() {
        this._animationReset();
    }

    getStatus() {
        return this.animationStatus;
    }

    getData () {
        return {
            animationData: this.animationData,
            nextKfRefreshIn: this.animationStatus.playStatus === "playing" ? this.nextKfRefreshIn : null,
        };
    }

    _updateData(begin) {
        const beginKeyframeNum = 3;

        if (begin) {
            this.animationData = [];
            for (let i = 0; i < beginKeyframeNum; i += 1) {
                this.animationData.push(this._advanceOneKeyframe());
            }
        } else {
            this.animationData = this._advanceOneKeyframe();
        }

        this.lastUpdateTS = Date.now();
        this.nextKfRefreshIn = this.defaultKfRefreshRate;
        this.refreshTimeout = setTimeout(this._updateData.bind(this, false), this.nextKfRefreshIn);
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

    //_setPlayInterval() {
    //    this.playInterval = setInterval(
    //        this._updateData.bind(this, false),
    //        this.animationStatus.keyframeRefreshRate
    //    );
    //}

    _animationReset() {
        this.lastUpdateTS = null;
        this.animationStatus = {
            ver: 0,
            keyframeRefreshRate: 5000,
            numOfFrames: 5,
            playStatus: "stopped",
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
        this.defaultKfRefreshRate = 5000;
        this.nextKfRefreshIn = 0;
    }

    play() {
        log.info("Animation", "Started play sequence");

        if (this.animationStatus.playStatus !== "playing") {
            log.info("Debug", this.animationStatus.playStatus);
            this.refreshTimeout = setTimeout(
                this._updateData.bind(this, this.animationStatus.playStatus === "stopped"),
                this.nextKfRefreshIn
            );

            this.animationStatus.playStatus = "playing";
            this.animationStatus.ver += 1;
        }

        //switch (oldPlayStatus) {
        //    case "paused":
        //        {
        //        log.info("Animation", "Paused branch");
        //            const timeDiff = Math.max(
        //                0,
        //                this.animationStatus.keyframeRefreshRate - (
        //                    this.pausedTS - this.lastUpdateTS
        //                )
        //            );

        //            this.playTimeout = setTimeout(() => {
        //                log.info("Animation", "Timeout running");
        //                this._updateData(false);
        //                this._setPlayInterval();
        //            }, timeDiff);

        //            this.pausedTS = null;
        //            break;
        //        }
        //    case "stopped":
        //        log.info("Animation", "stopped branch");

        //        this._updateData(true);
        //        this._setPlayInterval();
        //        break;
        //    default:
        //        log.info("Animation", "Default branch taken");
        //        break;
        //}


        log.info("Animation", "Play sequence ended");
    }

    pause() {
        if (this.animationStatus.playStatus === "playing") {
            clearTimeout(this.refreshTimeout);
            this.nextKfRefreshIn = this.defaultKfRefreshRate - (Date.now() - this.lastUpdateTS);
            log.info("Animation", "Timeout cleared, continuing in" + this.nextKfRefreshIn);

            this.animationStatus.playStatus = "paused";
            this.animationStatus.ver += 1;
        }
    }

    reset() {
        clearTimeout(this.refreshTimeout);
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
