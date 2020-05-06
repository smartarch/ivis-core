exports.up = (knex, Promise) => (async () => {

    await knex.raw('SET FOREIGN_KEY_CHECKS=0');

    const sigSets = await knex.table('signal_sets');
    for (const sigSet of sigSets) {
        sigSet.indexing = JSON.stringify({indexing: JSON.parse(sigSet.indexing)});
        await knex('signal_sets').where('id', sigSet.id).update(sigSet);
    }

    await knex.schema.table('signal_sets', table => {
        table.renameColumn('indexing', 'state');
        table.text('settings', 'longtext').notNullable();
    });

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async () => {
});