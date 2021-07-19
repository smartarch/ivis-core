'use strict';

const knex = require('./knex');
const signalSets = require('../models/signal-sets');
const es = require('./elasticsearch');
const moment = require('moment');
const shares = require('../models/shares');

function getSetIndexName(sigSetId) {
    return `signal_set_${sigSetId}`;
}

async function getSignalIndexField(context, signalSetId, signalField) {
    await shares.enforceEntityPermission(context, 'signalSet', signalSetId, 'view');
    const signals = await knex.transaction(async tx => {
        return await signalSets.getSignalByCidMapTx(tx, { id: signalSetId });
    });

    return `s${signals[signalField].id}`;
}

async function getSigSetBoundaries(signalSetId, tsField = 'ts') {
    const signals = await knex.transaction(async tx => {
        return await signalSets.getSignalByCidMapTx(tx, { id: signalSetId });
    });
    const tsSigCid = `s${signals[tsField].id}`;

    const first = await es.search({
        index: getSetIndexName(signalSetId),
        body: {
            query: {
                match_all: {},
            },
            size: 1,
            sort: {
                [tsSigCid]: 'asc'
            }
        }
    });

    const last = await es.search({
        index: `signal_set_${signalSetId}`,
        body: {
            query: {
                match_all: {},
            },
            size: 1,
            sort: {
                [tsSigCid]: 'desc'
            }
        }
    });

    if (!first.hits.hits[0] || !last.hits.hits[0]) {
        return {
            // we have to return non zero time interval
            first: '1900-01-01T00:00:00.000Z',
            last: '1900-01-02T00:00:00.000Z'
        };
    }

    return {
        first: first.hits.hits[0]['_source'][tsSigCid],
        last: last.hits.hits[0]['_source'][tsSigCid]
    };
}

async function estimateSigSetPeriodByCid(context, sigSetCid, tsField = 'ts') {
    const size = 1000;

    const signalSet = await signalSets.getByCid(context, sigSetCid);
    const tsSignal = await getSignalIndexField(context, signalSet.id, tsField);
    const res = await es.search({
        index: getSetIndexName(signalSet.id),
        body: {
            query: {
                match_all: {},
            },
            size: size,
            sort: {
                [tsSignal]: 'asc',
            }
        }
    });

    if (!res || !res.hits || !res.hits.hits || res.hits.hits.length <= 0) {
        // signal set appears to be empty, in which case we return Infinity
        return Infinity;
    }

    const timestamps = [];
    for (let hit of res.hits.hits) {
        const ts = hit['_source'][tsSignal];
        timestamps.push(moment(ts));
    }

    const diffs = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
        const diff = timestamps[i + 1].diff(timestamps[i]);
        diffs.push(diff);
    }

    diffs.sort();

    const median = diffs[Math.floor(diffs.length / 2)];

    return moment.duration(median);
}

async function getSigSetBoundariesByCid(context, signalSetCid, tsField = 'ts') {
    const signalSet = await signalSets.getByCid(context, signalSetCid)
    return await getSigSetBoundaries(signalSet.id, tsField);
}

async function calculateRMSE(context, from, to, sourceSetCid, predSetCid, valueField, interval = null) {
    // find the common subinterval of both predictions and real observation on
    // the given evaluation interval
    const b1 = await getSigSetBoundariesByCid(context, sourceSetCid);
    const b2 = await getSigSetBoundariesByCid(context, predSetCid);

    if (from < b1.first) {
        from = b1.first;
    }

    if (from < b2.first) {
        from = b2.first;
    }

    //
    if (to > b1.last) {
        to = b1.last;
    }

    if (to > b2.last) {
        to = b2.last;
    }

    // In case we were not given the aggregation interval, we have to select
    // it somehow.
    if (!interval && from < to) {
        const maxInterval = await findMaxInterval(from, to);

        // We now want to select the aggregation interval. There are two main things
        // to consider here. We want the aggregation to return less than 10000
        // buckets so that we don't have to paginate and so that we have some
        // reasonable upper limit on computation time.

        // We also don't want the interval to be much lower than the period of the
        // original timeseries, because that would make most of the buckets empty.

        // we estimate the period of predictions signal set - that is because it will
        // have either approximtely the same period as the source data or higher
        // (when the model is trained on some aggregation). We generally want similarly
        // sized or bigger buckets compared to the period - smaller buckets will not
        // help us as they will have null value
        const predPeriod = await estimateSigSetPeriodByCid(context, sourceSetCid);

        const selectedInterval = Math.min(maxInterval, predPeriod);
        interval = `${selectedInterval}ms`;
    }

    const { minArray: minArraySource, maxArray: maxArraySource, tsArray: tsArraySource } = await minMaxAgg(context, sourceSetCid, from, to, interval, valueField);
    const { minArray: minArrayPred, maxArray: maxArrayPred, tsArray: tsArrayPred } = await minMaxAgg(context, predSetCid, from, to, interval, valueField);

    fillValues(minArraySource, maxArraySource);
    fillValues(minArrayPred, maxArrayPred);

    let maxMAE = 0.0;
    let minMAE = 0.0;
    let maxMSE = 0.0;
    let minMSE = 0.0;
    const length = Math.min(minArraySource.length, minArrayPred.length);
    for (let i = 0; i < length; i++) {
        let dMax = Math.max(
            Math.abs(maxArraySource[i] - minArrayPred[i]),
            Math.abs(maxArrayPred[i] - minArraySource[i])
        );

        let dMin = Math.min(
            Math.abs(maxArraySource[i] - maxArrayPred[i]),
            Math.abs(minArraySource[i] - minArrayPred[i])
        );


        maxMAE += dMax;
        minMAE += dMin;
        maxMSE += dMax * dMax;
        minMSE += dMin * dMin;
    }

    maxMAE = maxMAE / length;
    minMAE = minMAE / length;

    maxMSE = maxMSE / length;
    minMSE = minMSE / length;

    return {
        minMAE,
        maxMAE,
        minMSE,
        maxMSE,
        from,
        to,
        interval
    };

    /** Returns the maximum aggregation interval in ms for an specified count
     *  of buckets. (Approximate)
     *
     */
    function findMaxInterval(from, to, maxSamples = 8000) {
        const timespan = moment.duration(moment(to).diff(moment(from)));

        return timespan.asMilliseconds() / maxSamples;
    }

    async function minMaxAgg(context, sigSetCid, minTs, maxTs, interval, valueField, tsField = 'ts') {
        const signalSet = await signalSets.getByCid(context, sigSetCid);
        const index = `signal_set_${signalSet.id}`;
        const signals = await knex.transaction(async tx => {
            return await signalSets.getSignalByCidMapTx(tx, { id: signalSet.id });
        });
        const valueEs = `s${signals[valueField].id}`;
        const tsEs = `s${signals[tsField].id}`;
        const query = {
            index: index,
            body: {
                //size: 0, // we don't need the actual records, only aggegations
                aggs: {
                    hist: {
                        date_histogram: {
                            field: tsEs,
                            interval: interval,
                        },
                        aggs: {
                            min_value: {
                                min: {
                                    field: valueEs
                                }
                            },
                            max_value: {
                                max: {
                                    field: valueEs
                                }
                            }
                        }
                    }
                }
            }
        }

        if (minTs && maxTs && minTs >= maxTs) {
            console.error(`minTs >= maxTs, minTs: ${minTs}, maxTs: ${maxTs}`);
        }

        if (!minTs && !maxTs) {
            query.body.query = { match_all: {} };
        } else {
            query.body.query = { range: { [tsEs]: {} } };
            if (minTs) {
                query.body.query.range[tsEs].gte = minTs;
            }
            if (maxTs) {
                query.body.query.range[tsEs].lt = maxTs;
            }
        }

        const results = await es.search(query);

        const minArray = [];
        const maxArray = [];
        const counts = [];
        const tsArray = [];

        const resValueField = 'value';
        for (let bucket of results.aggregations.hist.buckets) {
            minArray.push(bucket.min_value[resValueField]);
            maxArray.push(bucket.max_value[resValueField]);
            tsArray.push(bucket.key_as_string);
        }

        return { minArray, maxArray, tsArray };
    }

    function fillValues(minArray, maxArray) {
        // fill null values
        let lastMin = null;
        let lastMax = null;

        for (let i = 0; i < minArray.length; i++) {
            if (minArray[i]) {
                lastMin = minArray[i];
                lastMax = maxArray[i];
            } else {
                let nextMin = getNext(minArray, i);
                let nextMax = getNext(maxArray, i);

                let min = Math.min(lastMin, nextMin); // at least one is not null
                let max = Math.max(lastMax, nextMax);

                // fill the whole block of null values
                for (let j = i; j < minArray.length; j++) {
                    if (!minArray[j]) {
                        minArray[j] = min;
                        maxArray[j] = max;
                    } else {
                        break;
                    }
                }
            }
        }

        function getNext(array, i) {
            for (let j = i + 1; j < array.length; j++) {
                if (array[j]) {
                    return array[j];
                }
            }

            return null;
        }
    }
}

module.exports.getSigSetBoundaries = getSigSetBoundaries;
module.exports.calculateRMSE = calculateRMSE;