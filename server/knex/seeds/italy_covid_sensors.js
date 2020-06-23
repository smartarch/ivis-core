'use strict';

const moment = require('moment');
const https = require('https');
const {getColumnName, getTableName} = require('../../models/signal-storage');
const {SignalType} = require('../../../shared/signals');

const insertLimit = 10000;

async function loadJSON(url) {
    return new Promise((resolve) => {
        https.get(url, res => {
            let rawData = '';
            res.on('data', chunk => { rawData += chunk; });
            res.on('end', () => {
                resolve(JSON.parse(rawData));
            });
        });
    });
}

const urls = {
    index: 'https://open-covid-19.github.io/data/v2/index.json',
    demographics: 'https://open-covid-19.github.io/data/v2/demographics.json',
    epidemiology: 'https://open-covid-19.github.io/data/v2/epidemiology.json',
};

exports.seed = (knex) => (async () => {
    const [indexTable, demographicsTable, epidemiologyTable] = await Promise.all([loadJSON(urls.index), loadJSON(urls.demographics), loadJSON(urls.epidemiology)]);

    const italyFilter = (idxMap) => (datum => datum[idxMap.key].startsWith('IT'));
    const regionFilter = (idxMap, regionName) => (datum => datum[idxMap.key] === regionName);

    function preprocessData(table) {
        const idxMap = {};
        table.columns.map((columnName, idx) => idxMap[columnName] = idx);

        const newData = table.data.filter(italyFilter(idxMap)).map(datum => {
            datum[idxMap.key] = datum[idxMap.key].toLowerCase()
            return datum;
        });

        return {idxMap, data: newData};
    }

    function eliminateNegativeValues(idxMap, data, inidices) {
        const negatives = {};
        for (const idx of inidices) {
            negatives[idx] = 0;
        }

        for (let i = data.length - 1; i >= 0; i--) {
            const row = data[i];

            for (const j of inidices) {
                if (negatives[j] === 0 && row[j] >= 0) continue;

                if (row[j] === null) row[j] = 0;
                row[j] += negatives[j];
                negatives[j] = 0;

                if (row[j] < 0) {
                    negatives[j] = row[j];
                    row[j] = 0;
                }

            }
        }
    }

    const {idxMap: indexMap, data: index} = preprocessData(indexTable);
    const {idxMap: demographicsMap, data: demographics} = preprocessData(demographicsTable);
    const {idxMap: epidemiologyMap, data: epidemiology} = preprocessData(epidemiologyTable);

    const regionKeys = index.map(datum => datum[indexMap.key]);
    const regionNameMap = index.reduce((acc, datum) => Object.assign(acc,
            {
                [datum[indexMap.key]]:
                    datum[indexMap.subregion1_name] || datum[indexMap.country_name]
            }
        ),
        {}
    );

    const regionPopulationMap = demographics.reduce((acc, datum) => Object.assign(acc,
                {
                    [datum[demographicsMap.key]]:
                        datum[demographicsMap.population]
                }
            ),
            {}
        );

    const epidemiologyByRegion = {};
    for (const regionKey of regionKeys) {
        epidemiologyByRegion[regionKey] = epidemiology.filter(regionFilter(epidemiologyMap, regionKey));

        eliminateNegativeValues(epidemiologyMap, epidemiologyByRegion[regionKey], [epidemiologyMap.new_confirmed, epidemiologyMap.new_deceased, epidemiologyMap.new_recovered]);
    }


    async function createSigSet(sigSetCid, data, idxMap) {
        console.log(`Creating new signal set with cid: ${sigSetCid}`);

        async function deletePrevious() {
            const sigSet = await knex('signal_sets').where({cid: sigSetCid}).first();

            if (sigSet) {
                console.log(`Deleting signal set with cid ${sigSet.cid}`);
                await knex('signals').where({set: sigSet.id}).del();

                await knex.schema.dropTableIfExists(getTableName(sigSet));
                await knex('signal_sets').where({cid: sigSetCid}).del();
            }
        }

        const tsCid = 'ts';
        const fields = ['population', 'new_confirmed', 'new_negative', 'new_tested', 'new_deceased', 'new_recovered', 'new_active_cases',
                                    'total_confirmed', 'total_negative', 'total_tested', 'total_deceased', 'total_recovered', 'total_active_cases'];

        await deletePrevious();

        const sigSet = {
            cid: sigSetCid,
            name: regionNameMap[sigSetCid],
            indexing: JSON.stringify({status: 1}),
            namespace: 1
        };
        const ids = await knex('signal_sets').insert(sigSet);
        sigSet.id = ids[0];


        const idMap = {};

        idMap[tsCid] = await knex('signals').insert({
            cid: tsCid,
            name: 'Timestamp',
            type: SignalType.DATE_TIME,
            settings: JSON.stringify({}),
            set: sigSet.id,
            namespace: 1,
        });

        for (const fieldCid of fields) {
            idMap[fieldCid] = await knex('signals').insert({
                cid: fieldCid,
                name: fieldCid.charAt(0).toUpperCase() + fieldCid.substring(1).split('_').join(' '),
                type: SignalType.INTEGER,
                settings: JSON.stringify({}),
                set: sigSet.id,
                namespace: 1
            });
        }

        const signalTableName = getTableName(sigSet);
        await knex.schema.createTable(signalTableName, table => {
            table.increments('id');
            table.specificType(getColumnName(idMap[tsCid]), 'datetime(0)').notNullable().index();


            for (const fieldCid of fields) {
                table.specificType(getColumnName(idMap[fieldCid]), 'int');
            }
        });


        function *rowGenerator() {
            const population = regionPopulationMap[sigSetCid];
            let recovered_sum = 0;

            for (const row of data) {
                const new_confirmed = row[idxMap.new_confirmed] || 0;
                const new_tested = Math.max(row[idxMap.new_tested], new_confirmed);

                const new_deceased = row[idxMap.new_deceased] || 0;
                const new_recovered = row[idxMap.new_recovered] || 0;

                recovered_sum += new_recovered;

                const total_confirmed = row[idxMap.total_confirmed] || 0;
                const total_tested = Math.max(row[idxMap.total_tested], total_confirmed);

                const total_deceased = row[idxMap.total_deceased] || 0;
                const total_recovered = recovered_sum;

                yield {
                    [getColumnName(idMap[tsCid])]: moment.utc(row[idxMap.date]).toDate(),
                    [getColumnName(idMap.population)]: population - total_deceased,

                    [getColumnName(idMap.new_confirmed)]: new_confirmed,
                    [getColumnName(idMap.new_tested)]: new_tested,
                    [getColumnName(idMap.new_negative)]: new_tested - new_confirmed,

                    [getColumnName(idMap.new_deceased)]: new_deceased,
                    [getColumnName(idMap.new_recovered)]: new_recovered,
                    [getColumnName(idMap.new_active_cases)]: new_confirmed - new_deceased - new_recovered,

                    [getColumnName(idMap.total_confirmed)]: total_confirmed,
                    [getColumnName(idMap.total_tested)]: total_tested,
                    [getColumnName(idMap.total_negative)]: total_tested - total_confirmed,

                    [getColumnName(idMap.total_deceased)]: total_deceased,
                    [getColumnName(idMap.total_recovered)]: total_recovered,
                    [getColumnName(idMap.total_active_cases)]: total_confirmed - total_deceased - total_recovered,
                };

            }
        }


        let rows = [];
        for (const row of rowGenerator()) {
            rows.push(row);

            if (rows.length >= insertLimit) {
                console.log(`Inserting ${rows.length} to signal set ${sigSet.cid}`);
                await knex(signalTableName).insert(rows);
                rows = [];
            }
        }

        if (rows.length > 0) {
            console.log(`Inserting ${rows.length} to signal set ${sigSet.cid}`);
            await knex(signalTableName).insert(rows);
        }
    }

    for (const regionKey of regionKeys) {
        await createSigSet(regionKey, epidemiologyByRegion[regionKey], epidemiologyMap);
    }

})();
