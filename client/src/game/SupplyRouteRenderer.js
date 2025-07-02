// SupplyRouteRenderer.js
export default class SupplyRouteRenderer {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.ctx = game.ctx;
        this.camera = game.camera;
        
        // References to game state
        this.gameMap = game.gameMap;
        this.supplyRoutes = game.supplyRoutes;
        this.humanPlayer = game.humanPlayer;
    }

    /** Render active supply routes with animated dashed lines */
    renderSupplyRoutes() {
        // Render active supply routes with animated arrows
        this.supplyRoutes.forEach((route, fromId) => {
            const fromTerritory = this.gameMap.territories[fromId];
            const toTerritory = this.gameMap.territories[route.targetId];
            
            if (fromTerritory && toTerritory && route.path && route.path.length > 1) {
                this.ctx.save();
                
                // Draw route path with animated dashes - color based on activity
                const routeActive = fromTerritory.armySize > 10; // Route is active if source has armies
                if (routeActive) {
                    this.ctx.strokeStyle = '#00ffff'; // Bright cyan for active routes
                    this.ctx.globalAlpha = 0.9;
                } else {
                    this.ctx.strokeStyle = '#006666'; // Dimmed cyan for inactive routes
                    this.ctx.globalAlpha = 0.5;
                }
                this.ctx.lineWidth = 3;
                
                // Calculate direction-based animation offset
                const fromPos = route.path[0];
                const toPos = route.path[route.path.length - 1];
                const direction = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
                
                // Animate dashes flowing in the direction of ship movement
                const animationOffset = (Date.now() * 0.02) % 20;
                this.ctx.setLineDash([8, 12]);
                this.ctx.lineDashOffset = -animationOffset;
                
                // Draw path segments
                for (let i = 0; i < route.path.length - 1; i++) {
                    const current = route.path[i];
                    const next = route.path[i + 1];
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(current.x, current.y);
                    this.ctx.lineTo(next.x, next.y);
                    this.ctx.stroke();
                }
                
                this.ctx.restore();
            }
        });
    }

    /** Render drag preview when creating supply routes */
    renderDragPreview() {
        // Show drag preview when creating supply route
        if (this.game.isDraggingForSupplyRoute && this.game.dragStart) {
            const worldPos = this.camera.screenToWorld(this.game.mousePos.x, this.game.mousePos.y);
            const targetTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
            
            this.ctx.save();
            
            // Color-coded preview based on target validity
            if (targetTerritory && targetTerritory.ownerId === this.humanPlayer?.id && 
                targetTerritory.id !== this.game.dragStart.id) {
                this.ctx.strokeStyle = '#00ff00'; // Green for valid supply route target
                this.ctx.lineWidth = 3;
            } else {
                this.ctx.strokeStyle = '#ffff00'; // Yellow for neutral/unknown target
                this.ctx.lineWidth = 2;
            }
            
            this.ctx.globalAlpha = 0.8;
            this.ctx.setLineDash([5, 5]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.game.dragStart.x, this.game.dragStart.y);
            this.ctx.lineTo(worldPos.x, worldPos.y);
            this.ctx.stroke();
            
            this.ctx.restore();
        }
    }

    /** Render proportional fleet control UI with radial percentage indicator */
    renderProportionalDragUI() {
        if (!this.game.isProportionalDrag || !this.game.proportionalDragStart) return;
        
        this.ctx.save();
        
        const territory = this.game.proportionalDragStart.territory;
        const worldPos = this.camera.screenToWorld(this.game.mousePos.x, this.game.mousePos.y);
        const targetTerritory = this.game.findTerritoryAt(worldPos.x, worldPos.y);
        
        // Draw radial percentage indicator around source territory
        const radius = territory.radius + 15;
        const percentage = this.game.fleetPercentage;
        
        // Background circle
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.arc(territory.x, territory.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Percentage arc
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (percentage * Math.PI * 2);
        
        // Color based on percentage
        let color = '#44ff44'; // Green for low
        if (percentage > 0.6) color = '#ffaa44'; // Orange for medium
        if (percentage > 0.8) color = '#ff4444'; // Red for high
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.arc(territory.x, territory.y, radius, startAngle, endAngle);
        this.ctx.stroke();
        
        // Draw drag line to target
        if (targetTerritory) {
            // Color based on action type
            if (targetTerritory.isColonizable) {
                this.ctx.strokeStyle = '#ffff44'; // Yellow for probe
            } else if (targetTerritory.ownerId === this.humanPlayer?.id) {
                this.ctx.strokeStyle = '#44ff44'; // Green for transfer
            } else {
                this.ctx.strokeStyle = '#ff4444'; // Red for attack
            }
            
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.8;
            this.ctx.setLineDash([]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(territory.x, territory.y);
            this.ctx.lineTo(targetTerritory.x, targetTerritory.y);
            this.ctx.stroke();
        }
        
        // Text display showing fleet allocation
        const shipsToSend = Math.floor(territory.armySize * percentage);
        const shipsToKeep = territory.armySize - shipsToSend;
        
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const text = `Send: ${shipsToSend} / Keep: ${shipsToKeep}`;
        this.ctx.strokeText(text, territory.x, territory.y - 50);
        this.ctx.fillText(text, territory.x, territory.y - 50);
        
        this.ctx.restore();
    }

    /** Render transfer preview when hovering over targets */
    renderTransferPreview() {
        // Get input state from input handler
        const inputState = this.game.inputHandler ? this.game.inputHandler.getInputState() : {};
        const selectedTerritory = inputState.selectedTerritory;
        const hoveredTerritory = this.game.hoveredTerritory;
        
        if (!selectedTerritory || !hoveredTerritory || selectedTerritory === hoveredTerritory) return;
        if (selectedTerritory.ownerId !== this.humanPlayer?.id) return;
        
        this.ctx.save();
        
        // Calculate default transfer amount (50%)
        const transferAmount = Math.floor(selectedTerritory.armySize * 0.5);
        const keepAmount = selectedTerritory.armySize - transferAmount;
        
        // Color based on action type
        if (hoveredTerritory.isColonizable) {
            this.ctx.strokeStyle = '#ffff44'; // Yellow for probe
            this.ctx.fillStyle = 'rgba(255, 255, 68, 0.1)';
        } else if (hoveredTerritory.ownerId === this.humanPlayer?.id) {
            this.ctx.strokeStyle = '#44ff44'; // Green for transfer
            this.ctx.fillStyle = 'rgba(68, 255, 68, 0.1)';
        } else {
            this.ctx.strokeStyle = '#ff4444'; // Red for attack
            this.ctx.fillStyle = 'rgba(255, 68, 68, 0.1)';
        }
        
        // Highlight target territory border
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = 0.8;
        this.ctx.beginPath();
        this.ctx.arc(hoveredTerritory.x, hoveredTerritory.y, hoveredTerritory.radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.fill();
        
        // Display transfer information
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        let actionText = '';
        if (hoveredTerritory.isColonizable) {
            actionText = `Probe (Cost: 10)`;
        } else if (hoveredTerritory.ownerId === this.humanPlayer?.id) {
            actionText = `Send: ${transferAmount} / Keep: ${keepAmount}`;
        } else {
            actionText = `Attack: ${transferAmount} armies`;
        }
        
        this.ctx.strokeText(actionText, hoveredTerritory.x, hoveredTerritory.y + 40);
        this.ctx.fillText(actionText, hoveredTerritory.x, hoveredTerritory.y + 40);
        
        this.ctx.restore();
    }

    /** Main entry point: render all supply route related UI */
    renderAll(lodLevel) {
        // Render supply routes for operational and tactical view
        if (lodLevel >= 2) {
            this.renderSupplyRoutes();
        }
        
        // Always render UI elements (not affected by LOD)
        this.renderDragPreview();
        this.renderProportionalDragUI();
        this.renderTransferPreview();
    }
}