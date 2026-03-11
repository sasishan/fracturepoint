import { pgTable, uuid, text, integer, real, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const games = pgTable('games', {
  id: uuid('id').primaryKey(),
  mode: text('mode').notNull(),
  phase: text('phase').notNull().default('lobby'),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  winnerNation: text('winner_nation'),
  winCondition: text('win_condition'),
  totalTicks: integer('total_ticks').default(0),
  playerCount: integer('player_count').notNull(),
  stateSnapshot: jsonb('state_snapshot'),
}, (t) => ({ phaseIdx: index('games_phase_idx').on(t.phase) }));

export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  eloRating: real('elo_rating').notNull().default(1200),
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  isBanned: boolean('is_banned').default(false),
});

export const gameParticipants = pgTable('game_participants', {
  id: uuid('id').primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  nation: text('nation').notNull(),
  finalGdp: real('final_gdp'),
  finalProvinceCount: integer('final_province_count'),
  finalScore: integer('final_score'),
  eloChange: real('elo_change'),
}, (t) => ({
  gameIdx: index('gp_game_idx').on(t.gameId),
  playerIdx: index('gp_player_idx').on(t.playerId),
}));

export const gameEvents = pgTable('game_events', {
  id: uuid('id').primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  tick: integer('tick').notNull(),
  playerId: uuid('player_id').references(() => players.id),
  nation: text('nation'),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({ gameTickIdx: index('ge_game_tick_idx').on(t.gameId, t.tick) }));
