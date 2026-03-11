import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { GameRoomManager } from './game-room-manager.js';

export function registerSocketHandlers(io: SocketIOServer, roomManager: GameRoomManager): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[WS] Connect: ${socket.id} from ${socket.handshake.address}`);

    let currentRoomId: string | null = null;
    let currentPlayerId: string | null = null;

    socket.on('join_game', (data: unknown) => {
      try {
        const { gameId, playerId, nation } = data as { gameId: string; playerId: string; nation: string };
        if (!gameId || !playerId || !nation) {
          socket.emit('error', { code: 'INVALID_JOIN_DATA' });
          return;
        }

        let room = roomManager.getRoom(gameId);
        if (!room) {
          room = roomManager.createRoom(gameId, {
            maxPlayers: 8, gameMode: 'skirmish', tickRateMs: 200, startingNations: [nation],
          });
        }

        currentRoomId = gameId;
        currentPlayerId = playerId;
        room.addPlayer(socket, playerId, nation);

      } catch (err) {
        socket.emit('error', { code: 'JOIN_FAILED', message: String(err) });
      }
    });

    socket.on('action', (data: unknown) => {
      if (!currentRoomId || !currentPlayerId) {
        socket.emit('error', { code: 'NOT_IN_GAME' });
        return;
      }
      const room = roomManager.getRoom(currentRoomId);
      if (!room) { socket.emit('error', { code: 'ROOM_NOT_FOUND' }); return; }
      room.queueAction(currentPlayerId, data);
    });

    socket.on('start_game', () => {
      if (!currentRoomId) return;
      const room = roomManager.getRoom(currentRoomId);
      if (room && !room.isGameRunning()) {
        room.start();
        io.to(currentRoomId).emit('game_started', {
          tick: 0, gameId: currentRoomId, timestamp: Date.now(),
        });
      }
    });

    socket.on('ping', (ts: number) => {
      socket.emit('pong', { timestamp: ts, serverTime: Date.now() });
    });

    socket.on('chat', (data: unknown) => {
      if (!currentRoomId || !currentPlayerId) return;
      const msg = data as { message: string };
      if (typeof msg.message !== 'string' || msg.message.length > 500) return;
      io.to(currentRoomId).emit('chat', {
        playerId: currentPlayerId,
        message: msg.message.trim(),
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[WS] Disconnect: ${socket.id} (${reason})`);
      if (currentRoomId && currentPlayerId) {
        roomManager.getRoom(currentRoomId)?.removePlayer(currentPlayerId);
      }
    });
  });
}
