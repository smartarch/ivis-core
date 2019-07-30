'use strict';

import lzString from "lz-string";

export function extractPermanentLink(location) {
    const searchParams = new URLSearchParams(location.search);

    let config;
    let state;

    if (searchParams.has('config')) {
        config = JSON.parse(lzString.decompressFromEncodedURIComponent(searchParams.get('config')));
    }

    if (searchParams.has('state')) {
        state = JSON.parse(lzString.decompressFromEncodedURIComponent(searchParams.get('state')));
    }

    return {config, state};
}

export function extractPermanentLinkAndRedirect(location, history) {
    const {config, state} = extractPermanentLink(location);

    const searchParams = new URLSearchParams(location.search);

    let anyChange = false;

    if (config) {
        searchParams.delete('config');
        anyChange = true;
    }

    if (state) {
        searchParams.delete('state');
        anyChange = true;
    }

    if (anyChange) {
        history.replace(location.pathname + '?' + searchParams.toString(), { permanentLinkConfig: config, permanentLinkState: state });
    }
}

export function needsToExtractPermanentLinkAndRedirect(location) {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.has('config') || searchParams.has('state');
}

export function createPermanentLinkData(config, state) {
    const permanentLink = {};

    if (config) {
        permanentLink.config = lzString.compressToEncodedURIComponent(JSON.stringify(config));
    }

    if (state) {
        permanentLink.state = lzString.compressToEncodedURIComponent(JSON.stringify(state));
    }

    return permanentLink;
}

export function createPermanentLink(url, config, state) {
    const configData = createPermanentLinkData(config, state);

    const newUrl = new URL(url);
    if (configData.config) {
        newUrl.searchParams.append('config', configData.config);
    }

    if (configData.state) {
        newUrl.searchParams.append('state', configData.state);
    }

    return newUrl.toString();
}

export function getPermanentLinkConfigFromLocationState(location) {
    return location.state && location.state.permanentLinkConfig;
}

export function getPermanentLinkStateFromLocationState(location) {
    return location.state && location.state.permanentLinkState;
}
