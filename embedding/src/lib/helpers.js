'use strict';

export function restCall(method, url, data, callback) {
    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = () => {
        if (xhttp.readyState === 4 && xhttp.status === 200) {
            callback(xhttp.responseText ? JSON.parse(xhttp.responseText) : undefined);
        }
    };

    xhttp.open(method, url);
    xhttp.setRequestHeader("Content-type", "application/json");

    xhttp.send(data ? JSON.stringify(data) : null);
}


export function getAnonymousSandboxUrl(ivisSandboxUrlBase, path) {
    return ivisSandboxUrlBase + 'anonymous/' + (path || '');
}


export function getSandboxUrl(ivisSandboxUrlBase, accessToken,path) {
    return ivisSandboxUrlBase + accessToken + '/' + (path || '');
}


