'use strict';

const router = require('../../lib/router-async').create();
const log = require('../../lib/log');

class AnimationTest {
    constructor() {
        this.refreshRate = 1000/25;
        this.jump = 1/60;
        this.endTs = 1000 * 60;

        this._animationReset();
    }

    _refresh() {
        this.status.position = Math.min(this.endTs, this.status.position + (this.refreshRate * this.status.playbackSpeedFactor));
        this._updateData();

        if (this.iteration % 500) log.info(this.status.position);

        if (this.status.position === this.endTs) {
            this.pause();
        }
    }

    _updateData() {
        this.status.realtimePosition = this.status.position / this.status.playbackSpeedFactor;
        this.status.data.mutables.circleCx = this.status.position * this.jump;
    }

    _animationReset() {
        this.status = {
            isPlaying: false,
            position: 0,
            realtimePosition: 0,
            playbackSpeedFactor: 1,
            data: {
                base: {
                    circle: { cx: {valueId: "circleCx"} }
                },
                mutables: {
                    circleCx: 0
                }
            }
        };
    }

    getStatus() {
        return this.status;
    }

    play() {
        if (!this.status.isPlaying && this.status.position !== this.endTs) {
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
            0, Math.min(this.endTs, toMs)
        );

        log.info("Debug", "Seek intended to:", toMs, "limited to:", toMsLimited);
        this.status.position = toMsLimited;

        this._updateData();

        if (wasPlaying) {
            this.refreshInterval = setInterval(
                this._refresh.bind(this),
                this.refreshRate
            );
        }
    }

    changeSpeed(factor) {
        this.status.playbackSpeedFactor = factor;
    }
}

let currentAnimation = new AnimationTest();

router.get('/animation/server/1/status', (req, res) => {
    res.status(200).json(currentAnimation.getStatus());
});

router.post('/animation/server/1/play', (req, res) => {
    currentAnimation.play();
    res.sendStatus(200);
});

router.post('/animation/server/1/pause', (req, res) => {
    currentAnimation.pause();
    res.sendStatus(200);
});

router.post('/animation/server/1/reset', (req, res) => {
    currentAnimation.reset();
    res.sendStatus(200);
});

router.post('/animation/server/1/changeSpeed', (req, res) => {
    log.info("Debug", `Change of speed to ${JSON.stringify(req.body)}`);
    currentAnimation.changeSpeed(req.body.to);
    res.sendStatus(200);
});

router.post('/animation/server/1/seek', (req, res) => {
    log.info("Debug", `Seek to ${JSON.stringify(req.body)}`);
    currentAnimation.seek(req.body.to);
    res.sendStatus(200);
});


module.exports = router;
