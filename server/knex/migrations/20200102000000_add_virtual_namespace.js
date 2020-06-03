const id = 4294967295;
exports.up = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');
    await knex('namespaces').insert({
        id: id,
        name: 'Virtual',
        description: 'Virtual namespace'
    });
    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async () => {
    await knex('namespaces').where('id', id).del();
});
