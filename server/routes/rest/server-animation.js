'use strict';

const router = require('../../lib/router-async').create();
const log = require('../../lib/log');

class AnimationTest {
    constructor() {
        this._animationReset();
    }

    _refresh() {
        this.status.position += 1;

        if (this.status.position % this.status.numOfFrames === 0) {
            this._updateData();
        }

        this.lastUpdateTS = Date.now();
    }

    _updateData() {
        const jump = 6;

        const nextKeyframeNum = Math.floor(this.status.position / this.status.numOfFrames);
        if (nextKeyframeNum === this.status.numOfKeyframes) {
            log.info("Debug...", this.data.currKeyframeData.circle.cx);
            this.reset();
            return;
        }

        this.data.currKeyframeNum = nextKeyframeNum;

        this.data.currKeyframeData = {
            circle: { cx: (this.data.currKeyframeNum * jump) + 10 }
        };
        this.data.nextKeyframeData = {
            circle: { cx: ((this.data.currKeyframeNum + 1) * jump) + 10 }
        };

        log.info("Debug", "Data update....Current keyframe:" + this.data.currKeyframeNum, (this.lastKeyframeChangeTS - Date.now()) / 1000);
        this.lastKeyframeChangeTS = Date.now();
        this.newDataIn = this.status.refreshRate * this.status.numOfFrames;
    }

    _animationReset() {
        this.lastUpdateTS = null;
        this.status = {
            ver: 0,
            refreshRate: 1000/24,
            numOfFrames: 120,
            numOfKeyframes: 30,
            isPlaying: false,
            didSeekOn: 0,
            position: 0,
        };

        this.data = {
            currKeyframeNum: 0,
            currKeyframeData: {
                circle: { cx: 10 }
            },
            nextKeyframeData: {
                circle: { cx: 16 }
            },
        };
    }

    getStatus() {
        return this.status;
    }

    getData () {
        return {data: this.data, newDataIn: this.status.isPlaying ? this.newDataIn : -1};
    }

    play() {
        log.info("Animation", "Started play sequence");
        log.info("Debug", this.status.playStatus);

        if (!this.status.isPlaying) {
            this.refreshInterval = setInterval(
                this._refresh.bind(this),
                this.status.refreshRate
            );

            this.newDataIn = this.status.refreshRate * (this.status.numOfFrames - (this.status.position % this.status.numOfFrames));
            this.status.isPlaying = true;
            this.status.ver += 1;
        }

        log.info("Animation", "Play sequence ended");
    }

    pause() {
        if (this.status.isPlaying) {
            clearInterval(this.refreshInterval);
            log.info("Animation", "Interval cleared, paused at frame num" + this.status.position);

            this.status.isPlaying = false;
            this.status.ver += 1;
        }
    }

    reset() {
        clearInterval(this.refreshInterval);
        this._animationReset();
    }

    seek(toFrameNum) {
        const wasPlaying = this.status.isPlaying;
        if (wasPlaying) {
            clearInterval(this.refreshInterval);
        }

        const toFrameNumLimited = Math.max(
            0, Math.min((this.status.numOfFrames * this.status.numOfKeyframes) - 1, toFrameNum)
        );

        log.info("Seek intended to:", toFrameNum, "limited to:", toFrameNumLimited);
        this.status.position = toFrameNumLimited;

        this._updateData();

        if (wasPlaying) {
            this.refreshInterval = setInterval(
                this._refresh.bind(this),
                this.status.refreshRate
            );
            this.newDataIn = this.status.refreshRate * (this.status.numOfFrames - (this.status.position % this.status.numOfFrames));
        }

        this.status.didSeekOn = this.status.ver + 1;
        this.status.ver += 1;
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
    log.info("Animation", `Change of speed to ${JSON.stringigfy(req.body)}`);
    res.sendStatus(200);
});

router.post('/animation/server/seek', (req, res) => {
    log.info("Animation", `Seek to ${JSON.stringify(req.body)}`);
    currentAnimation.seek(req.body.to);
    res.sendStatus(200);
});


log.info("Animation", `Animation routes mounted.`);



module.exports = router;
