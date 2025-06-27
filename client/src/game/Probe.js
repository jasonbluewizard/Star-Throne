export class Probe {
    constructor(id, fromTerritory, toTerritory, playerId, playerColor) {
        this.id = id;
        this.fromTerritory = fromTerritory;
        this.toTerritory = toTerritory;
        this.playerId = playerId;
        this.playerColor = playerColor;
        
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
        
        // Probe moves slowly - 25 pixels per second (half speed)
        this.speed = 25;
        
        // Visual properties
        this.size = 4;
        this.trailPoints = [];
        this.maxTrailLength = 10;
    }
    
    update(deltaTime) {
        // Move towards target
        const moveDistance = this.speed * (deltaTime / 1000);
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
        // Draw trail
        if (this.trailPoints.length > 1) {
            ctx.strokeStyle = this.playerColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            
            ctx.beginPath();
            ctx.moveTo(this.trailPoints[0].x, this.trailPoints[0].y);
            for (let i = 1; i < this.trailPoints.length; i++) {
                ctx.lineTo(this.trailPoints[i].x, this.trailPoints[i].y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
        
        // Draw probe
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
    }
    
    getProgress() {
        return Math.min(this.traveledDistance / this.totalDistance, 1.0);
    }
}