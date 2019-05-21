'use strict';
const em = require('./extension-manager');
const {SignalType} = require('../../shared/signals');


// TODO better cids or ids? or need both?
function toQuery(sigSet, signals, params) {
    const columns = [...signals.map(sig => sig.cid)];

    const query = {
        sigSetCid: sigSet.cid,
    };

    if (params.search.value !== '') {

        const strValue = '*' + params.search.value + '*';

        const filter = {
            type: 'or'
        };


        filter.children = [];

        // First is ID column which doesn't have sigCid
        for (let i = 1; i < params.columns.length; i++) {

            if (params.columns[i].searchable !== true) {
                continue;
            }

            if (signals[i - 1].type === SignalType.TEXT && signals[i - 1].type === SignalType.KEYWORD) {
                filter.children.push({
                    type: 'wildcard',
                    sigCid: columns[i - 1],
                    value: strValue
                });
            }
        }

        if (filter.children.length > 0) {
            query.filter = filter;
        }
    }

    const docs = {
        limit: params.length,
        from: params.start,
        signals: columns
    };

    const sort = [];

    for (const order of params.order) {

        if (order.column === 0) {
            continue;
        }

        sort.push({
            sigCid: columns[order.column - 1],
            order: order.dir
        })
    }

    docs.sort = sort;

    query.docs = docs;

    query.params = {withId: true};
    return query;
}

function fromQueryResult(result) {
    const res = result[0];
    return res;
}

module.exports.toQuery = toQuery;
module.exports.fromQueryResult = fromQueryResult;
