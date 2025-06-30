// Shared types and interfaces between client and server
export interface PlayerState {
  id: string;
  name: string;
  color: string;
  type: 'human' | 'ai';
  territoriesOwned: number;
  totalArmies: number;
  isEliminated: boolean;
  territories: number[];
  armyGenRate: number;
}

export interface TerritoryState {
  id: number;
  ownerId: string | null;
  armySize: number;
  x: number;
  y: number;
  radius: number;
  neighbors: number[];
  hiddenNeighbors: number[];
  isColonizable: boolean;
  hiddenArmySize: number;
  lastCombatFlash: number;
}

export interface ProbeState {
  id: number;
  fromTerritoryId: number;
  toTerritoryId: number;
  playerId: string;
  playerColor: string;
  progress: number;
  startTime: number;
  duration: number;
}

export interface SupplyRoute {
  from: number;
  to: number;
  path: number[];
  active: boolean;
}

export interface GameState {
  territories: Record<number, TerritoryState>;
  players: Record<string, PlayerState>;
  probes: ProbeState[];
  supplyRoutes: SupplyRoute[];
  gamePhase: 'lobby' | 'playing' | 'ended';
  winner: string | null;
  tick: number;
  lastUpdate: number;
}

export enum CommandType {
  ATTACK_TERRITORY = 'ATTACK_TERRITORY',
  TRANSFER_ARMIES = 'TRANSFER_ARMIES',
  LAUNCH_PROBE = 'LAUNCH_PROBE',
  CREATE_SUPPLY_ROUTE = 'CREATE_SUPPLY_ROUTE',
  SELECT_TERRITORY = 'SELECT_TERRITORY',
}

export interface ClientCommand {
  type: CommandType;
  payload: any;
  timestamp: number;
}

// Specific command payloads
export interface AttackTerritoryCommand {
  fromTerritoryId: number;
  toTerritoryId: number;
}

export interface TransferArmiesCommand {
  fromTerritoryId: number;
  toTerritoryId: number;
}

export interface LaunchProbeCommand {
  fromTerritoryId: number;
  toTerritoryId: number;
}

export interface CreateSupplyRouteCommand {
  fromTerritoryId: number;
  toTerritoryId: number;
}

export interface SelectTerritoryCommand {
  territoryId: number;
}

// Server responses
export interface GameStateUpdate {
  type: 'FULL_STATE' | 'DELTA_STATE';
  gameState: Partial<GameState>;
  timestamp: number;
}

export interface CombatResult {
  attackerId: string;
  defenderId: string | null;
  fromTerritoryId: number;
  toTerritoryId: number;
  result: 'victory' | 'defeat';
  survivingArmies: number;
  timestamp: number;
}

export interface CommandError {
  command: CommandType;
  reason: string;
  timestamp: number;
}

// Game configuration
export interface GameConfig {
  mapSize: number;
  aiPlayerCount: number;
  playerName: string;
  maxPlayers: number;
  tickRate: number; // Server updates per second
  gameSpeed: number; // Speed multiplier for all game actions (0.01-2.0)
}

// Constants for game balancing
export const GAME_CONSTANTS = {
  PROBE_COST: 10,
  PROBE_SPEED: 25, // pixels per second
  ARMY_GENERATION_RATE: 3000, // milliseconds per army
  MIN_ATTACK_ARMIES: 2,
  COMBAT_ATTACKER_MODIFIER: 0.2, // 0.8-1.2 range
  COMBAT_DEFENDER_MODIFIER: 0.1, // 0.9-1.1 range
  TERRITORY_RADIUS: 25,
  CONNECTION_DISTANCE: 120,
  SUPPLY_ROUTE_DELAY_PER_HOP: 2000, // milliseconds
} as const;