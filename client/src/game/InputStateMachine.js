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
            // Clicked empty space - deselect
            this.fsm.transitionTo('Default');
            return true;
        }
        
        // Clicking same territory - keep selected (no deselect for better UX)
        if (territory.id === this.selectedTerritory.id) {
            return true;
        }
        
        // Clicking another territory - select it
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
    
    async handleRightClick(territory, worldPos) {
        if (!territory) {
            // Right-click on empty space - do nothing, maintain selection
            return true;
        }
        
        // Right-click on the selected territory itself - cancel supply routes if any exist
        if (territory.id === this.selectedTerritory.id) {
            // Check if this territory has any outgoing supply routes
            const outgoingRoutes = this.game.supplySystem.supplyRoutes.filter(route => route.from === territory.id);
            if (outgoingRoutes.length > 0) {
                // Cancel all outgoing supply routes from this territory
                outgoingRoutes.forEach(route => {
                    this.game.supplySystem.removeSupplyRoute(route.id);
                    console.log(`Cancelled supply route from ${territory.id} to ${route.to}`);
                });
                return true;
            }
            return true;
        }
        
        const sourceStar = this.selectedTerritory;
        const targetStar = territory;
        const ownershipType = this.game.pathfindingService.getTerritoryOwnershipType(targetStar, this.game.humanPlayer?.id);
        const isAdjacent = this.game.pathfindingService.areTerritoriesAdjacent(sourceStar, targetStar);
        
        console.log(`Right-click: ${sourceStar.id} -> ${targetStar.id}, ownership: ${ownershipType}, adjacent: ${isAdjacent}`);
        
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
                    // Non-adjacent enemy star - show error feedback
                    this.showFeedback("Target not in range", sourceStar.x, sourceStar.y);
                    console.log(`Enemy territory ${targetStar.id} not in range from ${sourceStar.id}`);
                }
                break;
                
            case 'neutral':
                // Cannot send fleets to neutral stars
                this.showFeedback("Cannot send fleets to neutral star", sourceStar.x, sourceStar.y);
                console.log(`Cannot target neutral territory ${targetStar.id}`);
                break;
                
            case 'colonizable':
                // Launch probe to colonizable planet
                if (sourceStar.armySize >= 11) { // Need at least 11 armies (probe costs 10, leave 1)
                    const success = this.game.launchProbe(sourceStar, targetStar);
                    if (success) {
                        console.log(`Probe launched from ${sourceStar.id} to colonizable planet ${targetStar.id}`);
                    } else {
                        this.showFeedback("Probe launch failed", sourceStar.x, sourceStar.y);
                    }
                } else {
                    this.showFeedback("Need 11+ armies to launch probe", sourceStar.x, sourceStar.y);
                    console.log(`Insufficient armies to launch probe from ${sourceStar.id}`);
                }
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