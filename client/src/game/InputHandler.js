/**
 * InputHandler.js - Simplified input processing module
 * 
 * Processes raw browser events into simple left-click selection and right-click contextual actions.
 * Removes complex proportional drag and modifier key logic per new architecture.
 */

import { InputStateMachine } from './InputStateMachine';
import { GAME_CONSTANTS } from '../../../common/gameConstants';

export class InputHandler {
    constructor(game) {
        this.game = game;
        this.hoveredTerritory = null;
        this.canvas = game.canvas;
        
        // Bind event handlers for proper cleanup (fixes memory leak)
        this._onMouseDown = (e) => this.handleMouseDown(e);
        this._onMouseMove = (e) => this.handleMouseMove(e);
        this._onMouseUp = (e) => this.handleMouseUp(e);
        this._onWheel = (e) => this.handleWheel(e);
        this._onContextMenu = (e) => e.preventDefault();
        this._onTouchStart = (e) => this.handleTouchStart(e);
        this._onTouchMove = (e) => this.handleTouchMove(e);
        this._onTouchEnd = (e) => this.handleTouchEnd(e);
        this._onKeyDown = (e) => this.handleKeyDown(e);
        
        // Simplified input state
        this.mousePos = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStartPos = null;
        this.dragStartTime = null;
        
        // Double-click handling for supply routes
        this.lastClickTime = 0;
        this.lastClickedTerritory = null;
        this.doubleClickThreshold = GAME_CONSTANTS.DOUBLE_CLICK_THRESHOLD_MS;
        
        // Progressive long-press timers
        this.longPressSelectionTimer = null;  // 0.5s for selection
        this.longPressSupplyTimer = null;     // 1.5s for supply mode
        this.hasTriggeredSelection = false;   // Track if selection already occurred
        
        // Touch state for mobile support
        this.touchState = {
            activeTouches: new Map(),
            lastTouchDistance: null,
            lastPinchCenter: null,
            panVelocity: { x: 0, y: 0 },
            lastPanTime: 0
        };
        
        // Gate toggle mode for flood controller
        this.gateToggleMode = false;
        
        // Initialize FSM
        this.inputFSM = new InputStateMachine(game);
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        console.log('🎛️ Setting up InputHandler event listeners...');
        
        // Mouse events using bound handlers
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('wheel', this._onWheel);
        this.canvas.addEventListener('contextmenu', this._onContextMenu);
        
        // Touch events using bound handlers
        this.canvas.addEventListener('touchstart', this._onTouchStart);
        this.canvas.addEventListener('touchmove', this._onTouchMove);
        this.canvas.addEventListener('touchend', this._onTouchEnd);
        this.canvas.addEventListener('touchcancel', this._onTouchEnd);
        
        // Keyboard events using bound handlers - with debugging
        document.addEventListener('keydown', this._onKeyDown);
        console.log('✅ Keyboard event listener added to document');
        
        // Test if canvas can receive focus
        this.canvas.tabIndex = 0; // Make canvas focusable
        this.canvas.focus(); // Try to focus it
        console.log('🎯 Canvas focused for keyboard events');
    }
    
    handleMouseDown(e) {
        e.preventDefault();
        this.isDragging = false;
        
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        this.dragStartPos = { ...this.mousePos };
        this.dragStartTime = Date.now();
        this.lastMousePos = { ...this.mousePos };
        
        // start progressive long‑press timers only for LMB
        if (e.button === 0) {
            this.hasTriggeredSelection = false;
            
            // Timer 1: Selection after 0.5s
            this.longPressSelectionTimer = setTimeout(() => {
                if (!this.isDragging) {
                    const worldPos = this.game.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
                    const terr = this.game.findTerritoryAt(worldPos.x, worldPos.y);
                    if (terr && terr.ownerId === this.game.humanPlayer.id && terr.armySize > 1) {
                        this.inputFSM.handleEvent('long_press_select', { territory: terr });
                        this.hasTriggeredSelection = true;
                        console.log(`🎯 Long press selection triggered at 0.5s for territory ${terr.id}`);
                    }
                }
            }, 500); // 0.5 seconds
            
            // Timer 2: Supply mode after 1.5s total
            this.longPressSupplyTimer = setTimeout(() => {
                if (!this.isDragging && this.hasTriggeredSelection) {
                    const worldPos = this.game.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
                    const terr = this.game.findTerritoryAt(worldPos.x, worldPos.y);
                    if (terr && terr.ownerId === this.game.humanPlayer.id && terr.armySize > 1) {
                        this.inputFSM.handleEvent('long_press_supply', { territory: terr });
                        console.log(`🔗 Long press supply mode triggered at 1.5s for territory ${terr.id}`);
                    }
                }
            }, 1500); // 1.5 seconds total
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const newMousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Check for camera drag threshold
        if (this.dragStartPos && !this.isDragging) {
            const dragDistance = Math.sqrt(
                Math.pow(newMousePos.x - this.dragStartPos.x, 2) + 
                Math.pow(newMousePos.y - this.dragStartPos.y, 2)
            );
            
            if (dragDistance > 10) {
                this.isDragging = true;
                // cancel long‑press timers when starting to drag
                clearTimeout(this.longPressSelectionTimer);
                clearTimeout(this.longPressSupplyTimer);
                this.hasTriggeredSelection = false;
            }
        }
        
        // Handle camera panning
        if (this.isDragging) {
            const deltaX = newMousePos.x - this.lastMousePos.x;
            const deltaY = newMousePos.y - this.lastMousePos.y;
            this.game.camera.pan(-deltaX, -deltaY);
        }
        
        // Update edge panning
        this.game.camera.updateEdgePanning(newMousePos.x, newMousePos.y, 16);
        
        // Update hovered territory for tooltips and supply route highlighting
        const worldPos = this.game.camera.screenToWorld(newMousePos.x, newMousePos.y);
        const hoveredTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
        this.hoveredTerritory = hoveredTerritory;
        
        this.lastMousePos = newMousePos;
        this.mousePos = newMousePos;
    }
    
    handleMouseUp(e) {
        // Clear long press timers when mouse is released
        clearTimeout(this.longPressSelectionTimer);
        clearTimeout(this.longPressSupplyTimer);
        this.hasTriggeredSelection = false;
        
        const clickDuration = Date.now() - (this.dragStartTime || 0);
        const wasQuickClick = clickDuration < 300 && !this.isDragging;
        
        const worldPos = this.game.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const targetTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
        
        if (wasQuickClick) {
            const currentTime = Date.now();
            
            // Check for double-click for supply routes (can be same or different territory)
            if (targetTerritory && 
                this.lastClickedTerritory && 
                currentTime - this.lastClickTime < this.doubleClickThreshold) {
                
                // Double-click detected
                console.log(`🎯 Double-click detected: last=${this.lastClickedTerritory.id}, current=${targetTerritory.id}`);
                console.log(`🎯 Time diff: ${currentTime - this.lastClickTime}ms (threshold: ${this.doubleClickThreshold}ms)`);
                console.log(`🎯 Territory owner: ${targetTerritory.ownerId}, human: ${this.game.humanPlayer?.id}`);
                
                this.inputFSM.handleEvent('double_tap', {
                    territory: targetTerritory,
                    shiftKey: e.shiftKey, 
                    ctrlKey: e.ctrlKey
                });
                this.lastClickTime = 0; // Reset to prevent triple-click
                this.lastClickedTerritory = null;
            } else {
                // Single click - start timer for potential double-click
                console.log(`🎯 Single click: territory=${targetTerritory?.id}, lastTime=${this.lastClickTime}, currentTime=${currentTime}`);
                this.lastClickTime = currentTime;
                this.lastClickedTerritory = targetTerritory;
                
                // Process single click after delay to check for double-click
                setTimeout(() => {
                    if (this.lastClickTime === currentTime) {
                        // No double-click occurred, process as single click
                        this.processSingleClick(e.button, targetTerritory, worldPos);
                    }
                }, this.doubleClickThreshold);
            }
        }
        
        // Reset drag state
        this.isDragging = false;
        this.dragStartPos = null;
        this.dragStartTime = null;
    }
    
    processSingleClick(button, territory, worldPos) {
        // Check UI elements first
        if (this.game.handleUIClick(this.mousePos.x, this.mousePos.y)) {
            return;
        }
        
        // Skip game logic if not in playing state
        if (this.game.gameState !== 'playing') {
            return;
        }
        
        if (button === 0) { // Left click
            // Check if clicking on enemy/neutral territory to toggle "no go" status
            if (territory && territory.ownerId !== this.game.humanPlayer?.id) {
                // Toggle no-go status for flood mode
                if (this.game.floodController && this.game.humanPlayer) {
                    this.game.floodController.toggleNoGoZone(this.game.humanPlayer, territory.id);
                    const isNoGo = this.game.floodController.isNoGoZone(this.game.humanPlayer, territory.id);
                    this.game.showMessage(
                        `Territory ${territory.id} marked as ${isNoGo ? 'NO GO' : 'ALLOWED'}`,
                        2000
                    );
                    return;
                }
            }
            
            // Normal left click handling
            this.inputFSM.handleEvent('tap', {
                territory: territory,
                x: worldPos.x, 
                y: worldPos.y,
                shiftKey: false, // Single click doesn't have modifiers
                ctrlKey: false
            });
        } else if (button === 2) {
            // Right-click ignored in single-button scheme
        }
    }
    


    
    handleWheel(e) {
        e.preventDefault();
        
        if (!this.game.camera) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(8.0, this.game.camera.targetZoom * zoomFactor);
        this.game.camera.zoomTo(newZoom, mouseX, mouseY);
        

    }
    
    handleTouchStart(e) {
        e.preventDefault();
        
        for (const touch of e.changedTouches) {
            this.touchState.activeTouches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startTime: Date.now()
            });
        }
        
        if (this.touchState.activeTouches.size === 2) {
            this.initializePinchGesture();
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        
        if (this.touchState.activeTouches.size === 1) {
            this.handleSingleTouchMove(e);
        } else if (this.touchState.activeTouches.size === 2) {
            this.handlePinchGesture(e);
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        
        for (const touch of e.changedTouches) {
            const touchData = this.touchState.activeTouches.get(touch.identifier);
            if (touchData && this.touchState.activeTouches.size === 1) {
                this.handleTouchTap(touch, touchData);
            }
            this.touchState.activeTouches.delete(touch.identifier);
        }
        
        if (this.touchState.activeTouches.size === 0) {
            this.touchState.lastTouchDistance = null;
            this.touchState.lastPinchCenter = null;
        }
    }
    
    handleTouchTap(touch, touchData) {
        const tapDuration = Date.now() - touchData.startTime;
        
        if (tapDuration < 500) { // Quick tap
            const rect = this.canvas.getBoundingClientRect();
            const worldPos = this.game.camera.screenToWorld(
                touch.clientX - rect.left,
                touch.clientY - rect.top
            );
            const territory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
            
            // Treat touch tap as tap event for FSM
            this.inputFSM.handleEvent('tap', {
                territory: territory,
                x: worldPos.x,
                y: worldPos.y,
                shiftKey: false,
                ctrlKey: false
            });
        }
    }
    
    handleSingleTouchMove(e) {
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const touchData = this.touchState.activeTouches.values().next().value;
        
        if (touchData) {
            const deltaX = touch.clientX - touchData.x;
            const deltaY = touch.clientY - touchData.y;
            
            this.game.camera.pan(-deltaX * 0.5, -deltaY * 0.5);
            
            touchData.x = touch.clientX;
            touchData.y = touch.clientY;
        }
    }
    
    initializePinchGesture() {
        const touches = Array.from(this.touchState.activeTouches.values());
        if (touches.length === 2) {
            const distance = Math.sqrt(
                Math.pow(touches[1].x - touches[0].x, 2) + 
                Math.pow(touches[1].y - touches[0].y, 2)
            );
            this.touchState.lastTouchDistance = distance;
            this.touchState.lastPinchCenter = {
                x: (touches[0].x + touches[1].x) / 2,
                y: (touches[0].y + touches[1].y) / 2
            };
        }
    }
    
    handlePinchGesture(e) {
        if (e.touches.length !== 2) return;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        const distance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        if (this.touchState.lastTouchDistance) {
            const scale = distance / this.touchState.lastTouchDistance;
            const newZoom = Math.min(3.0, this.game.camera.targetZoom * scale);
            
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            this.game.camera.zoomTo(newZoom, centerX, centerY);
        }
        
        this.touchState.lastTouchDistance = distance;
    }
    
    handleKeyDown(e) {
        console.log('🎹 Key pressed:', e.key, 'Code:', e.code);
        
        // Forward key events to FSM
        if (this.inputFSM.handleInput('keyPress', { key: e.key })) {
            return;
        }
        
        // Handle non-FSM keys
        switch (e.key) {
            case 'r':
            case 'R':
                if (this.game.gameState === 'ended') {
                    this.game.restartGame();
                }
                break;
            case 'm':
            case 'M':
                // Minimap feature removed
                break;
            case 'q':
            case 'Q':
                this.game.showPerformancePanel = !this.game.showPerformancePanel;

                break;
            case ' ':
                // Spacebar - Focus on Selected Territory
                const fsmState = this.inputFSM.getState();
                if (fsmState.selectedTerritory) {
                    this.game.camera.focusOnTerritory(fsmState.selectedTerritory);

                } else if (this.game.humanPlayer && this.game.humanPlayer.territories.length > 0) {
                    const firstTerritory = this.game.gameMap.territories[this.game.humanPlayer.territories[0]];
                    if (firstTerritory) {
                        this.game.camera.focusOnTerritory(firstTerritory);

                    }
                }
                break;
            case 'h':
            case 'H':
                // H key - Center camera on player's throne star
                if (this.game.humanPlayer?.throneStarId) { // Simplified condition (consolidated undefined/null checks)
                    const throneTerritory = this.game.gameMap.territories[this.game.humanPlayer.throneStarId];
                    if (throneTerritory) {
                        this.game.camera.focusOnTerritory(throneTerritory);
                        break;
                    }
                }
                
                // Fallback: find throne star by searching owned territories
                if (this.game.humanPlayer && this.game.humanPlayer.territories.length > 0) {
                    // Look for throne star among owned territories
                    let throneTerritory = null;
                    for (const territoryId of this.game.humanPlayer.territories) {
                        const territory = this.game.gameMap.territories[territoryId];
                        if (territory && territory.isThronestar) {
                            throneTerritory = territory;
                            break;
                        }
                    }
                    
                    if (throneTerritory) {
                        this.game.camera.focusOnTerritory(throneTerritory);
                    } else {
                        // Final fallback: focus on first territory
                        const firstTerritory = this.game.gameMap.territories[this.game.humanPlayer.territories[0]];
                        if (firstTerritory) {
                            this.game.camera.focusOnTerritory(firstTerritory);
                        }
                    }
                }
                break;
            case 'f':
            case 'F':
                // F key - Toggle flood mode for human player
                console.log('F key pressed - debugging flood mode');
                console.log('humanPlayer:', this.game.humanPlayer);
                console.log('floodController:', this.game.floodController);
                if (this.game.humanPlayer && this.game.floodController) {
                    console.log('Toggling flood mode for player:', this.game.humanPlayer.name);
                    const wasActive = this.game.floodController.isActive(this.game.humanPlayer);
                    this.game.floodController.togglePlayer(this.game.humanPlayer);
                    console.log('Flood mode toggled from', wasActive, 'to', this.game.floodController.isActive(this.game.humanPlayer));
                    
                    // Force show slider if flood mode is now active
                    if (this.game.floodController.isActive(this.game.humanPlayer)) {
                        console.log('Forcing slider to show...');
                        this.game.floodController.showSlider(this.game.humanPlayer);
                    }
                } else {
                    console.log('Cannot toggle flood mode - missing humanPlayer or floodController');
                }
                break;

        }
    }
    
    resetDragState() {
        this.isDragging = false;
        this.dragStartPos = null;
        this.dragStartTime = null;
    }
    
    // Get current input state for game loop
    getInputState() {
        return {
            mousePos: this.mousePos,
            isDragging: this.isDragging,
            selectedTerritory: this.inputFSM ? this.inputFSM.selectedTerritory : null,
            currentState: this.inputFSM ? this.inputFSM.currentState : 'Default'
        };
    }

    // Called by main game loop to handle timeouts
    update() {
        this.inputFSM.handleEvent('timeout');
    }
    
    // Cleanup method to properly remove event listeners (fixes memory leak)
    cleanup() {
        // Clear any active long press timers
        if (this.longPressSelectionTimer) {
            clearTimeout(this.longPressSelectionTimer);
            this.longPressSelectionTimer = null;
        }
        if (this.longPressSupplyTimer) {
            clearTimeout(this.longPressSupplyTimer);
            this.longPressSupplyTimer = null;
        }
        
        // Remove all event listeners using the same bound references
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this._onMouseDown);
            this.canvas.removeEventListener('mousemove', this._onMouseMove);
            this.canvas.removeEventListener('mouseup', this._onMouseUp);
            this.canvas.removeEventListener('wheel', this._onWheel);
            this.canvas.removeEventListener('contextmenu', this._onContextMenu);
            this.canvas.removeEventListener('touchstart', this._onTouchStart);
            this.canvas.removeEventListener('touchmove', this._onTouchMove);
            this.canvas.removeEventListener('touchend', this._onTouchEnd);
            this.canvas.removeEventListener('touchcancel', this._onTouchEnd);
        }
        
        // Remove document-level listeners
        document.removeEventListener('keydown', this._onKeyDown);
        
        // Clear references
        this.canvas = null;
        this.game = null;
        this.inputFSM = null;
    }
}