const urlJoin = require('url-join');
const QueueMixin = require('moleculer-bull');
const WebhookChannelService = require('./sub-services/webhook');

module.exports = {
  name: 'solid-notifications.provider',
  settings: {
    baseUrl: null,
    queueServiceUrl: null
  },
  dependencies: ['api', 'ldp.link-header'],
  async created() {
    const { baseUrl, queueServiceUrl } = this.settings;
    if (!baseUrl || !queueServiceUrl) throw new Error(`The baseUrl and queueServiceUrl settings are required`);

    this.broker.createService(WebhookChannelService, {
      mixins: [QueueMixin(queueServiceUrl)],
      settings: { baseUrl }
    });
  },
  async started() {
    await this.broker.call('ldp.link-header.register', { actionName: 'solid-notifications.provider.getLink' });

    await this.broker.call('api.addRoute', {
      route: {
        name: 'solid',
        path: '/.well-known/solid',
        authorization: false,
        authentication: false,
        aliases: {
          'GET /': 'solid-notifications.provider.discover'
        }
      }
    });
  },
  actions: {
    discover(ctx) {
      // TODO Handle content negotiation
      ctx.meta.$responseType = 'application/ld+json';
      return {
        '@context': { notify: 'http://www.w3.org/ns/solid/notifications#' },
        '@id': urlJoin(this.settings.baseUrl, '.well-known', 'solid'),
        '@type': 'http://www.w3.org/ns/pim/space#Storage',
        'notify:subscription': [
          urlJoin(this.settings.baseUrl, '.notifications', 'WebSocketChannel2023'),
          urlJoin(this.settings.baseUrl, '.notifications', 'WebhookChannel2023')
        ]
      };
    },
    getLink() {
      return {
        uri: urlJoin(this.settings.baseUrl, '.well-known', 'solid'),
        rel: 'http://www.w3.org/ns/solid/terms#storageDescription'
      };
    }
  }
};
