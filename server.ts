import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { handleSocketConnection } from './src/lib/server/socketHandler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Next.js handles normal requests
    handler(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Adjust this in production
    },
  });

  // Delegate socket connection logic
  io.on('connection', (socket) => {
    handleSocketConnection(io, socket);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server running`);
  });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
