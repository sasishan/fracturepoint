import { createServer } from './server.js';

const PORT = parseInt(process.env['GAME_SERVER_PORT'] ?? '3001', 10);
const HOST = process.env['GAME_SERVER_HOST'] ?? '0.0.0.0';

async function main() {
  const { fastify } = await createServer();
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`[GAME-SERVER] Ready on ${HOST}:${PORT}`);
}

main().catch(err => { console.error('[GAME-SERVER] Fatal:', err); process.exit(1); });
