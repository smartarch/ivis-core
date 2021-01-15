"use strict";

const allowedKeysCreate = new Set(['cid', 'type', 'name', 'description', 'namespace', 'record_id_template', 'settings', 'kind']);
const allowedKeysUpdate = new Set(['name', 'description', 'namespace', 'record_id_template', 'settings', 'kind']);

module.exports = {
    allowedKeysCreate,
    allowedKeysUpdate
};

