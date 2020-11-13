exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.table('alerts', table => {
        table.integer('sortsig').unsigned().references('signals.id');
    });
})();

exports.down = (knex, Promise) => (async() =>  {
})();
