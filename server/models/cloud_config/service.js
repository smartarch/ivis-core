'use strict';
const { getUndefinedCredDesc } = require('./undefined-service');
const { getAzureCredDesc } = require('./azure-default');

function getCredDescByType(type) {
    let resultFunc = getUndefinedCredDesc;

    switch (type) {
        case 'azureDefault':
            resultFunc = getAzureCredDesc;
            break;
    }

    return resultFunc();
}

module.exports.getCredDescByType = getCredDescByType;