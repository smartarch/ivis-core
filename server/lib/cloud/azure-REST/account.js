const { getAuthHeaderObj } = require('./basics');
const axios = require('axios').default; //for parameter typings
const scope = 'https://management.azure.com/.default';

async function _continueLink(url, headers, extractor, target) {
    const data = await axios.get(url, headers).then(response => response.data);

    for (const subscription of extractor(data)) {
        target.push(subscription);
    };

    if(data.nextLink)
        await _continueLink(data.nextLink, headers, target);
    return;
}

async function getSubscriptions(tokenProvider) {
    let result = [];
    await _continueLink('https://management.azure.com/subscriptions?api-version=2020-01-01', await getAuthHeaderObj(tokenProvider, scope), obj => obj.value, result);
    return result;
}

async function getLocationList(subscriptionId, tokenProvider) {
    return await axios.get(`https://management.azure.com/subscriptions/${subscriptionId}/locations?api-version=2020-01-01`, await getAuthHeaderObj(tokenProvider, scope))
        .then(response => response.data);
}

module.exports.getSubscriptions = getSubscriptions;
module.exports.getLocationList = getLocationList;