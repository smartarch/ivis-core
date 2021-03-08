exports.up = (knex, Promise) => (async () => {
    await knex.schema.table('signal_sets', table => {
        table.json('metadata');
    });
})();

exports.down = (knex, Promise) => (async () => {
});