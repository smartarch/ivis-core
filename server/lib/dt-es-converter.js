'use strict';
const em = require('./extension-manager');


// TODO better cids or ids? or need both?
function toQuery(sigSet, signals, params) {
    const columns = [...signals.map(sig => sig.cid)];

    // TODO params.search with params.columns[x].searchable

    const query = {
        sigSetCid: sigSet.cid,
        //filter: not necessary?
    };

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

    return query;
}

function fromQueryResult(result) {
    const res = result[0];
    return res;
}

module.exports.toQuery = toQuery;
module.exports.fromQueryResult = fromQueryResult;
