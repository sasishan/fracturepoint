/// <reference types="vite/client" />

/**
 * Runtime configuration — all server URLs come from environment variables.
 * Set VITE_LOBBY_URL and VITE_GAME_SERVER_URL in .env (local) or Vercel
 * environment variables (production).
 */

export const LOBBY_URL: string = (import.meta.env['VITE_LOBBY_URL'] as string | undefined) ?? 'http://localhost:3000';
export const GAME_SERVER_URL: string = (import.meta.env['VITE_GAME_SERVER_URL'] as string | undefined) ?? 'http://localhost:3001';
