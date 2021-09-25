
exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.createTable('cloud_services', table => {
        table.increments('id').primary();
        table.string('name');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.string('service_type', 50).defaultTo('undefinedType');
        table.string('credential_values', 10000).defaultTo('');
    });

    await knex.schema.createTable('presets', table => {
        table.increments('id').primary();
        table.integer('service').unsigned().notNullable().references('cloud_services.id');
        table.string('name');
        table.string('description');
        table.string('preset_type').defaultTo('undefinedType');
        table.string('specification_values');
    });

    await knex('cloud_services').insert({
        id: 1,
        name: 'Azure',
        service_type: 'azureDefault',
        credential_values: '{}'
    });

    await knex('presets').insert({
        id: 1,
        service: 1,
        name: 'local',
        preset_type: 'local',
        description: 'Runs a Job on the same machine as this IVIS instance',
        specification_values: '{ local: true }'
});
})();

exports.down = (knex, Promise) => (async() =>  {
    await knex.schema.dropTable('cloud_services');
    await knex.schema.dropTable('presets');
})();
