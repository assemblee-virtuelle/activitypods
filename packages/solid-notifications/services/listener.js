const urlJoin = require('url-join');
const fetch = require('node-fetch');
const LinkHeader = require('http-link-header');
const { v4: uuidv4 } = require('uuid');
const DbService = require('moleculer-db');
const { MoleculerError } = require('moleculer').Errors;
const { parseHeader, negotiateContentType, parseJson } = require('@semapps/middlewares');
const { TripleStoreAdapter } = require('@semapps/triplestore');

module.exports = {
  name: 'solid-notifications.listener',
  mixins: [DbService],
  adapter: new TripleStoreAdapter({ type: 'WebhookChannelListener', dataset: 'settings' }),
  settings: {
    baseUrl: undefined,
    // DbService settings
    idField: '@id'
  },
  dependencies: ['api', 'app'],
  async started() {
    if (!this.settings.baseUrl) throw new Error(`The baseUrl setting is required`);

    // Retrieve all active listeners
    const results = await this.actions.list({});
    this.listeners = results.rows;

    await this.broker.call('api.addRoute', {
      route: {
        path: '/.webhooks/:uuid',
        authorization: false,
        authentication: false,
        aliases: {
          'POST /': [parseHeader, negotiateContentType, parseJson, 'solid-notifications.listener.transfer']
        },
        bodyParsers: false
      }
    });
  },
  actions: {
    async register(ctx) {
      const { resourceUri, actionName } = ctx.params;

      const appActor = await ctx.call('app.get');

      // Check if a listener already exist
      const existingListener = this.listeners.find(
        listener => listener.resourceUri === resourceUri && listener.actionName === actionName
      );

      if (existingListener) {
        try {
          // Check if channel still exist
          const channel = await ctx.call('ldp.remote.get', {
            resourceUri: existingListener.channelUri,
            webId: appActor.id,
            strategy: 'networkOnly'
          });

          // If the channel still exist, registration is not needed
          return existingListener;
        } catch (e) {
          if (e.code === 404) {
            this.logger.warn(
              `Channel ${existingListener.channelUri} doesn't exist anymore. Registering a new channel...`
            );
            this.actions.remove({ id: existingListener['@id'] }, { parentCtx: ctx });
            this.listeners = this.listeners.filter(l => l['@id'] !== existingListener['@id']);
          } else {
            throw e;
          }
        }
      }

      // Discover webhook endpoint
      const storageDescription = await this.getSolidEndpoint(resourceUri);
      if (!storageDescription) throw new Error(`No storageDescription found for resourceUri ${resourceUri}`);

      // Fetch all subscriptions URLs
      const results = await Promise.all(
        storageDescription['notify:subscription'].map(channelSubscriptionUrl =>
          fetch(channelSubscriptionUrl, {
            headers: {
              Accept: 'application/ld+json'
            }
          }).then(res => res.ok && res.json())
        )
      );

      // Find webhook channel
      const webhookSubscription = results.find(
        subscription => subscription && subscription['notify:channelType'] === 'notify:WebhookChannel2023'
      );

      if (!webhookSubscription) throw new Error(`No webhook subscription URL found for resourceUri ${resourceUri}`);

      // Ensure webhookSubscription['notify:feature'] are correct

      // Generate a webhook path
      const webhookUrl = urlJoin(this.settings.baseUrl, '.webhooks', uuidv4());

      // Create a webhook channel (authenticate with HTTP signature)
      const { body } = await ctx.call('signature.proxy.query', {
        url: webhookSubscription.id || webhookSubscription['@id'],
        method: 'POST',
        headers: new fetch.Headers({ 'Content-Type': 'application/ld+json' }),
        body: JSON.stringify({
          '@context': {
            notify: 'http://www.w3.org/ns/solid/notifications#'
          },
          '@type': 'notify:WebhookChannel2023',
          'notify:topic': resourceUri,
          'notify:sendTo': webhookUrl
        }),
        actorUri: appActor.id
      });

      // Persist listener on the settings dataset
      const listener = await this._create(ctx, {
        webhookUrl,
        resourceUri,
        channelUri: body.id,
        actionName
      });

      this.listeners.push(listener);

      return listener;
    },
    async transfer(ctx) {
      const { uuid, ...data } = ctx.params;
      const webhookUrl = urlJoin(this.settings.baseUrl, '.webhooks', uuid);

      const listener = this.listeners.find(l => l.webhookUrl === webhookUrl);

      if (listener) {
        try {
          // Do no wait for the action to finish, so that the result can be immediately returned
          ctx.call(listener.actionName, data);
        } catch (e) {
          // Ignore errors that the actions may generate (otherwise 404 errors will be considered as non-existing webhooks)
        }
        ctx.meta.$statusCode = 200;
      } else {
        throw new MoleculerError(`No webhook found with URL ${webhookUrl}`, 404, 'NOT_FOUND');
      }
    },
    getCache() {
      return this.listeners;
    }
  },
  methods: {
    async getSolidEndpoint(resourceUri) {
      let solidEndpointUrl;

      try {
        const response = await fetch(resourceUri, { method: 'HEAD' });
        const linkHeader = LinkHeader.parse(response.headers.get('Link'));
        const storageDescriptionLinkHeader = linkHeader.rel('http://www.w3.org/ns/solid/terms#storageDescription');
        solidEndpointUrl = storageDescriptionLinkHeader[0].uri;
      } catch (e) {
        // Ignore errors, we will display a warning below
      }

      if (!solidEndpointUrl) {
        this.logger.warn(`Could not get link header for ${resourceUri}`);
        // Assume same endpoint as ActivityPods or CSS
        solidEndpointUrl = urlJoin(new URL(resourceUri).origin, '.well-known', 'solid');
      }

      const response = await fetch(solidEndpointUrl, {
        headers: {
          Accept: 'application/ld+json'
        }
      });

      if (response.ok) {
        return await response.json();
      }
      return false;
    }
  }
};
