export class InputHandler {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        console.log('🔧 InputHandler constructor:', {
            hasGame: !!game,
            hasCanvas: !!game.canvas,
            canvasId: game.canvas?.id,
            canvasWidth: game.canvas?.width,
            canvasHeight: game.canvas?.height,
            canvasStyle: game.canvas?.style?.display
        });
        
        // Add direct test click listener
        if (this.canvas) {
            this.canvas.addEventListener('click', (e) => {
                console.log('🔥 DIRECT CLICK TEST:', e.type, e.clientX, e.clientY);
            });
        }
        this.mousePos = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        this.isDragging = false;
        this.isFleetDragging = false;
        this.fleetSource = null;
        this.hoveredTerritory = null;

        this.touchState = {
            activeTouches: new Map(),
            lastTouchDistance: null,
            lastPinchCenter: null
        };

        this._onMouseDown = (e) => this.handleMouseDown(e);
        this._onMouseMove = (e) => this.handleMouseMove(e);
        this._onMouseUp = (e) => this.handleMouseUp(e);
        this._onWheel = (e) => this.handleWheel(e);
        this._onContextMenu = (e) => e.preventDefault();
        this._onTouchStart = (e) => this.handleTouchStart(e);
        this._onTouchMove = (e) => this.handleTouchMove(e);
        this._onTouchEnd = (e) => this.handleTouchEnd(e);

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.canvas) {
            console.error('❌ InputHandler: No canvas available for event listeners');
            return;
        }
        console.log('✅ InputHandler: Setting up event listeners');
        console.log('🔍 Canvas element details:', {
            tagName: this.canvas.tagName,
            id: this.canvas.id,
            style: this.canvas.style.cssText,
            offsetWidth: this.canvas.offsetWidth,
            offsetHeight: this.canvas.offsetHeight,
            parentNode: this.canvas.parentNode?.tagName
        });
        
        // Use pointer events with capture so dragging continues even if the
        // pointer leaves the canvas element. This is more reliable across
        // browsers than plain mouse events.
        this.canvas.addEventListener('pointerdown', this._onMouseDown);
        this.canvas.addEventListener('pointermove', this._onMouseMove);
        this.canvas.addEventListener('pointerup', this._onMouseUp);
        this.canvas.addEventListener('pointercancel', this._onMouseUp);
        
        console.log('✅ All pointer event listeners attached');
        this.canvas.addEventListener('wheel', this._onWheel);
        this.canvas.addEventListener('contextmenu', this._onContextMenu);

        this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
        this.canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    }

    handleMouseDown(e) {
        console.log('🐭 Mouse down event received!');
        e.preventDefault();
        // Capture pointer so move/up events continue even if it leaves the canvas
        if (typeof e.pointerId === 'number' && this.canvas.setPointerCapture) {
            try {
                this.canvas.setPointerCapture(e.pointerId);
            } catch {
                // Ignore errors if pointer capture isn't supported
            }
        }
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.lastMousePos = { ...this.mousePos };

        const worldPos = this.game.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const territory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
        
        console.log('🔍 Mouse down details:', {
            screenPos: this.mousePos,
            worldPos: worldPos,
            territory: territory ? territory.id : 'none',
            humanPlayerId: this.game.humanPlayer?.id,
            territoryOwner: territory?.ownerId
        });

        if (territory && territory.ownerId === this.game.humanPlayer?.id) {
            // Begin fleet drag from owned territory
            console.log('🎯 Starting fleet drag from territory', territory.id, 'with', territory.armySize, 'armies');
            this.isFleetDragging = true;
            this.fleetSource = territory;
            this.isDragging = false;
            console.log('🚀 Fleet drag started for player territory', territory.id);
        } else {
            // Start panning the map
            this.isDragging = true;
            console.log('🖱️ Starting map pan');
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const newPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (this.isFleetDragging) {
            // Just update position for preview
            console.log('🎯 Fleet dragging - updating preview position');
        } else if (this.isDragging) {
            const dx = newPos.x - this.lastMousePos.x;
            const dy = newPos.y - this.lastMousePos.y;
            this.game.camera.pan(-dx, -dy);
        }

        this.game.camera.updateEdgePanning(newPos.x, newPos.y, 16);
        const worldPos = this.game.camera.screenToWorld(newPos.x, newPos.y);
        this.hoveredTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
        this.lastMousePos = newPos;
        this.mousePos = newPos;
    }

    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const releasePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (typeof e.pointerId === 'number' && this.canvas.releasePointerCapture) {
            try {
                this.canvas.releasePointerCapture(e.pointerId);
            } catch {
                // Ignore errors if pointer capture isn't supported
            }
        }

        if (this.isFleetDragging && this.fleetSource) {
            const worldPos = this.game.camera.screenToWorld(releasePos.x, releasePos.y);
            const target = this.game.findTerritoryAt(worldPos.x, worldPos.y);
            console.log('🎯 Fleet drag release:', {
                source: this.fleetSource.id,
                target: target ? target.id : 'none',
                sourceArmies: this.fleetSource.armySize
            });
            if (target && target.id !== this.fleetSource.id) {
                // Determine if this is an attack or transfer
                const isAttack = target.ownerId !== this.game.humanPlayer?.id;
                console.log('🚀 Issuing fleet command from', this.fleetSource.id, 'to', target.id, 'isAttack:', isAttack);
                console.log('🔍 Target owner:', target.ownerId, 'Human player:', this.game.humanPlayer?.id);
                
                // Call async method properly
                this.game.issueFleetCommand(this.fleetSource, target, 0.5, isAttack).catch(err => {
                    console.error('❌ Fleet command failed:', err);
                });
            }
        }

        this.isDragging = false;
        this.isFleetDragging = false;
        this.fleetSource = null;
        console.log('🔚 Mouse up - fleet drag ended');
    }

    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.02, Math.min(8.0, this.game.camera.targetZoom * zoomFactor));
        this.game.camera.zoomTo(newZoom, mouseX, mouseY);
    }

    handleTouchStart(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            this.touchState.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
        if (this.touchState.activeTouches.size === 2) {
            const [a, b] = Array.from(this.touchState.activeTouches.values());
            this.touchState.lastTouchDistance = Math.hypot(b.x - a.x, b.y - a.y);
            this.touchState.lastPinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (this.touchState.activeTouches.size === 1) {
            const touch = e.touches[0];
            const data = this.touchState.activeTouches.get(touch.identifier);
            if (data) {
                const dx = touch.clientX - data.x;
                const dy = touch.clientY - data.y;
                this.game.camera.pan(-dx * 0.5, -dy * 0.5);
                data.x = touch.clientX;
                data.y = touch.clientY;
            }
        } else if (this.touchState.activeTouches.size === 2 && e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            if (this.touchState.lastTouchDistance) {
                const scale = dist / this.touchState.lastTouchDistance;
                const newZoom = Math.min(3.0, this.game.camera.targetZoom * scale);
                const centerX = (t1.clientX + t2.clientX) / 2;
                const centerY = (t1.clientY + t2.clientY) / 2;
                this.game.camera.zoomTo(newZoom, centerX, centerY);
            }
            this.touchState.lastTouchDistance = dist;
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            this.touchState.activeTouches.delete(t.identifier);
        }
        if (this.touchState.activeTouches.size < 2) {
            this.touchState.lastTouchDistance = null;
            this.touchState.lastPinchCenter = null;
        }
        this.isDragging = false;
    }

    getInputState() {
        return {
            mousePos: this.mousePos,
            isDragging: this.isDragging || this.isFleetDragging,
            selectedTerritory: this.isFleetDragging ? null : null, // Don't show selected territory during fleet drag
            fleetDragging: this.isFleetDragging,
            fleetSource: this.fleetSource,
            currentState: 'idle'
        };
    }

    update() {}

    cleanup() {
        if (!this.canvas) return;
        this.canvas.removeEventListener('pointerdown', this._onMouseDown);
        this.canvas.removeEventListener('pointermove', this._onMouseMove);
        this.canvas.removeEventListener('pointerup', this._onMouseUp);
        this.canvas.removeEventListener('pointercancel', this._onMouseUp);
        this.canvas.removeEventListener('wheel', this._onWheel);
        this.canvas.removeEventListener('contextmenu', this._onContextMenu);
        this.canvas.removeEventListener('touchstart', this._onTouchStart);
        this.canvas.removeEventListener('touchmove', this._onTouchMove);
        this.canvas.removeEventListener('touchend', this._onTouchEnd);
        this.canvas.removeEventListener('touchcancel', this._onTouchEnd);
        this.canvas = null;
        this.game = null;
    }
}
