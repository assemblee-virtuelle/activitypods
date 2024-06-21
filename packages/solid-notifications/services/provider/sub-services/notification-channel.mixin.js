const urlJoin = require('url-join');
const { Errors: E } = require('moleculer-web');
const { parseHeader, negotiateContentType, parseJson } = require('@semapps/middlewares');
const { ControlledContainerMixin, getDatasetFromUri, arrayOf } = require('@semapps/ldp');
const { ACTIVITY_TYPES } = require('@semapps/activitypub');
const { MIME_TYPES } = require('@semapps/mime-types');
const { v4: uuidV4 } = require('uuid');
const moment = require('moment');

/**
 * Solid Notification Channel mixin.
 * Use this mixin to implement solid notification channels.
 * The settings, actions, and methods to be implemented are marked in the code.
 *
 * By default, this service supports the following features:
 * - `notify:endAt`, `notify:startAt` channel properties to only trigger events within these time bounds.
 * - `notify:state` for resources (will return `dc:modified`
 * - `notify:rate` the channel's min duration between firing events.
 *
 * Note: modifying a channel resource using the ldp API will not take effect until a server restart.
 */
module.exports = {
  // name: 'solid-notifications.provider.<ChannelType>',
  mixins: [ControlledContainerMixin],
  settings: {
    // Channel properties (to be overridden)
    channelType: null, // E.g. 'WebhookChannel2023',
    typePredicate: null, // E.g. 'notify:WebhookChannel2023', defaults to `nofiy:${this.settings.channelType}`,
    acceptedTypes: [], // E.g. ['notify:WebhookChannel2023'],
    sendOrReceive: null, // Either 'send' or 'receive' (will set `sendTo` or `receiveFrom` URIs).

    baseUrl: null,
    // ControlledContainerMixin
    excludeFromMirror: true,
    activateTombstones: false,
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
    if (this.settings.sendOrReceive !== 'receive' && this.settings.sendOrReceive !== 'send')
      throw new Error('The setting `sendOrReceive` must be set to `send` or `receive`, depending on channelType.');
    if (!this.settings.channelType) throw new Error('The setting channelType must be set (e.g. `WebhookChannel2023`).');
    if (!this.settings.typePredicate) this.settings.typePredicate = `notify:${this.settings.channelType}`;
    if (this.settings.acceptedTypes?.length <= 0) this.settings.acceptedTypes = [this.settings.typePredicate];
  },
  async started() {
    const { channelType } = this.settings;

    await this.broker.call('api.addRoute', {
      route: {
        name: `notification-${channelType}`,
        path: `/.notifications/${channelType}`,
        bodyParsers: false,
        authorization: false,
        authentication: true,
        aliases: {
          'GET /': `${this.name}.discover`,
          'POST /': [parseHeader, negotiateContentType, parseJson, `${this.name}.createChannel`]
        }
      }
    });

    this.channels = [];

    await this.loadChannelsFromDb({ removeOldChannels: true });
  },
  actions: {
    async discover() {
      throw new Error('Not implemented. Please provide this action in your service.');
    },

    async createChannel(ctx) {
      // Expect format https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/notifications/#webhooks
      // Correct context: https://github.com/solid/vocab/blob/main/solid-notifications-context.jsonld
      const type = ctx.params.type || ctx.params['@type'];
      const topic = ctx.params.topic || ctx.params['notify:topic'];
      const sendToParam = ctx.params.sendTo || ctx.params['notify:sendTo'];
      const { webId } = ctx.meta;

      // TODO: Use ldo objects; This will only check for the json type and not parse json-ld variants...
      if (!this.settings.acceptedTypes.includes(type) && this.settings.channelType !== type)
        throw new Error(`Only one of ${this.settings.acceptedTypes} is accepted on this endpoint`);

      // Ensure topic exist (LDP resource, container or collection)
      const exists = await ctx.call('ldp.resource.exist', {
        resourceUri: topic,
        webId: 'system'
      });
      if (!exists) throw new E.BadRequestError('Cannot watch non-existing resource');

      // Ensure topic can be watched by the authenticated agent
      const rights = await ctx.call('webacl.resource.hasRights', {
        resourceUri: topic,
        rights: { read: true },
        webId
      });
      // TODO: Should a client without read rights know about the existence of that resource?
      if (!rights.read) throw new E.ForbiddenError('You need acl:Read rights on the resource');

      // Find container URI from topic (must be stored on same Pod)
      const topicWebId = urlJoin(this.settings.baseUrl, getDatasetFromUri(topic));
      const channelContainerUri = await this.actions.getContainerUri({ webId: topicWebId }, { parentCtx: ctx });

      // Create receiveFrom URI if needed (e.g. for web sockets).
      const receiveFrom =
        (this.settings.sendOrReceive === 'receive' && (await this.createReceiveFromUri(topic, webId))) || undefined;
      const sendTo = (this.settings.sendOrReceive === 'send' && sendToParam) || undefined;

      // Post channel on Pod
      const channelUri = await this.actions.post(
        {
          containerUri: channelContainerUri,
          resource: {
            type: this.settings.typePredicate,
            'notify:topic': topic,
            'notify:sendTo': sendTo,
            'notify:receiveFrom': receiveFrom
          },
          contentType: MIME_TYPES.JSON,
          webId: 'system'
        },
        { parentCtx: ctx }
      );

      // Keep track of channel internally.
      const channel = {
        id: channelUri,
        topic,
        sendTo,
        receiveFrom,
        webId
      };
      this.channels.push(channel);
      this.onChannelCreated(channel);

      ctx.meta.$responseType = 'application/ld+json';
      return this.actions.get(
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
      const { resourceUri, newData } = ctx.params;
      this.onResourceEvent(resourceUri, ACTIVITY_TYPES.CREATE, newData['dc:modified']);
    },
    async 'ldp.resource.updated'(ctx) {
      const { resourceUri, newData } = ctx.params;
      this.onResourceEvent(resourceUri, ACTIVITY_TYPES.UPDATE, newData['dc:modified']);
    },
    async 'ldp.resource.patched'(ctx) {
      const { resourceUri } = ctx.params;
      this.onResourceEvent(resourceUri, ACTIVITY_TYPES.UPDATE, await this.getModified(resourceUri));
    },
    async 'ldp.resource.deleted'(ctx) {
      const { resourceUri } = ctx.params;
      this.onResourceEvent(resourceUri, ACTIVITY_TYPES.DELETE, new Date().toISOString());
    },
    async 'ldp.container.attached'(ctx) {
      const { containerUri, resourceUri } = ctx.params;
      this.onContainerOrCollectionEvent(containerUri, resourceUri, ACTIVITY_TYPES.ADD);
    },
    async 'ldp.container.detached'(ctx) {
      const { containerUri, resourceUri } = ctx.params;
      this.onContainerOrCollectionEvent(containerUri, resourceUri, ACTIVITY_TYPES.REMOVE);
    },
    async 'activitypub.collection.added'(ctx) {
      const { collectionUri, itemUri } = ctx.params;
      this.onContainerOrCollectionEvent(collectionUri, itemUri, ACTIVITY_TYPES.ADD);
    },
    async 'activitypub.collection.removed'(ctx) {
      const { collectionUri, itemUri } = ctx.params;
      this.onContainerOrCollectionEvent(collectionUri, itemUri, ACTIVITY_TYPES.REMOVE);
    }
  },
  methods: {
    async getModified(resourceUri) {
      return await this.broker.call('ldp.resource.get', { resourceUri, webId: 'system' })?.['dc:modified'];
    },
    getMatchingChannels(topic) {
      const now = new Date();
      const matchedChannels = this.channels
        .filter(c => c.topic === topic)
        .filter(c => (c.startAt ? new Date(c.startAt) <= now : true))
        .filter(c => (c.endAt ? new Date(c.endAt) > now : true))
        // Check if rate is exceeded.
        .filter(c => {
          if (!(c.lastTriggered && c.rate)) return true;
          return moment.duration(c.rate).asMilliseconds() < now - c.lastTriggered;
        });

      return matchedChannels;
    },
    onContainerOrCollectionEvent(containerOrCollectionUri, resourceOrItemUri, type) {
      const activity = {
        '@context': ['https://www.w3.org/ns/activitystreams', 'https://www.w3.org/ns/solid/notifications-context/v1'],
        id: `urn:uuid:${uuidV4()}`,
        type,
        object: resourceOrItemUri,
        target: containerOrCollectionUri
      };
      this.triggerChannelsForTopic(containerOrCollectionUri, activity);
    },
    onResourceEvent(resourceUri, type, state) {
      const activity = {
        '@context': ['https://www.w3.org/ns/activitystreams', 'https://www.w3.org/ns/solid/notifications-context/v1'],
        id: `urn:uuid:${uuidV4()}`,
        type,
        object: resourceUri,
        state
      };
      this.triggerChannelsForTopic(resourceUri, activity);
    },
    async triggerChannelsForTopic(topicUri, activity) {
      const channelsToTrigger = this.getMatchingChannels(topicUri);

      // First set lastTriggered, so channels with rate are not triggered multiple times.
      const now = new Date();
      for (const channel of channelsToTrigger) {
        channel.lastTriggered = now;
      }

      // Trigger onEvent for each channel (handled by implementing service).
      await Promise.all(
        channelsToTrigger.map(async channel => {
          await this.onEvent(channel, activity);
        })
      );
    },
    async loadChannelsFromDb({ removeOldChannels }) {
      // Load all channels from all Pods
      await Promise.all(
        (await this.broker.call('pod.list')).map(async dataset => {
          // Why not use auth.account.find here?
          const webId = urlJoin(this.settings.baseUrl, dataset);
          const container = await this.actions.list({ webId });
          for (const channel of arrayOf(container['ldp:contains'])) {
            // Remove channels where endAt is in the past.
            if (removeOldChannels && channel['notify:endAt'] < new Date()) {
              this.broker.call('ldp.resource.delete', {
                resourceUri: channel.id || channel['@id'],
                webId: 'system'
              });
              continue;
            }

            this.channels.push({
              ...channel,
              id: channel.id || channel['@id'],
              topic: channel['notify:topic'],
              sendTo: channel['notify:sendTo'],
              receiveFrom: channel['notify:receiveFrom'],
              startAt: channel['notify:startAt'],
              endAt: channel['notify:endAt'],
              accept: channel['notify:accept'],
              rate: channel['notify:rate'],
              webId
            });
          }
        })
      );
    },

    // METHODS TO IMPLEMENT by implementing service.
    //
    async onEvent(channel, activity) {
      // This will be called for each channel when its topic changed.
      // The activity is to be sent to the subscriber by the implementing service.
      // Please add `published: new Date().toISOString()` to the activity when you send it.
      throw new Error('Not implemented. Please implement this method in your service.');
    },
    async createReceiveFromUri(topic, webId) {
      // Create a random URI to be registered for `receiveFrom` for a new channel under `this.channels`.
      throw new Error('Not implemented. Please implement this method in your service.');
    },
    onChannelCreated(channel) {
      // Do nothing by default. Can be overridden.
    },
    onChannelDeleted(channel) {
      // Do nothing by default. Can be overridden.
    }
  },

  hooks: {
    after: {
      delete(ctx, res) {
        const { resourceUri } = ctx.params;
        const channel = this.channels.find(c => c.id === resourceUri);
        this.channels = this.channels.filter(c => c.id !== resourceUri);
        this.onChannelDeleted(channel);
        return res;
      }
    }
  }
};
