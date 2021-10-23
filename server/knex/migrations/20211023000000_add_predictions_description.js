exports.up = (knex, Promise) => (async () => {
    await knex.schema.table('predictions', table => {
        table.text('description');
    });
})();

exports.down = (knex, Promise) => (async () => {
});