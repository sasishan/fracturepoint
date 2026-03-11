import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { GameRoomOptions } from './game-room-manager.js';
import { diffGameState } from './state-differ.js';
import { validateAction } from './action-validator.js';

// Import types from shared-types (without running game-rules which needs full deps)
interface GameState {
  gameId: string;
  phase: string;
  clock: { strategyTick: number; gameDay: number; gameYear: number; gameMonth: number; speed: string };
  provinces: Record<string, unknown>;
  nations: Record<string, unknown>;
  units: Record<string, unknown>;
  diplomaticMatrix: Record<string, unknown>;
  tradeRoutes: Record<string, unknown>;
  globalTension: number;
  nuclearWinterProgress: number;
  totalNuclearDetonations: number;
  events: unknown[];
  rngSeed: number;
  rngState: number;
  victoryCheckTick: number;
}

interface PlayerSession {
  playerId: string;
  socketId: string;
  nation: string;
  connectedAt: number;
  lastActionAt: number;
  actionCount: number;
  isReady: boolean;
}

export class GameRoom {
  private gameId: string;
  private state: GameState;
  private prevState: GameState | null = null;
  private players = new Map<string, PlayerSession>();
  private actionQueue: unknown[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;
  private running = false;
  private io: SocketIOServer;
  private options: GameRoomOptions;

  constructor(gameId: string, options: GameRoomOptions, io: SocketIOServer) {
    this.gameId = gameId;
    this.options = options;
    this.io = io;
    this.state = this.buildInitialState();
  }

  // ── Player Management ─────────────────────────────────────────────────────

  addPlayer(socket: Socket, playerId: string, nation: string): void {
    if (this.players.size >= this.options.maxPlayers) {
      socket.emit('error', { code: 'ROOM_FULL' });
      return;
    }

    this.players.set(playerId, {
      playerId, socketId: socket.id, nation,
      connectedAt: Date.now(), lastActionAt: Date.now(),
      actionCount: 0, isReady: false,
    });

    socket.join(this.gameId);
    this.sendSnapshot(socket);

    this.io.to(this.gameId).emit('player_joined', {
      playerId, nation, playerCount: this.players.size,
    });
    console.log(`[ROOM ${this.gameId}] +player ${playerId} as ${nation}`);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.io.to(this.gameId).emit('player_left', { playerId });
    if (this.players.size === 0) this.pause();
  }

  // ── Action Queue ──────────────────────────────────────────────────────────

  queueAction(playerId: string, action: unknown): void {
    const session = this.players.get(playerId);
    if (!session) return;

    // Rate limit: max 10 actions per second
    const now = Date.now();
    if (now - session.lastActionAt < 100 && session.actionCount > 10) {
      this.io.to(session.socketId).emit('error', { code: 'RATE_LIMITED' });
      return;
    }

    const validation = validateAction(action, playerId, session.nation, this.state);
    if (!validation.valid) {
      this.io.to(session.socketId).emit('action_rejected', { action, reason: validation.reason });
      return;
    }

    session.lastActionAt = now;
    session.actionCount++;
    this.actionQueue.push(action);
  }

  // ── Tick Loop ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tickInterval = setInterval(() => {
      this.strategyTick().catch(err => console.error(`[ROOM ${this.gameId}] Tick error:`, err));
    }, this.options.tickRateMs);
    console.log(`[ROOM ${this.gameId}] Started (${this.options.tickRateMs}ms/tick)`);
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
  }

  destroy(): void {
    this.pause();
    this.players.clear();
    this.actionQueue = [];
  }

  private async strategyTick(): Promise<void> {
    const t0 = Date.now();
    const actions = this.actionQueue.splice(0);
    this.prevState = this.state;

    // Advance clock (game rules engine will be plugged in here once M03 builds)
    this.state = this.advanceClock(this.state, actions);
    this.tickCount++;

    await this.broadcastDelta();

    if (this.tickCount % 300 === 0) {
      console.log(`[ROOM ${this.gameId}] Checkpoint tick=${this.tickCount}`);
    }

    if (this.state.phase === 'victory' || this.state.phase === 'nuclear_winter') {
      await this.handleGameEnd();
    }

    const elapsed = Date.now() - t0;
    if (elapsed > this.options.tickRateMs * 0.8) {
      console.warn(`[ROOM ${this.gameId}] Slow tick: ${elapsed}ms`);
    }
  }

  private advanceClock(state: GameState, _actions: unknown[]): GameState {
    const tick = state.clock.strategyTick + 1;
    const day = state.clock.gameDay + 1;
    const year = 2026 + Math.floor(day / 365);
    const month = Math.min(12, Math.floor((day % 365) / 30) + 1);
    return { ...state, clock: { ...state.clock, strategyTick: tick, gameDay: day, gameYear: year, gameMonth: month } };
  }

  private async broadcastDelta(): Promise<void> {
    if (!this.prevState) return;
    const delta = diffGameState(this.prevState, this.state);
    this.io.to(this.gameId).emit('state_delta', JSON.stringify({
      tick: this.state.clock.strategyTick,
      delta,
    }));
  }

  private sendSnapshot(socket: Socket): void {
    socket.emit('state_snapshot', JSON.stringify({ type: 'full_snapshot', state: this.state }));
  }

  private async handleGameEnd(): Promise<void> {
    this.pause();
    this.io.to(this.gameId).emit('game_over', {
      phase: this.state.phase,
      tick: this.state.clock.strategyTick,
    });
  }

  private buildInitialState(): GameState {
    return {
      gameId: this.gameId,
      phase: 'lobby',
      clock: { strategyTick: 0, gameDay: 0, gameYear: 2026, gameMonth: 1, speed: 'normal' },
      provinces: {}, nations: {}, units: {}, diplomaticMatrix: {}, tradeRoutes: {},
      globalTension: 20,
      nuclearWinterProgress: 0,
      totalNuclearDetonations: 0,
      events: [],
      rngSeed: Math.floor(Math.random() * 2 ** 32),
      rngState: Math.floor(Math.random() * 2 ** 32),
      victoryCheckTick: 0,
    };
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  getGameId(): string { return this.gameId; }
  getState(): GameState { return this.state; }
  getPlayerCount(): number { return this.players.size; }
  getTickCount(): number { return this.tickCount; }
  isGameRunning(): boolean { return this.running; }
}
