'use strict';
const em = require('./extension-manager');
const {SignalType} = require('../../shared/signals');


/**
 * Create ES query from DT params.
 * Query is acceptable by
 * @param sigSet
 * @param signals
 * @param params
 * @returns {{sigSetCid: *}}
 */
function toQuery(sigSet, signals, params) {
    const columns = [...signals.map(sig => sig.cid)];

    const query = {
        sigSetCid: sigSet.cid,
        params: {}
    };

    if (params.search.value !== '') {

        const strValue = '*' + params.search.value + '*';

        const filter = {
            type: 'or'
        };


        filter.children = [];

        // zero is ID column which doesn't have sigCid
        for (let i = 1; i < params.columns.length; i++) {

            if (params.columns[i].searchable !== true) {
                continue;
            }

            if (signals[i - 1].type === SignalType.TEXT || signals[i - 1].type === SignalType.KEYWORD) {
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

    // DocSort is used for auto generated ids, because they don't have id field, therefore would be imposisble
    // to sort them, so it fallbacks on _doc sort and lowers priority
    let docSort = null;
    for (const order of params.order) {
        if (order.column === 0) {
            sort.push({
                field: 'id',
                order: order.dir
            });

            docSort = {
                field: '_doc',
                order: order.dir
            };
        } else {
            sort.push({
                // coluumns are without id therefore shifted by 1
                sigCid: columns[order.column - 1],
                order: order.dir
            });
        }
    }

    if (docSort) {
        sort.push(docSort);
    }

    docs.sort = sort;

    query.docs = docs;

    query.params.withId = true;
    return query;
}

/**
 *
 * @param result
 * @param signals
 * @return Object {total: <Total number of documents>, data: <Batch of data from query>}
 */
function fromQueryResult(result, signals) {
    const res = {};
    const data = [];
    for (let doc of result[0].docs) {
        const record = [];
        record.push(doc['id']);
        for (let signal of signals) {
            record.push(doc[signal.cid]);
        }
        data.push(record);
    }
    res.data = data;
    res.total = result[0].total;
    return res;
}

module.exports.toQuery = toQuery;
module.exports.fromQueryResult = fromQueryResult;
