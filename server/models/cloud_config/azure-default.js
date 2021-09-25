'use strict';
const {TokenProvider} = require('../../lib/cloud/azure-REST/basics');
const {getSubscriptions, getLocationList} = require('../../lib/cloud/azure-REST/account');

const listSubscriptions = 'subscription-list';
const listLocations = 'location-list';
const proxyObj = {};

proxyObj[listSubscriptions] = async ({clientId, tenantId, clientSecret}, extraData) => {
    const tokenProvider = new TokenProvider(clientId, tenantId, clientSecret);
    const subscriptions = await getSubscriptions(tokenProvider);
    const result = subscriptions.map(sub => [sub.displayName, sub.subscriptionId]);
    return result;
}

proxyObj[listLocations] = async ({clientId, tenantId, clientSecret}, {subscriptionId}) => {
    const tokenProvider = new TokenProvider(clientId, tenantId, clientSecret);
    const locations = await getLocationList(subscriptionId, tokenProvider);
    const result = locations.value.map(sub => [sub.displayName, sub.name]);
    return result;
}


const azureDefault = {
    getCredDesc: () => (
        // this object defines the credentials
        {
        fields: [
            // type - input type to be used
            // label - text displayed next to the input element
            // name - id of the input element, also impacts how the final data is stored in the database
            // stringified {clientId: "val", tenantId: "val", ... } in this case
            {type: "text", name: "clientId", label: "Client ID"},
            {type: "text", name: "tenantId", label: "Tenant ID"},
            {type: "text", name: "clientSecret", label: "Client Secret"},
        ],
        check: {
            link: null,
            expected: null
        },
        helpHTML: "<ol><li>Start your computer</li><li>Start your browser</li><li>Get the credentials</li></ol>"
    }),
    getPresetDescs: () => (
        // this object defines preset types (keys)
        // and the preset type's properties (values, similar to credentials description)
        // TODO: add special data (rest url to call for information, ...)
        // TODO: consider removing type (these inputs are determined by the preset type)
        {
            "azureLocationSize": {
                fields: [
                    {name: "subscriptionId", type: "text", label: "Subscription ID", dataRequest: listSubscriptions},
                    {name: "location", type: "text", label: "Location", dataRequest: listLocations},
                    {name: "vm_size", type: "text", label: "Virtual machine size"}
                ],
                description: "Default Azure preset (defined by VM size and location)",
                helpHTML: "<b>Please try to select as little unique locations as possible accross one service." +
                    " Selecting too many locations poses a risk of exceeding Azure limits on virtual networks.</b>"
            },
            "otherTypex": {
                fields: [
                    {name: "theName", type: "text", label: "Label 1"}
                ],
                description: "Other preset type",
            }
        }
    ),
    proxy: () => proxyObj
}


module.exports.azureDefault = azureDefault;