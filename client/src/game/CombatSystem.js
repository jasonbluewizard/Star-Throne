/**
 * Centralized Combat System for Star Throne
 * Handles all battle resolution, army transfers, and throne star mechanics
 * Features delayed combat with coin-flip battles and visual feedback
 */

import { GameUtils } from './utils';
import { gameEvents, GAME_EVENTS, EVENT_PRIORITY, EventHelpers } from './EventSystem';

export class CombatSystem {
    constructor(game) {
        this.game = game;
        this.pendingBattles = []; // Array of battles waiting for ships to arrive
        this.activeBattles = []; // Array of battles currently in progress
    }

    /**
     * Initiates a delayed attack - ships launch but combat waits until arrival
     * @param {Object} attackingTerritory - Source territory
     * @param {Object} defendingTerritory - Target territory
     * @param {number} armyCount - Number of attacking armies
     * @returns {Object} Attack initiation result
     */
    attackTerritory(attackingTerritory, defendingTerritory, armyCount) {
        // Validate attack
        if (!this.validateAttack(attackingTerritory, defendingTerritory)) {
            return { success: false, reason: 'Invalid attack' };
        }

        // Calculate attacking force - use provided army count or default to 50%
        let actualAttackers;
        if (armyCount !== undefined && armyCount !== null) {
            actualAttackers = armyCount;
        } else {
            const maxAttackers = Math.max(0, attackingTerritory.armySize - 1);
            actualAttackers = Math.floor(maxAttackers * 0.5);
            // Apply minimum 1 ship rule
            if (actualAttackers < 1 && attackingTerritory.armySize > 1) {
                actualAttackers = 1;
            }
        }
        
        // Validate we have enough ships to attack
        if (actualAttackers <= 0 || attackingTerritory.armySize <= 1) {
            return { success: false, reason: `Territory ${attackingTerritory.id} only has ${attackingTerritory.armySize} ship(s) - cannot attack` };
        }
        
        // Get player objects
        const attacker = this.game.players[attackingTerritory.ownerId];
        const defender = defendingTerritory.ownerId ? this.game.players[defendingTerritory.ownerId] : null; // Neutral territories have no defender player
        
        console.log(`🎯 ATTACK DEBUG: Territory ${attackingTerritory.id} owned by player ID ${attackingTerritory.ownerId}, player name: ${attacker ? attacker.name : 'NOT FOUND'}`);
        
        if (!attacker) {
            return { success: false, reason: 'Invalid attacker' };
        }
        
        // For neutral territories, defender is null - that's okay

        // Deduct armies from attacking territory immediately with safety bounds
        const originalArmySize = attackingTerritory.armySize;
        attackingTerritory.armySize = Math.max(1, attackingTerritory.armySize - actualAttackers);
        
        // Verify we didn't go negative and log for debugging
        if (attackingTerritory.armySize <= 0) {
            console.error(`❌ COMBAT SYSTEM ERROR: Territory ${attackingTerritory.id} would have ${attackingTerritory.armySize} armies after sending ${actualAttackers}. Resetting to 1.`);
            attackingTerritory.armySize = 1;
            return { success: false, reason: 'Army calculation error prevented' };
        }
        
        console.log(`⚔️ COMBAT: Territory ${attackingTerritory.id} sent ${actualAttackers} armies (${originalArmySize} → ${attackingTerritory.armySize})`);

        // Create pending battle for when ships arrive
        const battle = {
            id: Date.now() + Math.random(), // Unique battle ID
            attackingTerritory: attackingTerritory,
            defendingTerritory: defendingTerritory,
            attackingArmies: actualAttackers,
            attacker: attacker,
            defender: defender,
            arrivalTime: Date.now() + 1000, // Ships arrive in 1 second
            status: 'pending'
        };
        
        // Store the attacking player ID for particle system
        this.lastAttackerId = attacker.id;

        this.pendingBattles.push(battle);
        


        return { 
            success: true, 
            attackingArmies: actualAttackers,
            battleId: battle.id
        };
    }

    /**
     * Updates the combat system, processing pending and active battles
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        const currentTime = Date.now();
        
        // Check for pending battles that should start
        for (let i = this.pendingBattles.length - 1; i >= 0; i--) {
            const battle = this.pendingBattles[i];
            
            if (currentTime >= battle.arrivalTime) {
                // Ships have arrived - start the battle
                this.startBattle(battle);
                this.pendingBattles.splice(i, 1);
            }
        }
        
        // Update active battles
        for (let i = this.activeBattles.length - 1; i >= 0; i--) {
            const battle = this.activeBattles[i];
            
            if (this.updateBattle(battle, currentTime)) {
                // Battle completed
                this.activeBattles.splice(i, 1);
            }
        }
    }

    /**
     * Starts a battle with coin-flip mechanics
     * @param {Object} battle - Battle object
     */
    startBattle(battle) {
        // Calculate combat odds based on discoveries
        const attackerBonus = this.calculateWeaponBonus(battle.attacker);
        const defenderBonus = battle.defender ? this.calculateDefenseBonus(battle.defender) : 0; // Neutral territories have no defense bonus
        
        // Base 50/50 odds adjusted by bonuses
        const attackerWinChance = Math.max(0.1, Math.min(0.9, 0.5 + attackerBonus - defenderBonus));
        
        console.log(`⚔️ COMBAT: ${battle.attackingArmies} vs ${battle.defendingTerritory.armySize} armies, round win chance: ${(attackerWinChance * 100).toFixed(1)}%`);
        
        battle.attackerWinChance = attackerWinChance;
        battle.attackersRemaining = battle.attackingArmies;
        battle.defendersRemaining = battle.defendingTerritory.armySize;
        battle.lastBattleTime = Date.now();
        battle.status = 'active';
        
        this.activeBattles.push(battle);
    }

    /**
     * Updates an active battle, processing coin-flip rounds
     * @param {Object} battle - Battle object
     * @param {number} currentTime - Current timestamp
     * @returns {boolean} True if battle is complete
     */
    updateBattle(battle, currentTime) {
        // Check if it's time for the next round (50ms per battle)
        if (currentTime - battle.lastBattleTime < 50) {
            return false;
        }
        
        // Check if battle should end before fighting
        if (battle.attackersRemaining <= 0 || battle.defendersRemaining <= 0) {
            this.completeBattle(battle);
            return true;
        }
        
        // Fight one round
        const attackerWins = Math.random() < battle.attackerWinChance;
        
        if (attackerWins) {
            // Attacker wins this round - defender loses one ship
            battle.defendersRemaining = Math.max(0, battle.defendersRemaining - 1);
            
            // Update the actual territory army count immediately
            battle.defendingTerritory.armySize = Math.max(0, battle.defendersRemaining);
            
            // Flash the defending planet with attacker's color (defender dies)
            this.flashPlanet(battle.defendingTerritory, battle.attacker.color);
            
            // Create particle explosion when defender ship dies
            const defenderColor = battle.defender ? battle.defender.color : '#999999'; // Gray for neutral
            this.createCombatParticleEffect(battle.defendingTerritory, defenderColor, 'defender_dies', battle);
            
            console.log(`💥 RED FLASH: Territory ${battle.defendingTerritory.id} flashing with attacker color ${battle.attacker.color}`);
            

        } else {
            // Defender wins this round - attacker loses one ship
            battle.attackersRemaining = Math.max(0, battle.attackersRemaining - 1);
            
            // Flash the defending planet with red (attacker dies)
            this.flashPlanet(battle.defendingTerritory, '#ff0000');
            
            // Create particle explosion when attacker ship dies
            this.createCombatParticleEffect(battle.defendingTerritory, battle.attacker.color, 'attacker_dies', battle);
            
            console.log(`💥 RED FLASH: Territory ${battle.defendingTerritory.id} flashing RED (attacker dies)`);
            

        }
        
        battle.lastBattleTime = currentTime;
        
        // Check if battle is over after this round
        if (battle.attackersRemaining <= 0 || battle.defendersRemaining <= 0) {
            this.completeBattle(battle);
            return true;
        }
        
        return false;
    }

    /**
     * Completes a battle and applies the results
     * @param {Object} battle - Battle object
     */
    completeBattle(battle) {
        const attackerWins = battle.attackersRemaining > 0 && battle.defendersRemaining <= 0;
        
        // Notify InputStateMachine about battle outcome for human player attacks
        if (this.game.inputHandler && this.game.inputHandler.inputFSM) {
            this.game.inputHandler.inputFSM.onBattleComplete(battle.id, attackerWins, battle.attackingTerritory.id);
        }
        
        if (attackerWins) {
            // Territory captured
            const oldOwner = battle.defender;
            const survivingAttackers = Math.max(1, battle.attackersRemaining);
            const wasNeutral = !oldOwner; // Check if this was a neutral territory
            
            // Check for throne star capture before changing ownership
            const isThroneCapture = battle.defendingTerritory.isThronestar;
            console.log(`🏰 THRONE CHECK: Territory ${battle.defendingTerritory.id} isThronestar: ${isThroneCapture}, defender: ${oldOwner ? oldOwner.name : 'neutral'}`);
            
            // Transfer territory
            battle.defendingTerritory.ownerId = battle.attackingTerritory.ownerId;
            battle.defendingTerritory.armySize = survivingAttackers;
            
            // Update player territories arrays
            if (oldOwner) {
                // Remove from old owner's territories
                const index = oldOwner.territories.indexOf(battle.defendingTerritory.id);
                if (index > -1) {
                    oldOwner.territories.splice(index, 1);
                }
            }
            
            // Add to new owner's territories
            if (!battle.attacker.territories.includes(battle.defendingTerritory.id)) {
                battle.attacker.territories.push(battle.defendingTerritory.id);
            }
            
            // Notify FloodModeController of territory capture for gate management
            if (this.game.floodController) {
                this.game.floodController.onTerritoryCaptured(oldOwner?.id || null, battle.attacker.id, battle.defendingTerritory.id);
            }
            
            // Handle throne star capture
            if (isThroneCapture && oldOwner) {
                console.log(`🏆 THRONE STAR CAPTURED! ${battle.attacker.name} captures throne from ${oldOwner.name}`);
                this.handleThroneStarCapture(battle.attacker, oldOwner, battle.defendingTerritory);
            }
            // Removed logically impossible condition: throne stars cannot be neutral (always have owners)
            
            // DISCOVERY: Trigger discovery when conquering neutral territory
            if (wasNeutral && this.game.discoverySystem) {
                console.log(`🔬 Processing discovery for ${battle.attacker.name} conquering neutral planet ${battle.defendingTerritory.id}`);
                const discovery = this.game.discoverySystem.processDiscovery(battle.defendingTerritory, battle.attacker);
                if (discovery) {
                    console.log(`🔍 Discovery on conquered planet ${battle.defendingTerritory.id}: ${discovery.name}`);
                    
                    // Increment tech level based on discovery type (cap at 5)
                    if (battle.attacker && battle.attacker.tech) {
                        switch (discovery.id) {
                            case 'precursor_weapons':
                                battle.attacker.tech.attack = Math.min(5, battle.attacker.tech.attack + 1);
                                break;
                            case 'precursor_shield':
                                battle.attacker.tech.defense = Math.min(5, battle.attacker.tech.defense + 1);
                                break;
                            case 'precursor_drive':
                                battle.attacker.tech.engines = Math.min(5, battle.attacker.tech.engines + 1);
                                break;
                            case 'precursor_nanotech':
                                battle.attacker.tech.production = Math.min(5, battle.attacker.tech.production + 1);
                                break;
                            case 'factory_complex':
                                battle.attacker.tech.production = Math.min(5, battle.attacker.tech.production + 1);
                                break;
                        }
                        console.log(`🔬 Tech Level Up: Player ${battle.attacker.name} - ${discovery.name} → Tech levels: A${battle.attacker.tech.attack} D${battle.attacker.tech.defense} E${battle.attacker.tech.engines} P${battle.attacker.tech.production}`);
                    }
                } else {
                    console.log(`🔍 No discovery on conquered planet ${battle.defendingTerritory.id}: Standard planet`);
                }
            }
            
            // Add floating combat text
            battle.defendingTerritory.floatingText = {
                text: `+${survivingAttackers}`,
                startTime: Date.now(),
                duration: 2000,
                startY: battle.defendingTerritory.y
            };
            

        } else {
            // Attack failed - ensure defenders have at least 1 army
            battle.defendingTerritory.armySize = Math.max(1, battle.defendersRemaining);
            
            // Add floating combat text
            battle.defendingTerritory.floatingText = {
                text: `Defended!`,
                startTime: Date.now(),
                duration: 2000,
                startY: battle.defendingTerritory.y
            };
            

        }
    }

    /**
     * Flash a planet with the attacker's color
     * @param {Object} territory - Territory to flash
     * @param {string} color - Color to flash
     */
    flashPlanet(territory, color) {
        territory.combatFlashTime = Date.now();
        territory.combatFlashColor = color;
        territory.combatFlashDuration = 800; // Longer flash duration matching Territory default
    }

    /**
     * Create combat particle effects when ships die
     * @param {Object} territory - Territory where combat occurs
     * @param {string} shipColor - Color of the dying ship
     * @param {string} context - 'attacker_dies' or 'defender_dies'
     */
    createCombatParticleEffect(territory, shipColor, context, battleInfo = null) {
        // Show subtle particle explosions for ALL combat
        const intensity = context === 'defender_dies' ? 1.3 : 1.0; // Moderate intensity
        
        if (this.game.animationSystem && this.game.animationSystem.createCombatParticles) {
            this.game.animationSystem.createCombatParticles(
                territory.x, 
                territory.y, 
                shipColor, 
                intensity
            );
        }
    }
    
    // Check if battle is within specified distance of human player territories
    isBattleNearPlayer(territory, humanPlayerId, maxDistance) {
        if (!territory.neighbors) return false;
        
        // Breadth-first search to find player territories within maxDistance hops
        const visited = new Set();
        const queue = [{id: territory.id, distance: 0}];
        visited.add(territory.id);
        
        while (queue.length > 0) {
            const {id, distance} = queue.shift();
            const currentTerritory = this.game.gameMap?.territories?.[id];
            
            if (!currentTerritory) continue;
            
            // If we found a player territory within range
            if (currentTerritory.ownerId === humanPlayerId) {
                return true;
            }
            
            // If we haven't reached max distance, explore neighbors
            if (distance < maxDistance && currentTerritory.neighbors) {
                for (const neighborId of currentTerritory.neighbors) {
                    if (!visited.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push({id: neighborId, distance: distance + 1});
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * Calculate weapon bonus from discoveries
     * @param {Object} player - Player object
     * @returns {number} Weapon bonus (0.0 to 0.4)
     */
    calculateWeaponBonus(player) {
        let bonus = 0;
        
        // Legacy discovery system bonus
        if (player.discoveries && player.discoveries.weaponTech) {
            bonus += Math.min(0.4, player.discoveries.weaponTech * 0.05);
        }
        
        // New tech level bonus: +5% per attack tech level
        if (player.tech && player.tech.attack > 0) {
            bonus += player.tech.attack * 0.05;
        }
        
        return bonus;
    }

    /**
     * Calculate defense bonus from discoveries
     * @param {Object} player - Player object
     * @returns {number} Defense bonus (0.0 to 0.4)
     */
    calculateDefenseBonus(player) {
        let bonus = 0;
        
        // Legacy discovery system bonus
        if (player.discoveries && player.discoveries.shieldTech) {
            bonus += Math.min(0.4, player.discoveries.shieldTech * 0.05);
        }
        
        // New tech level bonus: +5% per defense tech level
        if (player.tech && player.tech.defense > 0) {
            bonus += player.tech.defense * 0.05;
        }
        
        return bonus;
    }

    /**
     * Calculate battle odds for tooltip display
     * @param {Object} attacker - Attacking player
     * @param {Object} defender - Defending player
     * @returns {number} Win chance percentage (0-100)
     */
    calculateBattleOdds(attacker, defender) {
        const attackerBonus = this.calculateWeaponBonus(attacker);
        const defenderBonus = defender ? this.calculateDefenseBonus(defender) : 0; // Handle neutral territories
        
        // Base 50/50 odds adjusted by bonuses
        const attackerWinChance = Math.max(0.1, Math.min(0.9, 0.5 + attackerBonus - defenderBonus));
        
        return Math.round(attackerWinChance * 100);
    }

    /**
     * Calculate detailed combat preview with casualty estimates
     * @param {Object} attackingTerritory - Source territory
     * @param {Object} defendingTerritory - Target territory
     * @param {number} attackingArmies - Number of attacking armies
     * @returns {Object} Combat preview with odds, casualties, and outcome
     */
    calculateCombatPreview(attackingTerritory, defendingTerritory, attackingArmies) {
        if (!attackingTerritory || !defendingTerritory) {
            return null;
        }

        // Get player objects
        const attacker = this.game.players[attackingTerritory.ownerId];
        const defender = defendingTerritory.ownerId ? this.game.players[defendingTerritory.ownerId] : null;

        if (!attacker) {
            return null;
        }

        // Calculate win chance
        const winChance = this.calculateBattleOdds(attacker, defender);
        const attackerWinChance = winChance / 100;

        // Simulate battle outcome multiple times to get average casualties
        const simulations = 100;
        let totalAttackerLosses = 0;
        let totalDefenderLosses = 0;
        let victories = 0;

        for (let i = 0; i < simulations; i++) {
            let attackersRemaining = attackingArmies;
            let defendersRemaining = defendingTerritory.armySize;
            let attackerLosses = 0;
            let defenderLosses = 0;

            // Simulate battle rounds
            while (attackersRemaining > 0 && defendersRemaining > 0) {
                if (Math.random() < attackerWinChance) {
                    // Attacker wins round
                    defendersRemaining--;
                    defenderLosses++;
                } else {
                    // Defender wins round
                    attackersRemaining--;
                    attackerLosses++;
                }
            }

            totalAttackerLosses += attackerLosses;
            totalDefenderLosses += defenderLosses;

            if (attackersRemaining > 0) {
                victories++;
            }
        }

        // Calculate average casualties
        const avgAttackerLosses = Math.round(totalAttackerLosses / simulations);
        const avgDefenderLosses = Math.round(totalDefenderLosses / simulations);
        const actualWinChance = Math.round((victories / simulations) * 100);

        // Determine outcome text
        let outcomeText = '';
        if (actualWinChance >= 60) {
            outcomeText = `PROJ VICTORY (lose ${avgAttackerLosses} ships)`;
        } else if (actualWinChance >= 40) {
            outcomeText = `UNCERTAIN (lose ${avgAttackerLosses} ships)`;
        } else {
            outcomeText = `PROJ DEFEAT (destroy ${avgDefenderLosses} enemies)`;
        }

        return {
            winChance: actualWinChance,
            outcomeText: outcomeText,
            attackerLosses: avgAttackerLosses,
            defenderLosses: avgDefenderLosses,
            attackingArmies: attackingArmies,
            defendingArmies: defendingTerritory.armySize
        };
    }

    /**
     * Validates if an attack is legal - now allows long-range attacks
     */
    validateAttack(attackingTerritory, defendingTerritory) {
        if (!attackingTerritory || !defendingTerritory) return false;
        // Must have an attacker and not target own territory
        if (attackingTerritory.ownerId === null) return false;
        if (attackingTerritory.ownerId === defendingTerritory.ownerId) return false;
        // (Removed adjacency requirement to allow long-range attacks)
        return true;
    }

    /**
     * Resolves combat calculations with discovery bonuses
     */
    resolveCombat(attackingArmies, defendingArmies, attacker, defender) {
        // Get discovery bonuses
        const attackerDiscoveries = this.game.playerDiscoveries?.get(attacker.id) || {};
        const defenderDiscoveries = defender ? (this.game.playerDiscoveries?.get(defender.id) || {}) : {}; // Handle neutral territories
        
        // Calculate attack power with bonuses
        let attackBonus = 1.0;
        if (attackerDiscoveries.precursorWeapons > 0) {
            attackBonus += attackerDiscoveries.precursorWeapons * 0.1; // +10% per level
        }
        
        let attackPower = attackingArmies * (0.8 + Math.random() * 0.4) * attackBonus;
        
        // Calculate defense power with bonuses
        let defenseBonus = 1.0;
        if (defenderDiscoveries.precursorShield > 0) {
            defenseBonus += defenderDiscoveries.precursorShield * 0.1; // +10% per level
        }
        
        let defensePower = defendingArmies * (1.0 + Math.random() * 0.2) * defenseBonus;
        
        // Calculate casualties
        const attackerLosses = Math.floor(attackingArmies * (0.2 + Math.random() * 0.3));
        const defenderLosses = Math.floor(defendingArmies * (0.3 + Math.random() * 0.4));
        
        return {
            attackPower,
            defensePower,
            attackerLosses,
            defenderLosses
        };
    }

    /**
     * Handles throne star capture mechanics
     * @param {Object} attacker - Player who captured the throne
     * @param {Object} oldOwner - Player who lost the throne
     * @param {Object} throneTerritory - The throne star territory
     * @returns {boolean} True if game ended
     */
    handleThroneStarCapture(attacker, oldOwner, throneTerritory) {
        console.log(`🏆 THRONE STAR CAPTURED! ${attacker.name} captures throne from ${oldOwner.name}`);
        
        // Transfer all territories from old owner to attacker
        const transferredTerritories = [];
        
        for (let territory of Object.values(this.game.gameMap.territories)) {
            if (territory.ownerId === oldOwner.id && territory.id !== throneTerritory.id) {
                territory.ownerId = attacker.id;
                transferredTerritories.push(territory);
                
                // Update player territories arrays
                attacker.territories.push(territory.id);
            }
        }
        
        // Clear old owner's territories array (they've lost everything)
        oldOwner.territories = [];
        
        console.log(`Transferred ${transferredTerritories.length} territories to ${attacker.name}`);
        
        // Mark old owner as eliminated
        oldOwner.isEliminated = true;
        
        // Invalidate AI player cache since a player was eliminated
        if (this.game.aiManager) {
            this.game.aiManager.invalidatePlayerCache();
        }
        
        // Destroy the captured throne star (prevent multiple thrones in one empire)
        console.log(`🔥 Destroying captured throne star ${throneTerritory.id} to prevent multiple thrones`);
        throneTerritory.isThronestar = false;
        
        // Add dramatic floating text
        const floatingText = {
            x: throneTerritory.x,
            y: throneTerritory.y - 30,
            text: 'THRONE CAPTURED!',
            color: '#FFD700',
            startTime: Date.now(),
            duration: 5000
        };
        
        if (!this.game.floatingTexts) this.game.floatingTexts = [];
        this.game.floatingTexts.push(floatingText);
        
        // Check if this was a human player
        if (oldOwner.type === 'human') {
            console.log(`Human player ${oldOwner.name} eliminated! Game ending...`);
            // Set the attacker as winner when human player's throne is captured
            this.game.endGame(attacker);
            return true; // Game should end
        }
        
        // Check overall win conditions
        return this.game.checkWinConditions();
    }

    /**
     * Transfers armies between friendly territories (hardcoded 50% of fleet)
     * @param {Object} fromTerritory - Source territory
     * @param {Object} toTerritory - Destination territory
     * @returns {boolean} Success status
     */
    transferArmies(fromTerritory, toTerritory, transferAmount = null) {
        // Validate transfer
        if (fromTerritory.ownerId !== toTerritory.ownerId) {
            return false;
        }
        
        if (fromTerritory.armySize <= 1) {
            console.log(`❌ Cannot transfer from territory ${fromTerritory.id} - only has ${fromTerritory.armySize} ship(s)`);
            return false;
        }
        
        // Calculate transfer amount - use provided amount or default to 50%
        let actualTransfer;
        if (transferAmount !== null) {
            actualTransfer = transferAmount;
        } else {
            const maxTransfer = fromTerritory.armySize - 1;
            actualTransfer = Math.floor(maxTransfer * 0.5);
            // Apply minimum 1 ship rule
            if (actualTransfer < 1 && fromTerritory.armySize > 1) {
                actualTransfer = 1;
            }
        }
        
        if (actualTransfer <= 0) {
            return false;
        }
        
        // Don't transfer more than available
        const maxAvailable = fromTerritory.armySize - 1;
        actualTransfer = Math.min(actualTransfer, maxAvailable);
        
        // Execute transfer
        fromTerritory.armySize -= actualTransfer;
        toTerritory.armySize += actualTransfer;
        
        // Add visual feedback using territory floating text system
        toTerritory.floatingText = {
            text: `+${actualTransfer}`,
            startTime: Date.now(),
            duration: 2000,
            startY: toTerritory.y
        };
        
        console.log(`Transferred ${actualTransfer} armies from territory ${fromTerritory.id} to ${toTerritory.id}`);
        return true;
    }
}