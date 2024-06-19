const urlJoin = require('url-join');
const { v4: uuidV4 } = require('uuid');
const NotificationChannelMixin = require('./notification-channel.mixin');

/** @type {import('moleculer').ServiceSchema} */
const WebSocketChannel2023Service = {
  name: 'solid-notifications.provider.websocket',
  mixins: [NotificationChannelMixin],
  settings: {
    channelType: 'WebSocketChannel2023',
    sendOrReceive: 'receive',

    baseUrl: null
  },

  async started() {
    this.socketConnections = [];

    this.broker.call('api.addWebSocketRoute', {
      name: 'notification-websocket',
      route: `/.notifications/WebSocketChannel2023/socket/:id`,
      handlers: {
        /** @param {import('@activitypods/core/services/websocket/websocket.mixin').Connection} connection */
        onConnection: connection => {
          this.logger.info('onConnection', connection.requestUrl);

          const channel = this.channels.find(c => c.receiveFrom === connection.requestUrl);
          // Check if the requested channel is registered.
          if (!channel) {
            connection.webSocket.close(4040, 'Channel not found.');
            return;
          }
          this.socketConnections.push(connection);
        },
        onClose: (event, connection) => {
          this.logger.info('onClose', connection.requestUrl);
          this.socketConnections = this.socketConnections.filter(c => c === connection);
        },
        onMessage: (message, connection) => {
          this.logger.info('onMessage', message, connection.requestUrl);
          // We don't expect any messages.
        },
        onError: (event, connection) => {
          this.logger.info('onError', event, connection.requestUrl);
          // There is nothing to handle here.
        }
      }
    });
  },
  actions: {
    async discover(ctx) {
      ctx.meta.$responseType = 'application/ld+json';
      return {
        '@context': { notify: 'http://www.w3.org/ns/solid/notifications#' },
        '@id': urlJoin(this.settings.baseUrl, '.notifications', 'WebSocketChannel2023'),
        'notify:channelType': 'notify:WebSocketChannel2023',
        'notify:features': ['notify:endAt', 'notify:rate', 'notify:startAt', 'notify:state']
      };
    }
  },

  methods: {
    onChannelDeleted(channel) {
      // Close open connections
      this.socketConnections
        .filter(socketConnection => socketConnection.requestUrl === channel.receiveFrom)
        .forEach(connection => connection.webSocket.close(1001, 'The channel was deleted.'));
    },
    onEvent(channel, activity) {
      const message = JSON.stringify({
        ...activity,
        published: new Date().toISOString()
      });

      this.socketConnections
        .filter(socketConnection => socketConnection.requestUrl === channel.receiveFrom)
        .forEach(connection => connection.webSocket.send(message));
    },
    createReceiveFromUri() {
      // Create a random URI to be registered for `receiveFrom` for a new channel under `this.channels`.
      // Web socket requests to this URI are subsequently accepted (as validated in `onConnection`).
      return urlJoin(
        this.settings.baseUrl.replace('http', 'ws'),
        '.notifications',
        'WebSocketChannel2023',
        'socket',
        uuidV4()
      );
    }
  }
};

module.exports = WebSocketChannel2023Service;
