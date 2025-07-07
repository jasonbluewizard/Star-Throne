/**
 * Centralized Combat System for Star Throne
 * Handles all battle resolution, army transfers, and throne star mechanics
 * Features delayed combat with coin-flip battles and visual feedback
 */

import { GameUtils } from './utils.js';
import { gameEvents, GAME_EVENTS, EVENT_PRIORITY, EventHelpers } from './EventSystem.js';

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

        // Calculate attacking force - hardcoded 50% of available fleet
        const maxAttackers = Math.max(1, attackingTerritory.armySize - 1);
        const actualAttackers = Math.floor(maxAttackers * 0.5);
        
        // Get player objects
        const attacker = this.game.players[attackingTerritory.ownerId];
        const defender = defendingTerritory.ownerId ? this.game.players[defendingTerritory.ownerId] : null; // Neutral territories have no defender player
        
        console.log(`🎯 ATTACK DEBUG: Territory ${attackingTerritory.id} owned by player ID ${attackingTerritory.ownerId}, player name: ${attacker ? attacker.name : 'NOT FOUND'}`);
        
        if (!attacker) {
            return { success: false, reason: 'Invalid attacker' };
        }
        
        // For neutral territories, defender is null - that's okay

        // Deduct armies from attacking territory immediately
        attackingTerritory.armySize -= actualAttackers;

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
            

        } else {
            // Defender wins this round - attacker loses one ship
            battle.attackersRemaining = Math.max(0, battle.attackersRemaining - 1);
            
            // Flash the defending planet with red (attacker dies)
            this.flashPlanet(battle.defendingTerritory, '#ff0000');
            

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
            
            // Handle throne star capture
            if (isThroneCapture && oldOwner) {
                console.log(`🏆 THRONE STAR CAPTURED! ${battle.attacker.name} captures throne from ${oldOwner.name}`);
                this.handleThroneStarCapture(battle.attacker, oldOwner, battle.defendingTerritory);
            } else if (isThroneCapture && !oldOwner) {
                console.log(`🏰 THRONE STAR: Territory ${battle.defendingTerritory.id} is a throne star but was neutral - not triggering capture`);
            }
            
            // DISCOVERY: Trigger discovery when conquering neutral territory
            if (wasNeutral && this.game.discoverySystem) {
                console.log(`🔬 Processing discovery for ${battle.attacker.name} conquering neutral planet ${battle.defendingTerritory.id}`);
                const discovery = this.game.discoverySystem.processDiscovery(battle.defendingTerritory, battle.attacker);
                if (discovery) {
                    console.log(`🔍 Discovery on conquered planet ${battle.defendingTerritory.id}: ${discovery.name}`);
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
        territory.combatFlashDuration = 100; // Brief flash
    }

    /**
     * Calculate weapon bonus from discoveries
     * @param {Object} player - Player object
     * @returns {number} Weapon bonus (0.0 to 0.4)
     */
    calculateWeaponBonus(player) {
        if (!player.discoveries || !player.discoveries.weaponTech) {
            return 0;
        }
        
        // Each weapon cache provides +5% attack chance
        return Math.min(0.4, player.discoveries.weaponTech * 0.05);
    }

    /**
     * Calculate defense bonus from discoveries
     * @param {Object} player - Player object
     * @returns {number} Defense bonus (0.0 to 0.4)
     */
    calculateDefenseBonus(player) {
        if (!player.discoveries || !player.discoveries.shieldTech) {
            return 0;
        }
        
        // Each shield matrix provides +5% defense chance
        return Math.min(0.4, player.discoveries.shieldTech * 0.05);
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
    transferArmies(fromTerritory, toTerritory) {
        // Validate transfer
        if (fromTerritory.ownerId !== toTerritory.ownerId) {
            return false;
        }
        
        if (fromTerritory.armySize <= 1) {
            return false;
        }
        
        // Calculate transfer amount - hardcoded 50% of available fleet
        const maxTransfer = fromTerritory.armySize - 1;
        const actualTransfer = Math.floor(maxTransfer * 0.5);
        
        if (actualTransfer <= 0) {
            return false;
        }
        
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
        
        console.log(`Transferred ${actualTransfer} armies (50%) from territory ${fromTerritory.id} to ${toTerritory.id}`);
        return true;
    }
}