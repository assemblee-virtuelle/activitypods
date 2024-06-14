const ws = require('ws');

/**
 * @param {import('moleculer-web').IncomingMessage} request The incoming request.
 * @returns {boolean} Whether the request is a websocket request.
 */
const isWebSocketRequest = request => {
  return request.headers['upgrade'] === 'websocket' && request.headers['connection']?.includes('Upgrade');
};

/**
 * This mixin adds the ability to create WebSocket routes to the moleculer-web API Gateway.
 * The mixin adds a new action `addWebSocketRoute` to the service.
 * The action takes the following parameters:
 * - name: The name of the route.
 * - route: The route path.
 * - authorization: Whether to require authorization.
 * - authentication: Whether to require authentication.
 * - use: An array of middleware functions to use.
 * - handlers: An object with the following webSocket event callbacks:
 *   - onConnection: (connection)
 *   - onClose: (event, connection)
 *   - onMessage: (message, connection)
 *   - onError: (event, connection)
 * @type {import('moleculer').ServiceSchema}
 */
module.exports = {
  actions: {
    addWebSocketRoute: {
      params: {
        name: { type: 'string' },
        route: { type: 'string' },
        authorization: { type: 'boolean', default: false },
        authentication: { type: 'boolean', default: false },
        use: { type: 'array', items: 'function', default: [] },
        handlers: {
          $$type: 'object',
          onConnection: { type: 'function', default: () => {} },
          onClose: { type: 'function', default: () => {} },
          onMessage: { type: 'function', default: () => {} },
          onError: { type: 'function', default: () => {} }
        }
      },
      async handler(ctx) {
        const { name, route, authorization, authentication, use, handlers } = ctx.params;

        this.actions.addRoute({
          route: {
            name,
            authorization,
            authentication,
            path: route,
            bodyParsers: false,

            aliases: {
              'GET /': [
                // Add provided mixins.
                ...use,
                // Handle the upgrade and register the callbacks.
                (request, response, next) => this.handleRequest(request, response, next, handlers),
                // The alias route array needs to have an action after the middleware functions.
                `${this.name}.onConnectionEstablished`
              ]
            },
            onAfterCall: (ctx, _, incomingRequest, serverResponse) =>
              this.delayConnectionClosing(incomingRequest, serverResponse)
          }
        });
      }
    },
    onConnectionEstablished(ctx) {
      // Just a dummy function to satisfy the alias middleware handler above.
    }
  },

  methods: {
    /**
     * @param {import('moleculer-web').IncomingMessage} request The incoming request from the client.
     * @param {import('http').ServerResponse} response The server response being created.
     * @param {() => void} next	The next middleware function.
     * @param {import("./websocket.mixin").WebSocketHandlers} handlers The event handlers for the WebSocket to be registered.
     */
    async handleRequest(request, response, next, handlers) {
      if (!isWebSocketRequest(request)) {
        response.statusCode = 426;
        response.statusMessage = 'Upgrade Required: Not a WebSocket request';
        next();
        return;
      }
      const server = new ws.WebSocketServer({
        noServer: true
      });

      // Handle the upgrade request (returns 101 switching protocols).
      server.handleUpgrade(request, request.socket, Buffer.alloc(0), async (webSocket, upgradeRequest) => {
        // The registered route (e.g. /sockets/:foo)
        const { baseUrl } = request;
        // The URL as requested by the client (including URL params, e.g. /sockets/bar1?p2=v2).
        const requestUrl = request.originalUrl;
        // The parsed URL without URL params (e.g. /sockets/bar1).
        const { parsedUrl } = request;
        // The context params (URL params + registered params (e.g. {foo: "bar1", p2: "v2"}))
        const params = request.$params;

        // Create a new connection object (passed to all event handlers).
        /** @type {import("./websocket.mixin").Connection} */
        const connection = {
          server,
          request,
          response,
          requestUrl,
          baseUrl,
          parsedUrl,
          params,
          webSocket,
          send: webSocket.send
        };

        // Add event listeners registered by the caller.
        webSocket.addEventListener('close', e => handlers.onClose(e, connection));
        webSocket.addEventListener('message', e => handlers.onMessage(e.data, connection));
        webSocket.addEventListener('error', e => handlers.onError(e, connection));

        // Remove connections, when they close.
        webSocket.addEventListener('close', () => {
          this.connections = this.connections.filter(c => c !== connection);
        });

        // Add connection to the list of connections.
        this.connections.push(connection);

        // Trigger connected event.
        handlers.onConnection(connection);

        // Handle next middleware.
        next();

        this.logger.info('New WebSocket registered with URI: ', requestUrl);
      });
    },

    /**
     * Delay the connection closing until the web socket is closed, if this is a websocket connection.
     * @param {import('moleculer-web').IncomingMessage} incomingRequest The incoming request.
     * @param {import('http').ServerResponse} serverResponse The server response.
     */
    async delayConnectionClosing(incomingRequest, serverResponse) {
      // Don't return, if this is an open websocket, otherwise the connection will be closed.
      if (isWebSocketRequest(incomingRequest)) {
        // Only resolve, once the socket closes.
        await new Promise((resolve, reject) => {
          serverResponse.socket.on('close', resolve);
          serverResponse.socket.on('error', reject);

          // If already closed, return immediately.
          if (serverResponse.socket.closed) {
            resolve();
          }
        });
      }
    }
  },

  created() {
    /** @type {import("./websocket.mixin").RegisteredEndpoint[]} */
    this.connections = [];
  }
};
