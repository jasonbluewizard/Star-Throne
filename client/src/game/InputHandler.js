/**
 * InputHandler.js - Dedicated input processing module
 * 
 * Encapsulates all user input processing, including mouse, touch, and keyboard events.
 * Translates raw browser events into game-specific commands.
 */

import { InputStateMachine } from './InputStateMachine.js';

export class InputHandler {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        
        // Input state
        this.mousePos = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        this.isDragging = false;
        this.isDraggingForSupplyRoute = false;
        this.isProportionalDrag = false;
        this.proportionalDragStart = null;
        this.fleetPercentage = 0.5;
        this.dragStartPos = null;
        this.dragStartTime = null;
        this.dragStart = null;
        this.dragEnd = null;
        
        // Modifier keys state
        this.modifierKeys = {
            shift: false,
            ctrl: false,
            alt: false
        };
        
        // Touch state
        this.touchState = {
            activeTouches: new Map(),
            lastTouchDistance: null,
            lastPinchCenter: null,
            longPressTimer: null,
            longPressStarted: false,
            panVelocity: { x: 0, y: 0 },
            lastPanTime: 0
        };
        
        // Modifier keys
        this.modifierKeys = {
            shift: false,
            ctrl: false,
            alt: false
        };
        
        // Initialize FSM
        this.inputFSM = new InputStateMachine(game);
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }
    
    handleMouseDown(e) {
        e.preventDefault();
        this.isDragging = false;
        this.isDraggingForSupplyRoute = false;
        this.isProportionalDrag = false;
        
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        this.dragStartPos = { ...this.mousePos };
        this.dragStartTime = Date.now();
        this.lastMousePos = { ...this.mousePos };
        
        const worldPos = this.game.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        this.dragStart = this.game.findTerritoryAt(worldPos.x, worldPos.y);
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const newMousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Check for drag threshold
        if (this.dragStartPos && !this.isDragging && !this.isProportionalDrag) {
            const dragDistance = Math.sqrt(
                Math.pow(newMousePos.x - this.dragStartPos.x, 2) + 
                Math.pow(newMousePos.y - this.dragStartPos.y, 2)
            );
            
            const timeSinceDragStart = Date.now() - (this.dragStartTime || 0);
            
            if (dragDistance > 15 && timeSinceDragStart > 300) {
                this.startProportionalDrag();
            } else if (dragDistance > 10 && !this.game.selectedTerritory) {
                this.isDragging = true;
            }
        }
        
        // Handle camera panning
        if (this.isDragging && !this.isProportionalDrag) {
            const deltaX = newMousePos.x - this.lastMousePos.x;
            const deltaY = newMousePos.y - this.lastMousePos.y;
            this.game.camera.pan(-deltaX, -deltaY);
        }
        
        // Handle proportional drag
        if (this.isProportionalDrag && this.proportionalDragStart) {
            this.updateProportionalDrag(newMousePos);
        }
        
        // Update edge panning
        this.game.camera.updateEdgePanning(newMousePos.x, newMousePos.y, 16);
        
        this.lastMousePos = newMousePos;
        this.mousePos = newMousePos;
    }
    
    handleMouseUp(e) {
        const clickDuration = Date.now() - (this.dragStartTime || 0);
        const wasQuickClick = clickDuration < 300 && !this.isDragging && !this.isDraggingForSupplyRoute;
        
        const worldPos = this.game.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const targetTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
        
        // Debug logging for click detection
        if (!targetTerritory && wasQuickClick && this.game.selectedTerritory) {
            console.log('Empty space click detected - deselecting territory');
        }
        
        // Handle proportional fleet command
        if (this.isProportionalDrag && this.proportionalDragStart && targetTerritory) {
            this.game.executeFleetCommand(this.proportionalDragStart.territory, targetTerritory, this.fleetPercentage);
        }
        // Handle supply route creation
        else if (this.isDraggingForSupplyRoute && this.dragStart) {
            if (targetTerritory && targetTerritory.ownerId === this.game.humanPlayer?.id && targetTerritory.id !== this.dragStart.id) {
                this.game.createSupplyRoute(this.dragStart, targetTerritory);
            }
        }
        else if (e.button === 0 && (wasQuickClick || (!this.isDragging && !this.isProportionalDrag))) {
            // Check UI elements first
            if (this.game.handleUIClick(this.mousePos.x, this.mousePos.y)) {
                this.resetDragState();
                return;
            }
            
            // Skip game logic if not in playing state
            if (this.game.gameState !== 'playing') {
                this.resetDragState();
                return;
            }
            
            // Fix for territory deselection: Allow empty space clicks to deselect regardless of minor movement
            if (!targetTerritory && this.game.selectedTerritory) {
                console.log('Empty space click detected - deselecting territory via FSM');
                this.inputFSM.handleInput('leftClick', {
                    territory: null,
                    worldPos: worldPos,
                    screenPos: this.mousePos
                });
            } else {
                // Left click - use FSM for input handling
                this.inputFSM.handleInput('leftClick', {
                    territory: targetTerritory,
                    worldPos: worldPos,
                    screenPos: this.mousePos
                });
            }
        }
        else if (e.button === 2 && wasQuickClick) {
            // Right click - use FSM for input handling
            this.inputFSM.handleInput('rightClick', {
                territory: targetTerritory,
                worldPos: worldPos,
                screenPos: this.mousePos
            });
        }
        
        this.resetDragState();
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
        
        console.log('Mouse wheel zoom:', Math.round(this.game.camera.targetZoom * 100) + '%');
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
        
        if (this.touchState.activeTouches.size === 1) {
            this.startLongPressTimer();
        } else if (this.touchState.activeTouches.size === 2) {
            this.clearLongPressTimer();
            this.initializePinchGesture();
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        
        this.clearLongPressTimer();
        
        if (this.touchState.activeTouches.size === 1) {
            this.handleSingleTouchMove(e);
        } else if (this.touchState.activeTouches.size === 2) {
            this.handlePinchGesture(e);
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        
        this.clearLongPressTimer();
        
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
    
    handleKeyDown(e) {
        // Track modifier keys
        this.modifierKeys.shift = e.shiftKey;
        this.modifierKeys.ctrl = e.ctrlKey;
        this.modifierKeys.alt = e.altKey;
        
        // First check if FSM handles the key
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
            case 'd':
            case 'D':
                this.game.showTouchDebug = !this.game.showTouchDebug;
                break;
            case 'm':
            case 'M':
                this.game.minimapMinimized = !this.game.minimapMinimized;
                console.log('Minimap toggled with M key:', this.game.minimapMinimized ? 'minimized' : 'maximized');
                break;
            case 'q':
            case 'Q':
                this.game.showPerformancePanel = !this.game.showPerformancePanel;
                console.log('Performance panel toggled with Q key:', this.game.showPerformancePanel ? 'shown' : 'hidden');
                break;
            case ' ':
                // Spacebar - Focus on Selected Territory
                const fsmState = this.inputFSM.getState();
                if (fsmState.selectedTerritory) {
                    this.game.camera.focusOnTerritory(fsmState.selectedTerritory);
                    console.log('Focused camera on selected territory');
                } else if (this.game.humanPlayer && this.game.humanPlayer.territories.length > 0) {
                    const firstTerritory = this.game.gameMap.territories[this.game.humanPlayer.territories[0]];
                    if (firstTerritory) {
                        this.game.camera.focusOnTerritory(firstTerritory);
                        console.log('Focused camera on first owned territory');
                    }
                }
                break;
            case 'h':
            case 'H':
                // H key - Frame all human player territories
                if (this.game.humanPlayer && this.game.humanPlayer.territories.length > 0) {
                    const playerTerritories = this.game.humanPlayer.territories.map(id => this.game.gameMap.territories[id]);
                    this.game.camera.frameRegion(playerTerritories);
                    console.log('Framed all player territories');
                }
                break;
        }
    }
    
    handleKeyUp(e) {
        // Update modifier key state
        this.modifierKeys.shift = e.shiftKey;
        this.modifierKeys.ctrl = e.ctrlKey;
        this.modifierKeys.alt = e.altKey;
    }
    
    // Helper methods
    startProportionalDrag() {
        if (this.dragStart && this.dragStart.ownerId === this.game.humanPlayer?.id) {
            this.isProportionalDrag = true;
            this.proportionalDragStart = {
                territory: this.dragStart,
                startPos: { ...this.dragStartPos }
            };
        }
    }
    
    updateProportionalDrag(mousePos) {
        const distance = Math.sqrt(
            Math.pow(mousePos.x - this.proportionalDragStart.startPos.x, 2) +
            Math.pow(mousePos.y - this.proportionalDragStart.startPos.y, 2)
        );
        
        this.fleetPercentage = Math.min(1.0, Math.max(0.1, distance / 100));
        
        const worldPos = this.game.camera.screenToWorld(mousePos.x, mousePos.y);
        this.dragEnd = this.game.findTerritoryAt(worldPos.x, worldPos.y);
    }
    
    resetDragState() {
        this.isDragging = false;
        this.isDraggingForSupplyRoute = false;
        this.isProportionalDrag = false;
        this.proportionalDragStart = null;
        this.fleetPercentage = 0.5;
        this.dragStartPos = null;
        this.dragStartTime = null;
        this.dragStart = null;
        this.dragEnd = null;
    }
    
    startLongPressTimer() {
        this.touchState.longPressTimer = setTimeout(() => {
            this.touchState.longPressStarted = true;
            this.handleLongPress();
        }, 800);
    }
    
    clearLongPressTimer() {
        if (this.touchState.longPressTimer) {
            clearTimeout(this.touchState.longPressTimer);
            this.touchState.longPressTimer = null;
        }
        this.touchState.longPressStarted = false;
    }
    
    handleLongPress() {
        // Long press logic for mobile
        console.log('Long press detected');
    }
    
    handleSingleTouchMove(e) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const currentPos = {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
        
        if (this.lastMousePos) {
            const deltaX = currentPos.x - this.lastMousePos.x;
            const deltaY = currentPos.y - this.lastMousePos.y;
            this.game.camera.pan(-deltaX, -deltaY);
        }
        
        this.mousePos = currentPos;
        this.lastMousePos = currentPos;
    }
    
    initializePinchGesture() {
        const touches = Array.from(this.touchState.activeTouches.values());
        if (touches.length >= 2) {
            const distance = Math.sqrt(
                Math.pow(touches[0].x - touches[1].x, 2) +
                Math.pow(touches[0].y - touches[1].y, 2)
            );
            
            this.touchState.lastTouchDistance = distance;
            this.touchState.lastPinchCenter = {
                x: (touches[0].x + touches[1].x) / 2,
                y: (touches[0].y + touches[1].y) / 2
            };
        }
    }
    
    handlePinchGesture(e) {
        if (e.touches.length < 2) return;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        const rect = this.canvas.getBoundingClientRect();
        const pos1 = {
            x: touch1.clientX - rect.left,
            y: touch1.clientY - rect.top
        };
        const pos2 = {
            x: touch2.clientX - rect.left,
            y: touch2.clientY - rect.top
        };
        
        const currentDistance = Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) +
            Math.pow(pos1.y - pos2.y, 2)
        );
        
        if (this.touchState.lastTouchDistance && Math.abs(currentDistance - this.touchState.lastTouchDistance) > 2) {
            const zoomFactor = currentDistance / this.touchState.lastTouchDistance;
            const adjustedFactor = 1 + (zoomFactor - 1) * 1.5;
            
            const centerX = (pos1.x + pos2.x) / 2;
            const centerY = (pos1.y + pos2.y) / 2;
            
            const newZoom = Math.max(0.1, Math.min(3.0, this.game.camera.targetZoom * adjustedFactor));
            this.game.camera.zoomTo(newZoom, centerX, centerY);
        }
        
        this.touchState.lastTouchDistance = currentDistance;
    }
    
    handleTouchTap(touch, touchData) {
        const rect = this.canvas.getBoundingClientRect();
        const tapPos = {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
        
        const tapDuration = Date.now() - touchData.startTime;
        const tapDistance = Math.sqrt(
            Math.pow(tapPos.x - touchData.x, 2) +
            Math.pow(tapPos.y - touchData.y, 2)
        );
        
        if (tapDuration < 500 && tapDistance < 20) {
            // Check UI elements first
            if (this.game.handleUIClick(tapPos.x, tapPos.y)) {
                return;
            }
            
            if (this.game.gameState !== 'playing') return;
            
            const worldPos = this.game.camera.screenToWorld(tapPos.x, tapPos.y);
            const targetTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
            
            this.inputFSM.handleInput('leftClick', {
                territory: targetTerritory,
                worldPos: worldPos,
                screenPos: tapPos
            });
        }
    }
    
    // Public interface for game engine
    getSelectedTerritory() {
        return this.inputFSM.getState().selectedTerritory;
    }
    
    getInputState() {
        return this.inputFSM.getState();
    }
    
    resetInputState() {
        this.inputFSM.reset();
        this.resetDragState();
    }
}