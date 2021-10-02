'use strict';
const { azureDefault } = require('./azure-default');

const getCredentialDescription = 'getCredDesc';
const getPresetDescriptions = 'getPresetDescs';
const getProxy = 'proxy';

function getServiceObj(type) {
    switch (type) {
        case 'azureDefault':
            return azureDefault;
        default: {
            console.error("Unsupported service. service type:");
            console.error(type);
            return null;
        }
    }
}

function _tryCall(type, funName) {
    let serviceObj = getServiceObj(type);
    if(!serviceObj) {
        return null;
    }

    if([getCredentialDescription, getPresetDescriptions, getProxy].indexOf(funName) === -1) {
        console.error("Unexpected function is required. ( " + funName + " )");
        return null;
    }

    if(!serviceObj[funName]) {
        console.error(funName + " function is not defined!");
        return null;
    }

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