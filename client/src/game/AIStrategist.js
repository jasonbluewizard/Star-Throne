/**
 * Advanced AI Strategy System for Star Throne
 * Implements sophisticated AI decision-making with multiple strategies and personality types
 */

// AI Strategy Types
export const AI_STRATEGIES = {
    ECONOMIC: 'economic',
    MILITARY: 'military', 
    EXPANSION: 'expansion',
    TURTLE: 'turtle',
    OPPORTUNIST: 'opportunist'
};

// AI Personality Traits
export const AI_PERSONALITIES = {
    AGGRESSIVE: 'aggressive',
    DEFENSIVE: 'defensive',
    BALANCED: 'balanced',
    EXPLORER: 'explorer',
    CONSOLIDATOR: 'consolidator'
};

// Strategic Decision States
export const DECISION_STATES = {
    EXPAND: 'expand',
    ATTACK: 'attack',
    DEFEND: 'defend',
    CONSOLIDATE: 'consolidate',
    PROBE: 'probe'
};

export class AIStrategist {
    constructor(player, gameMap) {
        this.player = player;
        this.gameMap = gameMap;
        
        // Assign random strategy and personality
        this.strategy = this.selectRandomStrategy();
        this.personality = this.selectRandomPersonality();
        
        // Decision weights (0-1) - personality influences these
        this.weights = this.calculatePersonalityWeights();
        
        // Strategic state tracking
        this.currentState = DECISION_STATES.EXPAND;
        this.lastDecision = Date.now();
        this.decisionCooldown = 2000 + Math.random() * 3000; // 2-5 seconds
        
        // Performance tracking
        this.territoryGrowthRate = 0;
        this.combatSuccessRate = 0.5;
        this.lastTerritoryCount = 0;
        this.recentBattles = [];
        
        // Strategic memory
        this.threatenedTerritories = new Set();
        this.priorityTargets = [];
        this.lastProbeAttempt = 0;
        
        console.log(`AI ${this.player.name}: Strategy=${this.strategy}, Personality=${this.personality}`);
    }
    
    selectRandomStrategy() {
        const strategies = Object.values(AI_STRATEGIES);
        return strategies[Math.floor(Math.random() * strategies.length)];
    }
    
    selectRandomPersonality() {
        const personalities = Object.values(AI_PERSONALITIES);
        return personalities[Math.floor(Math.random() * personalities.length)];
    }
    
    calculatePersonalityWeights() {
        const baseWeights = {
            aggression: 0.5,
            expansion: 0.5,
            defense: 0.5,
            exploration: 0.5,
            consolidation: 0.5
        };
        
        // Modify weights based on personality
        switch (this.personality) {
            case AI_PERSONALITIES.AGGRESSIVE:
                baseWeights.aggression = 0.8;
                baseWeights.defense = 0.2;
                break;
            case AI_PERSONALITIES.DEFENSIVE:
                baseWeights.defense = 0.8;
                baseWeights.aggression = 0.3;
                break;
            case AI_PERSONALITIES.EXPLORER:
                baseWeights.exploration = 0.8;
                baseWeights.expansion = 0.7;
                break;
            case AI_PERSONALITIES.CONSOLIDATOR:
                baseWeights.consolidation = 0.8;
                baseWeights.expansion = 0.3;
                break;
            default: // BALANCED
                // Keep default weights
                break;
        }
        
        return baseWeights;
    }
    
    /**
     * Main strategic decision making method
     */
    makeStrategicDecision() {
        const now = Date.now();
        
        // Check decision cooldown
        if (now - this.lastDecision < this.decisionCooldown) {
            return false;
        }
        
        // Update strategic analysis
        this.updateStrategicAnalysis();
        
        // Determine best action based on current state and weights
        const decision = this.evaluateStrategicOptions();
        
        if (decision && decision.action) {
            this.executeDecision(decision);
            this.lastDecision = now;
            this.decisionCooldown = 1500 + Math.random() * 2500; // Vary timing
            return true;
        }
        
        return false;
    }
    
    updateStrategicAnalysis() {
        this.updateTerritoryGrowthRate();
        this.updateCombatSuccessRate();
        this.identifyThreats();
        this.identifyOpportunities();
        this.updateStrategicState();
    }
    
    updateTerritoryGrowthRate() {
        const currentCount = this.player.territories.length;
        if (this.lastTerritoryCount > 0) {
            this.territoryGrowthRate = (currentCount - this.lastTerritoryCount) / this.lastTerritoryCount;
        }
        this.lastTerritoryCount = currentCount;
    }
    
    updateCombatSuccessRate() {
        // Track recent battle outcomes
        const recentWins = this.player.battlesWon;
        const recentLosses = this.player.battlesLost;
        const totalBattles = recentWins + recentLosses;
        
        if (totalBattles > 0) {
            this.combatSuccessRate = recentWins / totalBattles;
        }
    }
    
    identifyThreats() {
        this.threatenedTerritories.clear();
        
        this.player.territories.forEach(territoryId => {
            const territory = this.gameMap.territories[territoryId];
            if (!territory) return;
            
            // Check if neighbors pose a threat
            const isThreaded = territory.neighbors.some(neighborId => {
                const neighbor = this.gameMap.territories[neighborId];
                return neighbor && 
                       neighbor.ownerId !== this.player.id && 
                       neighbor.ownerId !== null &&
                       neighbor.armySize > territory.armySize * 0.8;
            });
            
            if (isThreaded) {
                this.threatenedTerritories.add(territoryId);
            }
        });
    }
    
    identifyOpportunities() {
        this.priorityTargets = [];
        
        this.player.territories.forEach(territoryId => {
            const territory = this.gameMap.territories[territoryId];
            if (!territory || territory.armySize <= 1) return;
            
            // Find weak enemy neighbors
            territory.neighbors.forEach(neighborId => {
                const neighbor = this.gameMap.territories[neighborId];
                if (!neighbor || neighbor.ownerId === this.player.id) return;
                
                let priority = 0;
                
                // Enemy territory
                if (neighbor.ownerId !== null) {
                    const strengthRatio = territory.armySize / neighbor.armySize;
                    if (strengthRatio > 1.2) {
                        priority = strengthRatio;
                        
                        // Bonus for throne stars
                        if (neighbor.isThronestar) {
                            priority *= 3;
                        }
                    }
                }
                // Colonizable territory  
                else if (neighbor.isColonizable && territory.armySize >= 11) {
                    priority = 0.8; // Medium priority for expansion
                }
                
                if (priority > 0) {
                    this.priorityTargets.push({
                        from: territory,
                        to: neighbor,
                        priority,
                        type: neighbor.ownerId !== null ? 'attack' : 'colonize'
                    });
                }
            });
        });
        
        // Sort by priority
        this.priorityTargets.sort((a, b) => b.priority - a.priority);
        this.priorityTargets = this.priorityTargets.slice(0, 5); // Keep top 5
    }
    
    updateStrategicState() {
        const threatLevel = this.threatenedTerritories.size / Math.max(1, this.player.territories.length);
        const opportunityLevel = this.priorityTargets.length;
        
        // State transition logic
        if (threatLevel > 0.3) {
            this.currentState = DECISION_STATES.DEFEND;
        } else if (this.combatSuccessRate > 0.7 && opportunityLevel > 2) {
            this.currentState = DECISION_STATES.ATTACK;
        } else if (this.player.territories.length < 3) {
            this.currentState = DECISION_STATES.EXPAND;
        } else if (Date.now() - this.lastProbeAttempt > 30000) { // 30 seconds
            this.currentState = DECISION_STATES.PROBE;
        } else {
            this.currentState = DECISION_STATES.CONSOLIDATE;
        }
    }
    
    evaluateStrategicOptions() {
        switch (this.currentState) {
            case DECISION_STATES.ATTACK:
                return this.evaluateAttackOptions();
            case DECISION_STATES.DEFEND:
                return this.evaluateDefenseOptions();
            case DECISION_STATES.EXPAND:
                return this.evaluateExpansionOptions();
            case DECISION_STATES.PROBE:
                return this.evaluateProbeOptions();
            case DECISION_STATES.CONSOLIDATE:
                return this.evaluateConsolidationOptions();
            default:
                return null;
        }
    }
    
    evaluateAttackOptions() {
        if (this.priorityTargets.length === 0) return null;
        
        const attackTargets = this.priorityTargets.filter(t => t.type === 'attack');
        if (attackTargets.length === 0) return null;
        
        const target = attackTargets[0];
        return {
            action: 'attack',
            from: target.from,
            to: target.to,
            priority: target.priority
        };
    }
    
    evaluateDefenseOptions() {
        // Look for preemptive strikes against threats
        for (const territoryId of this.threatenedTerritories) {
            const territory = this.gameMap.territories[territoryId];
            if (!territory || territory.armySize <= 1) continue;
            
            const weakestThreat = territory.neighbors
                .map(id => this.gameMap.territories[id])
                .filter(t => t && t.ownerId !== this.player.id && t.ownerId !== null)
                .sort((a, b) => a.armySize - b.armySize)[0];
            
            if (weakestThreat && territory.armySize > weakestThreat.armySize * 1.1) {
                return {
                    action: 'attack',
                    from: territory,
                    to: weakestThreat,
                    priority: 0.8
                };
            }
        }
        
        return null;
    }
    
    evaluateExpansionOptions() {
        const colonizeTargets = this.priorityTargets.filter(t => t.type === 'colonize');
        if (colonizeTargets.length === 0) return null;
        
        const target = colonizeTargets[0];
        return {
            action: 'probe',
            from: target.from,
            to: target.to,
            priority: target.priority
        };
    }
    
    evaluateProbeOptions() {
        // Find territories that can launch probes
        for (const territoryId of this.player.territories) {
            const territory = this.gameMap.territories[territoryId];
            if (!territory || territory.armySize < 11) continue;
            
            const colonizableNeighbor = territory.neighbors
                .map(id => this.gameMap.territories[id])
                .find(t => t && t.isColonizable);
            
            if (colonizableNeighbor) {
                return {
                    action: 'probe',
                    from: territory,
                    to: colonizableNeighbor,
                    priority: 0.6
                };
            }
        }
        
        return null;
    }
    
    evaluateConsolidationOptions() {
        // Look for modest expansion or weak attacks
        if (this.priorityTargets.length > 0) {
            const target = this.priorityTargets[0];
            if (target.priority > 1.5) { // Only very safe attacks
                return {
                    action: target.type === 'attack' ? 'attack' : 'probe',
                    from: target.from,
                    to: target.to,
                    priority: target.priority * 0.7 // Reduced aggressiveness
                };
            }
        }
        
        return null;
    }
    
    executeDecision(decision) {
        if (!this.gameMap.game) return;
        
        switch (decision.action) {
            case 'attack':
                this.executeAttack(decision.from, decision.to);
                break;
            case 'probe':
                this.executeProbe(decision.from, decision.to);
                break;
        }
        
        // Log strategic decisions occasionally
        if (Math.random() < 0.1) {
            console.log(`AI ${this.player.name} (${this.strategy}/${this.personality}): ${decision.action} from ${decision.from.id} to ${decision.to.id} (priority: ${decision.priority.toFixed(2)})`);
        }
    }
    
    executeAttack(fromTerritory, toTerritory) {
        // Use the combat system for attacks
        const attackingArmies = Math.floor(fromTerritory.armySize * 0.7);
        const result = this.gameMap.game.combatSystem?.attackTerritory(fromTerritory, toTerritory, attackingArmies);
        
        // Track battle outcome
        if (result) {
            this.recentBattles.push({
                timestamp: Date.now(),
                success: result.success,
                from: fromTerritory.id,
                to: toTerritory.id
            });
            
            // Keep only recent battles
            if (this.recentBattles.length > 10) {
                this.recentBattles.shift();
            }
        }
    }
    
    executeProbe(fromTerritory, toTerritory) {
        if (this.gameMap.game.launchAIProbe) {
            this.gameMap.game.launchAIProbe(fromTerritory, toTerritory, this.player);
            this.lastProbeAttempt = Date.now();
        }
    }
    
    /**
     * Get strategic status for debugging
     */
    getStrategicStatus() {
        return {
            strategy: this.strategy,
            personality: this.personality,
            currentState: this.currentState,
            threatLevel: this.threatenedTerritories.size,
            opportunities: this.priorityTargets.length,
            combatSuccess: this.combatSuccessRate,
            growthRate: this.territoryGrowthRate
        };
    }
}