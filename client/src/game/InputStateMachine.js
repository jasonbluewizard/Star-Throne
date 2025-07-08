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

// -------------------------------------------------------------
// Add a new FSM sub‑state for drag‑to‑command
// -------------------------------------------------------------
class CommandDragState {
    constructor(fsm) { this.fsm = fsm; }

    enter(data) {
        this.src        = data.source;          // selected friendly planet
        this.shiftKey   = data.shiftKey;
        this.ctrlKey    = data.ctrlKey;
        console.log(`🎯 COMMAND DRAG: Started from territory ${this.src.id} (Shift:${this.shiftKey}, Ctrl:${this.ctrlKey})`);
    }

    handle(eventType, data) {
        switch (eventType) {
            case 'drag_move':
                // (optional: draw provisional arrow here)
                break;

            case 'drag_end': {
                const target = data.territory;
                console.log(`🎯 COMMAND DRAG END: Source ${this.src.id} → Target ${target?.id || 'none'}`);
                if (target && target.id !== this.src.id) {
                    const pct = this.shiftKey ? 1.0 :
                                this.ctrlKey  ? 0.25 : 0.5;
                    console.log(`🚀 EXECUTING FLEET COMMAND: ${this.src.id} → ${target.id} (${Math.round(pct*100)}% fleet)`);
                    this.fsm.game.executeFleetCommand(this.src, target, pct);
                } else {
                    console.log(`❌ COMMAND DRAG CANCELLED: ${target ? 'Same territory' : 'No target'}`);
                }
                this.fsm.setState('territory_selected', { keepSelection: true });
                break;
            }

            case 'drag_cancel':
                this.fsm.setState('territory_selected', { keepSelection: true });
                break;
        }
    }
}

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
            'EnemySelected': new EnemySelectedState(this),
            'command_drag': new CommandDragState(this)
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
            case 'click_left':   // single click now SENDS immediately
                this.handleLeftClick(data);
                break;
            // right-click removed – all commands are single-click
            case 'keyPress':
                return this.handleKeyPress(data.key);
            default:
                return false;
        }
    }
    
    handleLeftClick({ x, y, shiftKey, ctrlKey }) {
        const target = this.fsm.game.findTerritoryAt(x, y);
        const source = this.fsm.selectedTerritory;

        // ---------------- change selection ----------------
        if (!source) {
            if (target) {
                this.fsm.selectTerritory(target);
            }
            return;
        }

        // ---------------- deselect ----------------
        if (!target) {
            this.fsm.deselect();
            return;
        }

        // ---------------- same planet = no‑op -----------
        if (target.id === source.id) return;

        // ---------------- calculate send % --------------
        let pct = 0.5;
        if (shiftKey) pct = 1.0;
        else if (ctrlKey) pct = 0.25;

        // ---------------- friendly target ----------------
        if (target.ownerId === source.ownerId) {
            this.fsm.game.issueFleetCommand(source, target, pct);
            // keep source selected so user can chain orders
            return;
        }

        // ---------------- enemy / neutral target --------
        this.fsm.game.issueFleetCommand(source, target, pct);
        // source stays selected (common RTS feel)
    }
    
    // handleRightClick() removed completely
    
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