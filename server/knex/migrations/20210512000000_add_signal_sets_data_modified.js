exports.up = (knex, Promise) => (async () => {
    await knex.schema.table('signal_sets', table => {
        table.datetime('data_modified').notNullable().defaultTo('1000-01-01 00:00:00');
    });
})();

exports.down = (knex, Promise) => (async () => {
});