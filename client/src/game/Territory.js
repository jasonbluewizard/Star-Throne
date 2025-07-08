export class Territory {
    constructor(id, x, y, radius = 25, isColonizable = false) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.neighbors = [];
        this.hiddenNeighbors = []; // Legacy - no longer used with new visibility system
        this.ownerId = null; // null for neutral, or player ID
        
        // All territories start with neutral garrisons (1-30 armies)
        this.armySize = Math.floor(Math.random() * 30) + 1;
        this.isColonizable = false; // No longer needed with new visibility system
        
        // Visual properties
        this.baseColor = '#444444';
        this.neutralColor = '#666666'; // Standard neutral color
        this.strokeColor = '#888888'; // Standard stroke for all territories
        
        // Animation
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.lastArmyGeneration = 0;
        this.armyGenerationRate = 3000; // Generate army every 3 seconds (matches GAME_CONSTANTS)
        
        // Combat flash effect
        this.combatFlashTime = 0;
        this.combatFlashDuration = 800; // Flash for 800ms
        
        // Probe launch visual feedback
        this.probeFlashTime = 0;
        this.probeFlashDuration = 1000; // Flash for 1 second
        this.floatingText = null; // For floating "-10" text
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
        console.log(`⚡ FLASH TRIGGERED: Territory ${this.id} combat flash set to ${this.combatFlashTime}`);
    }
    
    // triggerProbeFlash disabled (no probes active)
    // triggerProbeFlash() {
    //     this.probeFlashTime = Date.now();
    //     this.floatingText = {
    //         text: '-10',
    //         startTime: Date.now(),
    //         duration: 1000,
    //         startY: this.y - this.radius - 10,
    //         color: '#ff4444'
    //     };
    // }
    
    generateArmies(deltaTime, player, gameSpeed = 1.0, game = null) {
        // Neutral territories have fixed army sizes and don't generate armies
        if (this.ownerId === null) return;
        
        // Don't generate armies until a few seconds after game start to prevent initialization issues
        if (game && game.gameStartTime && (Date.now() - game.gameStartTime) < 5000) {
            return;
        }
        
        // Apply game speed multiplier to army generation timing
        const speedAdjustedDelta = deltaTime * gameSpeed;
        this.lastArmyGeneration += speedAdjustedDelta;
        
        // Calculate generation rate with discovery bonuses and tech bonuses
        let effectiveGenerationRate = this.armyGenerationRate;
        
        // Apply production tech bonus: +10% per production tech level
        if (player && player.tech && player.tech.production > 0) {
            effectiveGenerationRate *= (1 + player.tech.production * 0.1);
        }
        
        // Apply planet-specific bonuses
        if (this.discoveryBonus === 'factory') {
            effectiveGenerationRate *= 0.5; // 200% speed (half the time)
        } else if (this.discoveryBonus === 'minerals') {
            effectiveGenerationRate *= 0.67; // 150% speed
        } else if (this.discoveryBonus === 'void_storm') {
            effectiveGenerationRate *= 1.33; // 75% speed
        }
        
        // Apply empire-wide nanotech bonus
        if (game && game.discoveries && game.discoveries.precursorNanotech > 0) {
            const nanotechBonus = 1 + (game.discoveries.precursorNanotech * 0.1);
            effectiveGenerationRate /= nanotechBonus;
        }
        
        if (this.lastArmyGeneration >= effectiveGenerationRate) {
            const armiesGenerated = Math.floor(this.lastArmyGeneration / effectiveGenerationRate);
            this.lastArmyGeneration = this.lastArmyGeneration % effectiveGenerationRate;
            
            // Check if this territory has an active supply route
            if (game && game.supplySystem && game.supplySystem.isSupplySource(this.id)) {
                const destinationId = game.supplySystem.getSupplyDestination(this.id);
                const destinationTerritory = game.gameMap.territories[destinationId];
                
                if (destinationTerritory && destinationTerritory.ownerId === this.ownerId) {
                    // Redirect army generation to destination
                    destinationTerritory.armySize += armiesGenerated;
                    // Supply route redirection (logging disabled for cleaner console output)
                    
                    // Visual feedback disabled to prevent text spam on heavily reinforced territories
                } else {
                    // Route broken, generate locally
                    this.armySize += armiesGenerated;
                }
            } else {
                // Normal army generation
                this.armySize += armiesGenerated;
            }
            
            if (player) {
                player.totalArmies += armiesGenerated;
            }
        }
    }
    
    render(ctx, players, selectedTerritory, gameData, hoveredTerritory = null) {
        const isSelected = selectedTerritory && selectedTerritory.id === this.id;
        const isHovered = hoveredTerritory && hoveredTerritory.id === this.id;
        
        // Determine territory color
        let fillColor = this.neutralColor;
        if (this.ownerId !== null && players[this.ownerId]) {
            fillColor = players[this.ownerId].color;
        }
        
        // Add home system flashing effect for human player
        if (gameData && gameData.humanPlayer && this.ownerId === gameData.humanPlayer.id && 
            gameData.homeSystemFlashStart && gameData.humanPlayer.territories.includes(this.id)) {
            const currentTime = Date.now();
            const elapsed = currentTime - gameData.homeSystemFlashStart;
            
            if (elapsed < gameData.homeSystemFlashDuration) {
                // Flash every 300ms for 3 seconds
                const flashCycle = Math.floor(elapsed / 300) % 2;
                if (flashCycle === 1) {
                    fillColor = '#ffffff'; // Flash to white
                }
            }
        }
        
        // Add combat flash effect (applies to all territories including neutral)
        const currentTime = Date.now();
        if (this.combatFlashTime > 0 && currentTime - this.combatFlashTime < this.combatFlashDuration) {
            const flashProgress = (currentTime - this.combatFlashTime) / this.combatFlashDuration;
            const flashIntensity = Math.sin(flashProgress * Math.PI * 6) * (1 - flashProgress);
            if (flashIntensity > 0 && this.combatFlashColor) {
                // Use attacker's color for combat flash
                fillColor = this.combatFlashColor;
                if (Math.random() < 0.01) { // Log occasionally to avoid spam
                    console.log(`🎨 FLASH RENDER: Territory ${this.id} flashing ${this.combatFlashColor}, intensity: ${flashIntensity.toFixed(2)}`);
                }
            } else if (flashIntensity > 0) {
                // Fallback to red if no color specified
                fillColor = this.adjustColorBrightness('#ff4444', 1 + flashIntensity * 0.8);
                if (Math.random() < 0.01) { // Log occasionally to avoid spam
                    console.log(`🎨 FLASH RENDER: Territory ${this.id} flashing RED fallback, intensity: ${flashIntensity.toFixed(2)}`);
                }
            }
        }
        
        // Add selection highlighting
        if (isSelected) {
            // Pulsing selection effect
            this.pulsePhase += 0.1;
            const pulseIntensity = Math.sin(this.pulsePhase) * 0.3 + 0.7;
            fillColor = this.adjustColorBrightness(fillColor, pulseIntensity);
        }
        
        // Add disconnected supply line pulsing (dim pulse for territories out of supply from throne)
        if (this.ownerId !== null && gameData?.isDisconnectedFromThrone?.(this.id)) {
            this.pulsePhase += 0.05; // Slower pulse for disconnected territories
            const disconnectedPulse = Math.sin(this.pulsePhase) * 0.15 + 0.4; // Dimmer pulse range (25%-55%)
            fillColor = this.adjustColorBrightness(fillColor, disconnectedPulse);
        }
        
        // Optimize rendering with batch operations
        ctx.save();
        
        // FOG OF WAR: Check if this is a mysterious territory
        const humanPlayerId = gameData?.humanPlayer?.id;
        const isNeutralMystery = this.ownerId === null && !this.neighbors.some(neighborId => {
            const neighbor = gameData?.gameMap?.territories?.[neighborId];
            return neighbor && neighbor.ownerId === humanPlayerId;
        });
        
        const isEnemyMystery = this.ownerId !== null && this.ownerId !== humanPlayerId && !this.neighbors.some(neighborId => {
            const neighbor = gameData?.gameMap?.territories?.[neighborId];
            return neighbor && neighbor.ownerId === humanPlayerId;
        });
        
        const isMysteriousTerritory = isNeutralMystery || isEnemyMystery;
        
        // Adjust rendering for mysterious territories
        const renderRadius = isMysteriousTerritory ? this.radius * 0.8 : this.radius;
        const renderAlpha = isMysteriousTerritory ? 0.6 : 1.0;
        
        // Add hover glow effect (reduced for mysterious territories)
        if (isHovered && !isSelected) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = isMysteriousTerritory ? 8 : 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        
        // Apply mystery transparency
        ctx.globalAlpha = renderAlpha;
        
        // Draw territory circle and border in single operation
        ctx.beginPath();
        ctx.arc(this.x, this.y, renderRadius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        // Clear shadow for subsequent rendering
        ctx.shadowBlur = 0;
        
        // Optimize player lookup using direct access
        const player = this.ownerId ? players[this.ownerId] : null;
        const isHumanPlayer = player && player.type === 'human';
        
        // Set stroke properties based on state
        if (isSelected) {
            // Pulsating selection outline
            const pulseIntensity = 0.7 + 0.3 * Math.sin(Date.now() * 0.005);
            ctx.strokeStyle = `rgba(255, 255, 255, ${pulseIntensity})`;
            ctx.lineWidth = 4;
        } else if (isHovered) {
            // Bright white hover outline
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
        } else if (isHumanPlayer) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = 1;
        }
        ctx.stroke();
        
        // Action confirmation flash
        if (this.lastActionFlash && (currentTime - this.lastActionFlash) < 300) {
            const flashProgress = (currentTime - this.lastActionFlash) / 300;
            const flashIntensity = 1 - flashProgress;
            ctx.strokeStyle = `rgba(0, 255, 0, ${flashIntensity})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        
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
        
        // Draw crown for throne star territories (SHOW ALL CROWNS)
        if (this.isThronestar && this.ownerId !== null) {
            this.renderCrown(ctx);
        }
        
        // Draw factory icon for Precursor Factory discoveries
        if (this.hasFactory) {
            this.renderFactoryIcon(ctx);
        }
        
        // Draw explosion animation for failed probes
        if (this.explosionTime && Date.now() - this.explosionTime < this.explosionDuration) {
            this.renderExplosion(ctx);
        }
        
        // Draw army count for neutral territories - hide only if in nebula
        if (this.ownerId === null) {
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            
            // Check if territory is inside a nebula (hide fleet count if so)
            const isInNebula = gameData?.gameMap?.isInNebula?.(this.x, this.y, 15) || false;
            
            if (isInNebula) {
                // Neutral territory in nebula - show purple question mark
                ctx.fillStyle = '#9966ff'; // Purple text for nebula mystery
                ctx.strokeStyle = 'rgba(153, 102, 255, 0.8)'; // Purple outline
                ctx.lineWidth = 2;
                ctx.font = 'bold 16px Arial';
                
                const displayText = '?';
                ctx.strokeText(displayText, this.x, this.y + 4);
                ctx.fillText(displayText, this.x, this.y + 4);
            } else {
                // Neutral territory outside nebula - show army count normally
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
        
        // Draw army count for owned territories - ALWAYS show player's own fleet counts
        if (this.ownerId !== null) {
            const player = players[this.ownerId];
            if (player) {
                const humanPlayerId = gameData?.humanPlayer?.id;
                const isPlayerOwned = this.ownerId === humanPlayerId;
                const isInNebula = gameData?.gameMap?.isInNebula?.(this.x, this.y, 15) || false;
                
                // Always show fleet counts for player's own territories, even in nebulas
                if (isPlayerOwned || !isInNebula) {
                    // Show army count normally for player territories or non-nebula territories
                    // Removed unused probe flash variable (leftover variable cleanup)
                    let textColor = '#000000'; // Default black text
                    // if (isProbeFlashing) { ... } // Skip probe flash color change (always default)
                    
                    ctx.fillStyle = textColor;
                    ctx.strokeStyle = '#ffffff'; // White outline for better readability
                    ctx.lineWidth = 2;
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    
                    let displayText = this.armySize.toString();
                    
                    // Add black dot indicator for reinforcing stars
                    if (window.game?.supplySystem?.isSupplySource(this.id)) {
                        displayText = `● ${displayText}`;
                    }
                    
                    ctx.strokeText(displayText, this.x, this.y + 4);
                    ctx.fillText(displayText, this.x, this.y + 4);
                } else {
                    // Enemy territory in nebula - show purple question mark
                    ctx.fillStyle = '#9966ff'; // Purple text for nebula mystery
                    ctx.strokeStyle = 'rgba(153, 102, 255, 0.8)'; // Purple outline
                    ctx.lineWidth = 2;
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    
                    const displayText = '?';
                    ctx.strokeText(displayText, this.x, this.y + 4);
                    ctx.fillText(displayText, this.x, this.y + 4);
                }
            }
        }
        
        // Draw floating text (probe-related floating text disabled)
        if (this.floatingText && !this.floatingText.text.includes('-10')) {
            const currentTime = Date.now();
            const elapsed = currentTime - this.floatingText.startTime;
            
            if (elapsed < this.floatingText.duration) {
                const progress = elapsed / this.floatingText.duration;
                const alpha = 1 - progress;
                const yOffset = progress * 30; // Float upward
                
                ctx.fillStyle = `rgba(255, 68, 68, ${alpha})`;
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(
                    this.floatingText.text,
                    this.x,
                    this.floatingText.startY - yOffset
                );
            } else {
                this.floatingText = null; // Remove when done
            }
        }
        
        // Highlight potential targets if this territory is selected
        if (isSelected && this.ownerId !== null) {
            this.renderPotentialTargets(ctx, players);
        }
        
        // Restore alpha for subsequent rendering
        ctx.globalAlpha = 1.0;
        
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
    
    renderCrown(ctx) {
        // Crown positioned above the planet
        const crownX = this.x;
        const crownY = this.y - this.radius - 15;
        const crownSize = Math.max(12, this.radius * 0.8);
        
        ctx.save();
        
        // Crown shadow for visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = `bold ${crownSize + 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('👑', crownX + 1, crownY + 1);
        
        // Main crown - golden color
        ctx.fillStyle = '#FFD700';
        ctx.font = `bold ${crownSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('👑', crownX, crownY);
        
        ctx.restore();
    }
    
    renderFactoryIcon(ctx) {
        // Factory icon positioned to the right of the planet
        const factoryX = this.x + this.radius + 10;
        const factoryY = this.y;
        const factorySize = Math.max(10, this.radius * 0.6);
        
        ctx.save();
        
        // Factory shadow for visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = `bold ${factorySize + 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('🏭', factoryX + 1, factoryY + 1);
        
        // Main factory icon - orange/industrial color
        ctx.fillStyle = '#FF8C00';
        ctx.font = `bold ${factorySize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('🏭', factoryX, factoryY);
        
        ctx.restore();
    }
    
    renderExplosion(ctx) {
        const elapsed = Date.now() - this.explosionTime;
        const progress = elapsed / this.explosionDuration;
        
        if (progress >= 1) return; // Animation finished
        
        ctx.save();
        
        // Multiple explosion rings expanding outward
        const maxRadius = this.radius * 3;
        const numRings = 3;
        
        for (let i = 0; i < numRings; i++) {
            const ringProgress = Math.max(0, progress - i * 0.2);
            const radius = ringProgress * maxRadius;
            const opacity = Math.max(0, 1 - ringProgress * 2);
            
            if (radius > 0 && opacity > 0) {
                // Orange/red explosion colors
                const colors = ['#ff4444', '#ff8800', '#ffaa00'];
                ctx.strokeStyle = colors[i % colors.length];
                ctx.globalAlpha = opacity;
                ctx.lineWidth = Math.max(1, 4 - ringProgress * 3);
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        // Central flash effect
        if (progress < 0.3) {
            const flashOpacity = (0.3 - progress) / 0.3;
            ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity * 0.8})`;
            ctx.globalAlpha = flashOpacity;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
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
