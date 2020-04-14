const {getEntityTypes} = require("../../lib/entity-settings");

exports.up = (knex, Promise) => (async () => {

    await knex.raw('SET FOREIGN_KEY_CHECKS=0');

    const typeTables = Object.values(getEntityTypes()).map(type => type.entitiesTable);

    async function updateVirt(id) {
        const virtObj = {
            name: 'Virtual',
            description: 'Virtual namespace',
            namespace: null
        };

        const oldId = (await knex.table('namespaces').where(virtObj).first()).id;

        await knex.table('namespaces').where(virtObj).update({id: id});

        for (let tableName of typeTables) {
            await knex.table(tableName).where({
                namespace: oldId
            }).update({namespace: id});
        }
    }

    for (const tableName of typeTables) {
        await knex.schema.table(tableName, table => {
            table.dropForeign('namespace');
        });
    }
    await knex.schema.table('permissions_namespace', table => {
        table.dropForeign('entity');
    });
    await knex.schema.table('shares_namespace', table => {
        table.dropForeign('entity');
    });


    // Max signed int, otherwise alter will fail
    await updateVirt(2147483647);
    // No support for auto_increment on signed int type in knex
    await knex.schema.raw('ALTER TABLE `namespaces` MODIFY `id` int not null auto_increment;');

    for (const tableName of typeTables) {
        await knex.schema.alterTable(tableName, table => {
            if (tableName !== 'namespaces') {
                table.integer('namespace').notNullable().references('namespaces.id').alter();
            } else {
                table.integer('namespace').references('namespaces.id').alter();
            }
        });
    }
    await knex.schema.alterTable('shares_namespace', table => {
        table.integer('entity').notNullable().references(`namespaces.id`).onDelete('CASCADE').alter();
    });

    await knex.schema.alterTable('permissions_namespace', table => {
        table.integer('entity').notNullable().references(`namespaces.id`).onDelete('CASCADE').alter();
    });

    // New virtual namespace id
    await updateVirt(-1);

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async () => {
});