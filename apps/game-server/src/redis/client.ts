import { Redis } from 'ioredis';

export function createRedisClient(redisUrl: string): Redis {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  client.on('connect', () => console.log('[REDIS] Connected'));
  client.on('error', (err: Error) => console.error('[REDIS] Error:', err.message));
  return client;
}

export async function setGameState(redis: Redis, gameId: string, state: unknown): Promise<void> {
  await redis.setex(`game:${gameId}:state`, 3600, JSON.stringify(state));
}

export async function getGameState(redis: Redis, gameId: string): Promise<unknown | null> {
  const data = await redis.get(`game:${gameId}:state`);
  return data ? JSON.parse(data) as unknown : null;
}
