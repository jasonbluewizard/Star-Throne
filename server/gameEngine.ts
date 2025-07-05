// Server-side authoritative game engine containing all game logic
// This replaces client-side authority with proper server validation

import { GAME_CONSTANTS } from '../common/gameConstants.js';
import { PlayerState, TerritoryState, ProbeState, GameState, SupplyRoute, CommandType, ClientCommand } from '../common/types/index.js';

export class GameEngine {
    private gameState: GameState;
    private lastUpdate: number;
    private tickRate: number;
    private gameSpeed: number;
    private gameMap: any; // Territory map structure
    public players: Map<string, any> = new Map();

    constructor(config: { mapSize: number; aiCount: number; humanPlayers: Array<{name: string, id: string}> }) {
        this.tickRate = GAME_CONSTANTS.SERVER_TICK_RATE_MS;
        this.gameSpeed = 1.0;
        this.lastUpdate = Date.now();
        
        // Initialize game state
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
        this.initializePlayers(config.humanPlayers, config.aiCount);
        this.distributeStartingTerritories();
    }

    private generateMap(territoryCount: number): void {
        // Generate territories with colonizable planets
        for (let i = 0; i < territoryCount; i++) {
            const territory: TerritoryState = {
                id: i,
                ownerId: null,
                armySize: 0,
                x: Math.random() * GAME_CONSTANTS.DEFAULT_MAP_WIDTH,
                y: Math.random() * GAME_CONSTANTS.DEFAULT_MAP_HEIGHT,
                radius: GAME_CONSTANTS.TERRITORY_RADIUS,
                neighbors: [],
                hiddenNeighbors: [],
                isColonizable: true,
                hiddenArmySize: Math.floor(Math.random() * 50) + 1,
                lastCombatFlash: 0
            };
            this.gameState.territories[i] = territory;
        }

        // Connect territories based on distance
        this.connectTerritories();
    }

    private connectTerritories(): void {
        const territories = Object.values(this.gameState.territories);
        
        territories.forEach(territory => {
            territories.forEach(other => {
                if (territory.id !== other.id) {
                    const distance = Math.sqrt(
                        (territory.x - other.x) ** 2 + (territory.y - other.y) ** 2
                    );
                    
                    if (distance < GAME_CONSTANTS.CONNECTION_DISTANCE) {
                        if (territory.isColonizable) {
                            territory.hiddenNeighbors.push(other.id);
                        } else {
                            territory.neighbors.push(other.id);
                        }
                    }
                }
            });
        });
    }

    private initializePlayers(humanPlayers: Array<{name: string, id: string}>, aiCount: number): void {
        // Add human players
        humanPlayers.forEach(human => {
            const player: PlayerState = {
                id: human.id,
                name: human.name,
                color: '#00ffff', // Cyan for human
                type: 'human',
                territories: [],
                armyGenRate: 1,
                totalArmies: 0,
                territoriesOwned: 0,
                isEliminated: false
            };
            this.gameState.players[human.id] = player;
            this.players.set(human.id, player);
        });

        // Add AI players
        for (let i = 0; i < aiCount; i++) {
            const aiId = `${GAME_CONSTANTS.AI_PLAYER_ID_PREFIX}_${i}`;
            const player: PlayerState = {
                id: aiId,
                name: this.generateAIName(i),
                color: this.generatePlayerColor(i + humanPlayers.length),
                type: 'ai',
                territories: [],
                armyGenRate: 1,
                totalArmies: 0,
                territoriesOwned: 0,
                isEliminated: false
            };
            this.gameState.players[aiId] = player;
            this.players.set(aiId, player);
        }
    }

    private distributeStartingTerritories(): void {
        const players = Object.values(this.gameState.players);
        const territories = Object.values(this.gameState.territories);
        const usedTerritories: number[] = [];

        players.forEach(player => {
            // Find territory with maximum distance from others
            let bestTerritory = null;
            let bestDistance = 0;

            territories.forEach(territory => {
                if (usedTerritories.includes(territory.id)) return;

                let minDistanceToUsed = Infinity;
                usedTerritories.forEach(usedId => {
                    const used = this.gameState.territories[usedId];
                    const distance = Math.sqrt(
                        (territory.x - used.x) ** 2 + (territory.y - used.y) ** 2
                    );
                    minDistanceToUsed = Math.min(minDistanceToUsed, distance);
                });

                if (usedTerritories.length === 0 || minDistanceToUsed > bestDistance) {
                    bestTerritory = territory;
                    bestDistance = minDistanceToUsed;
                }
            });

            if (bestTerritory) {
                this.colonizeTerritory(bestTerritory.id, player.id, GAME_CONSTANTS.INITIAL_STARTING_ARMY_SIZE);
                usedTerritories.push(bestTerritory.id);
            }
        });
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
        
        player.territories.push(territoryId);
        this.updatePlayerStats();
    }

    public startGame(): void {
        this.gameState.gamePhase = 'playing';
        console.log(`Server: Game started with ${Object.keys(this.gameState.players).length} players`);
    }

    public update(deltaTime: number): void {
        if (this.gameState.gamePhase !== 'playing') return;

        this.gameState.tick++;
        this.gameState.lastUpdate = Date.now();

        this.updateProbes(deltaTime);
        this.generateArmies(deltaTime);
        this.updateAI(deltaTime);
        this.checkWinConditions();
    }

    private updateProbes(deltaTime: number): void {
        for (let i = this.gameState.probes.length - 1; i >= 0; i--) {
            const probe = this.gameState.probes[i];
            probe.progress += deltaTime / probe.duration;

            if (probe.progress >= 1) {
                this.completeProbeColonization(probe);
                this.gameState.probes.splice(i, 1);
            }
        }
    }

    private completeProbeColonization(probe: ProbeState): void {
        const territory = this.gameState.territories[probe.toTerritoryId];
        if (territory && territory.isColonizable && territory.ownerId === null) {
            this.colonizeTerritory(probe.toTerritoryId, probe.playerId, GAME_CONSTANTS.INITIAL_COLONIZED_ARMY_SIZE);
            console.log(`Server: Probe colonized territory ${probe.toTerritoryId} for player ${probe.playerId}`);
        } else if (territory && territory.ownerId !== null) {
            console.log(`Server: Probe from player ${probe.playerId} destroyed! Territory ${probe.toTerritoryId} already owned by ${territory.ownerId}`);
        }
    }

    private generateArmies(deltaTime: number): void {
        Object.values(this.gameState.territories).forEach(territory => {
            if (territory.ownerId && !territory.isColonizable) {
                const player = this.gameState.players[territory.ownerId];
                if (player && !player.isEliminated) {
                    // Speed-adjusted army generation
                    const generationChance = (deltaTime * this.gameSpeed) / GAME_CONSTANTS.ARMY_GENERATION_RATE;
                    if (Math.random() < generationChance) {
                        territory.armySize++;
                    }
                }
            }
        });
    }

    private updateAI(deltaTime: number): void {
        const aiPlayers = Object.values(this.gameState.players).filter(p => p.type === 'ai' && !p.isEliminated);
        
        // Map size adaptive AI decision frequency
        const totalTerritories = Object.keys(this.gameState.territories).length;
        let decisionChance = (deltaTime * this.gameSpeed) / GAME_CONSTANTS.AI_DECISION_INTERVAL_MS;
        
        if (totalTerritories >= GAME_CONSTANTS.AI_MASSIVE_MAP_THRESHOLD) {
          decisionChance *= 0.005; // 99.5% slower on massive maps (almost freeze AI)
        } else if (totalTerritories >= GAME_CONSTANTS.AI_LARGE_MAP_THRESHOLD) {
          decisionChance *= 0.02; // 98% slower on large maps
        }
        
        aiPlayers.forEach(player => {
            if (Math.random() < decisionChance) {
                this.makeAIDecision(player);
            }
        });
    }

    private makeAIDecision(player: PlayerState): void {
        const ownedTerritories = player.territories
            .map(id => this.gameState.territories[id])
            .filter(t => t && t.ownerId === player.id);

        if (ownedTerritories.length === 0) return;

        // Map size adaptive AI throttling
        const totalTerritories = Object.keys(this.gameState.territories).length;
        let probeChance = GAME_CONSTANTS.AI_PROBE_LAUNCH_CHANCE_NORMAL;
        
        if (totalTerritories >= GAME_CONSTANTS.AI_MASSIVE_MAP_THRESHOLD) {
          probeChance = GAME_CONSTANTS.AI_PROBE_LAUNCH_CHANCE_MASSIVE;
        } else if (totalTerritories >= GAME_CONSTANTS.AI_LARGE_MAP_THRESHOLD) {
          probeChance = GAME_CONSTANTS.AI_PROBE_LAUNCH_CHANCE_LARGE;
        }

        // Simple AI: try to expand or attack
        const actionTerritory = ownedTerritories.find(t => t.armySize >= GAME_CONSTANTS.PROBE_MIN_ARMY_TO_LAUNCH);
        if (!actionTerritory) return;

        // Try to launch probe to colonizable neighbor (with map-size throttling)
        const colonizableNeighbor = actionTerritory.neighbors
            .map(id => this.gameState.territories[id])
            .find(t => t && t.isColonizable);

        if (colonizableNeighbor && Math.random() < probeChance) {
            this.launchProbe(player.id, actionTerritory.id, colonizableNeighbor.id);
            return;
        }

        // Try to attack weak enemy neighbor
        const enemyNeighbor = actionTerritory.neighbors
            .map(id => this.gameState.territories[id])
            .find(t => t && t.ownerId && t.ownerId !== player.id && 
                  actionTerritory.armySize > t.armySize * GAME_CONSTANTS.AI_ATTACK_STRENGTH_MULTIPLIER);

        if (enemyNeighbor) {
            this.attackTerritory(player.id, actionTerritory.id, enemyNeighbor.id);
        }
    }

    public executeCommand(playerId: string, command: ClientCommand): boolean {
        const player = this.gameState.players[playerId];
        if (!player || player.isEliminated) return false;

        switch (command.type) {
            case CommandType.ATTACK_TERRITORY:
                return this.attackTerritory(playerId, command.payload.fromTerritoryId, command.payload.toTerritoryId);
            
            case CommandType.LAUNCH_PROBE:
                return this.launchProbe(playerId, command.payload.fromTerritoryId, command.payload.toTerritoryId);
            
            case CommandType.TRANSFER_ARMIES:
                return this.transferArmies(playerId, command.payload.fromTerritoryId, command.payload.toTerritoryId);
            
            default:
                return false;
        }
    }

    public attackTerritory(playerId: string, fromTerritoryId: number, toTerritoryId: number): boolean {
        const fromTerritory = this.gameState.territories[fromTerritoryId];
        const toTerritory = this.gameState.territories[toTerritoryId];
        const player = this.gameState.players[playerId];

        if (!fromTerritory || !toTerritory || !player ||
            fromTerritory.ownerId !== playerId ||
            fromTerritory.armySize < GAME_CONSTANTS.MIN_ATTACK_ARMIES ||
            !fromTerritory.neighbors.includes(toTerritoryId)) {
            return false;
        }

        // Combat calculation
        const attackingArmies = Math.floor(fromTerritory.armySize * GAME_CONSTANTS.ATTACKER_SURVIVAL_RATE);
        const defendingArmies = toTerritory.armySize;

        const attackPower = attackingArmies * (GAME_CONSTANTS.COMBAT_ATTACKER_MODIFIER + Math.random() * GAME_CONSTANTS.ATTACK_POWER_RANDOM_RANGE);
        const defensePower = defendingArmies * (GAME_CONSTANTS.COMBAT_DEFENDER_MODIFIER + Math.random() * GAME_CONSTANTS.DEFENSE_POWER_RANDOM_RANGE);

        if (attackPower > defensePower) {
            // Attacker wins
            const survivingArmies = Math.ceil(attackingArmies * GAME_CONSTANTS.ATTACKER_SURVIVAL_RATE);
            
            // Remove territory from previous owner
            if (toTerritory.ownerId) {
                const prevOwner = this.gameState.players[toTerritory.ownerId];
                if (prevOwner) {
                    const index = prevOwner.territories.indexOf(toTerritoryId);
                    if (index > -1) prevOwner.territories.splice(index, 1);
                }
            }
            
            // Transfer territory to attacker
            toTerritory.ownerId = playerId;
            toTerritory.armySize = survivingArmies;
            fromTerritory.armySize = GAME_CONSTANTS.ARMY_LEFT_AFTER_ATTACK;
            
            if (!player.territories.includes(toTerritoryId)) {
                player.territories.push(toTerritoryId);
            }
            
            console.log(`Server: Attack successful - ${playerId} captured territory ${toTerritoryId}`);
        } else {
            // Defender wins
            const survivingDefenders = Math.ceil(defendingArmies * GAME_CONSTANTS.DEFENDER_SURVIVAL_RATE);
            toTerritory.armySize = survivingDefenders;
            fromTerritory.armySize = GAME_CONSTANTS.ARMY_LEFT_AFTER_ATTACK;
            
            console.log(`Server: Attack failed - ${playerId} lost attacking territory ${toTerritoryId}`);
        }

        this.updatePlayerStats();
        return true;
    }

    public launchProbe(playerId: string, fromTerritoryId: number, toTerritoryId: number): boolean {
        const fromTerritory = this.gameState.territories[fromTerritoryId];
        const toTerritory = this.gameState.territories[toTerritoryId];
        const player = this.gameState.players[playerId];

        if (!fromTerritory || !toTerritory || !player ||
            fromTerritory.ownerId !== playerId ||
            fromTerritory.armySize < GAME_CONSTANTS.PROBE_MIN_ARMY_TO_LAUNCH ||
            !toTerritory.isColonizable) {
            return false;
        }

        // Create probe
        const probe: ProbeState = {
            id: this.gameState.probes.length,
            fromTerritoryId,
            toTerritoryId,
            playerId,
            playerColor: player.color,
            progress: 0,
            startTime: Date.now(),
            duration: this.calculateProbeTime(fromTerritory, toTerritory)
        };

        fromTerritory.armySize -= GAME_CONSTANTS.PROBE_COST;
        this.gameState.probes.push(probe);
        
        console.log(`Server: Probe launched from ${fromTerritoryId} to ${toTerritoryId} by ${playerId}`);
        return true;
    }

    public transferArmies(playerId: string, fromTerritoryId: number, toTerritoryId: number): boolean {
        const fromTerritory = this.gameState.territories[fromTerritoryId];
        const toTerritory = this.gameState.territories[toTerritoryId];

        if (!fromTerritory || !toTerritory ||
            fromTerritory.ownerId !== playerId ||
            toTerritory.ownerId !== playerId ||
            fromTerritory.armySize <= GAME_CONSTANTS.MIN_ARMY_TO_LEAVE_AFTER_TRANSFER ||
            !fromTerritory.neighbors.includes(toTerritoryId)) {
            return false;
        }

        const transferAmount = Math.floor(fromTerritory.armySize / GAME_CONSTANTS.TRANSFER_AMOUNT_DIVISOR);
        fromTerritory.armySize -= transferAmount;
        toTerritory.armySize += transferAmount;

        console.log(`Server: Transferred ${transferAmount} armies from ${fromTerritoryId} to ${toTerritoryId}`);
        return true;
    }

    private calculateProbeTime(from: TerritoryState, to: TerritoryState): number {
        const distance = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
        return (distance / GAME_CONSTANTS.PROBE_SPEED) * 1000; // Convert to milliseconds
    }

    private checkWinConditions(): void {
        const activePlayers = Object.values(this.gameState.players).filter(p => !p.isEliminated && p.territories.length > 0);
        
        if (activePlayers.length === 1) {
            this.gameState.gamePhase = 'ended';
            this.gameState.winner = activePlayers[0].id;
            console.log(`Server: Game ended - Winner: ${activePlayers[0].name}`);
        } else if (activePlayers.length === 0) {
            this.gameState.gamePhase = 'ended';
            this.gameState.winner = null;
            console.log('Server: Game ended - Draw');
        }
    }

    private updatePlayerStats(): void {
        Object.values(this.gameState.players).forEach(player => {
            player.territoriesOwned = player.territories.length;
            player.totalArmies = player.territories.reduce((sum, territoryId) => {
                const territory = this.gameState.territories[territoryId];
                return sum + (territory?.armySize || 0);
            }, 0);
            
            if (player.territories.length === 0) {
                player.isEliminated = true;
            }
        });
    }

    public getFullState(): GameState {
        return { ...this.gameState };
    }

    private generateAIName(index: number): string {
        const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
        return `AI_${names[index % names.length]}_${index}`;
    }

    private generatePlayerColor(index: number): string {
        const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8844', '#8844ff'];
        return colors[index % colors.length];
    }
}