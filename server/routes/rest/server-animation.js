'use strict';

const router = require('../../lib/router-async').create();
const log = require('../../lib/log');

class AnimationTest {
    constructor() {
        this.refreshRate = 1000/6;
        this.jump = 3;
        this.maxIteration = 24 * 4;

        this._animationReset();
    }

    _refresh() {
        this.iteration += this.status.speedFactor;
        this._updateData();
    }

    _updateData() {
        this.status.position = this.iteration * this.refreshRate;
        this.status.data.mutables["0"] = this.iteration * this.jump;
    }

    _animationReset() {
        this.iteration = 0;

        this.status = {
            isPlaying: false,
            position: 0,
            length: this.refreshRate * this.maxIteration,
            speedFactor: 1,
            data: {
                base: {
                    circle: { cx: {valueId: "0"} }
                },
                mutables: {
                    "0": 0
                }
            }
        };
    }

    getStatus() {
        return this.status;
    }

    play() {
        if (!this.status.isPlaying) {
            this.refreshInterval = setInterval(
                this._refresh.bind(this),
                this.refreshRate
            );

            this.status.isPlaying = true;
        }
    }

    pause() {
        if (this.status.isPlaying) {
            clearInterval(this.refreshInterval);
            log.info("Debug", "Interval cleared, paused at " + this.status.position);

            this.status.isPlaying = false;
        }
    }

    reset() {
        clearInterval(this.refreshInterval);
        this._animationReset();
    }

    seek(toMs) {
        const wasPlaying = this.status.isPlaying;
        if (wasPlaying) {
            clearInterval(this.refreshInterval);
        }

        const toMsLimited = Math.max(
            0, Math.min(this.status.length, toMs)
        );

        log.info("Debug", "Seek intended to:", toMs, "limited to:", toMsLimited);
        this.iteration = toMsLimited / this.refreshRate;

        this._updateData();

        if (wasPlaying) {
            this.refreshInterval = setInterval(
                this._refresh.bind(this),
                this.status.refreshRate
            );
        }
    }

    changeSpeed(factor) {
        this.status.speedFactor = factor;
    }
}

let currentAnimation = new AnimationTest();

router.get('/animation/server/status', (req, res) => {
    res.status(200).json(currentAnimation.getStatus());
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
    log.info("Debug", `Change of speed to ${JSON.stringify(req.body)}`);
    currentAnimation.changeSpeed(req.body.to);
    res.sendStatus(200);
});

router.post('/animation/server/seek', (req, res) => {
    log.info("Debug", `Seek to ${JSON.stringify(req.body)}`);
    currentAnimation.seek(req.body.to);
    res.sendStatus(200);
});


module.exports = router;
