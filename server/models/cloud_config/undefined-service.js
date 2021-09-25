'use strict';
function getUndefinedCredDesc() {
    throw new Error("Undefined Service!");
}

function getUndefinedPresetDescs() {
    throw new Error("Undefined Service!");
}

module.exports.getUndefinedCredDesc = getUndefinedCredDesc;
module.exports.getUndefinedPresetDescs = getUndefinedPresetDescs;