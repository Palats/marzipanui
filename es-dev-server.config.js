const proxy = require('koa-proxies');

module.exports = {
    port: 8001,
    watch: true,
    nodeResolve: true,
    appIndex: 'index.html',
    middlewares: [
        proxy('/_generator', {
            target: 'http://localhost:9411',
        }),
    ],
};