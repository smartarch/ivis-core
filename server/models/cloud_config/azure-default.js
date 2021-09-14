'use strict';

function getAzureCredDesc() {
    return {
        fields: [
            {type: "text", name: "clientId", value: "", label: "Client ID"},
            {type: "text", name: "tenantId", value: "", label: "Tenant ID"},
            {type: "text", name: "clientSecret", value: "", label: "Client Secret"},
            {type: "text", name: "subscriptionId", value: "", label: "Subscription ID"}
        ],
        check: {
            link: null,
            expected: null
        },
        helpHTML: "<ol><li>Start your computer</li><li>Start your browser</li><li>Get the credentials</li></ol>"
    };
}



module.exports.getAzureCredDesc = getAzureCredDesc;