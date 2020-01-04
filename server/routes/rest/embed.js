'use strict';

const passport = require('../../lib/passport');
const users = require('../../models/users');
const shares = require('../../models/shares');

const router = require('../../lib/router-async').create();

router.putAsync('/embedded-entity-renew-restricted-access-token', passport.loggedIn, async (req, res) => {
    const method =  req.user.restrictedAccessMethod;
    if ((method === 'panel' || method === 'template')
        && req.user.restrictedAccessParams.renewableBySandbox) {
        await users.refreshRestrictedAccessToken(req.context, req.body.token);
        return res.json();

    } else {
        shares.throwPermissionDenied();
    }
});


module.exports = router;
