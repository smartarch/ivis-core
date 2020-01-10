const router = require('../../lib/router-async').create();
const log = require('../../lib/log');


router.get('/animation/server/init', (req, res) => {
    log.info("Animation", `user agent: ${req.get('user-agent')}`);
    res.json({ msg: "ahoj"});
});

router.get('/animation/server/status', (req, res) => {

});


router.post('/animation/server/play', (req, res) => {

});

router.post('/animation/server/pause', (req, res) => {

});

router.post('/animation/server/reset', (req, res) => {

});

router.post('/animation/server/changeSpeed', (req, res) => {

});

router.post('/animation/server/seek', (req, res) => {

});


log.info("Animation", `Animation routes mounted.`);



module.exports = router;
