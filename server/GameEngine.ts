import { GameState, PlayerState, TerritoryState, ProbeState, SupplyRoute, CommandType, ClientCommand, AttackTerritoryCommand, TransferArmiesCommand, LaunchProbeCommand, CreateSupplyRouteCommand, CombatResult, CommandError } from '../common/types/index.js';
import { GAME_CONSTANTS } from '../common/gameConstants.js';

export class GameEngine {
  private gameState: GameState;
  private lastUpdate: number;
  private tickRate: number;
  private gameSpeed: number;

  constructor(config: { mapSize: number; tickRate?: number; gameSpeed?: number }) {
    this.tickRate = config.tickRate || 20; // 20 updates per second
    this.gameSpeed = config.gameSpeed || 1.0; // Normal speed default
    this.lastUpdate = Date.now();
    
    this.gameState = {
      territories: {},
      players: {},
      probes: [],
      supplyRoutes: [],
      gamePhase: 'lobby',
      winner: null,
      tick: 0,
      lastUpdate: this.lastUpdate
    };

    this.generateMap(config.mapSize);
  }

  private generateMap(territoryCount: number): void {
    // Generate territories using Poisson disk sampling
    const territories = this.poissonDiskSampling(territoryCount, 2000, 2000);
    
    territories.forEach((pos, index) => {
      const territory: TerritoryState = {
        id: index,
        ownerId: null,
        armySize: 0,
        x: pos.x,
        y: pos.y,
        radius: GAME_CONSTANTS.TERRITORY_RADIUS,
        neighbors: [],
        hiddenNeighbors: [],
        isColonizable: true,
        hiddenArmySize: Math.floor(Math.random() * 50) + 1,
        lastCombatFlash: 0
      };
      
      this.gameState.territories[index] = territory;
    });

    this.connectTerritories();
    console.log(`Generated ${territoryCount} territories with connections`);
  }

  private poissonDiskSampling(numSamples: number, width: number, height: number): { x: number; y: number }[] {
    const minDistance = 80;
    const maxAttempts = 30;
    const cellSize = minDistance / Math.sqrt(2);
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);
    
    const grid: number[][] = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(-1));
    const points: { x: number; y: number }[] = [];
    const activeList: number[] = [];

    // Initial point
    const firstPoint = {
      x: Math.random() * width,
      y: Math.random() * height
    };
    
    points.push(firstPoint);
    activeList.push(0);
    
    const gridX = Math.floor(firstPoint.x / cellSize);
    const gridY = Math.floor(firstPoint.y / cellSize);
    grid[gridY][gridX] = 0;

    while (activeList.length > 0 && points.length < numSamples) {
      const randomIndex = Math.floor(Math.random() * activeList.length);
      const currentIndex = activeList[randomIndex];
      const currentPoint = points[currentIndex];
      
      let found = false;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = minDistance + Math.random() * minDistance;
        
        const newPoint = {
          x: currentPoint.x + Math.cos(angle) * distance,
          y: currentPoint.y + Math.sin(angle) * distance
        };
        
        if (newPoint.x >= 0 && newPoint.x < width && newPoint.y >= 0 && newPoint.y < height) {
          const newGridX = Math.floor(newPoint.x / cellSize);
          const newGridY = Math.floor(newPoint.y / cellSize);
          
          let valid = true;
          
          for (let dy = -2; dy <= 2 && valid; dy++) {
            for (let dx = -2; dx <= 2 && valid; dx++) {
              const checkX = newGridX + dx;
              const checkY = newGridY + dy;
              
              if (checkX >= 0 && checkX < gridWidth && checkY >= 0 && checkY < gridHeight) {
                const pointIndex = grid[checkY][checkX];
                if (pointIndex !== -1) {
                  const existingPoint = points[pointIndex];
                  const dist = Math.sqrt(
                    Math.pow(newPoint.x - existingPoint.x, 2) +
                    Math.pow(newPoint.y - existingPoint.y, 2)
                  );
                  if (dist < minDistance) {
                    valid = false;
                  }
                }
              }
            }
          }
          
          if (valid) {
            points.push(newPoint);
            activeList.push(points.length - 1);
            grid[newGridY][newGridX] = points.length - 1;
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        activeList.splice(randomIndex, 1);
      }
    }

    return points;
  }

  private connectTerritories(): void {
    const territories = Object.values(this.gameState.territories);
    
    for (let i = 0; i < territories.length; i++) {
      for (let j = i + 1; j < territories.length; j++) {
        const territory1 = territories[i];
        const territory2 = territories[j];
        
        const distance = Math.sqrt(
          Math.pow(territory2.x - territory1.x, 2) +
          Math.pow(territory2.y - territory1.y, 2)
        );
        
        if (distance <= GAME_CONSTANTS.CONNECTION_DISTANCE) {
          // All connections are hidden initially since all territories are colonizable
          territory1.hiddenNeighbors.push(territory2.id);
          territory2.hiddenNeighbors.push(territory1.id);
        }
      }
    }
  }

  public addPlayer(playerId: string, name: string, color: string, type: 'human' | 'ai'): void {
    const player: PlayerState = {
      id: playerId,
      name,
      color,
      type,
      territoriesOwned: 0,
      totalArmies: 0,
      isEliminated: false,
      territories: [],
      armyGenRate: 1
    };

    this.gameState.players[playerId] = player;
    console.log(`Player ${name} (${type}) added to game`);
  }

  public startGame(): void {
    this.gameState.gamePhase = 'playing';
    this.distributeStartingTerritories();
    console.log('Game started with server-authoritative engine');
  }

  private distributeStartingTerritories(): void {
    const players = Object.values(this.gameState.players);
    const territories = Object.values(this.gameState.territories);
    const availableTerritories = [...territories];
    
    // Shuffle territories
    for (let i = availableTerritories.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableTerritories[i], availableTerritories[j]] = [availableTerritories[j], availableTerritories[i]];
    }

    // Give each player exactly one starting territory
    players.forEach((player, index) => {
      if (index < availableTerritories.length) {
        const territory = availableTerritories[index];
        this.colonizeTerritory(territory.id, player.id, 50);
      }
    });

    this.updatePlayerStats();
  }

  private colonizeTerritory(territoryId: number, playerId: string, armySize: number): void {
    const territory = this.gameState.territories[territoryId];
    const player = this.gameState.players[playerId];
    
    if (!territory || !player) return;

    territory.ownerId = playerId;
    territory.armySize = armySize;
    territory.isColonizable = false;
    
    // Reveal hidden connections
    territory.neighbors = [...territory.hiddenNeighbors];
    territory.hiddenNeighbors = [];
    
    // Add to player's territories
    if (!player.territories.includes(territoryId)) {
      player.territories.push(territoryId);
    }
  }

  public update(deltaTime: number): void {
    if (this.gameState.gamePhase !== 'playing') return;

    this.gameState.tick++;
    this.gameState.lastUpdate = Date.now();

    // Update probes
    this.updateProbes(deltaTime);

    // Generate armies for owned territories
    this.generateArmies(deltaTime);

    // Process supply routes
    this.processSupplyRoutes(deltaTime);

    // Update AI players
    this.updateAI(deltaTime);

    // Check win conditions
    this.checkWinConditions();
  }

  private updateProbes(deltaTime: number): void {
    for (let i = this.gameState.probes.length - 1; i >= 0; i--) {
      const probe = this.gameState.probes[i];
      const elapsed = Date.now() - probe.startTime;
      probe.progress = Math.min(1.0, elapsed / probe.duration);

      if (probe.progress >= 1.0) {
        this.completeProbeColonization(probe);
        this.gameState.probes.splice(i, 1);
      }
    }
  }

  private completeProbeColonization(probe: ProbeState): void {
    const territory = this.gameState.territories[probe.toTerritoryId];
    if (!territory || territory.ownerId !== null) return;

    this.colonizeTerritory(probe.toTerritoryId, probe.playerId, 1);
    console.log(`Probe colonized territory ${probe.toTerritoryId} for player ${probe.playerId}`);
  }

  private generateArmies(deltaTime: number): void {
    Object.values(this.gameState.territories).forEach(territory => {
      if (territory.ownerId) {
        const player = this.gameState.players[territory.ownerId];
        if (player && !player.isEliminated) {
          // Apply game speed multiplier to army generation
          const speedAdjustedDelta = deltaTime * this.gameSpeed;
          const generationChance = speedAdjustedDelta / GAME_CONSTANTS.ARMY_GENERATION_RATE;
          if (Math.random() < generationChance) {
            territory.armySize++;
          }
        }
      }
    });
  }

  private processSupplyRoutes(deltaTime: number): void {
    // Implementation for supply route processing
    // This would handle the delayed transfers between territories
  }

  private updateAI(deltaTime: number): void {
    const aiPlayers = Object.values(this.gameState.players).filter(p => p.type === 'ai' && !p.isEliminated);
    
    // Apply game speed to AI decision timing
    const speedAdjustedChance = 0.01 * this.gameSpeed;
    
    aiPlayers.forEach(player => {
      if (Math.random() < speedAdjustedChance) { // Speed-adjusted chance to take action
        this.makeAIDecision(player);
      }
    });
  }

  private makeAIDecision(player: PlayerState): void {
    const ownedTerritories = player.territories.map(id => this.gameState.territories[id]).filter(Boolean);
    
    if (ownedTerritories.length === 0) return;

    // Simple AI: try to launch probes or attack
    const randomTerritory = ownedTerritories[Math.floor(Math.random() * ownedTerritories.length)];
    
    if (randomTerritory.armySize >= GAME_CONSTANTS.PROBE_COST) {
      // Try to find a colonizable neighbor
      const colonizableNeighbors = randomTerritory.neighbors
        .map(id => this.gameState.territories[id])
        .filter(t => t && t.isColonizable && t.ownerId === null);
      
      if (colonizableNeighbors.length > 0) {
        const target = colonizableNeighbors[Math.floor(Math.random() * colonizableNeighbors.length)];
        this.executeCommand(player.id, {
          type: CommandType.LAUNCH_PROBE,
          payload: { fromTerritoryId: randomTerritory.id, toTerritoryId: target.id },
          timestamp: Date.now()
        });
      }
    }
  }

  private checkWinConditions(): void {
    const alivePlayers = Object.values(this.gameState.players).filter(p => !p.isEliminated && p.territories.length > 0);
    
    if (alivePlayers.length === 1) {
      this.gameState.gamePhase = 'ended';
      this.gameState.winner = alivePlayers[0].id;
      console.log(`Game ended. Winner: ${alivePlayers[0].name}`);
    }
  }

  private updatePlayerStats(): void {
    Object.values(this.gameState.players).forEach(player => {
      player.territoriesOwned = player.territories.length;
      player.totalArmies = player.territories
        .map(id => this.gameState.territories[id])
        .filter(Boolean)
        .reduce((sum, territory) => sum + territory.armySize, 0);
      
      if (player.territoriesOwned === 0 && !player.isEliminated) {
        player.isEliminated = true;
        console.log(`Player ${player.name} eliminated`);
      }
    });
  }

  public executeCommand(playerId: string, command: ClientCommand): CombatResult | CommandError | null {
    const player = this.gameState.players[playerId];
    if (!player || player.isEliminated) {
      return { command: command.type, reason: 'Player not found or eliminated', timestamp: Date.now() };
    }

    switch (command.type) {
      case CommandType.ATTACK_TERRITORY:
        return this.handleAttackCommand(playerId, command.payload as AttackTerritoryCommand);
      
      case CommandType.TRANSFER_ARMIES:
        return this.handleTransferCommand(playerId, command.payload as TransferArmiesCommand);
      
      case CommandType.LAUNCH_PROBE:
        return this.handleProbeCommand(playerId, command.payload as LaunchProbeCommand);
      
      case CommandType.CREATE_SUPPLY_ROUTE:
        return this.handleSupplyRouteCommand(playerId, command.payload as CreateSupplyRouteCommand);
      
      default:
        return { command: command.type, reason: 'Unknown command type', timestamp: Date.now() };
    }
  }

  private handleAttackCommand(playerId: string, payload: AttackTerritoryCommand): CombatResult | CommandError {
    const fromTerritory = this.gameState.territories[payload.fromTerritoryId];
    const toTerritory = this.gameState.territories[payload.toTerritoryId];

    // Validation
    if (!fromTerritory || !toTerritory) {
      return { command: CommandType.ATTACK_TERRITORY, reason: 'Invalid territory', timestamp: Date.now() };
    }

    if (fromTerritory.ownerId !== playerId) {
      return { command: CommandType.ATTACK_TERRITORY, reason: 'You do not own the source territory', timestamp: Date.now() };
    }

    if (!fromTerritory.neighbors.includes(toTerritory.id)) {
      return { command: CommandType.ATTACK_TERRITORY, reason: 'Territories are not adjacent', timestamp: Date.now() };
    }

    if (fromTerritory.armySize < GAME_CONSTANTS.MIN_ATTACK_ARMIES) {
      return { command: CommandType.ATTACK_TERRITORY, reason: 'Insufficient armies to attack', timestamp: Date.now() };
    }

    if (toTerritory.ownerId === playerId) {
      return { command: CommandType.ATTACK_TERRITORY, reason: 'Cannot attack your own territory', timestamp: Date.now() };
    }

    // Execute combat
    return this.resolveCombat(fromTerritory, toTerritory);
  }

  private resolveCombat(attackingTerritory: TerritoryState, defendingTerritory: TerritoryState): CombatResult {
    const attackingArmies = attackingTerritory.armySize - 1;
    const defendingArmies = defendingTerritory.armySize;

    const attackPower = attackingArmies * (0.8 + Math.random() * GAME_CONSTANTS.COMBAT_ATTACKER_MODIFIER);
    const defensePower = defendingArmies * (0.9 + Math.random() * GAME_CONSTANTS.COMBAT_DEFENDER_MODIFIER);

    defendingTerritory.lastCombatFlash = Date.now();

    if (attackPower > defensePower) {
      // Attacker wins
      const survivingArmies = Math.ceil(attackingArmies * 0.7);
      
      // Transfer ownership
      const previousOwner = defendingTerritory.ownerId;
      defendingTerritory.ownerId = attackingTerritory.ownerId;
      defendingTerritory.armySize = survivingArmies;
      attackingTerritory.armySize = 1;

      // Update player territories
      if (previousOwner) {
        const prevPlayer = this.gameState.players[previousOwner];
        if (prevPlayer) {
          const index = prevPlayer.territories.indexOf(defendingTerritory.id);
          if (index > -1) prevPlayer.territories.splice(index, 1);
        }
      }

      const newOwner = this.gameState.players[attackingTerritory.ownerId!];
      if (newOwner && !newOwner.territories.includes(defendingTerritory.id)) {
        newOwner.territories.push(defendingTerritory.id);
      }

      this.updatePlayerStats();

      return {
        attackerId: attackingTerritory.ownerId!,
        defenderId: previousOwner,
        fromTerritoryId: attackingTerritory.id,
        toTerritoryId: defendingTerritory.id,
        result: 'victory',
        survivingArmies,
        timestamp: Date.now()
      };
    } else {
      // Defender wins
      const survivingDefenders = Math.ceil(defendingArmies * 0.8);
      defendingTerritory.armySize = survivingDefenders;
      attackingTerritory.armySize = 1;

      return {
        attackerId: attackingTerritory.ownerId!,
        defenderId: defendingTerritory.ownerId,
        fromTerritoryId: attackingTerritory.id,
        toTerritoryId: defendingTerritory.id,
        result: 'defeat',
        survivingArmies: survivingDefenders,
        timestamp: Date.now()
      };
    }
  }

  private handleTransferCommand(playerId: string, payload: TransferArmiesCommand): CommandError | null {
    const fromTerritory = this.gameState.territories[payload.fromTerritoryId];
    const toTerritory = this.gameState.territories[payload.toTerritoryId];

    if (!fromTerritory || !toTerritory) {
      return { command: CommandType.TRANSFER_ARMIES, reason: 'Invalid territory', timestamp: Date.now() };
    }

    if (fromTerritory.ownerId !== playerId || toTerritory.ownerId !== playerId) {
      return { command: CommandType.TRANSFER_ARMIES, reason: 'You must own both territories', timestamp: Date.now() };
    }

    if (!fromTerritory.neighbors.includes(toTerritory.id)) {
      return { command: CommandType.TRANSFER_ARMIES, reason: 'Territories are not adjacent', timestamp: Date.now() };
    }

    if (fromTerritory.armySize <= 1) {
      return { command: CommandType.TRANSFER_ARMIES, reason: 'Insufficient armies to transfer', timestamp: Date.now() };
    }

    // Execute transfer
    const transferAmount = Math.floor(fromTerritory.armySize / 2);
    fromTerritory.armySize -= transferAmount;
    toTerritory.armySize += transferAmount;

    this.updatePlayerStats();
    return null;
  }

  private handleProbeCommand(playerId: string, payload: LaunchProbeCommand): CommandError | null {
    const fromTerritory = this.gameState.territories[payload.fromTerritoryId];
    const toTerritory = this.gameState.territories[payload.toTerritoryId];

    if (!fromTerritory || !toTerritory) {
      return { command: CommandType.LAUNCH_PROBE, reason: 'Invalid territory', timestamp: Date.now() };
    }

    if (fromTerritory.ownerId !== playerId) {
      return { command: CommandType.LAUNCH_PROBE, reason: 'You do not own the source territory', timestamp: Date.now() };
    }

    if (fromTerritory.armySize < GAME_CONSTANTS.PROBE_COST) {
      return { command: CommandType.LAUNCH_PROBE, reason: 'Insufficient armies for probe', timestamp: Date.now() };
    }

    if (!toTerritory.isColonizable || toTerritory.ownerId !== null) {
      return { command: CommandType.LAUNCH_PROBE, reason: 'Target territory is not colonizable', timestamp: Date.now() };
    }

    // Launch probe
    fromTerritory.armySize -= GAME_CONSTANTS.PROBE_COST;
    
    const distance = Math.sqrt(
      Math.pow(toTerritory.x - fromTerritory.x, 2) +
      Math.pow(toTerritory.y - fromTerritory.y, 2)
    );
    
    // Apply game speed multiplier to probe travel time (faster speed = shorter duration)
    const duration = (distance / GAME_CONSTANTS.PROBE_SPEED) * 1000 / this.gameSpeed;
    const player = this.gameState.players[playerId];

    const probe: ProbeState = {
      id: this.gameState.probes.length,
      fromTerritoryId: fromTerritory.id,
      toTerritoryId: toTerritory.id,
      playerId,
      playerColor: player?.color || '#ffffff',
      progress: 0,
      startTime: Date.now(),
      duration
    };

    this.gameState.probes.push(probe);
    return null;
  }

  private handleSupplyRouteCommand(playerId: string, payload: CreateSupplyRouteCommand): CommandError | null {
    // Implementation for supply route creation
    return null;
  }

  public getGameState(): GameState {
    return { ...this.gameState };
  }

  public getPlayerGameState(playerId: string): Partial<GameState> {
    // Return only information visible to this player
    // For now, return full state (could be restricted later for fog of war)
    return this.getGameState();
  }
}