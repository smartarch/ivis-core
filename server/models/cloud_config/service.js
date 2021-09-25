'use strict';
const { azureDefault } = require('./azure-default');

const getCredentialDescription = 'getCredDesc';
const getPresetDescriptions = 'getPresetDescs';
const getProxy = 'proxy';

function getServiceObj(type) {
    switch (type) {
        case 'azureDefault':
            return azureDefault;
        default:
            throw new Error("Unsupported service");
    }
}

function _tryCall(type, funName) {
    let serviceObj = getServiceObj(type);

    if([getCredentialDescription, getPresetDescriptions, getProxy].indexOf(funName) === -1)
        throw new Error("Unexpected function is required. ( " + funName + " )");

    if(!serviceObj[funName])
        throw new Error(funName + " function is not defined!");

    return serviceObj[funName]()
}

function getCredDescByType(type) {
    return _tryCall(type, getCredentialDescription);
}

function getPresetDescsByType(type) {
    return _tryCall(type, getPresetDescriptions);
}

function getProxyByType(type) {
    return _tryCall(type, getProxy);
}

module.exports.getCredDescByType = getCredDescByType;
module.exports.getPresetDescsByType = getPresetDescsByType;
module.exports.getProxyByType = getProxyByType