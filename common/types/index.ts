// Shared types for client and server communication.

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  type: 'human' | 'ai';
  socketId?: string;
  territories: number[];
  armyGenRate: number;
  totalArmies: number;
  territoriesOwned: number;
  isEliminated: boolean;
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
    progress: number; // 0.0 to 1.0
    startTime: number;
    duration: number;
}

export interface ShipAnimationState {
    from: { x: number; y: number };
    to: { x: number; y: number };
    progress: number; // elapsed time
    duration: number;
    color: string;
    isAttack: boolean;
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

// Command Protocol
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

export interface GameConfig {
  mapSize: number;
  aiPlayerCount: number;
  playerName: string;
  maxPlayers: number;
  tickRate: number; // Server updates per second
  gameSpeed: number; // Speed multiplier for all game actions (0.01-2.0)
}