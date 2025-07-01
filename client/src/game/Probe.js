export class Probe {
    constructor(id, fromTerritory, toTerritory, playerId, playerColor, gameSpeed = 1.0, gameMap = null, game = null) {
        this.id = id;
        this.fromTerritory = fromTerritory;
        this.toTerritory = toTerritory;
        this.playerId = playerId;
        this.playerColor = playerColor;
        this.gameMap = gameMap;
        this.game = game; // Reference to game for discovery bonuses
        
        // Position and movement
        this.x = fromTerritory.x;
        this.y = fromTerritory.y;
        this.targetX = toTerritory.x;
        this.targetY = toTerritory.y;
        
        // Calculate direction
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this.directionX = dx / distance;
        this.directionY = dy / distance;
        this.totalDistance = distance;
        this.traveledDistance = 0;
        
        // Apply game speed multiplier to probe movement
        this.baseSpeed = 25 * gameSpeed;
        this.speed = this.baseSpeed;
        
        // Visual properties
        this.size = 4;
        this.trailPoints = [];
        this.maxTrailLength = 10;
    }
    
    update(deltaTime) {
        // Check if probe is in a nebula and adjust speed
        let currentSpeed = this.baseSpeed;
        
        // Apply Precursor Drive speed bonus (human player only)
        if (this.game && this.game.humanPlayer && this.playerId === this.game.humanPlayer.id && 
            this.game.discoveries && this.game.discoveries.precursorDrive > 0) {
            const driveBonus = 1 + (this.game.discoveries.precursorDrive * 0.2);
            currentSpeed *= driveBonus;
        }
        
        if (this.gameMap && this.gameMap.isInNebula(this.x, this.y)) {
            currentSpeed = currentSpeed / 3; // Slow to 1/3 speed in nebulas (after applying drive bonus)
        }
        
        // Move towards target
        const moveDistance = currentSpeed * (deltaTime / 1000);
        this.x += this.directionX * moveDistance;
        this.y += this.directionY * moveDistance;
        this.traveledDistance += moveDistance;
        
        // Add to trail
        this.trailPoints.push({ x: this.x, y: this.y });
        if (this.trailPoints.length > this.maxTrailLength) {
            this.trailPoints.shift();
        }
        
        // Check if reached destination
        return this.traveledDistance >= this.totalDistance;
    }
    
    render(ctx) {
        // Check if probe is in nebula for fade effect
        const inNebula = this.gameMap && this.gameMap.isInNebula(this.x, this.y);
        let baseOpacity = 1.0;
        
        if (inNebula) {
            // Create pulsing fade effect when in nebula
            const fadePhase = Date.now() * 0.003; // Slow pulsing
            baseOpacity = 0.3 + 0.4 * (Math.sin(fadePhase) + 1) * 0.5; // Fade between 0.3 and 0.7
        }
        
        // Draw trail
        if (this.trailPoints.length > 1) {
            ctx.strokeStyle = this.playerColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = baseOpacity * 0.5;
            
            ctx.beginPath();
            ctx.moveTo(this.trailPoints[0].x, this.trailPoints[0].y);
            for (let i = 1; i < this.trailPoints.length; i++) {
                ctx.lineTo(this.trailPoints[i].x, this.trailPoints[i].y);
            }
            ctx.stroke();
        }
        
        // Draw probe with fade effect
        ctx.globalAlpha = baseOpacity;
        ctx.fillStyle = this.playerColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw direction indicator
        const indicatorLength = 8;
        const endX = this.x + this.directionX * indicatorLength;
        const endY = this.y + this.directionY * indicatorLength;
        
        ctx.strokeStyle = this.playerColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Reset opacity
        ctx.globalAlpha = 1.0;
    }
    
    getProgress() {
        return Math.min(this.traveledDistance / this.totalDistance, 1.0);
    }
}