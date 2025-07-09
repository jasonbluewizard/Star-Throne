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
        this.pendingTarget = null;       // for confirm‑mode preview
        
        // LONG‑PRESS timer
        this.longPressTimer = null;
        
        // Track battles initiated by human player to manage selection state
        this.pendingPlayerBattles = new Map();
        
        console.log('InputStateMachine initialized in idle state');
    }

    // Main input event processor
    handleEvent(eventType, data) {
        switch (eventType) {
            case 'tap':          this.handleTap(data);          break;
            case 'double_tap':   this.handleDoubleTap(data);    break;
            case 'long_press':   this.handleLongPress(data);    break;
            case 'timeout':      this.handleTimeout();          break;
            default:
                console.log(`Unknown event type: ${eventType}`);
                break;
        }
    }

    // ---------- tap ----------
    handleTap({ territory }) {
        switch (this.state) {
            case 'idle':
                if (territory && territory.ownerId === this.game.humanPlayer.id && territory.armySize > 1) {
                    this.selectedTerritory = territory;
                    this.state = 'source_selected';
                }
                break;

            case 'source_selected':
                if (!territory) { this.reset(); break; }          // tap empty = deselect

                if (territory.id === this.selectedTerritory.id) { // tap source again = no‑op
                    break;
                }

                // friendly target – immediate transfer (no preview needed)
                if (territory.ownerId === this.game.humanPlayer.id) {
                    this.game.issueFleetCommand(this.selectedTerritory, territory, 0.5, false);
                    console.log(`🚀 Immediate transfer: ${this.selectedTerritory.id} -> ${territory.id}`);
                    // Stay in source_selected state for chaining commands
                }
                // hostile/neutral target – start preview for confirmation
                else {
                    this.enterPreview(territory, 'attack');
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
                    this.game.supplySystem.toggleSupplyRoute(this.selectedTerritory.id, territory.id);
                }
                // exit supply mode whether route created or not
                this.state = 'source_selected';
                this.game.ui?.exitSupplyMode?.();
                break;
        }
    }

    // ---------- double‑tap ----------
    handleDoubleTap({ territory, shiftKey, ctrlKey }) {
        if (this.state !== 'source_selected' || !territory ||
            territory.id === this.selectedTerritory?.id) return;

        const pct = shiftKey ? 1.0 : ctrlKey ? 0.25 : 0.5;

        if (territory.ownerId === this.game.humanPlayer.id) {
            this.game.issueFleetCommand(this.selectedTerritory, territory, pct);
        } else {
            this.game.issueFleetCommand(this.selectedTerritory, territory, pct, true /*attack*/);
        }
        // remain in source_selected so player can chain
    }

    // ---------- long‑press ----------
    handleLongPress({ territory }) {
        if (this.state === 'source_selected' &&
            territory && territory.id === this.selectedTerritory.id) {
            this.state = 'supply_mode';
            this.game.ui?.enterSupplyMode?.();
        }
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
        console.log(`🎯 Attack confirmed: ${this.selectedTerritory.id} -> ${target.id}`);
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

    // Reset state completely
    reset() { 
        this.state = 'idle'; 
        this.selectedTerritory = null; 
        this.pendingTarget = null;
        this.pendingPlayerBattles.clear();
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