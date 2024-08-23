const { Client } = require('@elastic/elasticsearch');
const config = require('../lib/config');

const host = config.elasticsearch.host || 'localhost';
const port = config.elasticsearch.port || '9200';
const protocol = 'http';

module.exports = new Client({
    node: `${protocol}://${host}:${port}`
});
