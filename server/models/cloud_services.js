'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');

const dtHelpers = require('../lib/dt-helpers');


async function _getByTx(tx, context, key, value, extraColumns = []) {
    const columns = ['id', 'name', ...extraColumns];

    const service = await tx('cloud_services').select(columns).where(key, value).first();

    return service;
}

async function _getBy(context, key, value, extraColumns = []) {
    return await knex.transaction(async tx => {
        return await _getByTx(tx, context, key, value, extraColumns);
    });
}


async function listDTAjax(context, params) {
    return await dtHelpers.ajaxList(
        params,
        builder => builder
            .from('cloud_services'),
        ['cloud_services.id', 'cloud_services.name']
    );
}

async function getById(context, id) {
    return await _getBy(context, 'id', id);
}

module.exports.listDTAjax = listDTAjax;
module.exports.getById = getById;