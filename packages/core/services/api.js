const fs = require('fs');
const path = require('path');
const ApiGatewayService = require('moleculer-web');

module.exports = {
  mixins: [ApiGatewayService],
  settings: {
    httpServerTimeout: 300000,
    cors: {
      origin: '*',
      methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
      exposedHeaders: '*',
    },
    routes: [
      {
        path: '/favicon.ico',
        aliases: {
          'GET /': 'api.favicon',
        },
      },
    ],
  },
  actions: {
    favicon(ctx) {
      ctx.meta.$responseType = 'image/x-icon';
      return fs.readFileSync(path.resolve(__dirname, '../static/favicon.ico'));
    },
  },
  methods: {
    authenticate(ctx, route, req, res) {
      if (req.headers.signature) {
        return ctx.call('signature.authenticate', { route, req, res });
      } else {
        return ctx.call('auth.authenticate', { route, req, res });
      }
    },
    authorize(ctx, route, req, res) {
      if (req.headers.signature) {
        return ctx.call('signature.authorize', { route, req, res });
      } else {
        return ctx.call('auth.authorize', { route, req, res });
      }
    },
  },
};
