import { GAME_CONSTANTS } from '../../../common/gameConstants';

export class TerritoryRenderer {
    constructor(game) {
        this.game = game;
        this.visibilityUpdateCounter = 0;
        this.lastVisibilityUpdate = 0;
        this.visibleTerritories = new Set();
    }

    // Main territory rendering method
    renderTerritories(ctx, camera, gameMap) {
        if (!gameMap || !gameMap.territories) return;

        // Update visible territories with throttling for performance
        const now = Date.now();
        if (now - this.lastVisibilityUpdate >= GAME_CONSTANTS.VISIBLE_TERRITORIES_UPDATE_INTERVAL_MS) {
            this.updateVisibleTerritories(camera, gameMap);
            this.lastVisibilityUpdate = now;
        }

        // Render only visible territories
        for (const territoryId of this.visibleTerritories) {
            const territory = gameMap.territories[territoryId];
            if (territory) {
                this.renderTerritory(ctx, territory, camera);
            }
        }

        // Render connections between territories
        this.renderConnections(ctx, camera, gameMap);
    }

    // Update which territories are visible in current viewport
    updateVisibleTerritories(camera, gameMap) {
        this.visibleTerritories.clear();
        
        const bounds = camera.getViewBounds();
        const margin = GAME_CONSTANTS.TERRITORY_VISIBILITY_PADDING;
        
        const territories = Object.values(gameMap.territories);
        
        for (let i = 0; i < territories.length; i++) {
            const territory = territories[i];
            if (territory.x + territory.radius >= bounds.left - margin &&
                territory.x - territory.radius <= bounds.right + margin &&
                territory.y + territory.radius >= bounds.top - margin &&
                territory.y - territory.radius <= bounds.bottom + margin) {
                this.visibleTerritories.add(territory.id);
            }
        }
    }

    // Render individual territory
    renderTerritory(ctx, territory, camera) {
        const screenPos = camera.worldToScreen(territory.x, territory.y);
        const radius = territory.radius * camera.zoom;

        ctx.save();

        // Territory circle
        if (territory.isColonizable) {
            this.renderColonizableTerritory(ctx, screenPos, radius, territory);
        } else {
            this.renderOwnedTerritory(ctx, screenPos, radius, territory);
        }

        // Army count text
        this.renderArmyCount(ctx, screenPos, territory, camera);

        // Throne star crown
        if (territory.isThronestar) {
            this.renderThroneStarCrown(ctx, screenPos, radius);
        }

        // Selection indicator
        if (this.game.selectedTerritory && this.game.selectedTerritory.id === territory.id) {
            this.renderSelectionIndicator(ctx, screenPos, radius);
        }

        // Combat flash effect
        if (territory.combatFlashTime > 0) {
            this.renderCombatFlash(ctx, screenPos, radius, territory);
        }

        // Probe flash effect
        if (territory.probeFlashTime > 0) {
            this.renderProbeFlash(ctx, screenPos, radius, territory);
        }

        // Floating text (damage numbers, etc.)
        if (territory.floatingText) {
            this.renderFloatingText(ctx, screenPos, territory.floatingText);
        }

        // Factory icon for precursor factory discoveries
        if (this.hasFactoryDiscovery(territory)) {
            this.renderFactoryIcon(ctx, screenPos, radius);
        }

        ctx.restore();
    }

    // Render colonizable (unexplored) territory
    renderColonizableTerritory(ctx, screenPos, radius, territory) {
        // Dark background circle
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing effect for unexplored planets
        const pulseIntensity = 0.5 + 0.3 * Math.sin(Date.now() * 0.003 + territory.pulsePhase);
        ctx.fillStyle = `rgba(255, 255, 0, ${pulseIntensity * 0.6})`;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Render owned territory
    renderOwnedTerritory(ctx, screenPos, radius, territory) {
        const player = this.game.players.find(p => p.id === territory.ownerId);
        
        if (player) {
            // Player-colored circle
            ctx.fillStyle = player.color;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Human player special effects
            if (player.type === 'human') {
                this.renderHumanPlayerEffects(ctx, screenPos, radius);
            }

            // Border
            ctx.strokeStyle = player.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Neutral territory
            ctx.fillStyle = territory.neutralColor || '#444444';
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Render special effects for human player territories
    renderHumanPlayerEffects(ctx, screenPos, radius) {
        // Cyan glow effect
        const glowGradient = ctx.createRadialGradient(
            screenPos.x, screenPos.y, radius * 0.5,
            screenPos.x, screenPos.y, radius * 1.5
        );
        glowGradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
        glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing selection effect for human territories
        const currentTime = Date.now();
        const pulsePhase = (currentTime * 0.003) % (Math.PI * 2);
        const pulseIntensity = 0.7 + 0.3 * Math.sin(pulsePhase);
        
        ctx.strokeStyle = `rgba(0, 255, 255, ${pulseIntensity})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius + 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Render army count text
    renderArmyCount(ctx, screenPos, territory, camera) {
        const fontSize = Math.max(12, 16 * camera.zoom);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (territory.isColonizable) {
            // Question mark for unexplored
            ctx.fillStyle = 'black';
            ctx.fillText('?', screenPos.x + 1, screenPos.y + 1); // Shadow
            ctx.fillStyle = 'yellow';
            ctx.fillText('?', screenPos.x, screenPos.y);
        } else {
            // Army count with high contrast
            const armyText = territory.armySize.toString();
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(armyText, screenPos.x, screenPos.y);
            ctx.fillText(armyText, screenPos.x, screenPos.y);
        }
    }

    // Render throne star crown icon
    renderThroneStarCrown(ctx, screenPos, radius) {
        const crownSize = radius * 0.6;
        const crownY = screenPos.y - radius - crownSize * 0.7;

        ctx.fillStyle = '#FFD700'; // Gold color
        ctx.strokeStyle = '#FFA500'; // Orange outline
        ctx.lineWidth = 2;

        // Simple crown shape
        ctx.beginPath();
        ctx.moveTo(screenPos.x - crownSize, crownY + crownSize);
        ctx.lineTo(screenPos.x - crownSize * 0.6, crownY);
        ctx.lineTo(screenPos.x - crownSize * 0.2, crownY + crownSize * 0.4);
        ctx.lineTo(screenPos.x, crownY - crownSize * 0.2);
        ctx.lineTo(screenPos.x + crownSize * 0.2, crownY + crownSize * 0.4);
        ctx.lineTo(screenPos.x + crownSize * 0.6, crownY);
        ctx.lineTo(screenPos.x + crownSize, crownY + crownSize);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
    }

    // Render territory selection indicator
    renderSelectionIndicator(ctx, screenPos, radius) {
        const time = Date.now() * 0.005;
        const pulseRadius = radius + 8 + 4 * Math.sin(time);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -time * 10;
        
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.setLineDash([]);
    }

    // Render combat flash effect
    renderCombatFlash(ctx, screenPos, radius, territory) {
        const flashIntensity = territory.combatFlashTime / territory.combatFlashDuration;
        const flashRadius = radius * (1 + flashIntensity * 0.5);
        
        ctx.fillStyle = `rgba(255, 0, 0, ${flashIntensity * 0.6})`;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, flashRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Render probe flash effect
    renderProbeFlash(ctx, screenPos, radius, territory) {
        const flashIntensity = territory.probeFlashTime / territory.probeFlashDuration;
        
        // Red flash on fleet numbers
        ctx.fillStyle = `rgba(255, 0, 0, ${flashIntensity})`;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Render floating text (damage numbers, etc.)
    renderFloatingText(ctx, screenPos, floatingText) {
        const textY = screenPos.y - 30 - floatingText.progress * 20;
        const alpha = 1 - floatingText.progress;
        
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.lineWidth = 2;
        
        ctx.strokeText(floatingText.text, screenPos.x, textY);
        ctx.fillText(floatingText.text, screenPos.x, textY);
    }

    // Render factory icon for precursor factory discoveries
    renderFactoryIcon(ctx, screenPos, radius) {
        const iconSize = radius * 0.4;
        const iconY = screenPos.y + radius + iconSize;

        ctx.fillStyle = '#888888';
        ctx.fillRect(screenPos.x - iconSize, iconY - iconSize, iconSize * 2, iconSize * 1.5);
        
        ctx.fillStyle = '#AAAAAA';
        ctx.fillRect(screenPos.x - iconSize * 0.8, iconY - iconSize * 0.8, iconSize * 1.6, iconSize * 0.8);
    }

    // Render connections between territories
    renderConnections(ctx, camera, gameMap) {
        if (!gameMap || !gameMap.territories) return;

        const drawnConnections = new Set();
        
        for (const territoryId of this.visibleTerritories) {
            const territory = gameMap.territories[territoryId];
            if (!territory) continue;

            const fromPos = camera.worldToScreen(territory.x, territory.y);
            
            // Render visible connections
            for (const neighborId of territory.neighbors) {
                const connectionKey = Math.min(territory.id, neighborId) + '-' + Math.max(territory.id, neighborId);
                if (drawnConnections.has(connectionKey)) continue;
                drawnConnections.add(connectionKey);

                const neighbor = gameMap.territories[neighborId];
                if (!neighbor) continue;

                const toPos = camera.worldToScreen(neighbor.x, neighbor.y);
                this.renderConnection(ctx, fromPos, toPos, territory, neighbor);
            }
        }
    }

    // Render individual connection between territories
    renderConnection(ctx, fromPos, toPos, fromTerritory, toTerritory) {
        ctx.save();
        
        // Determine connection color based on ownership
        let strokeColor = '#444444'; // Default gray
        let lineWidth = 1;
        
        if (fromTerritory.ownerId === toTerritory.ownerId && fromTerritory.ownerId !== null) {
            // Same owner - use player color
            const player = this.game.players.find(p => p.id === fromTerritory.ownerId);
            if (player) {
                strokeColor = player.color;
                lineWidth = 2;
            }
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = 0.6;
        
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.stroke();
        
        ctx.restore();
    }

    // Check if territory has factory discovery
    hasFactoryDiscovery(territory) {
        if (!this.game.playerDiscoveries || !territory.ownerId) return false;
        
        const discoveries = this.game.playerDiscoveries.get(territory.ownerId);
        return discoveries && discoveries.factoryPlanets > 0;
    }

    // Get rendering statistics
    getStats() {
        return {
            visibleTerritories: this.visibleTerritories.size,
            totalTerritories: this.game.gameMap ? Object.keys(this.game.gameMap.territories).length : 0,
            visibilityUpdateCounter: this.visibilityUpdateCounter
        };
    }
}