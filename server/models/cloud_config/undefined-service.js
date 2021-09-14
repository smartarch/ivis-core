'use strict';
function getUndefinedCredDesc() {
    throw new Error("Undefined Service!");
}

module.exports.getUndefinedCredDesc = getUndefinedCredDesc;