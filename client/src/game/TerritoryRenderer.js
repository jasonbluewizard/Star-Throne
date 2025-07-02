// TerritoryRenderer.js
export default class TerritoryRenderer {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.ctx = game.ctx;
        this.camera = game.camera;
        
        // References to game state
        this.gameMap = game.gameMap;
        this.players = game.players;
        this.humanPlayer = game.humanPlayer;
        
        // Performance tracking
        this.visibleTerritories = [];
        this.lastCullingUpdate = 0;
    }

    /** Update list of on-screen territories using frustum culling. */
    updateVisibleTerritories() {
        // Use existing game visibility system
        this.game.updateVisibleTerritories();
        this.visibleTerritories = this.game.visibleTerritories;
    }

    /** Render all territory connections (warp lanes) behind the planets. */
    renderConnections() {
        this.ctx.lineWidth = 2;
        for (const territory of this.visibleTerritories) {
            territory.connections.forEach(connId => {
                const other = this.territories[connId];
                if (!other) return;
                
                // Only draw if the connected territory is also on-screen
                if (!this.camera.isVisible(other.x, other.y, 50)) return;
                
                // Determine connection color: same-owner color or gray
                const player1 = territory.owner ? this.players.find(p => p.id === territory.owner) : null;
                const player2 = other.owner ? this.players.find(p => p.id === other.owner) : null;
                
                this.ctx.strokeStyle = (player1 && player2 && player1.id === player2.id) 
                                       ? player1.color 
                                       : '#666666';
                this.ctx.globalAlpha = 0.6;
                this.ctx.beginPath();
                this.ctx.moveTo(territory.x, territory.y);
                this.ctx.lineTo(other.x, other.y);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            });
        }
    }

    /** Render a single territory (planet), its armies, ownership and special markers. */
    renderTerritory(territory) {
        // Draw base planet (circle or sprite) using territory's own render method
        territory.render(this.ctx, this.camera, this.game.selectedTerritory);

        // Draw owner-specific visuals or neutral visuals
        if (territory.owner !== null && territory.owner !== undefined) {
            // Owned territory
            const player = this.players.find(p => p.id === territory.owner);
            if (player) {
                this.renderTerritoryOwner(territory, player);
            }
        } else {
            // Neutral/unclaimed territory
            this.renderNeutralTerritory(territory);
        }

        // Draw throne crown icon if this is a throne star territory
        if (territory.isThroneStar) {
            this.renderThroneCrown(territory);
        }

        // Draw selection highlight
        if (this.game.selectedTerritory && this.game.selectedTerritory.id === territory.id) {
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(territory.x, territory.y, 26, 0, 2 * Math.PI);
            this.ctx.stroke();
            this.ctx.lineWidth = 1;
        }
    }

    /** Render territory owner-specific visuals */
    renderTerritoryOwner(territory, player) {
        // Special effects for human players
        if (player.type === 'human') {
            // Cyan glow effect for human player territories
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 3;
            this.ctx.shadowColor = '#00FFFF';
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath();
            this.ctx.arc(territory.x, territory.y, 24, 0, 2 * Math.PI);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            this.ctx.lineWidth = 1;
            
            // Cyan flag marker for human territories
            this.renderHumanFlag(territory);
        }
        
        // Draw army count for owned territory
        this.drawArmyCount(territory, '#000000');
    }

    /** Render neutral territory visuals */
    renderNeutralTerritory(territory) {
        // If colonizable (undiscovered), mark with a yellow "?"
        if (territory.isColonizable) {
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillStyle = 'yellow';
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.strokeText('?', territory.x, territory.y);
            this.ctx.fillText('?', territory.x, territory.y);
        } else {
            // Draw army count for neutral territories
            this.drawArmyCount(territory, 'white');
        }
    }

    /** Render throne crown icon */
    renderThroneCrown(territory) {
        // Draw golden crown above territory
        this.ctx.fillStyle = '#FFD700';
        this.ctx.strokeStyle = '#B8860B';
        this.ctx.lineWidth = 1;
        
        // Simple crown shape
        const crownY = territory.y - 35;
        this.ctx.beginPath();
        this.ctx.moveTo(territory.x - 8, crownY + 8);
        this.ctx.lineTo(territory.x - 6, crownY);
        this.ctx.lineTo(territory.x - 3, crownY + 4);
        this.ctx.lineTo(territory.x, crownY - 2);
        this.ctx.lineTo(territory.x + 3, crownY + 4);
        this.ctx.lineTo(territory.x + 6, crownY);
        this.ctx.lineTo(territory.x + 8, crownY + 8);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }

    /** Render cyan flag for human territories */
    renderHumanFlag(territory) {
        const flagX = territory.x + 18;
        const flagY = territory.y - 18;
        
        // Flag pole
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(flagX, flagY);
        this.ctx.lineTo(flagX, flagY + 15);
        this.ctx.stroke();
        
        // Flag
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.beginPath();
        this.ctx.moveTo(flagX, flagY);
        this.ctx.lineTo(flagX + 12, flagY + 3);
        this.ctx.lineTo(flagX + 8, flagY + 6);
        this.ctx.lineTo(flagX + 12, flagY + 9);
        this.ctx.lineTo(flagX, flagY + 12);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Star on flag
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 8px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('★', flagX + 6, flagY + 6);
    }

    /** Helper to draw the army count number with outline. */
    drawArmyCount(territory, fillColor) {
        const count = territory.armyCount.toString();
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // White outline for readability
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(count, territory.x, territory.y);
        
        // Filled text
        this.ctx.fillStyle = fillColor;
        this.ctx.fillText(count, territory.x, territory.y);
        this.ctx.lineWidth = 1;
    }

    /** Render special effects (combat flashes, etc.) */
    renderSpecialEffects() {
        for (const territory of this.visibleTerritories) {
            // Combat flash effect
            if (territory.isFlashing) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.5;
                this.ctx.fillStyle = '#FF0000';
                this.ctx.beginPath();
                this.ctx.arc(territory.x, territory.y, 28, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.restore();
            }
        }
    }

    /** Main entry point: update culling and draw everything. */
    renderTerritories() {
        // Update which territories are visible (culling)
        this.updateVisibleTerritories();

        // Get current selected territory from input handler
        const inputState = this.game.inputHandler ? this.game.inputHandler.getInputState() : {};
        const selectedTerritory = inputState.selectedTerritory;

        // Render only visible territories using existing Territory.render method
        this.visibleTerritories.forEach(territory => {
            territory.render(this.ctx, this.players, selectedTerritory, {
                humanPlayer: this.humanPlayer,
                homeSystemFlashStart: this.game.homeSystemFlashStart,
                homeSystemFlashDuration: this.game.homeSystemFlashDuration
            }, this.game.hoveredTerritory);
        });
    }
}