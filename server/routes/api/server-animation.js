t router = require('../../lib/router-async').create();

router.get(init, (req, res) => {
    res.send({ "msg": "ahoj"});
});

router.get(status, (req, res) => {

});


router.post(play, (req, res) => {

});

router.post(pause, (req, res) => {

});

router.post(reset, (req, res) => {

});

router.post(changeSpeed, (req, res) => {

});

router.post(seek, (req, res) => {

});



module.exports = router;
