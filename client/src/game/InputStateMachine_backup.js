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
            console.error(`No handler for state: ${this.currentState}`);
            return false;
        }
        
        const result = currentHandler.handleInput(inputType, data);
        
        // Update cursor based on current state
        this.updateCursor();
        
        return result;
    }
    
    // State transition with logging
    transitionTo(newState, data = {}) {
        const oldState = this.currentState;
        this.currentState = newState;
        this.stateData = { ...this.stateData, ...data };
        
        console.log(`FSM: ${oldState} -> ${newState}`, data);
        
        // Notify state handlers of transition
        if (this.stateHandlers[newState]) {
            this.stateHandlers[newState].onEnter(data);
        }
        
        if (this.stateHandlers[oldState]) {
            this.stateHandlers[oldState].onExit();
        }
        
        this.updateCursor();
        this.updateUI();
    }
    
    // Get current state for external queries
    getState() {
        return {
            currentState: this.currentState,
            selectedTerritory: this.selectedTerritory,
            probeOrigin: this.probeOrigin,
            stateData: this.stateData
        };
    }
    
    // Update cursor visual feedback
    updateCursor() {
        const cursorMode = this.cursorModes[this.currentState] || 'default';
        if (this.game.canvas) {
            this.game.canvas.style.cursor = cursorMode;
        }
    }
    
    // Update UI to reflect current state
    updateUI() {
        if (this.game.ui) {
            this.game.ui.setInputState(this.getState());
        }
    }
    
    // Helper method to check if territory is valid for current context
    isValidTarget(territory, action) {
        const handler = this.stateHandlers[this.currentState];
        return handler ? handler.isValidTarget(territory, action) : false;
    }
    
    // Reset FSM to default state
    reset() {
        this.transitionTo('Default');
        this.selectedTerritory = null;
        this.probeOrigin = null;
        this.stateData = {};
    }
}

// Base State Class
class BaseState {
    constructor(fsm) {
        this.fsm = fsm;
        this.game = fsm.game;
    }
    
    handleInput(inputType, data) {
        console.warn(`Unhandled input ${inputType} in state ${this.constructor.name}`);
        return false;
    }
    
    onEnter(data) {
        // Override in subclasses
    }
    
    onExit() {
        // Override in subclasses
    }
    
    isValidTarget(territory, action) {
        return false;
    }
    
    // Helper to check if territory is owned by human player
    isOwnedByPlayer(territory) {
        return territory && territory.ownerId === this.game.humanPlayer?.id;
    }
    
    // Helper to check if territories are neighbors
    areNeighbors(territory1, territory2) {
        return territory1 && territory2 && 
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
    
    isValidTarget(territory, action) {
        return true; // All territories can be selected from default
    }
}

// Territory Selected State: Player owns selected territory
class TerritorySelectedState extends BaseState {
    onEnter(data) {
        this.selectedTerritory = data.selectedTerritory;
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
            // Stay selected to allow multiple actions
            return true;
        }
        
        // Clicking another owned territory
        if (this.isOwnedByPlayer(territory)) {
            if (this.areNeighbors(this.selectedTerritory, territory)) {
                // Fleet transfer to adjacent territory
                this.game.transferFleet(this.selectedTerritory, territory);
                // Keep territory selected for multiple transfers
                return true;
            } else {
                // Select new territory (distant owned territory)
                this.fsm.selectedTerritory = territory;
                this.fsm.transitionTo('TerritorySelected', { selectedTerritory: territory });
                return true;
            }
        }
        
        // Clicking enemy/neutral territory - just select it for inspection (no attack on left-click)
        if (!territory.isColonizable) {
            this.fsm.selectedTerritory = territory;
            this.fsm.transitionTo('EnemySelected', { selectedTerritory: territory });
            return true;
        }
        
        // Clicking colonizable territory - select it for inspection
        this.fsm.selectedTerritory = territory;
        this.fsm.transitionTo('EnemySelected', { selectedTerritory: territory });
        return true;
    }
    
    handleRightClick(territory, worldPos) {
        console.log(`TerritorySelected: Right-click on territory ${territory?.id}, isColonizable: ${territory?.isColonizable}`);
        
        if (!territory) {
            return false; // Camera drag
        }
        
        // Right-click on colonizable planet - launch probe
        if (territory.isColonizable) {
            console.log(`Attempting probe launch: from ${this.selectedTerritory.id} (${this.selectedTerritory.armySize} armies) to ${territory.id}`);
            if (this.selectedTerritory.armySize >= 10) {
                this.game.launchProbe(this.selectedTerritory, territory);
                console.log(`Probe launched successfully via right-click`);
                // Stay in TerritorySelected to allow multiple probes
                return true;
            } else {
                this.game.showError("Need at least 10 fleet strength to launch probe");
                return true;
            }
        }
        
        // Right-click on friendly territory - transfer reinforcements
        if (this.isOwnedByPlayer(territory) && territory.id !== this.selectedTerritory.id) {
            console.log(`Attempting reinforcement: from ${this.selectedTerritory.id} to ${territory.id}`);
            if (this.game.controls && this.game.controls.executeReinforcement) {
                const reinforcementSuccess = this.game.controls.executeReinforcement(this.selectedTerritory, territory);
                if (reinforcementSuccess) {
                    console.log(`Reinforcement sent successfully via right-click`);
                    return true;
                }
            } else {
                // Fallback to old transfer system
                this.game.transferFleet(this.selectedTerritory, territory);
                return true;
            }
        }
        
        // Right-click on enemy territory - attack using new Controls module
        if (!this.isOwnedByPlayer(territory) && !territory.isColonizable) {
            console.log(`Attempting attack: from ${this.selectedTerritory.id} to ${territory.id}`);
            if (this.game.controls && this.game.controls.executeAttack) {
                const attackSuccess = this.game.controls.executeAttack(this.selectedTerritory, territory);
                if (attackSuccess) {
                    console.log(`Attack launched successfully via right-click`);
                    // Stay in TerritorySelected to allow multiple attacks
                    return true;
                } else {
                    console.log(`Attack failed validation`);
                    return true;
                }
            } else {
                console.log(`Controls module not available, falling back to old attack method`);
                this.game.attackTerritory(this.selectedTerritory, territory);
                return true;
            }
        }
        
        return false;
    }
    
    handleKeyPress(key) {
        switch (key) {
            case 'p':
            case 'P':
                // Activate probe targeting mode
                this.fsm.probeOrigin = this.selectedTerritory;
                this.fsm.transitionTo('ProbeTargeting', { 
                    probeOrigin: this.selectedTerritory 
                });
                return true;
            case 'Escape':
                this.fsm.transitionTo('Default');
                return true;
            default:
                return false;
        }
    }
    
    isValidTarget(territory, action) {
        switch (action) {
            case 'transfer':
                return this.isOwnedByPlayer(territory) && 
                       this.areNeighbors(this.selectedTerritory, territory);
            case 'attack':
                return !this.isOwnedByPlayer(territory) && !territory.isColonizable;
            case 'probe':
                return territory.isColonizable;
            default:
                return false;
        }
    }
}

// Probe Targeting State: Active probe targeting mode
class ProbeTargetingState extends BaseState {
    onEnter(data) {
        this.probeOrigin = data.probeOrigin;
        console.log(`Entering probe targeting mode from territory ${this.probeOrigin.id}`);
        this.game.showMessage("Select a colonizable planet to probe", 3000);
    }
    
    onExit() {
        this.game.hideMessage();
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
            // Clicked empty space - stay in probe targeting
            return true;
        }
        
        if (territory.isColonizable) {
            if (this.probeOrigin.armySize >= 10) {
                this.game.launchProbe(this.probeOrigin, territory);
                // Return to territory selected state
                this.fsm.selectedTerritory = this.probeOrigin;
                this.fsm.transitionTo('TerritorySelected', { 
                    selectedTerritory: this.probeOrigin 
                });
                return true;
            } else {
                this.game.showError("Need at least 10 fleet strength to launch probe");
                return true;
            }
        } else {
            this.game.showError("Invalid probe target. Select an unexplored planet.");
            return true;
        }
    }
    
    handleRightClick(territory, worldPos) {
        // Right-click cancels probe targeting
        this.fsm.selectedTerritory = this.probeOrigin;
        this.fsm.transitionTo('TerritorySelected', { 
            selectedTerritory: this.probeOrigin 
        });
        return true;
    }
    
    handleKeyPress(key) {
        switch (key) {
            case 'Escape':
                // Cancel probe targeting
                this.fsm.selectedTerritory = this.probeOrigin;
                this.fsm.transitionTo('TerritorySelected', { 
                    selectedTerritory: this.probeOrigin 
                });
                return true;
            default:
                return false;
        }
    }
    
    isValidTarget(territory, action) {
        return action === 'probe' && territory.isColonizable;
    }
}

// Enemy Selected State: Enemy/neutral/colonizable territory selected
class EnemySelectedState extends BaseState {
    onEnter(data) {
        this.selectedTerritory = data.selectedTerritory;
        if (this.selectedTerritory.isColonizable) {
            console.log(`Selected colonizable planet ${this.selectedTerritory.id}`);
        } else {
            console.log(`Selected enemy territory ${this.selectedTerritory.id}`);
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
            // Clicked empty space - deselect
            this.fsm.transitionTo('Default');
            return true;
        }
        
        // Any click selects new territory (transition based on ownership)
        if (this.isOwnedByPlayer(territory)) {
            this.fsm.selectedTerritory = territory;
            this.fsm.transitionTo('TerritorySelected', { selectedTerritory: territory });
            return true;
        } else {
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
    
    isValidTarget(territory, action) {
        return false; // No actions available from enemy selected state
    }
}