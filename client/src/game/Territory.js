export class Territory {
    constructor(id, x, y, radius = 25) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.neighbors = [];
        this.ownerId = null; // null for neutral, or player ID
        this.armySize = 0;
        
        // Visual properties
        this.baseColor = '#444444';
        this.neutralColor = '#666666';
        this.strokeColor = '#888888';
        
        // Animation
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.lastArmyGeneration = 0;
        this.armyGenerationRate = 2000; // Generate army every 2 seconds
    }
    
    addNeighbor(territoryId) {
        if (!this.neighbors.includes(territoryId)) {
            this.neighbors.push(territoryId);
        }
    }
    
    isNeutral() {
        return this.ownerId === null;
    }
    
    generateArmies(deltaTime, player) {
        if (this.ownerId === null) return;
        
        this.lastArmyGeneration += deltaTime;
        
        if (this.lastArmyGeneration >= this.armyGenerationRate) {
            const armiesGenerated = Math.floor(this.lastArmyGeneration / this.armyGenerationRate);
            this.armySize += armiesGenerated;
            this.lastArmyGeneration = this.lastArmyGeneration % this.armyGenerationRate;
            
            if (player) {
                player.totalArmies += armiesGenerated;
            }
        }
    }
    
    render(ctx, players, selectedTerritory) {
        const isSelected = selectedTerritory && selectedTerritory.id === this.id;
        
        // Determine territory color
        let fillColor = this.neutralColor;
        if (this.ownerId !== null && players[this.ownerId]) {
            fillColor = players[this.ownerId].color;
        }
        
        // Add selection highlighting
        if (isSelected) {
            // Pulsing selection effect
            this.pulsePhase += 0.1;
            const pulseIntensity = Math.sin(this.pulsePhase) * 0.3 + 0.7;
            fillColor = this.adjustColorBrightness(fillColor, pulseIntensity);
        }
        
        // Draw territory circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        // Draw border with special styling for human player
        const player = players.find(p => p.id === this.ownerId);
        const isHumanPlayer = player && player.type === 'human';
        
        if (isSelected) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
        } else if (isHumanPlayer) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = 1;
        }
        ctx.stroke();
        
        // Add extra glow for human player territories
        if (isHumanPlayer && !isSelected) {
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        // Draw territory ID (for debugging)
        if (isSelected) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`T${this.id}`, this.x, this.y - this.radius - 8);
        }
        
        // Highlight potential targets if this territory is selected
        if (isSelected && this.ownerId !== null) {
            this.renderPotentialTargets(ctx, players);
        }
    }
    
    renderPotentialTargets(ctx, players) {
        // Show attackable neighbors with red outline
        this.neighbors.forEach(neighborId => {
            const neighbor = this.gameMap?.territories[neighborId];
            if (neighbor && neighbor.ownerId !== this.ownerId) {
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(neighbor.x, neighbor.y, neighbor.radius + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
    }
    
    adjustColorBrightness(hex, factor) {
        if (hex.startsWith('#')) {
            hex = hex.slice(1);
        }
        
        const num = parseInt(hex, 16);
        const r = Math.min(255, Math.floor((num >> 16) * factor));
        const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) * factor));
        const b = Math.min(255, Math.floor((num & 0x0000FF) * factor));
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    getDistanceTo(otherTerritory) {
        const dx = this.x - otherTerritory.x;
        const dy = this.y - otherTerritory.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    isNeighborOf(otherTerritory) {
        return this.neighbors.includes(otherTerritory.id);
    }
    
    // Serialize territory data for network transmission (future multiplayer)
    serialize() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            radius: this.radius,
            neighbors: this.neighbors,
            ownerId: this.ownerId,
            armySize: this.armySize
        };
    }
    
    // Deserialize territory data from network (future multiplayer)
    static deserialize(data) {
        const territory = new Territory(data.id, data.x, data.y, data.radius);
        territory.neighbors = data.neighbors || [];
        territory.ownerId = data.ownerId;
        territory.armySize = data.armySize || 0;
        return territory;
    }
}
