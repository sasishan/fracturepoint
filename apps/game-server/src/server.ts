import Fastify from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { GameRoomManager } from './game-room-manager.js';
import { registerSocketHandlers } from './socket-handlers.js';

export async function createServer() {
  const fastify = Fastify({ logger: { level: process.env['LOG_LEVEL'] ?? 'info' } });

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'ww3-game-server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  await fastify.ready();

  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env['NODE_ENV'] === 'production'
        ? 'https://ww3-fracture-point.com'
        : ['http://localhost:5173', 'http://localhost:8420'],
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  const roomManager = new GameRoomManager(io);
  registerSocketHandlers(io, roomManager);

  return { fastify, io, roomManager };
}
