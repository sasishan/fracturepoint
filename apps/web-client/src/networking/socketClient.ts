import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';

// ── Module state ────────────────────────────────────────────────────────────

let socket: Socket | null = null;

// ── Connect ─────────────────────────────────────────────────────────────────

export function connectToGame(
  gameServerUrl: string,
  roomId: string,
  playerId: string
): Socket {
  if (socket?.connected) {
    socket.disconnect();
  }

  const store = useGameStore.getState();

  socket = io(gameServerUrl, {
    transports: ['websocket'],
    query: { roomId, playerId },
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  // ── Lifecycle events ────────────────────────────────────────────────────

  socket.on('connect', () => {
    console.info('[socket] connected', socket?.id);
    store.setConnected(true);
    store.setGameId(roomId);
    store.setPlayerId(playerId);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[socket] disconnected:', reason);
    store.setConnected(false);
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] connect error:', err.message);
    store.setConnected(false);
  });

  // ── Game events ─────────────────────────────────────────────────────────

  socket.on('state_snapshot', (payload: unknown) => {
    store.applySnapshot(payload);
  });

  socket.on('state_delta', (payload: unknown) => {
    store.applyDelta(payload);
  });

  socket.on('error', (payload: unknown) => {
    console.error('[socket] server error:', payload);
  });

  return socket;
}

// ── Send action ──────────────────────────────────────────────────────────────

export function sendAction(action: Record<string, unknown>): void {
  if (!socket?.connected) {
    console.warn('[socket] sendAction called but not connected');
    return;
  }
  socket.emit('action', action);
}

// ── Disconnect ───────────────────────────────────────────────────────────────

export function disconnectFromGame(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ── Get socket (for advanced use) ───────────────────────────────────────────

export function getSocket(): Socket | null {
  return socket;
}
