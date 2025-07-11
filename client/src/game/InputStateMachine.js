/**
 * Player Input Finite State Machine (FSM)
 * 
 * ---------------- FSM STATES ----------------
 * idle → source_selected → pending_preview → (execute|cancel) → idle
 * idle → source_selected → supply_mode → tap target → create/remove route
 */

import { PathfindingService } from './PathfindingService';
import { GameUtils } from './utils';
import { GAME_CONSTANTS } from '../../../common/gameConstants';

// helper to reset preview UI
function clearPreview(game) { 
    game.ui?.hidePreviewArrow?.(); 
}

export class InputStateMachine {
    constructor(game) {
        this.game = game;
        this.state = 'idle';
        this.selectedTerritory = null;
        this.selectedTerritories = new Set();  // For multi-selection with Shift+click
        this.pendingTarget = null;       // for confirm‑mode preview
        
        // LONG‑PRESS timer
        this.longPressTimer = null;
        
        // Track battles initiated by human player to manage selection state
        this.pendingPlayerBattles = new Map();
        
        // Track territories that have been confirmed for attack (no re-confirmation needed)
        this.confirmedAttackTargets = new Set();
        
        console.log('InputStateMachine initialized in idle state');
    }

    // Main input event processor
    handleEvent(eventType, data) {
        switch (eventType) {
            case 'tap':                this.handleTap(data);             break;
            case 'double_tap':         this.handleDoubleTap(data);       break;
            case 'long_press':         this.handleLongPress(data);       break;
            case 'long_press_select':  this.handleLongPressSelect(data); break;
            case 'long_press_supply':  this.handleLongPressSupply(data); break;
            case 'timeout':            this.handleTimeout();             break;
            default:
                console.log(`Unknown event type: ${eventType}`);
                break;
        }
    }

    // ---------- tap ----------
    handleTap({ territory, shiftKey }) {
        console.log(`🎯 FSM handleTap: territory=${territory?.id}, shiftKey=${shiftKey}, state=${this.state}`);
        switch (this.state) {
            case 'idle':
                if (territory && territory.ownerId === this.game.humanPlayer.id && territory.armySize > 1) {
                    this.selectedTerritory = territory;
                    this.selectedTerritories.clear();
                    this.selectedTerritories.add(territory);
                    this.state = 'source_selected';
                }
                break;

            case 'source_selected':
                if (!territory) { this.reset(); break; }          // tap empty = deselect

                if (shiftKey && territory && territory.ownerId === this.game.humanPlayer.id) {
                    console.log(`🔄 SHIFT+CLICK: Adding/removing territory ${territory.id} to selection`);
                    if (this.selectedTerritories.has(territory)) {
                        this.selectedTerritories.delete(territory);
                        console.log(`➖ Removed territory ${territory.id} from selection, total: ${this.selectedTerritories.size}`);
                    } else {
                        this.selectedTerritories.add(territory);
                        console.log(`➕ Added territory ${territory.id} to selection, total: ${this.selectedTerritories.size}`);
                    }
                    this.selectedTerritory = territory;
                    if (this.selectedTerritories.size === 0) {
                        this.reset();
                    }
                    break;
                }

                if (this.selectedTerritories.size === 1 && territory.id === this.selectedTerritory.id) {
                    break; // tap source again = no-op
                }

                const isFriendly = territory.ownerId === this.game.humanPlayer.id;

                if (this.selectedTerritories.size > 1) {
                    for (const from of this.selectedTerritories) {
                        if (from.id === territory.id) continue;
                        this.game.issueFleetCommand(from, territory, 0.5, !isFriendly);
                    }
                } else {
                    const from = this.selectedTerritory;
                    if (isFriendly) {
                        this.game.issueFleetCommand(from, territory, 0.5, false);
                        console.log(`🚀 Immediate transfer: ${from.id} -> ${territory.id}`);
                    } else {
                        const targetKey = `${from.id}->${territory.id}`;
                        if (this.confirmedAttackTargets.has(targetKey)) {
                            this.game.issueFleetCommand(from, territory, 0.5, true);
                            console.log(`🎯 Immediate repeat attack: ${from.id} -> ${territory.id}`);
                        } else {
                            this.enterPreview(territory, 'attack');
                        }
                    }
                }
                break;

            case 'pending_preview':      // this is the CONFIRM tap
                if (territory && territory.id === this.pendingTarget.id) {
                    this.executePendingAction( territory );
                } else {
                    clearPreview(this.game);           // tapped elsewhere → cancel
                    this.state = territory ? 'source_selected' : 'idle';
                    this.pendingTarget = null;
                }
                break;

            case 'supply_mode':
                if (territory && territory.ownerId === this.game.humanPlayer.id &&
                    territory.id !== this.selectedTerritory.id) {
                    console.log(`🔗 Creating supply route: ${this.selectedTerritory.id} -> ${territory.id}`);
                    // Call createSupplyRoute with territory objects instead of IDs
                    this.game.createSupplyRoute(this.selectedTerritory, territory);
                    this.state = 'source_selected';
                    this.game.ui?.exitSupplyMode?.();
                } else if (!territory) {
                    // Clicked empty space - cancel existing supply route if any
                    console.log(`🔗 Cancelling supply route from territory ${this.selectedTerritory.id}`);
                    this.game.cancelSupplyRoute(this.selectedTerritory);
                    this.state = 'source_selected';
                    this.game.ui?.exitSupplyMode?.();
                } else {
                    // Clicked invalid target - just exit supply mode
                    console.log(`🔗 Exiting supply mode - invalid target`);
                    this.state = 'source_selected';
                    this.game.ui?.exitSupplyMode?.();
                }
                break;
        }
    }

    // ---------- double‑tap ----------
    handleDoubleTap({ territory, shiftKey, ctrlKey }) {
        if (!territory) return;

        // Double-click on SELECTED territory: enter reinforce mode
        if (this.state === 'source_selected' && territory.id === this.selectedTerritory?.id) {
            this.enterSupplyMode(territory);
            console.log(`🔗 Double-click reinforce mode: Territory ${territory.id} entering supply mode`);
            return;
        }

        // Double-click from source_selected state on different territory: execute fleet command
        if (this.state === 'source_selected' && territory.id !== this.selectedTerritory?.id) {
            const pct = shiftKey ? 1.0 : ctrlKey ? 0.25 : 0.5;

            if (territory.ownerId === this.game.humanPlayer.id) {
                this.game.issueFleetCommand(this.selectedTerritory, territory, pct);
            } else {
                this.game.issueFleetCommand(this.selectedTerritory, territory, pct, true /*attack*/);
            }
            // remain in source_selected so player can chain
        }
    }

    // ---------- progressive long‑press ----------
    handleLongPressSelect({ territory }) {
        if (!territory || territory.ownerId !== this.game.humanPlayer.id || territory.armySize <= 1) return;

        // Long press selection: always select the territory
        this.selectedTerritory = territory;
        this.state = 'source_selected';
        console.log(`🎯 Long press selection (0.5s): Territory ${territory.id} selected`);
    }

    handleLongPressSupply({ territory }) {
        if (!territory || territory.ownerId !== this.game.humanPlayer.id || territory.armySize <= 1) return;

        // Long press supply mode: enter supply mode if territory is selected
        if (this.state === 'source_selected' && this.selectedTerritory && this.selectedTerritory.id === territory.id) {
            this.enterSupplyMode(territory);
            console.log(`🔗 Long press supply mode (1.5s): Territory ${territory.id} entering supply mode`);
        }
    }

    // Legacy long press handler for compatibility
    handleLongPress({ territory }) {
        // Fallback to selection for any existing calls
        this.handleLongPressSelect({ territory });
    }

    // ---------- helper: preview ----------
    enterPreview(target, type) {
        this.pendingTarget = target;
        this.state         = 'pending_preview';
        this.previewStart  = Date.now();
        this.game.ui?.showPreviewArrow?.(this.selectedTerritory, target, type);
    }

    // ---------- helper: execute ----------
    executePendingAction(target) {
        const pct = 0.5;   // default 50 %
        // This should only be called for attacks now since transfers are immediate
        this.game.issueFleetCommand(this.selectedTerritory, target, pct, true /*attack*/);
        
        // Mark this attack route as confirmed for future immediate attacks
        const targetKey = `${this.selectedTerritory.id}->${target.id}`;
        this.confirmedAttackTargets.add(targetKey);
        
        console.log(`🎯 Attack confirmed: ${this.selectedTerritory.id} -> ${target.id} (added to confirmed targets)`);
        clearPreview(this.game);
        // outcome: stay source_selected for reinforce, deselect on successful attack handled elsewhere
        this.state         = 'source_selected';
        this.pendingTarget = null;
    }

    // ---------- timeout watchdog ----------
    handleTimeout() {
        if (this.state === 'pending_preview' &&
            Date.now() - this.previewStart > GAME_CONSTANTS.PREVIEW_TIMEOUT_MS) {
            clearPreview(this.game);
            this.pendingTarget = null;
            this.state = 'source_selected';
        }
    }

    // ---------- supply mode helper ----------
    enterSupplyMode(territory) {
        this.state = 'supply_mode';
        this.game.ui?.enterSupplyMode?.();
        
        // Check if territory is already supplying reinforcements
        const isCurrentlySupplying = this.game.supplySystem?.isSupplySource?.(territory.id);
        
        // Show contextual message based on current supply status
        if (this.game.uiManager) {
            if (isCurrentlySupplying) {
                this.game.uiManager.showMessage(`🔗 SUPPLY MODE: Star ${territory.id} currently supplying. Click different star to reroute, or blank space to cancel`, 4000);
            } else {
                this.game.uiManager.showMessage(`🔗 SUPPLY MODE: Click target star to reinforce from Star ${territory.id}`, 3000);
            }
        }
        
        console.log(`🔗 Supply mode activated for territory ${territory.id}, currently supplying: ${isCurrentlySupplying}`);
    }

    // Reset state completely
    reset() { 
        this.state = 'idle'; 
        this.selectedTerritory = null; 
        this.selectedTerritories.clear();  // Clear multi-selection
        this.pendingTarget = null;
        this.pendingPlayerBattles.clear();
        this.confirmedAttackTargets.clear(); // Clear confirmed attack targets when deselecting
        clearPreview(this.game); 
    }

    // Legacy compatibility methods
    getState() {
        return {
            currentState: this.state,
            selectedTerritory: this.selectedTerritory,
            stateData: {}
        };
    }

    transitionTo(newState, data = {}) {
        console.log(`FSM: ${this.state} -> ${newState}`, data);
        this.state = newState;
        if (newState === 'Default') {
            this.reset();
        }
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
            this.state = 'idle';
        } else if (!attackerWins) {
            console.log(`🎯 Battle lost - keeping territory ${attackingTerritoryId} selected`);
            // Keep the source territory selected for failed attacks
        }
    }

    // Legacy compatibility for old input handler calls
    handleInput(inputType, data) {
        // Convert old input types to new event types
        switch (inputType) {
            case 'leftClick':
                this.handleEvent('tap', { territory: data.territory });
                break;
            default:
                console.log(`Legacy input type not supported: ${inputType}`);
                break;
        }
    }
}