const {getVirtualNamespaceId} = require("../../../shared/namespaces");

exports.up = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');
    await knex('namespaces').insert({
        id: getVirtualNamespaceId(),
        name: 'Virtual',
        description: 'Virtual namespace'
    });
    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async () => {
    await knex('namespaces').where('id', getVirtualNamespaceId()).del();
});
