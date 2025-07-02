/**
 * Centralized Combat System for Star Throne
 * Handles all battle resolution, army transfers, and throne star mechanics
 * Eliminates duplicate combat logic scattered across different files
 */

import { GameUtils } from './utils.js';
import { gameEvents, GAME_EVENTS, EVENT_PRIORITY, EventHelpers } from './EventSystem.js';

export class CombatSystem {
    constructor(game) {
        this.game = game;
    }

    /**
     * Resolves an attack between two territories
     * @param {Object} attackingTerritory - Source territory
     * @param {Object} defendingTerritory - Target territory
     * @param {number} attackingArmies - Number of armies attacking (optional, defaults to all but 1)
     * @returns {Object} Combat result with success, casualties, and throne capture info
     */
    attackTerritory(attackingTerritory, defendingTerritory, attackingArmies = null) {
        // Validate attack
        if (!this.validateAttack(attackingTerritory, defendingTerritory)) {
            return { success: false, reason: 'Invalid attack' };
        }

        // Calculate attacking force
        const maxAttackers = Math.max(1, attackingTerritory.armySize - 1);
        const actualAttackers = attackingArmies ? Math.min(attackingArmies, maxAttackers) : maxAttackers;
        
        // Get player objects
        const attacker = this.game.players[attackingTerritory.ownerId];
        const defender = this.game.players[defendingTerritory.ownerId];
        
        if (!attacker || !defender) {
            return { success: false, reason: 'Invalid players' };
        }

        // Calculate combat result
        const combatResult = this.resolveCombat(
            actualAttackers, 
            defendingTerritory.armySize,
            attacker,
            defender
        );

        // Apply combat result
        const attackSuccess = combatResult.attackPower > combatResult.defensePower;
        const result = {
            success: attackSuccess,
            attackPower: combatResult.attackPower,
            defensePower: combatResult.defensePower,
            attackerLosses: combatResult.attackerLosses,
            defenderLosses: combatResult.defenderLosses,
            throneCapture: false,
            gameEnded: false
        };

        // Update army counts
        attackingTerritory.armySize -= actualAttackers;
        
        if (attackSuccess) {
            // Territory captured
            const oldOwner = defender;
            const survivingAttackers = Math.max(1, actualAttackers - combatResult.attackerLosses);
            
            // Check for throne star capture before changing ownership
            const isThroneCapture = defendingTerritory.isThronestar;
            
            // Transfer territory
            defendingTerritory.ownerId = attackingTerritory.ownerId;
            defendingTerritory.armySize = survivingAttackers;
            
            // Emit territory captured event
            EventHelpers.territoryEvent(GAME_EVENTS.TERRITORY_CAPTURED, defendingTerritory, attacker, {
                previousOwner: oldOwner.id,
                attackingTerritoryId: attackingTerritory.id,
                survivingArmies: survivingAttackers
            });
            
            // Handle throne star capture
            if (isThroneCapture) {
                result.throneCapture = true;
                result.gameEnded = this.handleThroneStarCapture(attacker, oldOwner, defendingTerritory);
                
                // Emit throne capture event
                EventHelpers.combatEvent(GAME_EVENTS.THRONE_CAPTURED, attacker, oldOwner, {
                    throneTerritory: defendingTerritory.id,
                    gameEnded: result.gameEnded
                });
            }
            
            // Add floating combat text
            defendingTerritory.floatingText = {
                text: `+${survivingAttackers}`,
                startTime: Date.now(),
                duration: 2000,
                startY: defendingTerritory.y
            };
        } else {
            // Attack failed
            defendingTerritory.armySize = Math.max(1, defendingTerritory.armySize - combatResult.defenderLosses);
            
            // Emit territory defended event
            EventHelpers.territoryEvent(GAME_EVENTS.TERRITORY_DEFENDED, defendingTerritory, defender, {
                attackerId: attacker.id,
                attackingTerritoryId: attackingTerritory.id,
                defenderLosses: combatResult.defenderLosses
            });
            
            // Add floating combat text
            defendingTerritory.floatingText = {
                text: `Defended!`,
                startTime: Date.now(),
                duration: 2000,
                startY: defendingTerritory.y
            };
        }

        return result;
    }

    /**
     * Validates if an attack is legal
     */
    validateAttack(attackingTerritory, defendingTerritory) {
        // Must have different owners
        if (attackingTerritory.ownerId === defendingTerritory.ownerId) {
            return false;
        }
        
        // Attacking territory must have more than 1 army
        if (attackingTerritory.armySize <= 1) {
            return false;
        }
        
        // Territories must be connected
        if (!attackingTerritory.neighbors.includes(defendingTerritory.id)) {
            return false;
        }
        
        return true;
    }

    /**
     * Resolves combat calculations with discovery bonuses
     */
    resolveCombat(attackingArmies, defendingArmies, attacker, defender) {
        // Get discovery bonuses
        const attackerDiscoveries = this.game.playerDiscoveries?.get(attacker.id) || {};
        const defenderDiscoveries = this.game.playerDiscoveries?.get(defender.id) || {};
        
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
        
        for (let territory of this.game.gameMap.territories) {
            if (territory.ownerId === oldOwner.id && territory.id !== throneTerritory.id) {
                territory.ownerId = attacker.id;
                transferredTerritories.push(territory);
            }
        }
        
        console.log(`Transferred ${transferredTerritories.length} territories to ${attacker.name}`);
        
        // Mark old owner as eliminated
        oldOwner.isEliminated = true;
        
        // Destroy the captured throne star (prevent multiple thrones in one empire)
        throneTerritory.isThronestar = false;
        
        // Add dramatic floating text
        this.game.addFloatingText(throneTerritory.x, throneTerritory.y, 
            `THRONE CAPTURED!`, '#FFD700', 5000);
        
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
     * Transfers armies between friendly territories
     * @param {Object} fromTerritory - Source territory
     * @param {Object} toTerritory - Destination territory
     * @param {number} armyCount - Number of armies to transfer
     * @returns {boolean} Success status
     */
    transferArmies(fromTerritory, toTerritory, armyCount = null) {
        // Validate transfer
        if (fromTerritory.ownerId !== toTerritory.ownerId) {
            return false;
        }
        
        if (fromTerritory.armySize <= 1) {
            return false;
        }
        
        // Calculate transfer amount
        const maxTransfer = fromTerritory.armySize - 1;
        const actualTransfer = armyCount ? Math.min(armyCount, maxTransfer) : Math.floor(maxTransfer / 2);
        
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
        
        console.log(`Transferred ${actualTransfer} armies from territory ${fromTerritory.id} to ${toTerritory.id}`);
        return true;
    }
}