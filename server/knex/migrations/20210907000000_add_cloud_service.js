
exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.createTable('cloud_services', table => {
        table.increments('id').primary();
        table.string('name');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.string('credentials_description', 10000).defaultTo('');
    });

    const azure_description = JSON.stringify({
        fields: [
            {type: "text", name: "clientId", value: "", label: "Client ID"},
            {type: "text", name: "tenantId", value: "", label: "Tenant ID"},
            {type: "password", name: "clientSecret", value: "", label: "Client Secret"}
        ],
        check: {
            link: null,
            expected: null
        },
        helpHTML: "<ol><li>Start your computer</li><li>Start your browser</li><li>Get the credentials</li></ol>"
    });

    const test_description = JSON.stringify({
        fields: [
            {type: "text", name: "userID", value: "", label: "User ID"},
            {type: "text", name: "accessToken", value: "", label: "Client Token"}
        ],
        check: {
            link: null,
            expected: null
        },
        helpHTML: "<ol><li>Start your computer</li><li>Start your browser</li><li>Get the credentials</li></ol>"
    });

    await knex('cloud_services').insert({
        id: 1,
        name: 'Azure',
        credentials_description: azure_description
    });

    await knex('cloud_services').insert({
        id: 2,
        name: 'Test',
        credentials_description: test_description
    });
    
})();

exports.down = (knex, Promise) => (async() =>  {
    await knex.schema.dropTable('cloud_services');
})();
