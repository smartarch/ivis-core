'use strict';

const em = require('./lib/extension-manager');
const emCommonDefaults = require('../shared/em-common-defaults');
const config = require('./lib/config');
const translate = require('./lib/translate');
const knex = require('./lib/knex');
const log = require('./lib/log');
const https = require('https');
const http = require('http');
const fs = require('fs');
const shares = require('./models/shares');
const templates = require('./models/templates');
const tasks = require('./models/tasks');
const builder = require('./lib/builder');
const taskHandler = require('./lib/task-handler');
const alertsHandler = require('./lib/alerts-event-handler')
const indexer = require('./lib/indexers/' + config.indexer);
const appBuilder = require('./app-builder');
const {AppType} = require('../shared/app');
const bluebird = require('bluebird');
const savePdf = require('./lib/pdf-export');

emCommonDefaults.setDefaults(em);

if (config.examples.serverMonitorEnabled === true) {
    const serverMonitorAnimation = require('../examples/animations/server-monitor').create();
    em.set('animation.monitor', serverMonitorAnimation);
}

async function initAndStart() {
    function createServer(appType, appName, host, port, isHttps, certsConfig, callback) {
        const app = appBuilder.createApp(appType);
        app.set('port', port);

        let server;

        if (isHttps) {
            const options = {
                key: fs.readFileSync(__dirname + '/' + certsConfig.serverKey),
                cert: fs.readFileSync(__dirname + '/' + certsConfig.serverCert),
                ca: certsConfig.caCert && fs.readFileSync(__dirname + '/' + certsConfig.caCert),
                crl: certsConfig.crl && fs.readFileSync(__dirname + '/' + certsConfig.crl),
                requestCert: !!certsConfig.caCert,
                rejectUnauthorized: false
            };

            server = https.createServer(options, app);

        } else {
            server = http.createServer({}, app);
        }

        server.on('listening', () => {
            const addr = server.address();
            log.info('Express', `WWW server [${appName}] listening on ${isHttps ? "HTTPS" : "HTTP"} port ${addr.port}`);
        });

        em.invoke('server.setup', server, app, appType);

        server.listen(port, host, callback);
    }

    const createServerAsync = bluebird.promisify(createServer);


    await knex.migrate.latest();

    await em.invokeAsync('knex.migrate');

    await shares.regenerateRoleNamesTable();
    await shares.rebuildPermissions();

    await savePdf.init();
    await builder.init();
    await indexer.init();
    await taskHandler.init();
    await alertsHandler.init();
    await templates.compileAll();
    await tasks.compileAll();

    await em.invokeAsync('services.start');

    await createServerAsync(AppType.TRUSTED, 'trusted', config.www.host, config.www.trustedPort, config.www.trustedPortIsHttps, config.certs.www);
    await createServerAsync(AppType.SANDBOXED, 'sandbox', config.www.host, config.www.sandboxPort, config.www.sandboxPortIsHttps, config.certs.www);
    await createServerAsync(AppType.API, 'api', config.www.host, config.www.apiPort, config.www.apiPortIsHttps, config.certs.api);

    log.info('Service', 'All services started');
    appBuilder.setReady();
}

initAndStart().catch(err => {
    log.error('Main', err);
    process.exit(1);
});
