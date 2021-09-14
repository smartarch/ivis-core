
exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.createTable('cloud_services', table => {
        table.increments('id').primary();
        table.string('name');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.string('service_type', 50).defaultTo('undefinedType');
        table.string('credential_values', 10000).defaultTo('');
    });

    await knex('cloud_services').insert({
        id: 1,
        name: 'Azure',
        service_type: 'azureDefault',
        credential_values: '{}'
    });
})();

exports.down = (knex, Promise) => (async() =>  {
    await knex.schema.dropTable('cloud_services');
})();
