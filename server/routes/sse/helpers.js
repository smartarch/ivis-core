'use strict';

function initEventSource(res) {
    res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();

    res.write('retry: 5000\n\n');
    res.flush();
}

module.exports = {
   initEventSource
}