/**
 * InputHandler.js - Simplified input processing module
 * 
 * Processes raw browser events into simple left-click selection and right-click contextual actions.
 * Removes complex proportional drag and modifier key logic per new architecture.
 */

import { InputStateMachine } from './InputStateMachine.js';

export class InputHandler {
    constructor(game) {
        this.game = game;
        this.hoveredTerritory = null;
        this.canvas = game.canvas;
        
        // Simplified input state
        this.mousePos = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStartPos = null;
        this.dragStartTime = null;
        
        // Double-click handling for supply routes
        this.lastClickTime = 0;
        this.lastClickedTerritory = null;
        this.doubleClickThreshold = 300; // ms - more forgiving for trackpads
        
        // Touch state for mobile support
        this.touchState = {
            activeTouches: new Map(),
            lastTouchDistance: null,
            lastPinchCenter: null,
            panVelocity: { x: 0, y: 0 },
            lastPanTime: 0
        };
        
        // Initialize FSM
        this.inputFSM = new InputStateMachine(game);
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        console.log('🖱️ SETTING UP EVENT LISTENERS on canvas:', this.game.canvas);
        
        // Mouse events with debug logging
        this.game.canvas.addEventListener('mousedown', (e) => {
            console.log('🖱️ CANVAS MOUSEDOWN:', e.button);
            this.handleMouseDown(e);
        });
        this.game.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.game.canvas.addEventListener('mouseup', (e) => {
            console.log('🖱️ CANVAS MOUSEUP:', e.button);
            this.handleMouseUp(e);
        });
        this.game.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Touch events for mobile support
        this.game.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.game.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.game.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        this.game.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
        
        console.log('🖱️ EVENT LISTENERS SETUP COMPLETE');
        
        // Keyboard events (simplified - no modifier key tracking)
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    handleMouseDown(e) {
        e.preventDefault();
        this.isDragging = false;
        
        const rect = this.game.canvas.getBoundingClientRect();
        this.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        this.dragStartPos = { ...this.mousePos };
        this.dragStartTime = Date.now();
        this.lastMousePos = { ...this.mousePos };
        
        // Only start drag for right mouse button
        if (e.button === 2) {
            this.isDragging = true;
        }
    }
    
    handleMouseMove(e) {
        const rect = this.game.canvas.getBoundingClientRect();
        const newMousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Handle camera panning only when already dragging (right-click drag)
        if (this.isDragging) {
            const deltaX = newMousePos.x - this.lastMousePos.x;
            const deltaY = newMousePos.y - this.lastMousePos.y;
            this.game.camera.pan(-deltaX, -deltaY);
        }
        
        // Update edge panning
        this.game.camera.updateEdgePanning(newMousePos.x, newMousePos.y, 16);
        
        // Update hovered territory for tooltips
        const worldPos = this.game.camera.screenToWorld(newMousePos.x, newMousePos.y);
        const hoveredTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
        this.hoveredTerritory = hoveredTerritory;
        this.game.hoveredTerritory = hoveredTerritory;
        
        this.lastMousePos = newMousePos;
        this.mousePos = newMousePos;
    }
    
    handleMouseUp(e) {
        const worldPos = this.game.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const targetTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
        
        // Only process left-clicks as game commands (not drags)
        if (e.button === 0 && !this.isDragging) {
            console.log(`🖱️ MOUSE UP: Territory ${targetTerritory?.id} at world(${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)}) modifiers shift=${e.shiftKey}, ctrl=${e.ctrlKey}`);
            this.processSingleClick(e.button, targetTerritory, worldPos, e.shiftKey, e.ctrlKey);
        } else {
            console.log(`🖱️ MOUSE UP IGNORED: button=${e.button}, isDragging=${this.isDragging}`);
        }
        
        this.resetDragState();
    }
    
    processSingleClick(button, territory, worldPos, shiftKey = false, ctrlKey = false) {
        console.log(`🖱️ PROCESS CLICK: button=${button}, territory=${territory?.id}, gameState=${this.game.gameState}`);
        
        // Check UI elements first
        if (this.game.handleUIClick(this.mousePos.x, this.mousePos.y)) {
            console.log(`🖱️ UI CLICK HANDLED`);
            return;
        }
        
        // Skip game logic if not in playing state
        if (this.game.gameState !== 'playing') {
            console.log(`🖱️ GAME NOT PLAYING: ${this.game.gameState}`);
            return;
        }
        
        if (button === 0) { // Left click
            console.log(`🖱️ SENDING TO FSM: leftClick event`);
            const result = this.inputFSM.handleInput('leftClick', {
                territory: territory,
                worldPos: worldPos,
                screenPos: this.mousePos,
                shiftKey: shiftKey,
                ctrlKey: ctrlKey
            });
            console.log(`🖱️ FSM RESULT: ${result}`);
        } else if (button === 2) { // Right click (deprecated in single button control scheme)
            // Right-click now just does camera dragging - all commands moved to left-click
            console.log(`🖱️ RIGHT-CLICK: Territory ${territory?.id} - functionality moved to left-click with modifiers`);
            return;
        }
    }
    

    handleDoubleClick(territory) {
        console.log(`handleDoubleClick called for territory ${territory.id}, owned by player ${territory.ownerId}`);
        
        // NEW SINGLE BUTTON CONTROL: Double-click functionality
        if (!this.lastClickedTerritory || !territory) return;
        
        const source = this.lastClickedTerritory;
        const target = territory;
        
        // Only proceed if source is owned by player
        if (source.ownerId === this.game.humanPlayer?.id) {
            if (target.ownerId === this.game.humanPlayer?.id && source.id !== target.id) {
                // Double-click between two friendly territories: toggle supply route
                const routes = this.game.supplySystem.supplyRoutes || [];
                const existingIndex = routes.findIndex(route => route.from === source.id && route.to === target.id);
                if (existingIndex >= 0) {
                    // Remove existing supply route
                    this.game.supplySystem.supplyRoutes.splice(existingIndex, 1);
                    console.log('Supply route removed between', source.id, 'and', target.id);
                } else {
                    // Create new supply route
                    this.game.supplySystem.createSupplyRoute(source.id, target.id);
                    console.log('Supply route created between', source.id, 'and', target.id);
                }
            } else if (target.ownerId !== this.game.humanPlayer?.id) {
                // Double-click on enemy or neutral territory: long-range strike (send all available fleets)
                const availableFleet = Math.max(0, source.armySize - 1);
                if (availableFleet > 0) {
                    console.log('Initiating long-range strike from', source.id, 'to target', target.id);
                    this.game.launchLongRangeAttack(source, target, availableFleet);
                }
            }
        }
        
        // Legacy double-click code for compatibility
        if (territory.ownerId === this.game.humanPlayer?.id) {
            const selectedTerritory = this.inputFSM.getState().selectedTerritory;
            // Removed debug console logging (dead code cleanup)
            
            if (selectedTerritory && selectedTerritory.ownerId === this.game.humanPlayer?.id) {
                if (selectedTerritory.id === territory.id) {
                    // Double-click on same selected territory - stop supply routes
                    const stopped = this.game.supplySystem?.stopSupplyRoutesFromTerritory(territory.id);
                    // Removed debug logging for supply route operations (dead code cleanup)
                } else {
                    // Double-click on different owned territory - create supply route
                    // Removed debug logging for supply route creation (dead code cleanup)
                    this.game.createSupplyRoute(selectedTerritory, territory).catch(error => {
                        console.error('Failed to create supply route:', error);
                    });
                }
            }
        } else {
            // Removed debug logging for territory ownership (dead code cleanup)
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        if (!this.game.camera) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(3.0, this.game.camera.targetZoom * zoomFactor));
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
            
            // Treat touch tap as left-click
            this.inputFSM.handleInput('leftClick', {
                territory: territory,
                worldPos: worldPos,
                screenPos: { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
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
            const newZoom = Math.max(0.1, Math.min(3.0, this.game.camera.targetZoom * scale));
            
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            this.game.camera.zoomTo(newZoom, centerX, centerY);
        }
        
        this.touchState.lastTouchDistance = distance;
    }
    
    handleKeyDown(e) {
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
}