/**
 * CombatSystem.js - Combat resolution module
 * 
 * Contains all logic related to resolving conflicts between players.
 * Encapsulates combat mechanics for easier balancing and modification.
 */

import { GAME_CONSTANTS } from '../../../common/gameConstants.ts';

export class CombatSystem {
    constructor(game) {
        this.game = game;
    }
    
    attackTerritory(fromTerritory, toTerritory) {
        if (!this.validateAttack(fromTerritory, toTerritory)) {
            return false;
        }
        
        const attackingPlayer = this.game.players.find(p => p.id === fromTerritory.ownerId);
        const defendingPlayer = toTerritory.ownerId ? 
            this.game.players.find(p => p.id === toTerritory.ownerId) : null;
        
        // Calculate attacking force
        const attackingArmies = Math.floor(fromTerritory.armySize * GAME_CONSTANTS.ATTACK_TRANSFER_RATIO);
        
        if (attackingArmies < GAME_CONSTANTS.MIN_ATTACK_ARMY_SIZE) {
            console.log('Not enough armies to attack!');
            return false;
        }
        
        // Apply discovery bonuses
        const attackBonus = this.calculateAttackBonus(attackingPlayer);
        const defenseBonus = this.calculateDefenseBonus(defendingPlayer);
        
        // Calculate combat result
        const combatResult = this.resolveCombat(
            attackingArmies, 
            toTerritory.armySize, 
            attackBonus, 
            defenseBonus
        );
        
        // Apply combat result
        fromTerritory.armySize -= attackingArmies;
        
        if (combatResult.victory) {
            // Attacker wins
            this.handleVictoriousAttack(
                fromTerritory, toTerritory, 
                attackingPlayer, defendingPlayer,
                combatResult.survivingArmies
            );
        } else {
            // Defender wins
            this.handleFailedAttack(fromTerritory, toTerritory, combatResult.survivingArmies);
        }
        
        // Visual feedback
        this.triggerCombatFlash(toTerritory);
        this.createFloatingDamageText(toTerritory, combatResult);
        
        // Check for throne star capture - CRITICAL FIX
        if (combatResult.victory && toTerritory.isThronestar) {
            console.log(`🏆 THRONE STAR CAPTURE DETECTED! ${attackingPlayer.name} captures ${defendingPlayer?.name}'s throne!`);
            this.handleThroneStarCapture(attackingPlayer, defendingPlayer, toTerritory);
        }
        
        // Check elimination
        this.checkPlayerElimination();
        
        // Check win conditions
        this.checkWinConditions();
        
        return true;
    }
    
    validateAttack(fromTerritory, toTerritory) {
        // Check ownership
        if (fromTerritory.ownerId !== this.game.humanPlayer?.id) {
            console.log('Cannot attack from territory you don\'t own');
            return false;
        }
        
        // Check if target is colonizable (use probes instead)
        if (toTerritory.isColonizable) {
            console.log('Cannot attack colonizable planets - use probes instead');
            return false;
        }
        
        // Check adjacency
        if (!fromTerritory.neighbors.includes(toTerritory.id)) {
            console.log('Territories must be adjacent to attack');
            return false;
        }
        
        // Check self-attack
        if (fromTerritory.ownerId === toTerritory.ownerId) {
            console.log('Cannot attack your own territory');
            return false;
        }
        
        // Check minimum army requirement
        const attackingArmies = Math.floor(fromTerritory.armySize * GAME_CONSTANTS.ATTACK_TRANSFER_RATIO);
        if (attackingArmies < GAME_CONSTANTS.MIN_ATTACK_ARMY_SIZE) {
            console.log('Need at least 2 armies to attack');
            return false;
        }
        
        return true;
    }
    
    resolveCombat(attackingArmies, defendingArmies, attackBonus = 0, defenseBonus = 0) {
        // Calculate effective combat strength
        const baseAttackPower = attackingArmies * GAME_CONSTANTS.ATTACK_POWER_BASE_MULTIPLIER;
        const randomAttackModifier = Math.random() * GAME_CONSTANTS.ATTACK_POWER_RANDOM_RANGE;
        const attackPower = (baseAttackPower + randomAttackModifier) * (1 + attackBonus / 100);
        
        const baseDefensePower = defendingArmies * GAME_CONSTANTS.DEFENSE_POWER_BASE_MULTIPLIER;
        const randomDefenseModifier = Math.random() * GAME_CONSTANTS.DEFENSE_POWER_RANDOM_RANGE;
        const defensePower = (baseDefensePower + randomDefenseModifier) * (1 + defenseBonus / 100);
        
        console.log(`Combat: Attack ${attackPower.toFixed(1)} vs Defense ${defensePower.toFixed(1)}`);
        
        const victory = attackPower > defensePower;
        const powerDifference = Math.abs(attackPower - defensePower);
        
        // Calculate survivors based on power difference
        let survivingArmies;
        if (victory) {
            // Attacker wins - survivors proportional to excess power
            const casualtyRate = Math.min(0.8, defensePower / attackPower);
            survivingArmies = Math.max(1, Math.floor(attackingArmies * (1 - casualtyRate)));
        } else {
            // Defender wins - survivors based on defense efficiency
            const casualtyRate = Math.min(0.9, attackPower / defensePower);
            survivingArmies = Math.max(0, Math.floor(defendingArmies * (1 - casualtyRate)));
        }
        
        return {
            victory,
            survivingArmies,
            attackPower,
            defensePower,
            powerDifference
        };
    }
    
    calculateAttackBonus(player) {
        if (!player) return 0;
        
        let bonus = 0;
        
        // Check for Precursor Weapons discovery
        if (this.game.discoveries) {
            const weaponsDiscoveries = this.game.discoveries.filter(d => 
                d.playerId === player.id && d.type === 'precursor_weapons'
            );
            bonus += weaponsDiscoveries.length * 10; // +10% per level
        }
        
        return bonus;
    }
    
    calculateDefenseBonus(player) {
        if (!player) return 0;
        
        let bonus = 0;
        
        // Check for Precursor Shield discovery
        if (this.game.discoveries) {
            const shieldDiscoveries = this.game.discoveries.filter(d => 
                d.playerId === player.id && d.type === 'precursor_shield'
            );
            bonus += shieldDiscoveries.length * 10; // +10% per level
        }
        
        return bonus;
    }
    
    handleVictoriousAttack(fromTerritory, toTerritory, attackingPlayer, defendingPlayer, survivingArmies) {
        console.log(`${attackingPlayer.name} captures territory ${toTerritory.id}`);
        
        // CRITICAL: Check for throne star capture BEFORE any territory transfers!
        console.log(`DEBUG: Throne check - isThronestar: ${toTerritory.isThronestar}, defendingPlayer: ${defendingPlayer ? defendingPlayer.name : 'null'}, defendingPlayer.type: ${defendingPlayer ? defendingPlayer.type : 'null'}`);
        if (toTerritory.isThronestar && defendingPlayer) {
            console.log(`👑 THRONE STAR CAPTURED! ${attackingPlayer.name} conquers ${defendingPlayer.name}'s empire!`);
            
            // Transfer ALL remaining territories from defender to attacker
            const defendingTerritories = [...defendingPlayer.territories];
            for (const territoryId of defendingTerritories) {
                const territory = this.game.gameMap.territories[territoryId];
                if (territory && territory.id !== toTerritory.id) { // Skip the throne being captured
                    // Remove from defender
                    const defenderIndex = defendingPlayer.territories.indexOf(territoryId);
                    if (defenderIndex > -1) {
                        defendingPlayer.territories.splice(defenderIndex, 1);
                    }
                    
                    // Transfer to attacker
                    territory.ownerId = attackingPlayer.id;
                    territory.baseColor = attackingPlayer.color;
                    territory.strokeColor = attackingPlayer.color;
                    attackingPlayer.territories.push(territoryId);
                    
                    console.log(`Territory ${territoryId} transferred to ${attackingPlayer.name}`);
                }
            }
            
            // CRITICAL FIX: Clear ALL remaining territories from defending player to trigger game over
            defendingPlayer.territories = [];
            
            // Mark defender as eliminated
            defendingPlayer.isEliminated = true;
            console.log(`${defendingPlayer.name} has been eliminated!`);
            
            // Special handling if human player's throne is captured
            if (defendingPlayer.type === 'human') {
                console.log(`💀 HUMAN PLAYER'S THRONE STAR CAPTURED! Game over triggered!`);
                this.game.gameState = 'ended';
            }
            
            // Destroy the captured throne star to prevent multiple thrones
            toTerritory.isThronestar = false;
            console.log(`Throne star ${toTerritory.id} destroyed`);
        }
        
        // Remove territory from defender
        if (defendingPlayer) {
            const territoryIndex = defendingPlayer.territories.indexOf(toTerritory.id);
            if (territoryIndex > -1) {
                defendingPlayer.territories.splice(territoryIndex, 1);
            }
        }
        
        // Transfer territory to attacker
        console.log(`DEBUG: About to transfer territory ${toTerritory.id} from ${toTerritory.ownerId} to ${attackingPlayer.id}`);
        toTerritory.ownerId = attackingPlayer.id;
        toTerritory.armySize = survivingArmies;
        attackingPlayer.territories.push(toTerritory.id);
        
        // Reveal hidden connections for newly captured territory
        if (toTerritory.hiddenNeighbors && toTerritory.hiddenNeighbors.length > 0) {
            toTerritory.neighbors.push(...toTerritory.hiddenNeighbors);
            toTerritory.hiddenNeighbors = [];
            console.log(`Hidden star lanes revealed for territory ${toTerritory.id}`);
        }
        
        // Update territory visual properties
        const player = this.game.players.find(p => p.id === toTerritory.ownerId);
        if (player) {
            toTerritory.baseColor = player.color;
            toTerritory.strokeColor = player.color;
        }
        
        // Create ship animation
        this.game.createShipAnimation(fromTerritory, toTerritory, attackingPlayer.color, 1000);
    }
    
    handleFailedAttack(fromTerritory, toTerritory, survivingDefenders) {
        console.log(`Attack on territory ${toTerritory.id} repelled`);
        
        // Update defender army count
        toTerritory.armySize = survivingDefenders;
        
        // Create failed attack animation
        const attackingPlayer = this.game.players.find(p => p.id === fromTerritory.ownerId);
        if (attackingPlayer) {
            this.game.createShipAnimation(fromTerritory, toTerritory, attackingPlayer.color, 800);
        }
    }
    
    handleThroneStarCapture(attackingPlayer, defendingPlayer) {
        if (!defendingPlayer) return;
        
        console.log(`🏆 ${attackingPlayer.name} captures ${defendingPlayer.name}'s throne star!`);
        
        // Transfer all remaining territories
        const territoriesToTransfer = [...defendingPlayer.territories];
        for (const territoryId of territoriesToTransfer) {
            const territory = this.game.gameMap.territories[territoryId];
            if (territory && territory.id !== territory.id) { // Don't transfer the throne star itself again
                territory.ownerId = attackingPlayer.id;
                attackingPlayer.territories.push(territoryId);
                
                // Update visual properties
                territory.baseColor = attackingPlayer.color;
                territory.strokeColor = attackingPlayer.color;
            }
        }
        
        // Clear defender's territories
        defendingPlayer.territories = [];
        defendingPlayer.isEliminated = true;
        
        // Destroy the captured throne star
        const throneTerritory = this.game.gameMap.territories[defendingPlayer.territories[0]];
        if (throneTerritory) {
            throneTerritory.isThronestar = false;
        }
        
        // Create dramatic visual effect
        this.game.showMessage(`👑 ${attackingPlayer.name} conquers ${defendingPlayer.name}'s empire!`, 5000);
    }
    
    triggerCombatFlash(territory) {
        territory.combatFlashTime = Date.now();
    }
    
    createFloatingDamageText(territory, combatResult) {
        const damageValue = Math.floor(combatResult.powerDifference);
        const text = combatResult.victory ? `-${damageValue}` : `+${damageValue}`;
        const color = combatResult.victory ? '#ff4444' : '#44ff44';
        
        territory.floatingText = {
            text: text,
            color: color,
            startTime: Date.now(),
            duration: 2000,
            endTime: Date.now() + 2000
        };
    }
    
    checkPlayerElimination() {
        for (const player of this.game.players) {
            if (player.territories.length === 0 && !player.isEliminated) {
                player.isEliminated = true;
                console.log(`Player ${player.name} has been eliminated!`);
                
                if (player.id === this.game.humanPlayer?.id) {
                    this.game.showMessage('💀 You have been eliminated! The galaxy belongs to others...', 5000);
                }
            }
        }
    }
    
    checkWinConditions() {
        const activePlayers = this.game.players.filter(p => !p.isEliminated);
        
        if (activePlayers.length === 1) {
            const winner = activePlayers[0];
            this.endGame(winner);
        } else if (this.game.humanPlayer && this.game.humanPlayer.isEliminated) {
            // Human player eliminated but others still fighting
            this.game.showMessage('🎮 Game Over - You can continue spectating', 3000);
        }
    }
    
    endGame(winner) {
        this.game.gameState = 'ended';
        this.game.winner = winner;
        
        console.log(`🏆 Game Over! Winner: ${winner.name}`);
        
        if (winner.id === this.game.humanPlayer?.id) {
            this.game.showMessage('🎉 Victory! You have conquered the galaxy!', 10000);
        } else {
            this.game.showMessage(`👑 ${winner.name} conquers the galaxy!`, 10000);
        }
        
        // Stop AI updates
        this.game.stopGameLoop = true;
    }
    
    // Transfer armies between friendly territories
    transferArmies(fromTerritory, toTerritory) {
        if (!this.validateTransfer(fromTerritory, toTerritory)) {
            return false;
        }
        
        const transferAmount = Math.floor(fromTerritory.armySize * GAME_CONSTANTS.TRANSFER_AMOUNT_RATIO);
        
        if (transferAmount < 1) {
            console.log('No armies to transfer');
            return false;
        }
        
        fromTerritory.armySize -= transferAmount;
        toTerritory.armySize += transferAmount;
        
        console.log(`Transferred ${transferAmount} armies from ${fromTerritory.id} to ${toTerritory.id}`);
        
        // Create transfer animation
        const player = this.game.players.find(p => p.id === fromTerritory.ownerId);
        if (player) {
            this.game.createShipAnimation(fromTerritory, toTerritory, player.color, 1200);
        }
        
        // Visual feedback
        toTerritory.floatingText = {
            text: `+${transferAmount}`,
            color: '#44ff44',
            startTime: Date.now(),
            duration: 2000,
            endTime: Date.now() + 2000
        };
        
        return true;
    }
    
    validateTransfer(fromTerritory, toTerritory) {
        // Check ownership
        if (fromTerritory.ownerId !== this.game.humanPlayer?.id || 
            toTerritory.ownerId !== this.game.humanPlayer?.id) {
            console.log('Can only transfer between your own territories');
            return false;
        }
        
        // Check adjacency
        if (!fromTerritory.neighbors.includes(toTerritory.id)) {
            console.log('Territories must be adjacent for transfer');
            return false;
        }
        
        // Check army availability
        const transferAmount = Math.floor(fromTerritory.armySize * GAME_CONSTANTS.TRANSFER_AMOUNT_RATIO);
        if (transferAmount < 1) {
            console.log('Not enough armies to transfer');
            return false;
        }
        
        return true;
    }
}