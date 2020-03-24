'use strict';

function getGlobalNamespaceId() {
    return 1;
}

function getVirtualNamespaceId() {
    // Max sql int value;
    return 4294967295;
}

module.exports = {
    getGlobalNamespaceId,
    getVirtualNamespaceId
};
