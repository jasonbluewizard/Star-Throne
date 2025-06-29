export class Territory {
    constructor(id, x, y, radius = 25, isColonizable = false) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.neighbors = [];
        this.hiddenNeighbors = []; // Connections revealed after colonization
        this.ownerId = null; // null for neutral, or player ID
        this.armySize = 0;
        this.isColonizable = isColonizable; // Special planets requiring probe colonization
        
        // Visual properties
        this.baseColor = '#444444';
        this.neutralColor = isColonizable ? '#222222' : '#666666'; // Much darker for colonizable
        this.strokeColor = isColonizable ? '#444444' : '#888888'; // Different stroke for colonizable
        
        // Animation
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.lastArmyGeneration = 0;
        this.armyGenerationRate = 2000; // Generate army every 2 seconds
        
        // Combat flash effect
        this.combatFlashTime = 0;
        this.combatFlashDuration = 800; // Flash for 800ms
    }
    
    addNeighbor(territoryId) {
        if (!this.neighbors.includes(territoryId)) {
            this.neighbors.push(territoryId);
        }
    }
    
    addHiddenNeighbor(territoryId) {
        if (!this.hiddenNeighbors.includes(territoryId)) {
            this.hiddenNeighbors.push(territoryId);
        }
    }
    
    revealConnections() {
        // Move hidden connections to visible neighbors when colonized
        this.neighbors.push(...this.hiddenNeighbors);
        this.hiddenNeighbors = [];
        this.isColonizable = false; // No longer colonizable
    }
    
    isNeutral() {
        return this.ownerId === null;
    }
    
    triggerCombatFlash() {
        this.combatFlashTime = Date.now();
    }
    
    generateArmies(deltaTime, player, gameSpeed = 1.0) {
        // Neutral territories have fixed army sizes and don't generate armies
        if (this.ownerId === null) return;
        
        // Apply game speed multiplier to army generation timing
        const speedAdjustedDelta = deltaTime * gameSpeed;
        this.lastArmyGeneration += speedAdjustedDelta;
        
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
        
        // Add combat flash effect
        const currentTime = Date.now();
        if (this.combatFlashTime > 0 && currentTime - this.combatFlashTime < this.combatFlashDuration) {
            const flashProgress = (currentTime - this.combatFlashTime) / this.combatFlashDuration;
            const flashIntensity = Math.sin(flashProgress * Math.PI * 6) * (1 - flashProgress);
            if (flashIntensity > 0) {
                fillColor = this.adjustColorBrightness('#ff4444', 1 + flashIntensity * 0.8);
            }
        }
        
        // Add selection highlighting
        if (isSelected) {
            // Pulsing selection effect
            this.pulsePhase += 0.1;
            const pulseIntensity = Math.sin(this.pulsePhase) * 0.3 + 0.7;
            fillColor = this.adjustColorBrightness(fillColor, pulseIntensity);
        }
        
        // Optimize rendering with batch operations
        ctx.save();
        
        // Draw territory circle and border in single operation
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        // Optimize player lookup using direct access
        const player = this.ownerId ? players[this.ownerId] : null;
        const isHumanPlayer = player && player.type === 'human';
        
        // Set stroke properties based on state
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
        
        // Add extra ring for player territories
        if (this.ownerId !== null && player) {
            // Draw outer ring for all player territories
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            
            if (isHumanPlayer) {
                // Bright cyan outer ring for human player
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 6;
            } else {
                // Player color outer ring for AI players
                ctx.strokeStyle = player.color;
                ctx.lineWidth = 2;
                ctx.shadowColor = player.color;
                ctx.shadowBlur = 3;
            }
            
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        // Draw flag for human player territories
        if (isHumanPlayer) {
            this.renderHumanFlag(ctx);
        }
        
        // Draw army count for neutral territories or "?" for colonizable
        if (this.ownerId === null) {
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            
            if (this.isColonizable) {
                // Special styling for colonizable planets
                ctx.fillStyle = '#000000'; // Black text
                ctx.strokeStyle = '#ffff00'; // Yellow outline for contrast
                ctx.lineWidth = 2;
                
                const displayText = '?';
                ctx.strokeText(displayText, this.x, this.y + 4);
                ctx.fillText(displayText, this.x, this.y + 4);
                
                // Add pulsing border effect
                const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.003 + this.pulsePhase);
                ctx.strokeStyle = `rgba(255, 255, 0, ${pulseIntensity})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                // Regular neutral territory styling
                ctx.fillStyle = '#000000'; // Black text
                ctx.strokeStyle = '#ffffff'; // White outline for contrast
                ctx.lineWidth = 2;
                
                const displayText = this.armySize.toString();
                ctx.strokeText(displayText, this.x, this.y + 4);
                ctx.fillText(displayText, this.x, this.y + 4);
            }
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
        
        ctx.restore();
    }
    
    renderHumanFlag(ctx) {
        // Small flag pole and flag for human territories
        const flagX = this.x + this.radius * 0.6;
        const flagY = this.y - this.radius * 0.8;
        const poleHeight = this.radius * 0.7;
        const flagWidth = this.radius * 0.4;
        const flagHeight = this.radius * 0.25;
        
        // Draw flag pole
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(flagX, flagY);
        ctx.lineTo(flagX, flagY + poleHeight);
        ctx.stroke();
        
        // Draw flag
        ctx.fillStyle = '#00ffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(flagX, flagY);
        ctx.lineTo(flagX + flagWidth, flagY + flagHeight / 2);
        ctx.lineTo(flagX, flagY + flagHeight);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Add small star on flag
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(8, this.radius * 0.3)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('★', flagX + flagWidth * 0.4, flagY + flagHeight * 0.7);
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
