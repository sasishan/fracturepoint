import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const lobbyUrl      = env['VITE_LOBBY_URL']      ?? 'http://localhost:3000';
  const gameServerUrl = env['VITE_GAME_SERVER_URL'] ?? 'http://localhost:3001';

  return {
    plugins: [react()],
    publicDir: resolve(__dirname, '../../data'),
    resolve: {
      alias: {
        '@ww3/shared-types': resolve(__dirname, '../../packages/shared-types/src/index.ts'),
        '@ww3/game-math': resolve(__dirname, '../../packages/game-math/src/index.ts'),
        '@ww3/map-data': resolve(__dirname, '../../packages/map-data/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': lobbyUrl,
        '/socket.io': { target: gameServerUrl, ws: true },
      },
    },
  };
});
