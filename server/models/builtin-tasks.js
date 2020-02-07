'use strict';

const em = require('../lib/extension-manager');

const aggregationTask = {
    name: 'aggregation',
    description:'',
    type: '',
    settings:{
        params:[],
        code: `
        print('aggs')
        `
    },
    namespace: 0
};

const builtinTasks = {
    aggregationTask
};

/*
Sample builtin task:
'id': {
    name: 'XXX',
    params: []
}
 */

em.invoke('builtinTasks.add',builtinTasks);

function list() {
    return builtinTasks;
}

module.exports.list = list;
