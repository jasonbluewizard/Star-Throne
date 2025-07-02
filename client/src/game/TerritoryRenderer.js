export class TerritoryRenderer {
    constructor(game) {
        this.game = game;
        
        // Viewport culling optimization
        this.visibleTerritories = [];
        this.lastVisibilityUpdate = 0;
        this.visibilityUpdateInterval = 100; // Update every 100ms
        
        // Level of Detail (LOD) thresholds
        this.lodThresholds = {
            detailed: 0.8,    // Show all details above 80% zoom
            simplified: 0.3,  // Simplified rendering 30-80% zoom
            minimal: 0.0      // Minimal rendering below 30% zoom
        };
        
        // Rendering batches for performance
        this.renderBatches = {
            territories: [],
            connections: [],
            armies: [],
            effects: []
        };
        
        // Pre-computed rendering data
        this.territoryDisplayCache = new Map();
        this.connectionCache = new Map();
    }

    // Update visible territories with viewport culling
    updateVisibleTerritories() {
        const now = Date.now();
        if (now - this.lastVisibilityUpdate < this.visibilityUpdateInterval) {
            return; // Skip update if too soon
        }
        
        this.lastVisibilityUpdate = now;
        this.visibleTerritories = [];
        
        if (!this.game.gameMap || !this.game.camera) return;
        
        const camera = this.game.camera;
        const padding = 100; // Extra padding for smooth scrolling
        
        // Calculate viewport bounds in world coordinates
        const viewLeft = camera.x - camera.width / (2 * camera.zoom) - padding;
        const viewRight = camera.x + camera.width / (2 * camera.zoom) + padding;
        const viewTop = camera.y - camera.height / (2 * camera.zoom) - padding;
        const viewBottom = camera.y + camera.height / (2 * camera.zoom) + padding;
        
        // Use spatial index for O(1) lookups if available
        if (this.game.gameMap.spatialIndex) {
            this.visibleTerritories = this.game.gameMap.getTerritoriesInBounds(
                viewLeft, viewTop, viewRight, viewBottom
            );
        } else {
            // Fallback to linear search
            for (const territory of Object.values(this.game.gameMap.territories)) {
                if (this.isTerritoryVisible(territory, viewLeft, viewRight, viewTop, viewBottom)) {
                    this.visibleTerritories.push(territory);
                }
            }
        }
    }

    // Check if territory is visible in viewport
    isTerritoryVisible(territory, left, right, top, bottom) {
        const radius = territory.radius || 25;
        return (territory.x + radius >= left && 
                territory.x - radius <= right &&
                territory.y + radius >= top && 
                territory.y - radius <= bottom);
    }

    // Get current Level of Detail based on zoom
    getCurrentLOD() {
        const zoom = this.game.camera.zoom;
        
        if (zoom >= this.lodThresholds.detailed) {
            return 'detailed';
        } else if (zoom >= this.lodThresholds.simplified) {
            return 'simplified'; 
        } else {
            return 'minimal';
        }
    }

    // Batch territories by rendering properties for efficient drawing
    batchTerritories() {
        this.renderBatches.territories = [];
        this.renderBatches.connections = [];
        this.renderBatches.armies = [];
        this.renderBatches.effects = [];
        
        const lod = this.getCurrentLOD();
        
        for (const territory of this.visibleTerritories) {
            // Batch territory rendering
            this.renderBatches.territories.push({
                territory,
                lod,
                screenPos: this.game.camera.worldToScreen(territory.x, territory.y),
                radius: territory.radius * this.game.camera.zoom
            });
            
            // Batch connections (only for detailed LOD)
            if (lod === 'detailed' && territory.neighbors) {
                for (const neighborId of territory.neighbors) {
                    const neighbor = this.game.gameMap.territories[neighborId];
                    if (neighbor && this.shouldRenderConnection(territory, neighbor)) {
                        this.renderBatches.connections.push({
                            from: territory,
                            to: neighbor,
                            fromScreen: this.game.camera.worldToScreen(territory.x, territory.y),
                            toScreen: this.game.camera.worldToScreen(neighbor.x, neighbor.y)
                        });
                    }
                }
            }
            
            // Batch army numbers (simplified and detailed LOD)
            if (lod !== 'minimal' && territory.armySize > 0) {
                this.renderBatches.armies.push({
                    territory,
                    screenPos: this.game.camera.worldToScreen(territory.x, territory.y),
                    armySize: territory.armySize
                });
            }
            
            // Batch visual effects
            if (territory.combatFlashTime > 0 || territory.probeFlashTime > 0) {
                this.renderBatches.effects.push({
                    territory,
                    screenPos: this.game.camera.worldToScreen(territory.x, territory.y),
                    radius: territory.radius * this.game.camera.zoom
                });
            }
        }
    }

    // Check if connection should be rendered
    shouldRenderConnection(territory1, territory2) {
        // Don't render duplicate connections
        const connectionKey = `${Math.min(territory1.id, territory2.id)}-${Math.max(territory1.id, territory2.id)}`;
        
        if (this.connectionCache.has(connectionKey)) {
            return false;
        }
        
        this.connectionCache.set(connectionKey, true);
        return true;
    }

    // Render all batched territories efficiently
    renderTerritories(ctx) {
        const lod = this.getCurrentLOD();
        
        // Group territories by color for batch rendering
        const colorGroups = new Map();
        
        for (const batch of this.renderBatches.territories) {
            const territory = batch.territory;
            const player = this.game.players.find(p => p.id === territory.ownerId);
            const color = player ? player.color : territory.neutralColor;
            
            if (!colorGroups.has(color)) {
                colorGroups.set(color, []);
            }
            colorGroups.get(color).push(batch);
        }
        
        // Render each color group in a single draw call
        for (const [color, batches] of colorGroups) {
            ctx.save();
            ctx.fillStyle = color;
            ctx.strokeStyle = this.getStrokeColor(color, lod);
            ctx.lineWidth = this.getLineWidth(lod);
            
            ctx.beginPath();
            for (const batch of batches) {
                const { screenPos, radius } = batch;
                
                if (lod === 'minimal') {
                    // Minimal LOD: Simple squares
                    ctx.rect(screenPos.x - radius/2, screenPos.y - radius/2, radius, radius);
                } else {
                    // Detailed/Simplified LOD: Circles
                    ctx.moveTo(screenPos.x + radius, screenPos.y);
                    ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
                }
            }
            
            ctx.fill();
            if (lod !== 'minimal') {
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // Render territory connections efficiently
    renderConnections(ctx) {
        if (this.renderBatches.connections.length === 0) return;
        
        const lod = this.getCurrentLOD();
        
        ctx.save();
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = Math.max(1, 2 * this.game.camera.zoom);
        ctx.globalAlpha = 0.6;
        
        ctx.beginPath();
        for (const connection of this.renderBatches.connections) {
            ctx.moveTo(connection.fromScreen.x, connection.fromScreen.y);
            ctx.lineTo(connection.toScreen.x, connection.toScreen.y);
        }
        ctx.stroke();
        ctx.restore();
        
        // Clear connection cache for next frame
        this.connectionCache.clear();
    }

    // Render army numbers with LOD optimization
    renderArmyNumbers(ctx) {
        if (this.renderBatches.armies.length === 0) return;
        
        const lod = this.getCurrentLOD();
        const fontSize = this.getFontSize(lod);
        
        ctx.save();
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        for (const batch of this.renderBatches.armies) {
            const { screenPos, armySize } = batch;
            const text = armySize.toString();
            
            // White outline for better visibility
            ctx.strokeText(text, screenPos.x, screenPos.y);
            ctx.fillText(text, screenPos.x, screenPos.y);
        }
        ctx.restore();
    }

    // Render visual effects (flashes, explosions)
    renderEffects(ctx) {
        if (this.renderBatches.effects.length === 0) return;
        
        const now = Date.now();
        
        ctx.save();
        for (const batch of this.renderBatches.effects) {
            const { territory, screenPos, radius } = batch;
            
            // Combat flash effect
            if (territory.combatFlashTime > 0) {
                const flashAge = now - territory.combatFlashTime;
                if (flashAge < territory.combatFlashDuration) {
                    const alpha = 1.0 - (flashAge / territory.combatFlashDuration);
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y, radius * 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            // Probe flash effect
            if (territory.probeFlashTime > 0) {
                const flashAge = now - territory.probeFlashTime;
                if (flashAge < territory.probeFlashDuration) {
                    const alpha = 1.0 - (flashAge / territory.probeFlashDuration);
                    ctx.globalAlpha = alpha * 0.6;
                    ctx.fillStyle = '#00ff00';
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y, radius * 1.1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }

    // Helper methods for LOD-based styling
    getStrokeColor(fillColor, lod) {
        if (lod === 'minimal') return fillColor;
        return '#ffffff';
    }

    getLineWidth(lod) {
        switch (lod) {
            case 'detailed': return Math.max(1, 2 * this.game.camera.zoom);
            case 'simplified': return Math.max(1, 1.5 * this.game.camera.zoom);
            case 'minimal': return 0;
            default: return 1;
        }
    }

    getFontSize(lod) {
        const baseSize = 14;
        const zoom = this.game.camera.zoom;
        
        switch (lod) {
            case 'detailed': return Math.max(10, baseSize * zoom);
            case 'simplified': return Math.max(8, baseSize * zoom * 0.8);
            case 'minimal': return Math.max(6, baseSize * zoom * 0.6);
            default: return baseSize;
        }
    }

    // Main render method
    render(ctx) {
        // Update visibility and batching
        this.updateVisibleTerritories();
        this.batchTerritories();
        
        // Render in optimized order
        this.renderConnections(ctx);
        this.renderTerritories(ctx);
        this.renderEffects(ctx);
        this.renderArmyNumbers(ctx);
    }

    // Get rendering statistics
    getStats() {
        return {
            visibleTerritories: this.visibleTerritories.length,
            totalTerritories: Object.keys(this.game.gameMap?.territories || {}).length,
            currentLOD: this.getCurrentLOD(),
            lastVisibilityUpdate: this.lastVisibilityUpdate,
            batchSizes: {
                territories: this.renderBatches.territories.length,
                connections: this.renderBatches.connections.length,
                armies: this.renderBatches.armies.length,
                effects: this.renderBatches.effects.length
            }
        };
    }

    // Reset caches
    reset() {
        this.visibleTerritories = [];
        this.territoryDisplayCache.clear();
        this.connectionCache.clear();
        this.renderBatches = {
            territories: [],
            connections: [],
            armies: [],
            effects: []
        };
    }
}