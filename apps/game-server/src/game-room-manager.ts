import type { Server as SocketIOServer } from 'socket.io';
import { GameRoom } from './game-room.js';

export interface GameRoomOptions {
  maxPlayers: number;
  gameMode: 'skirmish' | 'grand_strategy' | 'campaign' | 'crisis' | 'sandbox';
  tickRateMs: number;
  startingNations: string[];
}

export class GameRoomManager {
  private rooms = new Map<string, GameRoom>();
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  createRoom(gameId: string, options: GameRoomOptions): GameRoom {
    if (this.rooms.has(gameId)) throw new Error(`Room ${gameId} already exists`);
    const room = new GameRoom(gameId, options, this.io);
    this.rooms.set(gameId, room);
    console.log(`[ROOMS] Created room ${gameId} (${options.gameMode})`);
    return room;
  }

  getRoom(gameId: string): GameRoom | undefined {
    return this.rooms.get(gameId);
  }

  removeRoom(gameId: string): void {
    const room = this.rooms.get(gameId);
    if (room) { room.destroy(); this.rooms.delete(gameId); }
  }

  getRoomCount(): number { return this.rooms.size; }

  getTotalPlayerCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) total += room.getPlayerCount();
    return total;
  }

  getStats() {
    return {
      rooms: this.rooms.size,
      totalPlayers: this.getTotalPlayerCount(),
      roomList: [...this.rooms.entries()].map(([id, r]) => ({
        id, players: r.getPlayerCount(), tick: r.getTickCount(), running: r.isGameRunning(),
      })),
    };
  }
}
