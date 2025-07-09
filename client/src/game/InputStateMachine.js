/**
 * Player Input Finite State Machine (FSM)
 * 
 * This FSM manages all player input interactions using the new contextual command model.
 * Left-click selects territories, right-click executes contextual actions.
 * 
 * States:
 * - Default: No territory selected, awaiting input
 * - TerritorySelected: Player owns selected territory, awaiting command
 * - EnemySelected: Enemy/neutral territory selected for inspection
 */

import { PathfindingService } from './PathfindingService.js';
import { GameUtils } from './utils.js';

export class InputStateMachine {
    constructor(game) {
        this.game = game;
        this.currentState = 'Default';
        this.selectedTerritory = null;
        this.stateData = {};
        
        // Track battles initiated by human player to manage selection state
        this.pendingPlayerBattles = new Map(); // battleId -> { sourceTerritory, targetTerritory, battleId }
        
        // Cursor modes for visual feedback
        this.cursorModes = {
            'Default': 'default',
            'TerritorySelected': 'pointer',
            'EnemySelected': 'help'
        };
        
        // Initialize state handlers
        this.stateHandlers = {
            'Default': new DefaultState(this),
            'TerritorySelected': new TerritorySelectedState(this),
            'EnemySelected': new EnemySelectedState(this)
        };
        
        console.log('InputStateMachine initialized in Default state');
    }
    
    // Main input event processor
    handleInput(inputType, data) {
        const currentHandler = this.stateHandlers[this.currentState];
        if (!currentHandler) {
            GameUtils.logError(`No handler for state: ${this.currentState}`);
            return false;
        }
        
        const result = currentHandler.handleInput(inputType, data);
        
        // Update UI cursor based on current state
        this.updateCursor();
        
        return result;
    }
    
    // State transition method
    transitionTo(newState, data = {}) {
        const oldState = this.currentState;
        const oldHandler = this.stateHandlers[oldState];
        const newHandler = this.stateHandlers[newState];
        
        if (!newHandler) {
            GameUtils.logError(`Invalid state transition to: ${newState}`);
            return;
        }
        
        // Exit old state
        if (oldHandler && oldHandler.onExit) {
            oldHandler.onExit();
        }
        
        // Change state
        this.currentState = newState;
        
        // Enter new state
        if (newHandler.onEnter) {
            newHandler.onEnter(data);
        }
        
        console.log(`FSM: ${oldState} -> ${newState}`, data);
    }
    
    // Get current state information
    getState() {
        return {
            currentState: this.currentState,
            selectedTerritory: this.selectedTerritory,
            stateData: this.stateData
        };
    }
    
    // Update cursor based on current state
    updateCursor() {
        const cursorMode = this.cursorModes[this.currentState] || 'default';
        if (this.game.canvas) {
            this.game.canvas.style.cursor = cursorMode;
        }
    }
    
    // Force state reset (for game restart)
    reset() {
        this.transitionTo('Default');
        this.selectedTerritory = null;
        this.stateData = {};
        this.pendingPlayerBattles.clear();
    }
    
    // Track a battle initiated by the human player
    trackPlayerBattle(battleId, sourceTerritory, targetTerritory) {
        this.pendingPlayerBattles.set(battleId, {
            sourceTerritory: sourceTerritory,
            targetTerritory: targetTerritory,
            battleId: battleId
        });
    }
    
    // Handle battle completion - called by CombatSystem when battles finish
    onBattleComplete(battleId, attackerWins, attackingTerritoryId) {
        const battleData = this.pendingPlayerBattles.get(battleId);
        if (!battleData) return; // Not a human player battle
        
        // Remove from tracking
        this.pendingPlayerBattles.delete(battleId);
        
        // Only deselect if the attack succeeded (territory was conquered)
        if (attackerWins && this.selectedTerritory && this.selectedTerritory.id === attackingTerritoryId) {
            console.log(`🎯 Battle won - deselecting territory ${attackingTerritoryId}`);
            this.selectedTerritory = null;
            this.transitionTo('Default');
        } else if (!attackerWins) {
            console.log(`🎯 Battle lost - keeping territory ${attackingTerritoryId} selected`);
            // Keep the source territory selected for failed attacks
        }
    }
}

// Base state class
class BaseState {
    constructor(fsm) {
        this.fsm = fsm;
        this.game = fsm.game;
    }
    
    // State lifecycle methods
    onEnter(data) {}
    onExit() {}
    
    // Input handling
    handleInput(inputType, data) {
        return false;
    }
    
    // Helper methods
    isOwnedByPlayer(territory) {
        return territory && territory.ownerId === this.game.humanPlayer?.id;
    }
    
    areNeighbors(territory1, territory2) {
        return territory1 && territory2 && 
               territory1.neighbors && 
               territory1.neighbors.includes(territory2.id);
    }
}

// Default State: Nothing selected
class DefaultState extends BaseState {
    onEnter(data) {
        // Clear selected territory when entering default state
        this.game.selectedTerritory = null;
        this.fsm.selectedTerritory = null;
        console.log('Default state entered - territory deselected');
    }
    
    handleInput(inputType, data) {
        switch (inputType) {
            case 'leftClick':
                return this.handleLeftClick(data.territory, data.worldPos);
            case 'rightClick':
                return this.handleRightClick(data.territory, data.worldPos);
            case 'keyPress':
                return this.handleKeyPress(data.key);
            default:
                return false;
        }
    }
    
    handleLeftClick(territory, worldPos) {
        if (!territory) {
            // Clicked empty space - stay in Default
            return true;
        }
        
        // Select only your own territory with >1 army
        if (territory && territory.ownerId === this.game.humanPlayer?.id && territory.armySize > 1) {
            this.fsm.selectedTerritory = territory;
            this.fsm.transitionTo('TerritorySelected', { selectedTerritory: territory });
        }
        return true;  // consume left-click in default state
    }
    
    handleRightClick() { 
        // Right-click is deprecated – do nothing
        return false; 
    }
    
    handleKeyPress(key) {
        // No special keys in default state
        return false;
    }
}

// Territory Selected State: Player owns selected territory
class TerritorySelectedState extends BaseState {
    onEnter(data) {
        this.selectedTerritory = data.selectedTerritory;
        this.game.selectedTerritory = this.selectedTerritory;
        console.log(`Selected owned territory ${this.selectedTerritory.id} with ${this.selectedTerritory.armySize} armies`);
    }
    
    handleInput(inputType, data) {
        switch (inputType) {
            case 'leftClick':
                return this.handleLeftClick(data.territory, data.worldPos);
            case 'rightClick':
                return this.handleRightClick(data.territory, data.worldPos);
            case 'keyPress':
                return this.handleKeyPress(data.key);
            default:
                return false;
        }
    }
    
    handleLeftClick(territory, worldPos) {
        // Empty space → deselect
        if (!territory) {
            this.fsm.transitionTo('Default');
            return true;
        }

        // Same planet → no‑op
        if (territory.id === this.selectedTerritory.id) {
            return true;
        }

        // Any other planet → reuse old right‑click logic
        return this.handleRightClick(territory, worldPos);
    }
    
    async handleRightClick(territory, worldPos) {
        if (!territory) {
            // Right-click on empty space - do nothing, maintain selection
            return true;
        }
        
        // Right-click on the selected territory itself - cancel supply routes if any exist
        if (territory.id === this.selectedTerritory.id) {
            // Check if this territory has any outgoing supply routes (using SupplySystem module)
            const outgoingRoutes = this.game.supplySystem.supplyRoutes.filter(route => route.from === territory.id);
            if (outgoingRoutes.length > 0) {
                outgoingRoutes.forEach(route => {
                    this.game.supplySystem.removeSupplyRoute(route.id);
                    console.log(`Cancelled supply route from ${territory.id} to ${route.to}`);
                });
                return true;
            } else {
                console.log(`No supply route to cancel from territory ${territory.id}`);
            }
            return true;
        }
        
        const sourceStar = this.selectedTerritory;
        const targetStar = territory;
        const ownershipType = this.game.pathfindingService.getTerritoryOwnershipType(targetStar, this.game.humanPlayer?.id);
        const isAdjacent = this.game.pathfindingService.areTerritoriesAdjacent(sourceStar, targetStar);
        
        console.log(`🎯 Right-click: ${sourceStar.id} (owner: ${sourceStar.ownerId}) -> ${targetStar.id} (owner: ${targetStar.ownerId}), ownership: ${ownershipType}, adjacent: ${isAdjacent}`);
        console.log(`🎯 FSM STATE: Current state is ${this.fsm.currentState}, selected territory: ${this.selectedTerritory?.id}`);
        
        // Validate minimum fleet size for commands
        if (sourceStar.armySize <= 1) {
            this.showFeedback("Need more than 1 army to send fleet", sourceStar.x, sourceStar.y);
            return true;
        }
        
        // Handle different target types
        switch (ownershipType) {
            case 'friendly':
                if (isAdjacent) {
                    // Adjacent friendly star - send reinforcements (50%)
                    const success = this.game.combatSystem.transferArmies(sourceStar, targetStar);
                    if (success) {
                        const fleetSize = Math.floor((sourceStar.armySize + Math.floor(sourceStar.armySize * 0.5)) * 0.5);
                        this.game.createShipAnimation(sourceStar, targetStar, false, fleetSize);
                        console.log(`Sent reinforcements from ${sourceStar.id} to adjacent ${targetStar.id}`);
                        
                        // Auto-rollover: newly reinforced planet becomes the active source
                        this.fsm.selectedTerritory = targetStar;
                        this.fsm.transitionTo('TerritorySelected', { selectedTerritory: targetStar });
                    }
                } else {
                    // Distant friendly star - find path and execute multi-hop transfer
                    try {
                        const path = await this.game.pathfindingService.findShortestPath(
                            sourceStar.id, 
                            targetStar.id, 
                            this.game.gameMap, 
                            this.game.humanPlayer?.id
                        );
                        
                        if (path && path.length > 1) {
                            GameUtils.logDebug(`Multi-hop transfer path found: ${path.join(' -> ')}`);
                            this.game.executeFleetCommand(sourceStar, targetStar, 0.5, 'multi-hop-transfer', path);
                            
                            // Auto-rollover: newly reinforced planet becomes the active source
                            this.fsm.selectedTerritory = targetStar;
                            this.fsm.transitionTo('TerritorySelected', { selectedTerritory: targetStar });
                        } else {
                            this.showFeedback("No valid reinforcement path", sourceStar.x, sourceStar.y);
                            GameUtils.logDebug(`No path found from ${sourceStar.id} to ${targetStar.id}`);
                        }
                    } catch (error) {
                        GameUtils.logError("Pathfinding error:", error);
                        this.showFeedback("Pathfinding failed", sourceStar.x, sourceStar.y);
                    }
                }
                break;
                
            case 'enemy':
                if (isAdjacent) {
                    // Adjacent enemy star - attack with 50% of fleet
                    const attackingArmies = Math.floor((sourceStar.armySize - 1) * 0.5);
                    if (attackingArmies > 0) {
                        const result = this.game.combatSystem.attackTerritory(sourceStar, targetStar, attackingArmies);
                        this.game.createShipAnimation(sourceStar, targetStar, true, attackingArmies);
                        console.log(`Attacked enemy ${targetStar.id} from ${sourceStar.id}`);
                        
                        // Track battle to handle deselection based on outcome
                        if (result.success && result.battleId) {
                            this.fsm.trackPlayerBattle(result.battleId, sourceStar, targetStar);
                            console.log(`🎯 Tracking battle ${result.battleId} for territory ${sourceStar.id}`);
                        }
                        // No immediate deselection - wait for battle outcome
                    }
                } else {
                    // Non-adjacent enemy star - check for warp lane path first
                    const attackingArmies = Math.floor((sourceStar.armySize - 1) * 0.5);
                    console.log(`🎯 NON-ADJACENT ENEMY: Checking path to ${targetStar.id} with ${attackingArmies} armies`);
                    
                    if (attackingArmies > 0) {
                        // Try to find a path through warp lanes
                        try {
                            const path = await this.game.pathfindingService.findAttackPath(
                                sourceStar.id,
                                targetStar.id,
                                this.game.gameMap,
                                this.game.humanPlayer?.id
                            );
                            
                            if (path && path.length > 1) {
                                console.log(`🛣️ ENEMY: Found warp lane path: ${path.join(' -> ')}`);
                                this.game.executeFleetCommand(sourceStar, targetStar, 0.5, 'multi-hop-attack', path);
                                
                                // Track the attack for battle outcome
                                const result = { success: true, battleId: `multihop_${Date.now()}_${Math.random()}` };
                                this.fsm.trackPlayerBattle(result.battleId, sourceStar, targetStar);
                                console.log(`🎯 Tracking multi-hop enemy attack ${result.battleId} for territory ${sourceStar.id}`);
                            } else {
                                // No path found - use long-range attack
                                console.log(`🚀 ENEMY: No path found, launching long-range attack from territory ${sourceStar.id} to ${targetStar.id}`);
                                const result = this.game.launchLongRangeAttack(sourceStar, targetStar, attackingArmies);
                                console.log(`🚀 ENEMY: Launched long-range attack: ${sourceStar.id} -> ${targetStar.id} (${attackingArmies} ships)`);
                                
                                // Track long-range battle if available
                                if (result && result.battleId) {
                                    this.fsm.trackPlayerBattle(result.battleId, sourceStar, targetStar);
                                    console.log(`🎯 Tracking long-range enemy battle ${result.battleId} for territory ${sourceStar.id}`);
                                }
                            }
                        } catch (error) {
                            console.error("Pathfinding error for enemy attack:", error);
                            // Fall back to long-range attack on pathfinding failure
                            const result = this.game.launchLongRangeAttack(sourceStar, targetStar, attackingArmies);
                            if (result && result.battleId) {
                                this.fsm.trackPlayerBattle(result.battleId, sourceStar, targetStar);
                            }
                        }
                        // No immediate deselection - wait for battle outcome
                    } else {
                        console.log(`❌ ENEMY ATTACK BLOCKED: Source has only ${sourceStar.armySize} armies`);
                        this.showFeedback("Need more armies for attack", sourceStar.x, sourceStar.y);
                    }
                }
                break;
                
            case 'neutral':
                console.log(`🎯 NEUTRAL CASE: isAdjacent=${isAdjacent}, sourceStar armies=${sourceStar.armySize}`);
                if (isAdjacent) {
                    // Adjacent neutral star with garrison - attack directly (no probe needed)
                    const attackingArmies = Math.floor((sourceStar.armySize - 1) * 0.5);
                    if (attackingArmies > 0) {
                        console.log(`🎯 ADJACENT NEUTRAL: Attacking with ${attackingArmies} armies`);
                        const result = this.game.combatSystem.attackTerritory(sourceStar, targetStar, attackingArmies);
                        this.game.createShipAnimation(sourceStar, targetStar, true, attackingArmies);
                        console.log(`Attacked neutral garrison ${targetStar.id} from ${sourceStar.id}`);
                        
                        // Track battle to handle deselection based on outcome
                        if (result.success && result.battleId) {
                            this.fsm.trackPlayerBattle(result.battleId, sourceStar, targetStar);
                            console.log(`🎯 Tracking neutral battle ${result.battleId} for territory ${sourceStar.id}`);
                        }
                        // No immediate deselection - wait for battle outcome
                    }
                } else {
                    // Non-adjacent neutral star - check for warp lane path first
                    const attackingArmies = Math.floor((sourceStar.armySize - 1) * 0.5);
                    console.log(`🎯 NON-ADJACENT NEUTRAL: Checking path to ${targetStar.id} with ${attackingArmies} armies`);
                    
                    if (attackingArmies > 0) {
                        // Try to find a path through warp lanes
                        try {
                            const path = await this.game.pathfindingService.findAttackPath(
                                sourceStar.id,
                                targetStar.id,
                                this.game.gameMap,
                                this.game.humanPlayer?.id
                            );
                            
                            if (path && path.length > 1) {
                                console.log(`🛣️ NEUTRAL: Found warp lane path: ${path.join(' -> ')}`);
                                this.game.executeFleetCommand(sourceStar, targetStar, 0.5, 'multi-hop-attack', path);
                                
                                // Track the attack for battle outcome
                                const result = { success: true, battleId: `multihop_${Date.now()}_${Math.random()}` };
                                this.fsm.trackPlayerBattle(result.battleId, sourceStar, targetStar);
                                console.log(`🎯 Tracking multi-hop neutral attack ${result.battleId} for territory ${sourceStar.id}`);
                            } else {
                                // No path found - use long-range attack
                                console.log(`🚀 NEUTRAL: No path found, launching long-range attack from territory ${sourceStar.id} to ${targetStar.id}`);
                                const result = this.game.launchLongRangeAttack(sourceStar, targetStar, attackingArmies);
                                console.log(`🚀 NEUTRAL: Launched long-range attack: ${sourceStar.id} -> ${targetStar.id} (${attackingArmies} ships)`);
                                
                                // Track long-range battle if available
                                if (result && result.battleId) {
                                    this.fsm.trackPlayerBattle(result.battleId, sourceStar, targetStar);
                                    console.log(`🎯 Tracking long-range neutral battle ${result.battleId} for territory ${sourceStar.id}`);
                                }
                            }
                        } catch (error) {
                            console.error("Pathfinding error for neutral attack:", error);
                            // Fall back to long-range attack on pathfinding failure
                            const result = this.game.launchLongRangeAttack(sourceStar, targetStar, attackingArmies);
                            if (result && result.battleId) {
                                this.fsm.trackPlayerBattle(result.battleId, sourceStar, targetStar);
                            }
                        }
                        // No immediate deselection - wait for battle outcome
                    } else {
                        console.log(`🚀 NEUTRAL: Not enough armies for attack`);
                        this.showFeedback("Need more armies for attack", sourceStar.x, sourceStar.y);
                    }
                }
                break;
                
            case 'colonizable':
                // Colonizable planets should no longer exist with the new system, but keep for safety
                this.showFeedback("Invalid target type", sourceStar.x, sourceStar.y);
                console.log(`Deprecated colonizable target: ${targetStar.id}`);
                break;
                
            default:
                console.log(`Invalid target: ${targetStar.id}`);
                break;
        }
        
        // Keep territory selected for multiple commands
        return true;
    }
    
    handleKeyPress(key) {
        switch (key) {
            case 'Escape':
                this.fsm.transitionTo('Default');
                return true;
            default:
                return false;
        }
    }
    
    showFeedback(message, x, y) {
        // Add floating text feedback for failed commands
        if (this.game.addFloatingText) {
            this.game.addFloatingText(x, y, message, '#FF6B6B', 2000);
        } else {
            console.log(`Feedback: ${message}`);
        }
    }
}

// Enemy Selected State: Enemy/neutral/colonizable territory selected
class EnemySelectedState extends BaseState {
    onEnter(data) {
        this.selectedTerritory = data.selectedTerritory;
        this.game.selectedTerritory = this.selectedTerritory;
        
        if (this.selectedTerritory.isColonizable) {
            console.log(`Selected colonizable territory ${this.selectedTerritory.id}`);
        } else if (this.selectedTerritory.ownerId === 0) {
            console.log(`Selected neutral territory ${this.selectedTerritory.id}`);
        } else {
            console.log(`Selected enemy territory ${this.selectedTerritory.id} (owner: ${this.selectedTerritory.ownerId})`);
        }
    }
    
    handleInput(inputType, data) {
        switch (inputType) {
            case 'leftClick':
                return this.handleLeftClick(data.territory, data.worldPos);
            case 'rightClick':
                return this.handleRightClick(data.territory, data.worldPos);
            case 'keyPress':
                return this.handleKeyPress(data.key);
            default:
                return false;
        }
    }
    
    handleLeftClick(territory, worldPos) {
        if (!territory) {
            // Clicked empty space - go to default
            this.fsm.transitionTo('Default');
            return true;
        }
        
        // Clicking same territory - keep selected
        if (territory.id === this.selectedTerritory.id) {
            return true;
        }
        
        // Clicking different territory
        if (this.isOwnedByPlayer(territory)) {
            this.fsm.selectedTerritory = territory;
            this.fsm.transitionTo('TerritorySelected', { selectedTerritory: territory });
            return true;
        } else {
            // Another enemy/neutral/colonizable territory
            this.fsm.selectedTerritory = territory;
            this.fsm.transitionTo('EnemySelected', { selectedTerritory: territory });
            return true;
        }
    }
    
    handleRightClick() { 
        // noop – RMB unused
        return false; 
    }
    
    handleKeyPress(key) {
        switch (key) {
            case 'Escape':
                this.fsm.transitionTo('Default');
                return true;
            default:
                return false;
        }
    }
}