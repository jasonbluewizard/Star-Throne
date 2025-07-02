// Import the new advanced AI strategy system
import { AIStrategist } from './AIStrategist.js';

// AI Finite State Machine states for enhanced strategic behavior (legacy - being replaced)
const AI_STATE = {
    EARLY_GAME_EXPANSION: 'EARLY_GAME_EXPANSION',
    CONSOLIDATING: 'CONSOLIDATING',
    AGGRESSIVE_ATTACK: 'AGGRESSIVE_ATTACK', 
    DEFENSIVE_POSTURING: 'DEFENSIVE_POSTURING',
};

export class Player {
    constructor(id, name, color, type = 'ai') {
        this.id = id;
        this.name = name;
        this.color = color;
        this.type = type; // 'human' or 'ai'
        
        // Game state
        this.territories = [];
        this.totalArmies = 0;
        this.isEliminated = false;
        this.score = 0;
        this.throneStarId = null; // ID of this player's throne star (starting planet)
        
        // Enhanced AI properties with state machine
        this.aiThinkTimer = 0;
        this.aiThinkInterval = 1000 + Math.random() * 2000; // 1-3 seconds
        this.aiStrategy = this.selectAIStrategy();
        this.aiTarget = null;
        
        // AI state machine for better strategic decisions
        if (this.type === 'ai') {
            this.aiState = AI_STATE.EARLY_GAME_EXPANSION;
            this.decisionTimer = 0;
            this.decisionInterval = 1000 + Math.random() * 500; // Faster decisions with jitter
            this.lastStateTransition = Date.now();
            
            // Initialize advanced AI strategist (will be set up when gameMap is available)
            this.strategist = null;
        }
        
        // Stats tracking
        this.territoriesConquered = 0;
        this.battlesWon = 0;
        this.battlesLost = 0;
        this.armiesLost = 0;
        
        // Last activity timestamp
        this.lastActivity = Date.now();
    }
    
    selectAIStrategy() {
        const strategies = ['aggressive', 'defensive', 'expansionist', 'opportunistic'];
        return strategies[Math.floor(Math.random() * strategies.length)];
    }
    
    /**
     * Initialize the advanced AI strategist
     */
    initializeAIStrategist(gameMap) {
        if (this.type === 'ai' && !this.strategist && gameMap) {
            this.strategist = new AIStrategist(this, gameMap);
        }
    }
    
    update(deltaTime, gameMap, gameSpeed = 1.0, game = null) {
        // Generate armies for all owned territories with speed multiplier and discovery bonuses
        this.territories.forEach(territoryId => {
            const territory = gameMap.territories[territoryId];
            if (territory) {
                territory.generateArmies(deltaTime, this, gameSpeed, game);
            }
        });
        
        // Update stats
        this.updateStats();
        
        // AI logic
        if (this.type === 'ai' && !this.isEliminated) {
            this.updateAI(deltaTime, gameMap);
        }
    }
    
    updateStats() {
        this.totalArmies = this.territories.reduce((total, territoryId) => {
            // Note: We'd need access to gameMap here, so this might need to be called differently
            return total;
        }, 0);
        
        // Calculate score based on territories and armies
        this.score = this.territories.length * 100 + this.territoriesConquered * 50;
    }
    
    updateAI(deltaTime, gameMap) {
        this.aiThinkTimer += deltaTime;
        
        if (this.aiThinkTimer < this.aiThinkInterval) return;
        
        this.aiThinkTimer = 0;
        this.aiThinkInterval = 2000 + Math.random() * 3000; // Slower AI thinking for performance
        
        // Cache territory lookups to reduce map access
        const ownedTerritories = [];
        for (const id of this.territories) {
            const territory = gameMap.territories[id];
            if (territory && territory.armySize > 2) {
                ownedTerritories.push(territory);
            }
        }
        
        if (ownedTerritories.length === 0) return;
        
        // 20% chance to consider probe colonization (reduced for performance)
        if (Math.random() < 0.2) {
            if (this.considerProbeColonization(ownedTerritories, gameMap)) {
                return; // Probe launched, skip regular attack this turn
            }
        }
        
        // Limit AI actions per update to reduce computational load
        const maxActions = Math.min(2, Math.ceil(ownedTerritories.length / 5));
        
        // Select strategy-based action with performance limits
        switch (this.aiStrategy) {
            case 'aggressive':
                this.executeAggressiveStrategy(ownedTerritories, gameMap, maxActions);
                break;
            case 'defensive':
                this.executeDefensiveStrategy(ownedTerritories, gameMap, maxActions);
                break;
            case 'expansionist':
                this.executeExpansionistStrategy(ownedTerritories, gameMap, maxActions);
                break;
            case 'opportunistic':
                this.executeOpportunisticStrategy(ownedTerritories, gameMap, maxActions);
                break;
        }
    }
    
    executeAggressiveStrategy(attackableTerritories, gameMap, maxActions = 2) {
        let actionsPerformed = 0;
        
        // Attack strongest enemy territories with performance limits
        for (const territory of attackableTerritories) {
            if (actionsPerformed >= maxActions) break;
            
            const targets = this.findAttackTargets(territory, gameMap)
                .filter(target => target.ownerId !== null && target.ownerId !== this.id)
                .sort((a, b) => b.armySize - a.armySize)
                .slice(0, 3); // Limit target evaluation
            
            if (targets.length > 0) {
                const target = targets[0];
                if (territory.armySize > target.armySize) {
                    this.executeAttack(territory, target, gameMap);
                    actionsPerformed++;
                }
            }
        }
        return actionsPerformed;
    }
    
    executeDefensiveStrategy(attackableTerritories, gameMap) {
        if (!attackableTerritories || attackableTerritories.length === 0) return;
        
        // Reinforce weak territories and attack only weak enemies
        for (const territory of attackableTerritories) {
            if (!territory) continue;
            
            const targets = this.findAttackTargets(territory, gameMap)
                .filter(target => target && target.ownerId !== null && target.ownerId !== this.id)
                .sort((a, b) => a.armySize - b.armySize);
            
            if (targets.length > 0) {
                const target = targets[0];
                if (target && territory.armySize > target.armySize * 1.5) {
                    this.executeAttack(territory, target, gameMap);
                    return;
                }
            }
        }
    }
    
    executeExpansionistStrategy(attackableTerritories, gameMap) {
        // Prioritize neutral territories
        for (const territory of attackableTerritories) {
            const neutralTargets = this.findAttackTargets(territory, gameMap)
                .filter(target => target.ownerId === null);
            
            if (neutralTargets.length > 0) {
                const target = neutralTargets[Math.floor(Math.random() * neutralTargets.length)];
                this.executeAttack(territory, target, gameMap);
                return;
            }
        }
        
        // If no neutral targets, attack weakest enemy
        this.executeOpportunisticStrategy(attackableTerritories, gameMap);
    }
    
    executeOpportunisticStrategy(attackableTerritories, gameMap) {
        if (!attackableTerritories || attackableTerritories.length === 0) return;
        
        // Attack best opportunities (weak targets with good strategic value)
        const allTargets = [];
        
        for (const territory of attackableTerritories) {
            if (!territory) continue;
            
            const targets = this.findAttackTargets(territory, gameMap)
                .filter(target => target && target.ownerId !== this.id);
            
            targets.forEach(target => {
                if (!target) return;
                
                const winChance = this.calculateWinChance(territory, target);
                if (winChance > 0.6) {
                    allTargets.push({
                        from: territory,
                        to: target,
                        winChance: winChance,
                        strategicValue: this.calculateStrategicValue(target, gameMap)
                    });
                }
            });
        }
        
        if (allTargets.length > 0) {
            // Sort by combined win chance and strategic value
            allTargets.sort((a, b) => (b.winChance * b.strategicValue) - (a.winChance * a.strategicValue));
            const bestTarget = allTargets[0];
            if (bestTarget && bestTarget.from && bestTarget.to) {
                this.executeAttack(bestTarget.from, bestTarget.to, gameMap);
            }
        }
    }
    
    findAttackTargets(territory, gameMap) {
        if (!territory || !territory.neighbors || !gameMap || !gameMap.territories) {
            return [];
        }
        
        return territory.neighbors
            .map(id => gameMap.territories[id])
            .filter(neighbor => neighbor && neighbor !== null && neighbor !== undefined && !neighbor.isColonizable);
    }
    
    calculateWinChance(attackingTerritory, defendingTerritory) {
        const attackPower = attackingTerritory.armySize * 0.75 * (0.8 + Math.random() * 0.4);
        const defensePower = defendingTerritory.armySize * (1.0 + Math.random() * 0.2);
        
        return attackPower / (attackPower + defensePower);
    }
    
    calculateStrategicValue(territory, gameMap) {
        let value = 1;
        
        // Neutral territories are valuable for expansion
        if (territory.ownerId === null) {
            value += 0.5;
        }
        
        // Territories with many neighbors are strategically valuable
        value += territory.neighbors.length * 0.1;
        
        // Territories that would connect our regions are valuable
        const ourNeighbors = territory.neighbors.filter(id => {
            const neighbor = gameMap.territories[id];
            return neighbor && neighbor.ownerId === this.id;
        });
        
        if (ourNeighbors.length >= 2) {
            value += 0.3; // Connection bonus
        }
        
        return value;
    }
    
    executeAttack(attackingTerritory, defendingTerritory, gameMap) {
        // Trigger combat flash on both territories
        attackingTerritory.triggerCombatFlash();
        defendingTerritory.triggerCombatFlash();
        
        // Create ship animation for AI attack (access via gameMap reference)
        if (gameMap.game) {
            gameMap.game.createShipAnimation(attackingTerritory, defendingTerritory, true);
        }
        
        // Enhanced logging for throne star attacks
        if (defendingTerritory.isThronestar || Math.random() < 0.05) {
            console.log(`AI ${this.name} attacking territory ${defendingTerritory.id} from ${attackingTerritory.id}${defendingTerritory.isThronestar ? ' (👑 THRONE STAR!)' : ''}`);
        }
        
        // Debug: Log attacking army strength for throne star attacks
        if (defendingTerritory.isThronestar) {
            console.log(`Throne attack details: Attacker ${attackingTerritory.armySize} armies (${Math.floor(attackingTerritory.armySize * 0.7)} attacking) vs Defender ${defendingTerritory.armySize} armies`);
            const oldOwner = gameMap.players[defendingTerritory.ownerId];
            console.log(`Defending player: ${defendingTerritory.ownerId} ${oldOwner?.type === 'human' ? '(👤 HUMAN PLAYER!)' : '(AI player)'}`);
        }
        
        // Delegate to centralized CombatSystem (AI uses 70% of armies)
        const attackingArmies = Math.floor(attackingTerritory.armySize * 0.7);
        const result = gameMap.game?.combatSystem?.attackTerritory(attackingTerritory, defendingTerritory, attackingArmies);
        
        if (!result) {
            console.log('CombatSystem not available');
            return;
        }
        
        if (result.success) {
            // Debug: Log successful throne attacks
            if (result.throneCapture) {
                console.log(`🏆 THRONE ATTACK SUCCESSFUL! ${this.name} captures throne star ${defendingTerritory.id}`);
            }
            
            // Update player stats for successful attack
            this.battlesWon++;
            this.territoriesConquered++;
            
            // Special handling for human player elimination
            if (result.gameEnded) {
                console.log(`💀 HUMAN PLAYER'S THRONE STAR CAPTURED! Game should end!`);
                if (gameMap.game) {
                    gameMap.game.gameState = 'ended';
                    gameMap.game.showMessage(`💀 Your empire has fallen! ${this.name} captured your throne star!`, 10000);
                    // Force UI to show game over screen
                    if (gameMap.game.ui) {
                        gameMap.game.ui.showGameOver = true;
                    }
                }
            }
        } else {
            // Attack failed
            if (defendingTerritory.isThronestar) {
                console.log(`❌ THRONE ATTACK FAILED! ${this.name} failed to capture throne star ${defendingTerritory.id}`);
                if (result.attackPower && result.defensePower) {
                    console.log(`Attack Power: ${result.attackPower.toFixed(1)} vs Defense Power: ${result.defensePower.toFixed(1)}`);
                }
            }
            
            this.battlesLost++;
            this.armiesLost += (result.attackerLosses || attackingArmies);
        }
        
        this.lastActivity = Date.now();
    }
    
    // Get player statistics for leaderboard
    getStats() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            territories: this.territories.length,
            totalArmies: this.totalArmies,
            score: this.score,
            isEliminated: this.isEliminated,
            territoriesConquered: this.territoriesConquered,
            battlesWon: this.battlesWon,
            battlesLost: this.battlesLost,
            winRate: this.battlesWon + this.battlesLost > 0 ? 
                     (this.battlesWon / (this.battlesWon + this.battlesLost) * 100).toFixed(1) : '0.0'
        };
    }
    
    // Serialize player data for network transmission (future multiplayer)
    serialize() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            type: this.type,
            territories: this.territories,
            totalArmies: this.totalArmies,
            isEliminated: this.isEliminated,
            score: this.score,
            territoriesConquered: this.territoriesConquered,
            battlesWon: this.battlesWon,
            battlesLost: this.battlesLost
        };
    }
    
    considerProbeColonization(attackableTerritories, gameMap) {
        // Find territories with enough fleet power for probes (need 10+ armies)
        const probeCapableTerritories = attackableTerritories.filter(t => t.armySize >= 15); // Keep some buffer
        
        if (probeCapableTerritories.length === 0) return false;
        
        // Find visible colonizable planets (within reasonable distance)
        const colonizableTargets = [];
        
        for (const territory of probeCapableTerritories) {
            // Look for colonizable planets within a reasonable range
            Object.values(gameMap.territories).forEach(target => {
                if (target.isColonizable && target.ownerId === null) {
                    const distance = Math.sqrt(
                        (territory.x - target.x) ** 2 + (territory.y - target.y) ** 2
                    );
                    
                    // Only consider colonizable planets within reasonable probe range
                    if (distance < 300) { // Adjust range as needed
                        colonizableTargets.push({
                            from: territory,
                            to: target,
                            distance: distance,
                            strategicValue: this.calculateColonizationValue(target, gameMap)
                        });
                    }
                }
            });
        }
        
        if (colonizableTargets.length === 0) return false;
        
        // Sort by strategic value and distance
        colonizableTargets.sort((a, b) => {
            const scoreA = a.strategicValue - (a.distance * 0.001);
            const scoreB = b.strategicValue - (b.distance * 0.001);
            return scoreB - scoreA;
        });
        
        // Launch probe to best target
        const bestTarget = colonizableTargets[0];
        if (gameMap.game && gameMap.game.launchAIProbe) {
            gameMap.game.launchAIProbe(bestTarget.from, bestTarget.to, this);
            return true;
        }
        
        return false;
    }
    
    calculateColonizationValue(territory, gameMap) {
        let value = 1;
        
        // Higher value for territories that would connect to our existing territories
        const nearbyOwned = territory.hiddenNeighbors.filter(id => {
            const neighbor = gameMap.territories[id];
            return neighbor && neighbor.ownerId === this.id;
        }).length;
        
        value += nearbyOwned * 2; // High value for connecting territories
        
        // Value based on potential connections
        value += territory.hiddenNeighbors.length * 0.2;
        
        return value;
    }

    // Enhanced AI state machine methods for strategic behavior
    evaluateAndTransitionState(gameMap) {
        if (this.type !== 'ai' || !this.aiState) return;
        
        const totalTerritories = Object.keys(gameMap.territories).length;
        const ownedTerritoryCount = this.territories.length;
        const territoryPercent = ownedTerritoryCount / totalTerritories;
        
        const timeSinceLastTransition = Date.now() - (this.lastStateTransition || 0);
        const minTransitionTime = 5000; // Minimum 5 seconds between transitions
        
        if (timeSinceLastTransition < minTransitionTime) return;
        
        let newState = this.aiState;
        
        // State transition logic based on game situation
        if (territoryPercent > 0.3) {
            newState = AI_STATE.AGGRESSIVE_ATTACK;
        } else if (ownedTerritoryCount > 5 && territoryPercent > 0.15) {
            newState = AI_STATE.CONSOLIDATING;
        } else if (ownedTerritoryCount < 3) {
            newState = AI_STATE.EARLY_GAME_EXPANSION;
        } else {
            // Analyze threat level for defensive posturing
            const threatenedTerritories = this.countThreatenedTerritories(gameMap);
            if (threatenedTerritories > ownedTerritoryCount * 0.4) {
                newState = AI_STATE.DEFENSIVE_POSTURING;
            }
        }
        
        if (newState !== this.aiState) {
            console.log(`AI ${this.name} transitioning from ${this.aiState} to ${newState}`);
            this.aiState = newState;
            this.lastStateTransition = Date.now();
        }
    }

    makeStrategicDecision(gameMap) {
        if (this.type !== 'ai') return false;
        
        // Initialize strategist if not done yet
        this.initializeAIStrategist(gameMap);
        
        // Use advanced AI strategist if available, otherwise fall back to legacy system
        if (this.strategist) {
            return this.strategist.makeStrategicDecision();
        }
        
        // Legacy AI system fallback
        if (!this.aiState) return false;
        
        switch (this.aiState) {
            case AI_STATE.EARLY_GAME_EXPANSION:
                this.doExpansion(gameMap);
                break;
            case AI_STATE.AGGRESSIVE_ATTACK:
                this.doAggressiveAttack(gameMap);
                break;
            case AI_STATE.CONSOLIDATING:
                this.doConsolidation(gameMap);
                break;
            case AI_STATE.DEFENSIVE_POSTURING:
                this.doDefensivePosturing(gameMap);
                break;
        }
        
        return true;
    }

    doExpansion(gameMap) {
        const ownedTerritories = this.territories
            .map(id => gameMap.territories[id])
            .filter(t => t && t.ownerId === this.id);
        
        for (const territory of ownedTerritories) {
            if (territory.armySize >= 11) { // Probe launch cost
                // Look for colonizable neighbors
                const colonizableNeighbor = territory.neighbors
                    .map(id => gameMap.territories[id])
                    .find(t => t && t.isColonizable);
                
                if (colonizableNeighbor && gameMap.game && gameMap.game.launchAIProbe) {
                    gameMap.game.launchAIProbe(territory, colonizableNeighbor, this);
                    return;
                }
            }
        }
    }

    doAggressiveAttack(gameMap) {
        const ownedTerritories = this.territories
            .map(id => gameMap.territories[id])
            .filter(t => t && t.ownerId === this.id)
            .sort((a, b) => b.armySize - a.armySize); // Attack with strongest territories first
        
        for (const territory of ownedTerritories) {
            if (territory.armySize > 5) {
                const weakEnemyNeighbor = territory.neighbors
                    .map(id => gameMap.territories[id])
                    .filter(t => t && t.ownerId && t.ownerId !== this.id)
                    .sort((a, b) => a.armySize - b.armySize)[0]; // Target weakest enemy
                
                if (weakEnemyNeighbor && territory.armySize > weakEnemyNeighbor.armySize * 1.5) {
                    this.executeAttack(territory, weakEnemyNeighbor, gameMap);
                    return;
                }
            }
        }
    }

    doConsolidation(gameMap) {
        // Focus on moving armies from safe territories to border territories
        const ownedTerritories = this.territories
            .map(id => gameMap.territories[id])
            .filter(t => t && t.ownerId === this.id);
        
        const borderTerritories = ownedTerritories.filter(t => 
            t.neighbors.some(nId => {
                const neighbor = gameMap.territories[nId];
                return neighbor && neighbor.ownerId !== this.id;
            })
        );
        
        // Strengthen weakest border territories first
        const weakBorderTerritory = borderTerritories
            .sort((a, b) => a.armySize - b.armySize)[0];
        
        if (weakBorderTerritory && weakBorderTerritory.armySize < 10) {
            // Look for adjacent strong territories to transfer from
            const adjacentStrong = weakBorderTerritory.neighbors
                .map(id => gameMap.territories[id])
                .filter(t => t && t.ownerId === this.id && t.armySize > 15)
                .sort((a, b) => b.armySize - a.armySize)[0];
            
            if (adjacentStrong && gameMap.game) {
                gameMap.game.transferFleet(adjacentStrong, weakBorderTerritory);
            }
        }
    }

    doDefensivePosturing(gameMap) {
        // Focus on defending threatened territories
        const threatenedTerritories = this.getThreatenedTerritories(gameMap);
        
        for (const territory of threatenedTerritories) {
            if (territory.armySize > 8) {
                // Look for preemptive strikes against dangerous neighbors
                const dangerousNeighbor = territory.neighbors
                    .map(id => gameMap.territories[id])
                    .filter(t => t && t.ownerId && t.ownerId !== this.id)
                    .sort((a, b) => b.armySize - a.armySize)[0];
                
                if (dangerousNeighbor && territory.armySize > dangerousNeighbor.armySize * 1.1) {
                    this.executeAttack(territory, dangerousNeighbor, gameMap);
                    return;
                }
            }
        }
    }

    countThreatenedTerritories(gameMap) {
        return this.territories
            .map(id => gameMap.territories[id])
            .filter(t => t && this.isTerritoryThreatened(t, gameMap))
            .length;
    }

    getThreatenedTerritories(gameMap) {
        return this.territories
            .map(id => gameMap.territories[id])
            .filter(t => t && this.isTerritoryThreatened(t, gameMap));
    }

    isTerritoryThreatened(territory, gameMap) {
        return territory.neighbors.some(nId => {
            const neighbor = gameMap.territories[nId];
            return neighbor && neighbor.ownerId && 
                   neighbor.ownerId !== this.id && 
                   neighbor.armySize >= territory.armySize * 0.8;
        });
    }
}
