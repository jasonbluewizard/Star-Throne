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
        
        // AI properties
        this.aiThinkTimer = 0;
        this.aiThinkInterval = 1000 + Math.random() * 2000; // 1-3 seconds
        this.aiStrategy = this.selectAIStrategy();
        this.aiTarget = null;
        
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
    
    update(deltaTime, gameMap, gameSpeed = 1.0) {
        // Generate armies for all owned territories with speed multiplier
        this.territories.forEach(territoryId => {
            const territory = gameMap.territories[territoryId];
            if (territory) {
                territory.generateArmies(deltaTime, this, gameSpeed);
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
        // Reinforce weak territories and attack only weak enemies
        for (const territory of attackableTerritories) {
            const targets = this.findAttackTargets(territory, gameMap)
                .filter(target => target.ownerId !== null && target.ownerId !== this.id)
                .sort((a, b) => a.armySize - b.armySize);
            
            if (targets.length > 0) {
                const target = targets[0];
                if (territory.armySize > target.armySize * 1.5) {
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
        // Attack best opportunities (weak targets with good strategic value)
        const allTargets = [];
        
        for (const territory of attackableTerritories) {
            const targets = this.findAttackTargets(territory, gameMap)
                .filter(target => target.ownerId !== this.id);
            
            targets.forEach(target => {
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
            this.executeAttack(bestTarget.from, bestTarget.to, gameMap);
        }
    }
    
    findAttackTargets(territory, gameMap) {
        return territory.neighbors
            .map(id => gameMap.territories[id])
            .filter(neighbor => neighbor !== null && !neighbor.isColonizable);
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
        if (attackingTerritory.armySize <= 1) return;
        
        // Trigger combat flash on both territories
        attackingTerritory.triggerCombatFlash();
        defendingTerritory.triggerCombatFlash();
        
        // Create ship animation for AI attack (access via gameMap reference)
        if (gameMap.game) {
            gameMap.game.createShipAnimation(attackingTerritory, defendingTerritory, true);
        }
        
        // Reduced logging to prevent console spam
        if (Math.random() < 0.05) { // Only log 5% of attacks
            console.log(`AI ${this.name} attacking territory ${defendingTerritory.id} from ${attackingTerritory.id}`);
        }
        
        // Use 70% of armies for attack
        const attackingArmies = Math.floor(attackingTerritory.armySize * 0.7);
        const defendingArmies = defendingTerritory.armySize;
        
        // Battle calculation
        const attackPower = attackingArmies * (0.8 + Math.random() * 0.4);
        const defensePower = defendingArmies * (1.0 + Math.random() * 0.2);
        
        const oldOwnerId = defendingTerritory.ownerId;
        
        if (attackPower > defensePower) {
            // Attack successful
            const survivingArmies = Math.max(1, attackingArmies - defendingArmies);
            
            // Transfer territory
            defendingTerritory.ownerId = this.id;
            defendingTerritory.armySize = survivingArmies;
            attackingTerritory.armySize -= attackingArmies;
            
            // Update player territories
            this.territories.push(defendingTerritory.id);
            this.territoriesConquered++;
            this.battlesWon++;
            
            // Remove from old owner
            if (oldOwnerId !== null && gameMap.players && gameMap.players[oldOwnerId]) {
                const oldOwner = gameMap.players[oldOwnerId];
                const index = oldOwner.territories.indexOf(defendingTerritory.id);
                if (index > -1) {
                    oldOwner.territories.splice(index, 1);
                    oldOwner.battlesLost++;
                }
            }
        } else {
            // Attack failed
            const survivingDefenders = Math.max(1, defendingArmies - Math.floor(attackingArmies * 0.7));
            const survivingAttackers = Math.max(1, Math.floor(attackingArmies * 0.3));
            
            defendingTerritory.armySize = survivingDefenders;
            attackingTerritory.armySize = attackingTerritory.armySize - attackingArmies + survivingAttackers;
            
            this.battlesLost++;
            this.armiesLost += (attackingArmies - survivingAttackers);
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
}
