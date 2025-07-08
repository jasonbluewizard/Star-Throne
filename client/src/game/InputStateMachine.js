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
                return this.handleLeftClick(data.territory, data.worldPos, data);
            case 'rightClick':
                return this.handleRightClick(data.territory, data.worldPos);
            case 'keyPress':
                return this.handleKeyPress(data.key);
            default:
                return false;
        }
    }
    
    handleLeftClick(territory, worldPos, data = {}) {
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
    
    handleRightClick(territory, worldPos) {
        // Right click in default state - camera drag (handled elsewhere)
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
                return this.handleLeftClick(data.territory, data.worldPos, data);
            case 'rightClick':
                return this.handleRightClick(data.territory, data.worldPos);
            case 'keyPress':
                return this.handleKeyPress(data.key);
            default:
                return false;
        }
    }
    
    handleLeftClick(territory, worldPos, data = {}) {
        if (!territory) {
            // Clicked empty space - deselect
            this.fsm.transitionTo('Default');
            return true;
        }
        
        // Clicking same territory - keep selected (no deselect for better UX)
        if (territory.id === this.selectedTerritory.id) {
            return true;
        }
        
        // NEW SINGLE BUTTON CONTROL: Left-click on different territory = fleet command
        if (territory.id !== this.selectedTerritory.id) {
            // Determine fleet percentage based on modifier keys
            let fleetPercentage = 0.5; // Default 50%
            if (data.shiftKey) {
                fleetPercentage = 1.0; // Send all (minus 1)
            } else if (data.ctrlKey) {
                fleetPercentage = 0.25; // Send 25%
            }
            
            // Execute the appropriate fleet command
            const success = this.executeFleetCommand(this.selectedTerritory, territory, fleetPercentage);
            if (success) {
                // Keep source selected for potential follow-up commands
                return true;
            }
        }
        
        // Fallback to selection behavior if fleet command wasn't executed
        if (this.isOwnedByPlayer(territory)) {
            this.fsm.selectedTerritory = territory;
            this.fsm.transitionTo('TerritorySelected', { selectedTerritory: territory });
            return true;
        } else {
            // Enemy, neutral, or colonizable territory
            this.fsm.selectedTerritory = territory;
            this.fsm.transitionTo('EnemySelected', { selectedTerritory: territory });
            return true;
        }
    }
    
    executeFleetCommand(sourceTerritory, targetTerritory, fleetPercentage) {
        // Validate command
        if (!sourceTerritory || !targetTerritory || sourceTerritory === targetTerritory) {
            return false;
        }
        
        if (sourceTerritory.ownerId !== this.game.humanPlayer.id) {
            return false; // Can only command own territories
        }
        
        // Calculate fleet size
        const availableFleets = Math.max(0, sourceTerritory.armySize - 1);
        let fleetsToSend = Math.floor(availableFleets * fleetPercentage);
        
        if (fleetPercentage >= 1.0) {
            // "Send all" means all minus 1
            fleetsToSend = availableFleets;
        }
        
        if (fleetsToSend <= 0) return false;
        
        // Check if territories are connected by visible warp lanes
        const sourceId = sourceTerritory.id;
        const targetId = targetTerritory.id;
        const isConnected = this.game.gameMap.connections[sourceId]?.includes(targetId);
        
        if (!isConnected && targetTerritory.ownerId !== null) {
            // Try multi-hop path for non-connected territories
            const path = this.game.findPathBetweenTerritories?.(sourceId, targetId);
            if (path && path.length > 2) {
                // Multi-hop route available
                const isAttack = targetTerritory.ownerId !== this.game.humanPlayer.id;
                this.game.launchMultiHopMovement?.(sourceTerritory, targetTerritory, fleetPercentage, isAttack, path);
                console.log(`🛸 Multi-hop ${isAttack ? 'attack' : 'transfer'}: ${fleetsToSend} ships via ${path.length} hops`);
                return true;
            } else {
                console.log('No valid path found between territories');
                return false;
            }
        }
        
        // Direct connection available - execute immediate command
        if (targetTerritory.ownerId === this.game.humanPlayer.id) {
            // Transfer to friendly territory
            this.game.combatSystem.executeTransfer(sourceTerritory, targetTerritory, fleetsToSend);
            console.log(`🚢 Transfer: ${fleetsToSend} ships from ${sourceId} to ${targetId}`);
        } else {
            // Attack enemy/neutral territory
            this.game.combatSystem.executeAttack(sourceTerritory, targetTerritory, fleetsToSend);
            console.log(`⚔️ Attack: ${fleetsToSend} ships from ${sourceId} to ${targetId}`);
        }
        
        return true;
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
                    }
                } else {
                    // Non-adjacent enemy star - launch long-range attack
                    const attackingArmies = Math.floor((sourceStar.armySize - 1) * 0.5);
                    console.log(`🎯 LONG-RANGE ENEMY TRIGGER: Attacking ${targetStar.id} with ${attackingArmies} armies`);
                    if (attackingArmies > 0) {
                        console.log(`🚀 ENEMY: Launching long-range attack from territory ${sourceStar.id} (owner: ${sourceStar.ownerId}) to ${targetStar.id} (owner: ${targetStar.ownerId})`);
                        this.game.launchLongRangeAttack(sourceStar, targetStar, attackingArmies);
                        console.log(`🚀 ENEMY: Launched long-range attack: ${sourceStar.id} -> ${targetStar.id} (${attackingArmies} ships)`);
                    } else {
                        console.log(`❌ LONG-RANGE BLOCKED: Source has only ${sourceStar.armySize} armies`);
                        this.showFeedback("Need more armies for long-range attack", sourceStar.x, sourceStar.y);
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
                    }
                } else {
                    // Non-adjacent neutral star - launch long-range attack
                    const attackingArmies = Math.floor((sourceStar.armySize - 1) * 0.5);
                    console.log(`🎯 NON-ADJACENT NEUTRAL: Attempting long-range attack with ${attackingArmies} armies`);
                    if (attackingArmies > 0) {
                        console.log(`🚀 NEUTRAL: Launching long-range attack from territory ${sourceStar.id} (owner: ${sourceStar.ownerId}) to ${targetStar.id} (owner: ${targetStar.ownerId})`);
                        this.game.launchLongRangeAttack(sourceStar, targetStar, attackingArmies);
                        console.log(`🚀 NEUTRAL: Launched long-range attack: ${sourceStar.id} -> ${targetStar.id} (${attackingArmies} ships)`);
                    } else {
                        console.log(`🚀 NEUTRAL: Not enough armies for long-range attack`);
                        this.showFeedback("Need more armies for long-range attack", sourceStar.x, sourceStar.y);
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
    
    handleRightClick(territory, worldPos) {
        // Right-click in enemy selected - camera drag
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