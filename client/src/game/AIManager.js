import { GAME_CONSTANTS } from '../../../common/gameConstants';

export class AIManager {
    constructor(game) {
        this.game = game;
        
        // AI processing optimization
        this.frameCount = 0;
        this.lastAIUpdate = {};
        this.aiUpdateInterval = 2000; // 2 seconds between AI decisions
        
        // AI personality traits and strategies
        this.aiPersonalities = [
            'aggressive', 'defensive', 'expansionist', 'opportunistic', 'balanced'
        ];
        
        // AI decision weights
        this.decisionWeights = {
            aggressive: { attack: 0.7, defend: 0.1, expand: 0.2 },
            defensive: { attack: 0.2, defend: 0.6, expand: 0.2 },
            expansionist: { attack: 0.3, defend: 0.2, expand: 0.5 },
            opportunistic: { attack: 0.4, defend: 0.3, expand: 0.3 },
            balanced: { attack: 0.33, defend: 0.33, expand: 0.34 }
        };
    }

    // Initialize AI personalities for players
    initializeAIPersonalities() {
        const aiPlayers = this.game.players.filter(p => p.type !== 'human');
        
        aiPlayers.forEach((player, index) => {
            // Assign personality
            player.personality = this.aiPersonalities[index % this.aiPersonalities.length];
            
            // Initialize AI state
            player.aiState = {
                lastDecision: 0,
                targetTerritory: null,
                strategy: 'explore', // explore, attack, defend, expand
                patience: Math.random() * 3000 + 2000, // 2-5 second patience
                aggression: Math.random() * 0.5 + 0.3, // 0.3-0.8 aggression
                expansionDesire: Math.random() * 0.6 + 0.2 // 0.2-0.8 expansion desire
            };
            
            console.log(`AI ${player.name} assigned ${player.personality} personality`);
        });
    }

    // Staggered AI updates for performance (process 1/4 of AI players per frame)
    updateAI(deltaTime) {
        const aiPlayers = this.game.players.filter(p => p.type !== 'human' && !p.isEliminated);
        
        if (aiPlayers.length === 0) return;
        
        // High-performance staggering: process only 1/4 of AI players per frame
        const playersPerFrame = Math.ceil(aiPlayers.length / 4);
        const frameOffset = this.frameCount % 4;
        const startIndex = frameOffset * playersPerFrame;
        const endIndex = Math.min(startIndex + playersPerFrame, aiPlayers.length);
        
        // Process subset of AI players this frame
        for (let i = startIndex; i < endIndex; i++) {
            const player = aiPlayers[i];
            this.updateAIPlayer(player, deltaTime);
        }
    }

    // Update individual AI player
    updateAIPlayer(player, deltaTime) {
        try {
            const now = Date.now();
            const timeSinceLastDecision = now - (this.lastAIUpdate[player.id] || 0);
            
            // AI decision throttling: only make decisions every 2-5 seconds
            if (timeSinceLastDecision < player.aiState.patience) {
                return;
            }
            
            this.lastAIUpdate[player.id] = now;
            
            // Reset patience with some randomness
            player.aiState.patience = Math.random() * 3000 + 2000;
            
            // Make AI decision based on current strategy
            this.makeAIDecision(player);
            
        } catch (error) {
            console.error(`Error updating AI player ${player.name}:`, error);
        }
    }

    // Core AI decision making
    makeAIDecision(player) {
        if (!player || player.isEliminated || player.territories.length === 0) {
            return;
        }
        
        const weights = this.decisionWeights[player.personality] || this.decisionWeights.balanced;
        const random = Math.random();
        
        // Decide action based on personality weights
        let action = 'expand';
        if (random < weights.attack) {
            action = 'attack';
        } else if (random < weights.attack + weights.defend) {
            action = 'defend';
        }
        
        // Execute chosen action
        switch (action) {
            case 'attack':
                this.attemptAttack(player);
                break;
            case 'defend':
                this.attemptDefend(player);
                break;
            case 'expand':
                this.attemptExpansion(player);
                break;
        }
    }

    // AI attack logic
    attemptAttack(player) {
        const ownedTerritories = player.territories
            .map(id => this.game.gameMap.territories[id])
            .filter(t => t && t.armySize > GAME_CONSTANTS.MIN_ATTACK_ARMIES);
        
        if (ownedTerritories.length === 0) return;
        
        // Find potential targets
        const targets = [];
        
        for (const territory of ownedTerritories) {
            for (const neighborId of territory.neighbors) {
                const neighbor = this.game.gameMap.territories[neighborId];
                
                if (neighbor && neighbor.ownerId !== player.id) {
                    // Calculate attack value
                    const attackPower = territory.armySize - 1;
                    const defensePower = neighbor.armySize;
                    const winChance = attackPower / (attackPower + defensePower);
                    
                    // Consider throne stars (high value targets)
                    const throneBonus = neighbor.isThronestar ? 2.0 : 1.0;
                    
                    targets.push({
                        from: territory,
                        to: neighbor,
                        value: winChance * throneBonus,
                        isThrone: neighbor.isThronestar
                    });
                }
            }
        }
        
        // Sort by value and attack best target
        targets.sort((a, b) => b.value - a.value);
        
        if (targets.length > 0 && targets[0].value > 0.4) {
            const target = targets[0];
            
            if (target.isThrone) {
                console.log(`AI ${player.name} attacking territory ${target.to.id} from ${target.from.id} (👑 THRONE STAR!)`);
                console.log(`Throne attack details: Attacker ${target.from.armySize} armies (${target.from.armySize - 1} attacking) vs Defender ${target.to.armySize} armies`);
            }
            
            this.game.combatSystem.attackTerritory(player.id, target.from.id, target.to.id);
        }
    }

    // AI defend logic (reinforce weak territories)
    attemptDefend(player) {
        const ownedTerritories = player.territories
            .map(id => this.game.gameMap.territories[id])
            .filter(t => t && t.armySize > 1);
        
        if (ownedTerritories.length < 2) return;
        
        // Find vulnerable territories
        const vulnerableTerritories = ownedTerritories.filter(territory => {
            // Check if territory has enemy neighbors
            return territory.neighbors.some(neighborId => {
                const neighbor = this.game.gameMap.territories[neighborId];
                return neighbor && neighbor.ownerId && neighbor.ownerId !== player.id;
            });
        });
        
        // Find territories to transfer from (not vulnerable, high army count)
        const sourceTerritories = ownedTerritories.filter(territory => {
            return territory.armySize > 10 && !vulnerableTerritories.includes(territory);
        });
        
        if (vulnerableTerritories.length > 0 && sourceTerritories.length > 0) {
            // Transfer from strongest safe territory to weakest vulnerable territory
            const source = sourceTerritories.reduce((max, t) => t.armySize > max.armySize ? t : max);
            const target = vulnerableTerritories.reduce((min, t) => t.armySize < min.armySize ? t : min);
            
            // Check if territories are connected
            if (this.areTerritoriesConnected(source.id, target.id, player.id)) {
                this.game.combatSystem.transferArmies(player.id, source.id, target.id);
            }
        }
    }

    // AI expansion logic (probe colonization)
    attemptExpansion(player) {
        const ownedTerritories = player.territories
            .map(id => this.game.gameMap.territories[id])
            .filter(t => t && t.armySize >= GAME_CONSTANTS.PROBE_COST);
        
        if (ownedTerritories.length === 0) return;
        
        // Find colonizable targets
        const colonizableTargets = [];
        
        for (const territory of ownedTerritories) {
            // Look for colonizable planets in range
            for (const otherTerritory of Object.values(this.game.gameMap.territories)) {
                if (otherTerritory.isColonizable && otherTerritory.ownerId === null) {
                    const distance = this.calculateDistance(territory, otherTerritory);
                    
                    if (distance <= GAME_CONSTANTS.MAX_PROBE_RANGE) {
                        colonizableTargets.push({
                            from: territory,
                            to: otherTerritory,
                            distance: distance,
                            priority: this.calculateExpansionPriority(otherTerritory)
                        });
                    }
                }
            }
        }
        
        // Sort by priority and distance
        colonizableTargets.sort((a, b) => {
            const priorityDiff = b.priority - a.priority;
            if (Math.abs(priorityDiff) > 0.1) return priorityDiff;
            return a.distance - b.distance; // Closer is better if priority is similar
        });
        
        // 20% chance to launch probe (reduced from previous versions for performance)
        if (colonizableTargets.length > 0 && Math.random() < 0.2) {
            const target = colonizableTargets[0];
            console.log(`AI ${target.from.ownerId} launched probe from territory ${target.from.id} to colonizable planet ${target.to.id}`);
            this.game.combatSystem.launchProbe(player.id, target.from.id, target.to.id);
        }
    }

    // Calculate expansion priority for territories
    calculateExpansionPriority(territory) {
        let priority = 0.5; // Base priority
        
        // Check hidden connections (more connections = higher priority)
        priority += territory.hiddenNeighbors.length * 0.1;
        
        // Random factor for unpredictability
        priority += Math.random() * 0.3;
        
        return priority;
    }

    // Check if territories are connected through owned territory
    areTerritoriesConnected(fromId, toId, playerId) {
        const visited = new Set();
        const queue = [fromId];
        
        while (queue.length > 0) {
            const currentId = queue.shift();
            
            if (currentId === toId) return true;
            if (visited.has(currentId)) continue;
            
            visited.add(currentId);
            
            const current = this.game.gameMap.territories[currentId];
            if (!current || current.ownerId !== playerId) continue;
            
            // Add connected owned territories
            for (const neighborId of current.neighbors) {
                const neighbor = this.game.gameMap.territories[neighborId];
                if (neighbor && neighbor.ownerId === playerId && !visited.has(neighborId)) {
                    queue.push(neighborId);
                }
            }
        }
        
        return false;
    }

    // Calculate distance between territories
    calculateDistance(territory1, territory2) {
        const dx = territory1.x - territory2.x;
        const dy = territory1.y - territory2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Generate AI name with variety
    generateAIName(index) {
        const firstNames = [
            'Alex', 'Blake', 'Casey', 'Dana', 'Emma', 'Felix', 'Grace', 'Hunter', 'Iris', 'Jack',
            'Kai', 'Luna', 'Max', 'Nova', 'Owen', 'Piper', 'Quinn', 'Riley', 'Sage', 'Tyler',
            'Uma', 'Victor', 'Wade', 'Xara', 'Yuki', 'Zara', 'Ash', 'Beck', 'Cole', 'Drew',
            'Echo', 'Finn', 'Gale', 'Hope', 'Ivan', 'Jade', 'Kane', 'Lexi', 'Mika', 'Nora',
            'Orion', 'Phoenix', 'Raven', 'Storm', 'Tara', 'Vale', 'Wren', 'Zane', 'Aria', 'Brix',
            'Cora', 'Dex', 'Eve', 'Fox', 'Grey', 'Hex', 'Ivy', 'Jax', 'Knox', 'Lux',
            'Mars', 'Neo', 'Onyx', 'Paz', 'Quin', 'Rex', 'Sky', 'Taj', 'Uri', 'Vex',
            'Wolf', 'Xen', 'Yor', 'Zed', 'Ace', 'Bay', 'Cyx', 'Daz', 'Eon', 'Flux'
        ];
        
        const clanNames = [
            'StarForge', 'VoidHunters', 'NebulaRise', 'CubClan', 'SolarFlare', 'CosmicFury',
            'AstroLords', 'GalaxyGuard', 'StarRaiders', 'VoidWalkers', 'NebulaCorp', 'CelestialArmy',
            'StarCommand', 'VoidMaster', 'CosmicAlliance', 'GalacticEmpire', 'StellarUnion', 'NebulaNation',
            'StarLegion', 'VoidCorp', 'CosmicOrder', 'GalaxyElite', 'StellarForce', 'NebulaStrike',
            'StarKnights', 'VoidLords', 'CosmicRebels', 'GalaxyPirates', 'StellarRanger', 'NebulaWing',
            'StarBrigade', 'VoidStorm', 'CosmicTitan', 'GalaxyNomad', 'StellarPhantom', 'NebulaBlade',
            'StarVanguard', 'VoidSentry', 'CosmicWarden', 'GalaxyHunter', 'StellarGhost', 'NebulaShade',
            'StarReaper', 'VoidShadow', 'CosmicSpectre', 'GalaxyWraith', 'StellarSpirit', 'NebulaPhantom'
        ];
        
        const prefixes = [
            'Admiral', 'Captain', 'Commander', 'General', 'Lord', 'Lady', 'Sir', 'Dame',
            'Duke', 'Duchess', 'Baron', 'Baroness', 'Count', 'Countess', 'Warlord', 'Champion',
            'Sentinel', 'Guardian', 'Marshal', 'Commodore', 'Colonel', 'Major', 'Chief', 'Elder',
            'Master', 'Grandmaster', 'Overlord', 'Supreme', 'Prime', 'Alpha', 'Beta', 'Omega',
            'Shadow', 'Ghost', 'Phantom', 'Spectre', 'Wraith', 'Spirit', 'Void', 'Cosmic'
        ];
        
        const name = firstNames[index % firstNames.length];
        
        // 25% chance for clan format, 75% chance for prefix format
        if (Math.random() < 0.25) {
            const clan = clanNames[Math.floor(index / firstNames.length) % clanNames.length];
            return `[${clan}] ${name}`;
        } else {
            const prefix = prefixes[Math.floor(index / 2) % prefixes.length];
            return `${prefix} ${name}`;
        }
    }

    // Update frame counter
    incrementFrame() {
        this.frameCount++;
    }

    // Get AI statistics for performance monitoring
    getStats() {
        const aiPlayers = this.game.players.filter(p => p.type !== 'human');
        const activeAI = aiPlayers.filter(p => !p.isEliminated);
        
        return {
            totalAI: aiPlayers.length,
            activeAI: activeAI.length,
            frameCount: this.frameCount,
            lastUpdateTimes: Object.keys(this.lastAIUpdate).length
        };
    }

    // Reset AI state
    reset() {
        this.frameCount = 0;
        this.lastAIUpdate = {};
    }
}