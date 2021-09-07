
exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.createTable('cloud_services', table => {
        table.increments('id').primary();
        table.string('name');
        table.timestamp('created').defaultTo(knex.fn.now());
    });

    await knex('cloud_services').insert({
        id: 1,
        name: 'Azure'
    });

    await knex('cloud_services').insert({
        id: 2,
        name: 'Test'
    });
    
})();

exports.down = (knex, Promise) => (async() =>  {
})();
