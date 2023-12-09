const fs = require('fs');
const path = require('path');
const ApiGatewayService = require('moleculer-web');
const CONFIG = require('../config/config');

module.exports = {
  mixins: [ApiGatewayService],
  settings: {
    port: CONFIG.PORT,
    httpServerTimeout: 300000,
    cors: {
      origin: '*',
      methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
      exposedHeaders: '*'
    },
    routes: [
      {
        name: 'favicon',
        path: '/favicon.ico',
        aliases: {
          'GET /': 'api.favicon'
        }
      },
      {
        name: 'redirectToFront',
        path: '/',
        aliases: {
          'GET /': 'api.redirectToFront'
        }
      }
    ]
  },
  actions: {
    favicon(ctx) {
      ctx.meta.$responseType = 'image/x-icon';
      return fs.readFileSync(path.resolve(__dirname, '../static/favicon.ico'));
    },
    redirectToFront(ctx) {
      ctx.meta.$statusCode = 302;
      ctx.meta.$location = CONFIG.FRONTEND_URL;
    }
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
    // Overwrite optimization method to put catchAll routes at the end
    // See https://github.com/moleculerjs/moleculer-web/issues/335
    optimizeRouteOrder() {
      this.routes.sort(a => (a.opts.catchAll ? 1 : -1));
      this.aliases.sort(a => (a.route.opts.catchAll ? 1 : -1));
    }
  }
};
