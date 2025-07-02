import { GAME_CONSTANTS } from '../../../common/gameConstants';

export class EnhancedCombatSystem {
    constructor(game) {
        this.game = game;
        
        // Combat animations and effects
        this.activeBattles = [];
        this.explosionEffects = [];
        this.combatResults = [];
        
        // Fleet composition system
        this.fleetTypes = {
            scouts: { cost: 5, attack: 0.8, defense: 0.6, speed: 1.5, icon: '🔍' },
            fighters: { cost: 10, attack: 1.0, defense: 1.0, speed: 1.0, icon: '⚔️' },
            battleships: { cost: 20, attack: 1.8, defense: 1.4, speed: 0.7, icon: '🚢' },
            carriers: { cost: 30, attack: 1.2, defense: 1.6, speed: 0.8, icon: '🛸' }
        };
        
        // Terrain bonuses
        this.terrainBonuses = {
            asteroid: { defense: 1.3, description: 'Asteroid fields provide defensive cover' },
            nebula: { attack: 0.8, defense: 1.1, description: 'Nebulas reduce visibility' },
            station: { defense: 1.5, attack: 1.2, description: 'Space stations boost combat' },
            fortress: { defense: 2.0, description: 'Ancient fortresses are nearly impregnable' }
        };
        
        // Combat phases
        this.combatPhases = {
            APPROACH: 'approach',
            ENGAGEMENT: 'engagement', 
            RESOLUTION: 'resolution',
            AFTERMATH: 'aftermath'
        };
    }

    // Enhanced combat resolution with animations
    resolveCombat(attackingTerritory, defendingTerritory, attackingFleetComposition = null) {
        const battle = this.createBattle(attackingTerritory, defendingTerritory, attackingFleetComposition);
        
        // Add to active battles for animation
        this.activeBattles.push(battle);
        
        // Start combat sequence
        this.startCombatSequence(battle);
        
        return battle;
    }

    // Create battle data structure
    createBattle(attackingTerritory, defendingTerritory, fleetComposition) {
        const attackingPlayer = this.game.players.find(p => p.id === attackingTerritory.ownerId);
        const defendingPlayer = this.game.players.find(p => p.id === defendingTerritory.ownerId);
        
        const battle = {
            id: Date.now() + Math.random(),
            phase: this.combatPhases.APPROACH,
            startTime: Date.now(),
            
            // Territory info
            attackingTerritory,
            defendingTerritory,
            
            // Player info  
            attackingPlayer,
            defendingPlayer,
            
            // Fleet composition
            attackingFleet: this.calculateFleetComposition(attackingTerritory, fleetComposition),
            defendingFleet: this.calculateFleetComposition(defendingTerritory),
            
            // Combat modifiers
            terrainBonus: this.getTerrainBonus(defendingTerritory),
            discoveryBonuses: this.getDiscoveryBonuses(attackingPlayer, defendingPlayer),
            
            // Animation data
            explosions: [],
            projectiles: [],
            visualEffects: [],
            
            // Results
            winner: null,
            casualties: { attacker: 0, defender: 0 },
            completed: false
        };
        
        return battle;
    }

    // Calculate fleet composition
    calculateFleetComposition(territory, composition = null) {
        const totalArmies = territory.id === territory.ownerId ? territory.armySize - 1 : territory.armySize;
        
        if (composition) {
            // Custom fleet composition
            return {
                scouts: composition.scouts || 0,
                fighters: composition.fighters || totalArmies,
                battleships: composition.battleships || 0,
                carriers: composition.carriers || 0,
                total: totalArmies
            };
        } else {
            // Default composition (mostly fighters)
            return {
                scouts: Math.floor(totalArmies * 0.1),
                fighters: Math.floor(totalArmies * 0.7),
                battleships: Math.floor(totalArmies * 0.15),
                carriers: Math.floor(totalArmies * 0.05),
                total: totalArmies
            };
        }
    }

    // Get terrain bonuses
    getTerrainBonus(territory) {
        if (territory.terrainType && this.terrainBonuses[territory.terrainType]) {
            return this.terrainBonuses[territory.terrainType];
        }
        
        // Random terrain assignment for existing territories
        if (!territory.terrainType) {
            const terrainTypes = Object.keys(this.terrainBonuses);
            const randomIndex = Math.floor(territory.id * 0.234) % terrainTypes.length;
            territory.terrainType = Math.random() < 0.3 ? terrainTypes[randomIndex] : 'normal';
        }
        
        return territory.terrainType !== 'normal' ? this.terrainBonuses[territory.terrainType] : {};
    }

    // Get discovery bonuses from discovery system
    getDiscoveryBonuses(attackingPlayer, defendingPlayer) {
        const bonuses = { attacker: {}, defender: {} };
        
        if (this.game.discoverySystem && attackingPlayer?.type === 'human') {
            const combatBonuses = this.game.discoverySystem.getCombatBonuses();
            bonuses.attacker = combatBonuses;
        }
        
        // Defenders get slight home advantage
        bonuses.defender.defense = 0.1;
        
        return bonuses;
    }

    // Start animated combat sequence
    startCombatSequence(battle) {
        console.log(`⚔️ Enhanced combat: ${battle.attackingPlayer?.name} attacks ${battle.defendingPlayer?.name || 'neutral'}`);
        
        // Phase 1: Approach (ships moving toward each other)
        this.animateApproachPhase(battle);
        
        // Schedule subsequent phases
        setTimeout(() => this.animateEngagementPhase(battle), 1000);
        setTimeout(() => this.animateResolutionPhase(battle), 2000);
        setTimeout(() => this.animateAftermathPhase(battle), 3000);
    }

    // Animate approach phase
    animateApproachPhase(battle) {
        battle.phase = this.combatPhases.APPROACH;
        
        // Create approaching ship projectiles
        const shipCount = Math.min(battle.attackingFleet.total, 20); // Limit visual ships
        
        for (let i = 0; i < shipCount; i++) {
            const projectile = {
                id: Date.now() + i,
                from: { x: battle.attackingTerritory.x, y: battle.attackingTerritory.y },
                to: { x: battle.defendingTerritory.x, y: battle.defendingTerritory.y },
                progress: 0,
                speed: 0.5 + Math.random() * 0.3,
                type: this.getRandomShipType(),
                color: battle.attackingPlayer?.color || '#ff4444'
            };
            
            battle.projectiles.push(projectile);
        }
    }

    // Animate engagement phase
    animateEngagementPhase(battle) {
        battle.phase = this.combatPhases.ENGAGEMENT;
        
        // Create explosion effects
        const explosionCount = Math.min(battle.attackingFleet.total + battle.defendingFleet.total, 15);
        
        for (let i = 0; i < explosionCount; i++) {
            const explosion = {
                id: Date.now() + i,
                x: battle.defendingTerritory.x + (Math.random() - 0.5) * 100,
                y: battle.defendingTerritory.y + (Math.random() - 0.5) * 100,
                size: 10 + Math.random() * 20,
                intensity: Math.random(),
                startTime: Date.now() + i * 100,
                duration: 800,
                color: i % 2 === 0 ? '#ff6600' : '#ffaa00'
            };
            
            battle.explosions.push(explosion);
        }
        
        // Add visual effects
        battle.visualEffects.push({
            type: 'shockwave',
            x: battle.defendingTerritory.x,
            y: battle.defendingTerritory.y,
            startTime: Date.now(),
            duration: 1200,
            maxRadius: 80
        });
    }

    // Animate resolution phase
    animateResolutionPhase(battle) {
        battle.phase = this.combatPhases.RESOLUTION;
        
        // Calculate actual combat results
        const result = this.calculateCombatOutcome(battle);
        battle.winner = result.winner;
        battle.casualties = result.casualties;
        
        // Create damage numbers
        if (result.casualties.attacker > 0) {
            battle.visualEffects.push({
                type: 'damage_number',
                text: `-${result.casualties.attacker}`,
                x: battle.attackingTerritory.x,
                y: battle.attackingTerritory.y - 30,
                color: '#ff4444',
                startTime: Date.now(),
                duration: 2000
            });
        }
        
        if (result.casualties.defender > 0) {
            battle.visualEffects.push({
                type: 'damage_number',
                text: `-${result.casualties.defender}`,
                x: battle.defendingTerritory.x,
                y: battle.defendingTerritory.y - 30,
                color: '#ff4444',
                startTime: Date.now(),
                duration: 2000
            });
        }
        
        // Victory/defeat indicator
        battle.visualEffects.push({
            type: 'result_banner',
            text: result.winner === 'attacker' ? 'VICTORY!' : 'DEFEAT!',
            x: battle.defendingTerritory.x,
            y: battle.defendingTerritory.y - 50,
            color: result.winner === 'attacker' ? '#00ff00' : '#ff0000',
            startTime: Date.now(),
            duration: 3000
        });
    }

    // Animate aftermath phase
    animateAftermathPhase(battle) {
        battle.phase = this.combatPhases.AFTERMATH;
        
        // Apply results to territories
        this.applyCombatResults(battle);
        
        // Mark battle as completed
        battle.completed = true;
        
        // Add to combat results history
        this.combatResults.push({
            timestamp: Date.now(),
            attacker: battle.attackingPlayer?.name,
            defender: battle.defendingPlayer?.name || 'Neutral',
            winner: battle.winner,
            casualties: battle.casualties,
            location: battle.defendingTerritory.id
        });
        
        console.log(`Combat complete: ${battle.winner === 'attacker' ? 'Victory' : 'Defeat'}`);
    }

    // Calculate combat outcome with enhanced mechanics
    calculateCombatOutcome(battle) {
        const attacker = battle.attackingFleet;
        const defender = battle.defendingFleet;
        const terrain = battle.terrainBonus;
        const bonuses = battle.discoveryBonuses;
        
        // Calculate effective combat power
        let attackPower = this.calculateFleetPower(attacker, 'attack');
        let defensePower = this.calculateFleetPower(defender, 'defense');
        
        // Apply discovery bonuses
        attackPower *= (1 + (bonuses.attacker.attackBonus || 0));
        defensePower *= (1 + (bonuses.defender.defenseBonus || 0));
        
        // Apply terrain bonuses
        if (terrain.attack) attackPower *= terrain.attack;
        if (terrain.defense) defensePower *= terrain.defense;
        
        // Add randomness
        attackPower *= (0.8 + Math.random() * 0.4);
        defensePower *= (0.8 + Math.random() * 0.4);
        
        // Determine winner and calculate casualties
        if (attackPower > defensePower) {
            const casualtyRate = 1 - (attackPower / (attackPower + defensePower));
            const attackerCasualties = Math.floor(attacker.total * casualtyRate * 0.7);
            const defenderCasualties = defender.total;
            
            return {
                winner: 'attacker',
                casualties: {
                    attacker: attackerCasualties,
                    defender: defenderCasualties
                },
                survivingArmies: attacker.total - attackerCasualties
            };
        } else {
            const casualtyRate = 1 - (defensePower / (attackPower + defensePower));
            const defenderCasualties = Math.floor(defender.total * casualtyRate);
            const attackerCasualties = attacker.total;
            
            return {
                winner: 'defender',
                casualties: {
                    attacker: attackerCasualties,
                    defender: defenderCasualties
                },
                survivingArmies: defender.total - defenderCasualties
            };
        }
    }

    // Calculate fleet power based on composition
    calculateFleetPower(fleet, type) {
        let power = 0;
        
        for (const [shipType, count] of Object.entries(fleet)) {
            if (shipType === 'total') continue;
            
            const shipStats = this.fleetTypes[shipType];
            if (shipStats) {
                power += count * shipStats[type];
            }
        }
        
        return power;
    }

    // Apply combat results to game state
    applyCombatResults(battle) {
        const result = battle;
        
        if (result.winner === 'attacker') {
            // Territory captured
            const previousOwner = result.defendingTerritory.ownerId;
            result.defendingTerritory.ownerId = result.attackingTerritory.ownerId;
            result.defendingTerritory.armySize = result.casualties ? 
                (result.casualties.survivingArmies || Math.ceil(result.attackingFleet.total * 0.7)) : 
                Math.ceil(result.attackingFleet.total * 0.7);
            
            result.attackingTerritory.armySize = 1; // Attacking territory left with 1
            
            // Update player territories
            if (previousOwner) {
                const prevPlayer = this.game.players.find(p => p.id === previousOwner);
                if (prevPlayer) {
                    const index = prevPlayer.territories.indexOf(result.defendingTerritory.id);
                    if (index > -1) prevPlayer.territories.splice(index, 1);
                }
            }
            
            const newOwner = this.game.players.find(p => p.id === result.attackingTerritory.ownerId);
            if (newOwner && !newOwner.territories.includes(result.defendingTerritory.id)) {
                newOwner.territories.push(result.defendingTerritory.id);
            }
            
            // Check for throne star capture
            if (result.defendingTerritory.isThronestar) {
                this.handleThroneCapture(newOwner, previousOwner);
            }
            
        } else {
            // Attack failed
            result.attackingTerritory.armySize = 1;
            if (result.casualties && result.casualties.defender > 0) {
                result.defendingTerritory.armySize = Math.max(1, 
                    result.defendingTerritory.armySize - result.casualties.defender);
            }
        }
        
        // Flash territories for visual feedback
        result.attackingTerritory.combatFlashTime = Date.now();
        result.defendingTerritory.combatFlashTime = Date.now();
    }

    // Handle throne star capture
    handleThroneCapture(conqueror, defeated) {
        if (!defeated) return;
        
        console.log(`👑 THRONE CAPTURED! ${conqueror.name} conquers ${defeated}'s empire!`);
        
        // Transfer all territories
        const defeatedPlayer = this.game.players.find(p => p.id === defeated);
        if (defeatedPlayer) {
            const territoriesToTransfer = [...defeatedPlayer.territories];
            
            for (const territoryId of territoriesToTransfer) {
                const territory = this.game.gameMap.territories[territoryId];
                if (territory && territory.id !== territoryId) { // Don't transfer the captured throne itself
                    territory.ownerId = conqueror.id;
                    conqueror.territories.push(territoryId);
                }
            }
            
            defeatedPlayer.territories = [];
            defeatedPlayer.isEliminated = true;
            
            // Destroy captured throne star
            const capturedThrone = this.game.gameMap.territories.find(t => t.isThronestar && t.ownerId === conqueror.id);
            if (capturedThrone) {
                capturedThrone.isThronestar = false;
            }
        }
    }

    // Get random ship type for animations
    getRandomShipType() {
        const types = Object.keys(this.fleetTypes);
        return types[Math.floor(Math.random() * types.length)];
    }

    // Update all active battles
    update(deltaTime) {
        // Update battle animations
        for (let i = this.activeBattles.length - 1; i >= 0; i--) {
            const battle = this.activeBattles[i];
            
            // Update projectiles
            for (const projectile of battle.projectiles) {
                projectile.progress += deltaTime * projectile.speed / 1000;
            }
            
            // Remove completed battles
            if (battle.completed && Date.now() - battle.startTime > 5000) {
                this.activeBattles.splice(i, 1);
            }
        }
        
        // Clean up old explosion effects
        this.explosionEffects = this.explosionEffects.filter(
            explosion => Date.now() - explosion.startTime < explosion.duration
        );
    }

    // Render combat animations
    render(ctx, camera) {
        for (const battle of this.activeBattles) {
            this.renderBattle(ctx, camera, battle);
        }
    }

    // Render individual battle
    renderBattle(ctx, camera, battle) {
        // Render projectiles
        for (const projectile of battle.projectiles) {
            if (projectile.progress < 1.0) {
                const currentX = projectile.from.x + (projectile.to.x - projectile.from.x) * projectile.progress;
                const currentY = projectile.from.y + (projectile.to.y - projectile.from.y) * projectile.progress;
                
                const screenPos = camera.worldToScreen(currentX, currentY);
                
                ctx.save();
                ctx.fillStyle = projectile.color;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
        
        // Render explosions
        for (const explosion of battle.explosions) {
            const age = Date.now() - explosion.startTime;
            if (age > 0 && age < explosion.duration) {
                const progress = age / explosion.duration;
                const alpha = 1.0 - progress;
                const size = explosion.size * (1 + progress * 2);
                
                const screenPos = camera.worldToScreen(explosion.x, explosion.y);
                
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = explosion.color;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
        
        // Render visual effects
        for (const effect of battle.visualEffects) {
            this.renderVisualEffect(ctx, camera, effect);
        }
    }

    // Render visual effects
    renderVisualEffect(ctx, camera, effect) {
        const age = Date.now() - effect.startTime;
        if (age < 0 || age > effect.duration) return;
        
        const progress = age / effect.duration;
        const screenPos = camera.worldToScreen(effect.x, effect.y);
        
        ctx.save();
        
        switch (effect.type) {
            case 'shockwave':
                const radius = progress * effect.maxRadius;
                ctx.strokeStyle = '#ffffff';
                ctx.globalAlpha = 1.0 - progress;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case 'damage_number':
                ctx.fillStyle = effect.color;
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.globalAlpha = 1.0 - progress;
                ctx.fillText(effect.text, screenPos.x, screenPos.y - progress * 20);
                break;
                
            case 'result_banner':
                ctx.fillStyle = effect.color;
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.globalAlpha = progress < 0.5 ? progress * 2 : 2 - progress * 2;
                ctx.fillText(effect.text, screenPos.x, screenPos.y);
                break;
        }
        
        ctx.restore();
    }

    // Get combat statistics
    getStats() {
        return {
            activeBattles: this.activeBattles.length,
            totalBattles: this.combatResults.length,
            explosionEffects: this.explosionEffects.length,
            recentResults: this.combatResults.slice(-5)
        };
    }

    // Reset system
    reset() {
        this.activeBattles = [];
        this.explosionEffects = [];
        this.combatResults = [];
    }
}