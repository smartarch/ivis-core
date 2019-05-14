'use strict';
const em = require('./extension-manager');


// TODO better cids or ids? or need both?
function toQuery(sigSet, signals, params) {
    const columns = ['id', ...signals.map(sig => sig.cid)];

    // TODO params.search with params.columns[x].searchable

    const query = {
        sigSetCid: sigSet.cid,
        //filter: not necessary?
    };

    const docs = {
        limit: params.length,
        from: params.start,
        signals
    };

    const sort = [];

    for (const order of params.order) {
        sort.push({
            sigCid: columns[order.column],
            order: order.dir
        })
    }

    docs.sort = sort;

    query.docs = docs;

    return query;
}

module.exports.toQuery = toQuery;
