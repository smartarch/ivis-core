'use strict';

const em = require('../lib/extension-manager');

const builtinTemplates = {
    "hello": {
        name: "Hello World",
        params: [{
            "id": "message",
            "type": "string",
            "label": "Message",
            "help": "The message to display"
        }],
    }
};

/*
Sample builtin template:
'id': {
    name: 'XXX',
    params: []
}

To add templates from a wrapper, use:

em.on('builtinTemplates.add', builtinTemplates => {
    builtinTemplates['id'] = {
        name: 'XXX',
        params: []
    };
});

And also create the routes as in /client/src/templates/builtin-templates-root.js
*/


em.invoke('builtinTemplates.add', builtinTemplates);

function list() {
    return builtinTemplates;
}

module.exports.list = list;
