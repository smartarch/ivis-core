exports.up = (knex, Promise) => (async () => {
    await knex.schema.table('tasks', table => {
        table.string('source').defaultTo('user');
    });

})();

exports.down = (knex, Promise) => (async () => {
    await knex.schema.table('tasks', table => {
        table.dropColumn('source');
    });
})();
