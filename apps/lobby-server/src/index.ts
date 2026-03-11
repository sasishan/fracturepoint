import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';

const PORT = parseInt(process.env['LOBBY_SERVER_PORT'] ?? '3000', 10);
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-CHANGE-IN-PRODUCTION';

async function main() {
  const fastify = Fastify({ logger: { level: process.env['LOG_LEVEL'] ?? 'info' } });

  await fastify.register(fastifyCors, {
    origin: process.env['NODE_ENV'] === 'production'
      ? 'https://ww3-fracture-point.com'
      : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(fastifyJwt, { secret: JWT_SECRET });

  // Auth decorator
  fastify.decorate('authenticate', async function (
    this: typeof fastify,
    request: Parameters<typeof fastify.authenticate>[0],
    reply: Parameters<typeof fastify.authenticate>[1],
  ) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Routes
  fastify.get('/health', async () => ({
    status: 'ok', service: 'ww3-lobby-server', uptime: process.uptime(),
  }));

  // Auth routes
  fastify.post<{ Body: { username: string; email: string; password: string } }>(
    '/auth/register',
    async (request, reply) => {
      const { username, email, password } = request.body;
      if (!username || !email || !password) {
        return reply.code(400).send({ error: 'username, email, and password are required' });
      }
      if (username.length < 3 || username.length > 30) {
        return reply.code(400).send({ error: 'Username must be 3–30 characters' });
      }
      if (password.length < 8) {
        return reply.code(400).send({ error: 'Password must be at least 8 characters' });
      }
      // TODO: Save to PostgreSQL
      const playerId = crypto.randomUUID();
      const token = fastify.jwt.sign({ playerId, username, email }, { expiresIn: '15m' });
      const refreshToken = fastify.jwt.sign({ playerId, type: 'refresh' }, { expiresIn: '30d' });
      return reply.code(201).send({ token, refreshToken, playerId, username });
    },
  );

  fastify.post<{ Body: { username: string; password: string } }>(
    '/auth/login',
    async (request, reply) => {
      const { username, password } = request.body;
      if (!username || !password) {
        return reply.code(400).send({ error: 'username and password are required' });
      }
      // TODO: Verify against PostgreSQL
      const playerId = crypto.randomUUID();
      const token = fastify.jwt.sign({ playerId, username }, { expiresIn: '15m' });
      const refreshToken = fastify.jwt.sign({ playerId, type: 'refresh' }, { expiresIn: '30d' });
      return { token, refreshToken, playerId, username };
    },
  );

  fastify.get('/auth/me', {
    onRequest: [(fastify as unknown as { authenticate: (req: unknown, rep: unknown) => Promise<void> }).authenticate],
  }, async (request) => {
    return (request as unknown as { user: unknown }).user;
  });

  // Lobby routes
  const openGames: Array<{ id: string; mode: string; players: number; maxPlayers: number; createdAt: string }> = [];

  fastify.get('/lobby/games', async () => ({ games: openGames }));

  fastify.post<{ Body: { mode?: string; maxPlayers?: number } }>(
    '/lobby/games',
    {
      onRequest: [(fastify as unknown as { authenticate: (req: unknown, rep: unknown) => Promise<void> }).authenticate],
    },
    async (request, reply) => {
      const { mode = 'skirmish', maxPlayers = 8 } = request.body ?? {};
      const gameId = crypto.randomUUID();
      openGames.push({ id: gameId, mode, players: 1, maxPlayers, createdAt: new Date().toISOString() });
      return reply.code(201).send({ gameId, mode, maxPlayers });
    },
  );

  fastify.post<{ Params: { gameId: string } }>(
    '/lobby/games/:gameId/join',
    {
      onRequest: [(fastify as unknown as { authenticate: (req: unknown, rep: unknown) => Promise<void> }).authenticate],
    },
    async (request, reply) => {
      const { gameId } = request.params;
      const game = openGames.find(g => g.id === gameId);
      if (!game) return reply.code(404).send({ error: 'Game not found' });
      if (game.players >= game.maxPlayers) return reply.code(409).send({ error: 'Game is full' });
      game.players++;
      return { gameId, status: 'joined', gameServerUrl: `ws://localhost:3001` };
    },
  );

  fastify.get('/lobby/leaderboard', async () => ({
    players: [], // TODO: Load from PostgreSQL + Drizzle
  }));

  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[LOBBY-SERVER] Ready on port ${PORT}`);
}

main().catch(err => { console.error('[LOBBY-SERVER] Fatal:', err); process.exit(1); });
