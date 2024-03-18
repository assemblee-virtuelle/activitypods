const urlJoin = require('url-join');
const fetch = require('node-fetch');
const { Errors: E } = require('moleculer-web');
const { parseHeader, negotiateContentType, parseJson } = require('@semapps/middlewares');
const { ControlledContainerMixin, getDatasetFromUri, arrayOf } = require('@semapps/ldp');
const { ACTIVITY_TYPES } = require('@semapps/activitypub');
const { MIME_TYPES } = require('@semapps/mime-types');

const queueOptions =
  process.env.NODE_ENV === 'test'
    ? {}
    : {
        // Try again after 3 minutes and until 12 hours later
        attempts: 8,
        backoff: { type: 'exponential', delay: '180000' }
      };

module.exports = {
  name: 'solid-notifications.provider.webhook',
  mixins: [ControlledContainerMixin],
  settings: {
    baseUrl: null,
    // ControlledContainerMixin
    acceptedTypes: ['notify:WebhookChannel2023'],
    excludeFromMirror: true,
    // Like the CSS, we allow anyone with the URI of the channel to read and delete it
    // https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/notifications/#unsubscribing-from-a-notification-channel
    newResourcesPermissions: {
      anon: {
        read: true,
        write: true
      }
    }
  },
  dependencies: ['api', 'pod'],
  async created() {
    if (!this.settings.baseUrl) throw new Error('The baseUrl setting is required');
    if (!this.createJob) throw new Error('The QueueMixin must be configured with this service');
  },
  async started() {
    await this.broker.call('api.addRoute', {
      route: {
        name: 'notification-webhook',
        path: '/.notifications/WebhookChannel2023',
        bodyParsers: false,
        authorization: false,
        authentication: true,
        aliases: {
          'GET /': 'solid-notifications.provider.webhook.discover',
          'POST /': [parseHeader, negotiateContentType, parseJson, 'solid-notifications.provider.webhook.createChannel']
        }
      }
    });

    this.channels = [];

    // Load all channels from all Pods
    for (const dataset of await this.broker.call('pod.list')) {
      const webId = urlJoin(this.settings.baseUrl, dataset);
      const container = await this.actions.list({ webId });
      for (const channel of arrayOf(container['ldp:contains'])) {
        this.channels.push({
          id: channel.id || channel['@id'],
          topic: channel['notify:topic'],
          sendTo: channel['notify:sendTo'],
          webId
        });
      }
    }
  },
  actions: {
    async discover(ctx) {
      // TODO Handle content negociation
      ctx.meta.$responseType = 'application/ld+json';
      return {
        '@context': { notify: 'http://www.w3.org/ns/solid/notifications#' },
        '@id': urlJoin(this.settings.baseUrl, '.notifications', 'WebhookChannel2023'),
        'notify:channelType': 'notify:WebhookChannel2023',
        'notify:features': ['notify:accept', 'notify:endAt', 'notify:rate', 'notify:startAt', 'notify:state']
      };
    },
    async createChannel(ctx) {
      // Expect format https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/notifications/#webhooks
      // Correct context: https://github.com/solid/vocab/blob/main/solid-notifications-context.jsonld
      const type = ctx.params.type || ctx.params['@type'];
      const topic = ctx.params.topic || ctx.params['notify:topic'];
      const sendTo = ctx.params.sendTo || ctx.params['notify:sendTo'];
      const webId = ctx.meta.webId;

      if (type !== 'notify:WebhookChannel2023')
        throw new Error('Only notify:WebhookChannel2023 is accepted on this endpoint');

      // Ensure topic exist (LDP resource, container or collection)
      const exists = await ctx.call('ldp.resource.exist', {
        resourceUri: topic,
        webId: 'system'
      });
      if (!exists) throw new E.BadRequestError('Cannot watch unexisting resource');

      // Ensure topic can be watched by the authenticated agent
      const rights = await ctx.call('webacl.resource.hasRights', {
        resourceUri: topic,
        rights: { read: true },
        webId
      });
      if (!rights.read) throw new E.ForbiddenError('You need acl:Read rights on the resource');

      // Find container URI from topic (must be stored on same Pod)
      const topicWebId = urlJoin(this.settings.baseUrl, getDatasetFromUri(topic));
      const channelContainerUri = await this.actions.getContainerUri({ webId: topicWebId }, { parentCtx: ctx });

      // Post channel on Pod
      const channelUri = await this.actions.post(
        {
          containerUri: channelContainerUri,
          resource: {
            type: 'notify:WebhookChannel2023',
            'notify:topic': topic,
            'notify:sendTo': sendTo
          },
          contentType: MIME_TYPES.JSON,
          webId: 'system'
        },
        { parentCtx: ctx }
      );

      // Keep track of channel internally
      this.channels.push({
        id: channelUri,
        topic,
        sendTo,
        webId
      });

      ctx.meta.$responseType = 'application/ld+json';
      return await this.actions.get(
        {
          resourceUri: channelUri,
          accept: MIME_TYPES.JSON,
          webId: 'system'
        },
        { parentCtx: ctx }
      );
    },
    getCache() {
      return this.channels;
    }
  },
  events: {
    async 'ldp.resource.created'(ctx) {
      const { resourceUri } = ctx.params;
      for (const channel of this.getMatchingChannels(resourceUri)) {
        const activity = {
          type: ACTIVITY_TYPES.CREATE,
          object: resourceUri
        };
        this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
      }
    },
    async 'ldp.resource.updated'(ctx) {
      const { resourceUri } = ctx.params;
      for (const channel of this.getMatchingChannels(resourceUri)) {
        const activity = {
          type: ACTIVITY_TYPES.UPDATE,
          object: resourceUri
        };
        this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
      }
    },
    async 'ldp.resource.patched'(ctx) {
      const { resourceUri } = ctx.params;
      for (const channel of this.getMatchingChannels(resourceUri)) {
        const activity = {
          type: ACTIVITY_TYPES.UPDATE,
          object: resourceUri
        };
        this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
      }
    },
    async 'ldp.resource.deleted'(ctx) {
      const { resourceUri } = ctx.params;
      for (const channel of this.getMatchingChannels(resourceUri)) {
        const activity = {
          type: ACTIVITY_TYPES.DELETE,
          object: resourceUri
        };
        this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
      }
    },
    async 'ldp.container.attached'(ctx) {
      const { containerUri, resourceUri } = ctx.params;
      for (const channel of this.getMatchingChannels(containerUri)) {
        const activity = {
          type: ACTIVITY_TYPES.ADD,
          object: resourceUri,
          target: containerUri
        };
        this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
      }
    },
    async 'ldp.container.detached'(ctx) {
      const { containerUri, resourceUri } = ctx.params;
      for (const channel of this.getMatchingChannels(containerUri)) {
        const activity = {
          type: ACTIVITY_TYPES.REMOVE,
          object: resourceUri,
          target: containerUri
        };
        this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
      }
    },
    async 'activitypub.collection.added'(ctx) {
      const { collectionUri, itemUri } = ctx.params;
      for (const channel of this.getMatchingChannels(collectionUri)) {
        const activity = {
          type: ACTIVITY_TYPES.ADD,
          object: itemUri,
          target: collectionUri
        };
        this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
      }
    },
    async 'activitypub.collection.removed'(ctx) {
      const { collectionUri, itemUri } = ctx.params;
      for (const channel of this.getMatchingChannels(collectionUri)) {
        const activity = {
          type: ACTIVITY_TYPES.REMOVE,
          object: itemUri,
          target: collectionUri
        };
        this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
      }
    }
  },
  methods: {
    getMatchingChannels(topic) {
      return this.channels.filter(c => c.topic === topic);
    }
  },
  queues: {
    webhookPost: {
      name: '*',
      async process(job) {
        const { channel, activity } = job.data;

        try {
          const response = await fetch(channel.sendTo, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/ld+json'
            },
            body: JSON.stringify({
              '@context': 'https://www.w3.org/ns/activitystreams',
              ...activity,
              published: new Date().toISOString()
            })
          });

          if (response.status === 404) {
            this.logger.warn(`Webhook ${channel.sendTo} returned a 404 error, deleting it...`);
            await this.actions.delete({ resourceUri: channel.id, webId: channel.webId });
          } else {
            job.progress(100);
          }

          return { ok: response.ok, status: response.status, statusText: response.statusText };
        } catch (e) {
          if (job.attemptsMade + 1 >= job.opts.attempts) {
            this.logger.warn(`Webhook ${channel.sendTo} failed ${job.opts.attempts} times, deleting it...`);
            // DO NOT DELETE YET TO IMPROVE MONITORING
            // await this.actions.delete({ resourceUri: channel.id, webId: channel.webId });
          }

          throw new Error(`Posting to webhook ${channel.sendTo} failed. Error: (${e.message})`);
        }
      }
    }
  },
  hooks: {
    after: {
      delete(ctx, res) {
        const { resourceUri } = ctx.params;
        this.channels = this.channels.filter(channel => channel.id !== resourceUri);
        return res;
      }
    }
  }
};
