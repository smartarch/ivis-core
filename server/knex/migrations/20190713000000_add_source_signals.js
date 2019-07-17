const {SignalSource, SignalType} = require('../../../shared/signals');

exports.up = (knex, Promise) => (async () => {
    await knex.schema.table('signals', table => {
        table.string('source').notNullable().defaultTo(SignalSource.RAW);
    });

    await knex.table('signals').whereIn('type', ['derived_painless_date','derived_painless']).update({source: SignalSource.DERIVED});
    await knex.table('signals').where('type', 'derived_painless_date').update({type: SignalType.DATE_TIME});
    await knex.table('signals').where('type', 'derived_painless').update({type: SignalType.PAINLESS});
})();

exports.down = (knex, Promise) => (async () => {
})();
