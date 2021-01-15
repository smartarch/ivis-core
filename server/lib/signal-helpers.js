"use strict";
const em = require('./extension-manager');

const allowedKeysCreate = new Set(['cid', 'name', 'description', 'type', 'source', 'set', 'indexed', 'settings', 'namespace', 'weight_list', 'weight_edit', ...em.get('models.signals.extraKeys', [])]);
const allowedKeysUpdate = new Set(['cid', 'name', 'description', 'type', 'source', 'indexed', 'settings', 'namespace', 'weight_list', 'weight_edit', ...em.get('models.signals.extraKeys', [])]);

module.exports = {
    allowedKeysCreate,
    allowedKeysUpdate
};
