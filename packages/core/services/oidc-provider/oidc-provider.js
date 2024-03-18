const Redis = require('ioredis');
const { delay } = require('@semapps/ldp');
const { Errors: E } = require('moleculer-web');
const RedisAdapter = require('./adapter');
const baseConfig = require('./base-config');
const fetch = require('node-fetch');

module.exports = {
  name: 'oidc-provider',
  settings: {
    baseUrl: undefined,
    frontendUrl: undefined,
    redisUrl: undefined,
    cookieSecret: 'COOKIE-SECRET'
  },
  dependencies: ['jwk', 'api'],
  async started() {
    // Dynamically import Provider since it's an ESM module
    const { default: Provider } = await import('oidc-provider');

    this.client = new Redis(this.settings.redisUrl, { keyPrefix: 'oidc:' });

    const { privateJwk } = await this.broker.call('jwk.get');

    const config = baseConfig(this.settings, privateJwk);

    config.adapter = name => new RedisAdapter(name, this.client);

    // See https://github.com/panva/node-oidc-provider/blob/main/recipes/client_based_origins.md
    config.clientBasedCORS = (ctx, origin, client) => {
      // TODO validate CORS based on client
      console.log('origin, client', origin, client);
      return true;
    };

    this.oidc = new Provider(this.settings.baseUrl, config);

    // Allow provider to interpret reverse proxy headers.
    this.oidc.proxy = true;

    await this.broker.call('api.addRoute', {
      route: {
        name: 'oidc-config',
        path: '/.well-known/openid-configuration',
        aliases: {
          'GET /': 'oidc-provider.proxyConfig'
        }
      }
    });

    // The OIDC provider route must be added after all other routes, otherwise it gets overwritten
    // TODO find out why ! Probably due to the fact it is only a middleware (adding dummy aliases doesn't help)
    await delay(5000);

    await this.broker.call('api.addRoute', {
      route: {
        name: 'oidc-provider',
        path: '/.oidc/auth',
        use: [this.oidc.callback()]
      }
    });
  },
  actions: {
    // See https://moleculer.services/docs/0.13/moleculer-web.html#Authentication
    async authenticate(ctx) {
      const { route, req, res } = ctx.params;
      // Extract token from authorization header (do not take the Bearer part)
      const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
      if (token) {
        const payload = await ctx.call('jwk.verifyToken', { token });
        if (payload) {
          ctx.meta.tokenPayload = payload;
          ctx.meta.webId = payload.webid; // Not webId !!
          return Promise.resolve(payload);
        }
        // Invalid token
        // TODO make sure token is deleted client-side
        ctx.meta.webId = 'anon';
        return Promise.reject(new E.UnAuthorizedError(E.ERR_INVALID_TOKEN));
      }
      // No token
      ctx.meta.webId = 'anon';
      return Promise.resolve(null);
    },
    // See https://moleculer.services/docs/0.13/moleculer-web.html#Authorization
    async authorize(ctx) {
      const { route, req, res } = ctx.params;
      // Extract token from authorization header (do not take the Bearer part)
      const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
      if (token) {
        const payload = await ctx.call('jwk.verifyToken', { token });
        if (payload) {
          ctx.meta.tokenPayload = payload;
          ctx.meta.webId = payload.webid; // Not webId !!
          return Promise.resolve(payload);
        }
        ctx.meta.webId = 'anon';
        return Promise.reject(new E.UnAuthorizedError(E.ERR_INVALID_TOKEN));
      }
      ctx.meta.webId = 'anon';
      return Promise.reject(new E.UnAuthorizedError(E.ERR_NO_TOKEN));
    },
    async proxyConfig() {
      const res = await fetch(`${this.settings.baseUrl}.oidc/auth/.well-known/openid-configuration`);
      if (res.ok) {
        return await res.json();
      } else {
        throw new Error('Not found');
      }
    }
  },
  events: {
    async 'auth.connected'(ctx) {
      const { webId, interactionId } = ctx.params;
      if (interactionId) {
        // See https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#user-flows
        await this.interactionFinished(interactionId, {
          login: { accountId: webId, amr: ['pwd'] }
        });
      }
    },
    async 'auth.registered'(ctx) {
      const { webId, interactionId } = ctx.params;
      if (interactionId) {
        // See https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#user-flows
        await this.interactionFinished(interactionId, {
          login: { accountId: webId, amr: ['pwd'] }
        });
      }
    }
  },
  methods: {
    async interactionFinished(interactionId, result) {
      const interaction = await this.oidc.Interaction.find(interactionId);
      interaction.result = result;
      await interaction.save(interaction.exp - Math.floor(Date.now() / 1000));
    }
  }
};
