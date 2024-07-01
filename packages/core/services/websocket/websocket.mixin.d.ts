import { WebSocketServer, WebSocket, ErrorEvent, Data } from 'ws';
import { IncomingRequest } from 'moleculer-web';
import { ServerResponse } from 'http';

interface Connection {
  server: WebSocketServer;
  request: IncomingRequest;
  response: ServerResponse;
  requestUrl: string;
  baseUrl: string;
  parsedUrl: string;
  params: Record<string, unknown>;
  webSocket: WebSocket;
  send: WebSocket['send'];
}

interface WebSocketHandlers {
  onConnection: (connection: Connection) => void;
  onClose: (event: CloseEvent, connection: Connection) => void;
  onMessage: (message: Data, connection: Connection) => void;
  onError: (event: ErrorEvent, connection: Connection) => void;
}
