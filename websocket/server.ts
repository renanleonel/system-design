import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';

const dev = process.argv.includes('--dev');
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

void app.prepare().then(() => {
  const server = createServer((request, response) => {
    void handle(request, response, parse(request.url ?? '/', true));
  });

  const websocketServer = new WebSocketServer({ noServer: true });

  websocketServer.on('connection', (socket) => {
    const send = () => {
      if (socket.readyState !== socket.OPEN) return;

      socket.send(
        JSON.stringify({
          type: 'random-number',
          randomNumber: Math.floor(Math.random() * 100) + 1,
          serverTime: new Date().toISOString(),
        }),
      );
    };

    send();
    const interval = setInterval(send, 1000);
    socket.on('close', () => clearInterval(interval));
    socket.on('message', (data) => {
      try {
        const payload: unknown = JSON.parse(data.toString());

        if (
          payload === null ||
          typeof payload !== 'object' ||
          !('type' in payload) ||
          payload.type !== 'message' ||
          !('message' in payload) ||
          typeof payload.message !== 'string'
        ) {
          throw new Error('Invalid message payload.');
        }

        const message = payload.message.trim();

        if (message.length === 0 || message.length > 80) {
          throw new Error('Messages must contain between 1 and 80 characters.');
        }

        socket.send(
          JSON.stringify({
            type: 'acknowledgement',
            message: `Server received: ${message}`,
            serverTime: new Date().toISOString(),
          }),
        );
      } catch {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Send a message between 1 and 80 characters.',
            serverTime: new Date().toISOString(),
          }),
        );
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url ?? '/');

    if (pathname !== '/api/ws') {
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit('connection', websocket, request);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
