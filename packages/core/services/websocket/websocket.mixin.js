const { WebSocketServer } = require('ws');
const http = require('http');

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
 * - onConnection: (connection)
 * - onClose: (event, connection)
 * - onMessage: (message, connection)
 * - onError: (event, connection)
 * @type {import('moleculer').ServiceSchema}
 */
module.exports = {
  name: 'websocket',
  settings: {},
  created() {
    /** @type {import("./websocket.mixin").RegisteredEndpoint[]} */
    this.connections = [];
  },
  started() {
    // Listen to upgrade requests and handle them with `upgradeHandler`.
    // This will attach a `webSocketRequestHandler` to upgrade the
    // connection and get a web socket object.
    this.wss = new WebSocketServer({ noServer: true });
    this.server.on('upgrade', this.upgradeHandler);
  },
  actions: {
    /** See description in service comment. */
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

        // Use the service's regular route handler but add some mixins.
        this.actions.addRoute({
          route: {
            name,
            authorization,
            authentication,
            path: route,
            bodyParsers: false,
            callOptions: { timeout: 0 },
            aliases: {
              'GET /': [
                // Add provided mixins.
                ...use,
                // Handle the upgrade and register the callbacks (or error on non-ws requests).
                (request, response, next) => this.handleWsRequest(request, response, next, handlers),
                // The alias route array needs to have an action after the middleware functions.
                `${this.name}.onWsConnection`
              ]
            },
            // Prevent ws connections from being closed by the lifecycle methods.
            onAfterCall: (ctx, bla, incomingRequest, serverResponse) =>
              this.delayConnectionClosing(incomingRequest, serverResponse)
          }
        });
      }
    },
    onWsConnection(ctx) {
      // Just a dummy function to satisfy the alias middleware handler above.
      // You can access the connection object with `ctx.meta.connection`.
      // Warning: This action is also called, if the connection fails.
      // In this case, `ctx.meta.connection` is unset.
    }
  },

  methods: {
    /**
     * @param {import('moleculer-web').IncomingMessage} request The moleculer-web request.
     * @param {import('http').ServerResponse} response The node http server response.
     * @param {() => void} next The next callback.
     * @param {import("./websocket.mixin").WebSocketHandlers} handlers The handlers to register.
     */
    async handleWsRequest(request, response, next, handlers) {
      if (!request.webSocketRequestHandler) {
        response.statusCode = 426;
        response.statusMessage = 'Upgrade Required: Not a WebSocket request';
        next();
        return;
      }
      const wss = new WebSocketServer({
        noServer: true
      });

      // The existence of the handler indicates, we can perform a WS handshake.
      // The call will do that and return the webSocket (`upgradeHandler`).
      const webSocket = await request.webSocketRequestHandler();

      // Create a new connection object (passed to all event handlers).
      /** @type {import("./websocket.mixin").Connection} */
      const connection = {
        server: wss,
        request,
        response,
        // The registered route (e.g. /sockets/:foo)
        baseUrl: request.baseUrl,
        // The URL as requested by the client (including URL params, e.g. /sockets/bar1?p2=v2).
        requestUrl: request.originalUrl,
        // The parsed URL without URL params (e.g. /sockets/bar1).
        parsedUrl: request.parsedUrl,
        // The context params (URL params + registered params (e.g. {foo: "bar1", p2: "v2"}))
        params: request.$params,
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

      // Attach connection to ctx.
      request.$ctx.meta.connection = connection;

      // Handle next middleware.
      next();

      this.logger.info('New WebSocket registered with URI: ', connection.requestUrl);
    },

    /**
     * Inspired by https://codeberg.org/kitten/app/src/branch/main/src/Server.js#L1042
     * @param {http.IncomingMessage} request The request
     * @param {import('node:net').Socket} socket The socket
     * @param {Buffer} head The first packet of the request
     * @returns  {object} `this.httpHandler(request, response)`
     */
    upgradeHandler(request, socket, head) {
      const response = new http.ServerResponse(request);
      response.assignSocket(socket);

      // Avoid hanging onto upgradeHead as this will keep the entire
      // slab buffer used by node alive.
      const copyOfHead = Buffer.alloc(head.length);
      head.copy(copyOfHead);

      response.on('finish', () => {
        if (response.socket !== null) {
          response.socket.destroy();
        }
      });

      // Add a handler that indicates a web socket request.
      // Calling the handler will perform the ws upgrade handshake and return the webSocket.
      request.webSocketRequestHandler = () =>
        new Promise(resolve => {
          this.wss?.handleUpgrade(request, request.socket, copyOfHead, ws => {
            this.wss?.emit('connection', ws, request);
            resolve(ws);
          });
        });

      return this.httpHandler(request, response);
    },

    /**
     * Delay the connection closing until the web socket is closed, if this is a websocket connection.
     * @param {import('moleculer-web').IncomingMessage} incomingRequest The incoming moleculer-web request.
     * @param {import('http').ServerResponse} serverResponse The node http server response.
     */
    async delayConnectionClosing(incomingRequest, serverResponse) {
      // Don't return, if this is an open websocket, otherwise the connection will be closed.
      if (incomingRequest.webSocketRequestHandler) {
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
  }
};
