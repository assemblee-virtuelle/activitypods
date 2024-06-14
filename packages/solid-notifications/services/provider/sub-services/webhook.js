const urlJoin = require('url-join');
const fetch = require('node-fetch');
const { v4: uuidV4 } = require('uuid');
const { Errors: E } = require('moleculer-web');
const { parseHeader, negotiateContentType, parseJson } = require('@semapps/middlewares');
const { ControlledContainerMixin, getDatasetFromUri, arrayOf } = require('@semapps/ldp');
const { ACTIVITY_TYPES } = require('@semapps/activitypub');
const { MIME_TYPES } = require('@semapps/mime-types');
const NotificationChannelMixin = require('./notification-channel.mixin');

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
  mixins: [NotificationChannelMixin],
  settings: {
    channelType: 'WebhookChannel2023',
    typePredicate: 'notify:WebhookChannel2023',
    acceptedTypes: ['notify:WebhookChannel2023'],
    sendOrReceive: 'send'
  },
  async created() {
    //
  },
  async started() {
    //
  },
  actions: {
    async discover(ctx) {
      // TODO Handle content negotiation
      ctx.meta.$responseType = 'application/ld+json';
      return {
        '@context': { notify: 'http://www.w3.org/ns/solid/notifications#' },
        '@id': urlJoin(this.settings.baseUrl, '.notifications', 'WebhookChannel2023'),
        'notify:channelType': 'notify:WebhookChannel2023',
        'notify:features': ['notify:endAt', 'notify:rate', 'notify:startAt', 'notify:state']
      };
    }
  },

  methods: {
    onEvent(channel, activity) {
      this.createJob('webhookPost', channel.sendTo, { channel, activity }, queueOptions);
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
