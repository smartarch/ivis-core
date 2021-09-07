'use strict';

const passport = require('../../lib/passport');

const router = require('../../lib/router-async').create();

router.postAsync('/cloud_services-table', passport.loggedIn, async (req, res) => {
    // TODO: get data from database
    const result = {
        draw: 1,
        recordsTotal: 2,
        recordsFiltered: 2,
        data:
            [[0, 'Azure'], [1, 'Test']]};

    return res.json(result);
});


module.exports = router;