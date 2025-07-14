/**
 * Renderer.js - Dedicated rendering module
 * 
 * Exclusively responsible for all drawing operations on the HTML5 Canvas.
 * Receives game state and renders it without modifying the state.
 */

import { GAME_CONSTANTS } from '../../../common/gameConstants';

export class Renderer {
    constructor(canvas, camera, game = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = camera;
        this.game = game;
        
        // Performance tracking
        this.visibleTerritories = 0;
        this.lastVisibilityUpdate = 0;
        
        // Object pooling for ship animations
        this.shipAnimationPool = [];
        this.activeShipAnimations = [];
        
        // Parallax starfield layers
        this.starLayers = {
            far: [],
            mid: [],
            near: []
        };
        
        this.setupCanvas();
        this.initializeStarfield();
    }
    
    setupCanvas() {
        // Set canvas size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Configure context settings
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.camera.updateViewport(this.canvas.width, this.canvas.height);
        });
    }
    
    initializeStarfield() {
        // Generate three layers of parallax stars
        const generateStars = (count, minSize, maxSize, minOpacity, maxOpacity) => {
            const stars = [];
            for (let i = 0; i < count; i++) {
                stars.push({
                    x: Math.random() * GAME_CONSTANTS.DEFAULT_MAP_WIDTH * 1.5,
                    y: Math.random() * GAME_CONSTANTS.DEFAULT_MAP_HEIGHT * 1.5,
                    size: Math.random() * (maxSize - minSize) + minSize,
                    opacity: Math.random() * (maxOpacity - minOpacity) + minOpacity,
                    twinklePhase: Math.random() * Math.PI * 2,
                    twinkleSpeed: Math.random() * 0.02 + 0.01
                });
            }
            return stars;
        };
        
        this.starLayers.far = generateStars(300, 0.5, 1.0, 0.2, 0.4);
        this.starLayers.mid = generateStars(150, 1.0, 1.5, 0.3, 0.6);
        this.starLayers.near = generateStars(80, 1.5, 2.5, 0.4, 0.8);
    }
    
    render(gameData) {
        const startTime = performance.now();
        
        // Clear canvas
        this.ctx.fillStyle = GAME_CONSTANTS.BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply camera transform
        this.ctx.save();
        this.camera.applyTransform(this.ctx);
        
        // Render parallax starfield
        this.renderStarfield();
        
        // Render nebulas (behind territories)
        this.renderNebulas(gameData.gameMap);
        
        // Update visible territories for performance
        this.updateVisibleTerritories(gameData.gameMap);
        
        // Render game objects
        this.renderConnections(gameData.gameMap);
        this.renderSupplyRoutes(gameData.supplyRoutes);
        this.renderTerritories(gameData.gameMap, gameData.humanPlayer, gameData.discoveries);
        this.renderProbes(gameData.probes, gameData.gameMap);
        this.renderShipAnimations();
        
        // Render selection and drag preview
        if (gameData.inputState?.selectedTerritory) {
            this.renderSelection(gameData.inputState.selectedTerritory);
        }
        this.renderDragPreview(gameData);
        
        this.ctx.restore();
        
        // Render UI (screen coordinates)
        this.renderUI(gameData);
        
        const renderTime = performance.now() - startTime;
        return { renderTime, visibleTerritories: this.visibleTerritories };
    }
    
    renderStarfield() {
        const viewBounds = this.camera.getViewBounds();
        const cameraPos = this.camera.getWorldCenter();
        
        // Render each layer with different parallax factors
        this.renderStarLayer(this.starLayers.far, 0.05, viewBounds, cameraPos);
        this.renderStarLayer(this.starLayers.mid, 0.15, viewBounds, cameraPos);
        this.renderStarLayer(this.starLayers.near, 0.30, viewBounds, cameraPos);
    }
    
    renderStarLayer(stars, parallaxFactor, viewBounds, cameraPos) {
        this.ctx.save();
        
        for (const star of stars) {
            // Apply parallax offset
            const parallaxX = star.x - cameraPos.x * parallaxFactor;
            const parallaxY = star.y - cameraPos.y * parallaxFactor;
            
            // Viewport culling
            if (parallaxX < viewBounds.left - 50 || parallaxX > viewBounds.right + 50 ||
                parallaxY < viewBounds.top - 50 || parallaxY > viewBounds.bottom + 50) {
                continue;
            }
            
            // Twinkling animation
            star.twinklePhase += star.twinkleSpeed;
            const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
            const opacity = star.opacity * twinkle;
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(parallaxX, parallaxY, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    renderNebulas(gameMap) {
        if (!gameMap.nebulas) return;
        
        const viewBounds = this.camera.getViewBounds();
        
        for (const nebula of gameMap.nebulas) {
            // Viewport culling
            if (nebula.x + nebula.radius < viewBounds.left || nebula.x - nebula.radius > viewBounds.right ||
                nebula.y + nebula.radius < viewBounds.top || nebula.y - nebula.radius > viewBounds.bottom) {
                continue;
            }
            
            // Create radial gradient
            const gradient = this.ctx.createRadialGradient(
                nebula.x, nebula.y, 0,
                nebula.x, nebula.y, nebula.radius
            );
            gradient.addColorStop(0, 'rgba(128, 0, 255, 0.3)');
            gradient.addColorStop(0.5, 'rgba(64, 0, 128, 0.2)');
            gradient.addColorStop(1, 'rgba(32, 0, 64, 0.1)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    updateVisibleTerritories(gameMap) {
        const now = Date.now();
        if (now - this.lastVisibilityUpdate < 100) return; // Throttle to 10fps
        
        this.lastVisibilityUpdate = now;
        this.visibleTerritories = 0;
        
        const viewBounds = this.camera.getViewBounds();
        const margin = 50;
        
        for (const territory of Object.values(gameMap.territories)) {
            if (this.camera.isRectVisible(
                territory.x - territory.radius, territory.y - territory.radius,
                territory.radius * 2, territory.radius * 2, margin
            )) {
                territory.isVisible = true;
                this.visibleTerritories++;
            } else {
                territory.isVisible = false;
            }
        }
    }
    
    renderConnections(gameMap, players = []) {
        // No warp lanes to render - range-based movement only
        return;
    }
    
    renderSupplyRoutes(supplyRoutes) {
        if (!supplyRoutes || supplyRoutes.length === 0) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = GAME_CONSTANTS.SUPPLY_ROUTE_COLOR;
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = 0.8;
        
        const currentTime = Date.now();
        const dashOffset = (currentTime * GAME_CONSTANTS.SUPPLY_ROUTE_DASH_ANIMATION_SPEED) % 20;
        this.ctx.setLineDash([10, 10]);
        this.ctx.lineDashOffset = dashOffset;
        
        for (const route of supplyRoutes) {
            if (!route.active || !route.path || route.path.length < 2) continue;
            
            this.ctx.beginPath();
            const firstTerritory = route.path[0];
            this.ctx.moveTo(firstTerritory.x, firstTerritory.y);
            
            for (let i = 1; i < route.path.length; i++) {
                const territory = route.path[i];
                this.ctx.lineTo(territory.x, territory.y);
            }
            
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    renderTerritories(gameMap, humanPlayer, discoveries = []) {
        const currentTime = Date.now();
        const zoomLevel = this.camera.getZoomLevel();
        
        // Level of Detail rendering
        const showDetails = zoomLevel > 0.5;
        const showNumbers = zoomLevel > 0.3;
        
        for (const territory of Object.values(gameMap.territories)) {
            if (!territory.isVisible) continue;
            
            this.ctx.save();
            
            // Render territory circle
            this.renderTerritoryCircle(territory, currentTime, humanPlayer);
            
            // Render throne star crown
            if (territory.isThronestar) {
                this.renderThroneStarCrown(territory);
            }
            
            // Render army count for all territories (no more colonizable planets)
            if (showNumbers) {
                this.renderArmyCount(territory);
            }
            
            // Always render supply route indicators regardless of zoom level
            this.renderSupplyRouteIndicators(territory);
            
            // Render floating text
            if (territory.floatingText && showDetails) {
                this.renderFloatingText(territory);
            }
            
            // Render human player flag
            if (territory.ownerId === humanPlayer?.id && showDetails) {
                this.renderHumanPlayerFlag(territory);
            }
            
            this.ctx.restore();
        }
    }
    
    renderTerritoryCircle(territory, currentTime, humanPlayer) {
        // Flash effects
        let flashAlpha = 1.0;
        if (territory.combatFlashTime && currentTime - territory.combatFlashTime < territory.combatFlashDuration) {
            flashAlpha = 0.3 + 0.7 * Math.sin((currentTime - territory.combatFlashTime) * 0.02);
        }
        
        // Base color
        let fillColor = territory.baseColor;
        if (territory.ownerId) {
            const player = this.findPlayerById(territory.ownerId);
            fillColor = player?.color || territory.baseColor;
        }
        
        // Human player pulsing effect
        if (territory.ownerId === humanPlayer?.id) {
            const pulseIntensity = 0.3 + 0.2 * Math.sin(currentTime * 0.005);
            this.ctx.globalAlpha = pulseIntensity;
            this.ctx.fillStyle = '#00ffff';
            this.ctx.beginPath();
            this.ctx.arc(territory.x, territory.y, territory.radius + 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Main territory circle
        this.ctx.globalAlpha = flashAlpha;
        this.ctx.fillStyle = fillColor;
        this.ctx.beginPath();
        this.ctx.arc(territory.x, territory.y, territory.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Border
        this.ctx.strokeStyle = territory.strokeColor;
        this.ctx.lineWidth = territory.ownerId === humanPlayer?.id ? 3 : 2;
        this.ctx.stroke();
    }
    
    renderThroneStarCrown(territory) {
        const crownSize = 8;
        const crownY = territory.y - territory.radius - 10;
        
        this.ctx.fillStyle = '#FFD700';
        this.ctx.strokeStyle = '#FFA500';
        this.ctx.lineWidth = 1;
        
        // Crown base
        this.ctx.fillRect(territory.x - crownSize, crownY, crownSize * 2, crownSize * 0.6);
        
        // Crown spikes
        this.ctx.beginPath();
        this.ctx.moveTo(territory.x - crownSize, crownY);
        this.ctx.lineTo(territory.x - crownSize * 0.5, crownY - crownSize * 0.8);
        this.ctx.lineTo(territory.x, crownY - crownSize);
        this.ctx.lineTo(territory.x + crownSize * 0.5, crownY - crownSize * 0.8);
        this.ctx.lineTo(territory.x + crownSize, crownY);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }
    
    renderColonizableIndicator(territory) {
        const pulsePhase = territory.pulsePhase || 0;
        const pulseAlpha = 0.6 + 0.4 * Math.sin(pulsePhase * 0.05);
        
        this.ctx.fillStyle = `rgba(255, 255, 0, ${pulseAlpha})`;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Text shadow
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText('?', territory.x, territory.y);
        this.ctx.fillText('?', territory.x, territory.y);
    }
    
    renderArmyCount(territory) {
        this.ctx.fillStyle = 'black';
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Check if this star is reinforcing another star
        const isReinforcingSource = this.game?.supplySystem?.isSupplySource(territory.id);
        
        let text = territory.armySize.toString();
        if (isReinforcingSource) {
            text = `● ${text}`; // Add black dot indicator for reinforcing stars
        }
        
        this.ctx.strokeText(text, territory.x, territory.y);
        this.ctx.fillText(text, territory.x, territory.y);
    }
    
    renderSupplyRouteIndicators(territory) {
        // Removed debug ownership verification (dead code cleanup)
        const humanPlayerId = this.game?.humanPlayer?.id;
        
        if (!this.game?.supplySystem?.supplyRoutes) {
            // Removed debug supply system logging (dead code cleanup)
            return;
        }
        
        // Count incoming supply routes to this territory
        const incomingRoutes = this.game.supplySystem.supplyRoutes.filter(route => route.to === territory.id);
        const reinforcementCount = incomingRoutes.length;
        
        // Removed debug supply route rendering logs (dead code cleanup)
        
        // Render supply route indicators based on actual incoming routes
        if (territory.ownerId === this.game?.humanPlayer?.id) {
            // Removed test logging (dead code cleanup)
            
            // Position below the territory circle
            const yOffset = territory.radius + 15;
            
            this.ctx.fillStyle = '#00ff00'; // Green color for reinforcement indicators
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = 1; // Ensure full opacity for plus symbols
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Draw text with outline for visibility
            this.ctx.strokeText('+', territory.x, territory.y + yOffset);
            this.ctx.fillText('+', territory.x, territory.y + yOffset);
        }
        
        // Ensure full opacity for reinforcement plus symbols
        this.ctx.globalAlpha = 1;
        if (reinforcementCount > 0) {
            // Create + symbols underneath the territory
            const plusSymbols = '+'.repeat(reinforcementCount);
            
            // Position below the territory circle
            const yOffset = territory.radius + 15;
            
            this.ctx.fillStyle = '#00ff00'; // Green color for reinforcement indicators
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = 1; // Ensure full opacity for plus symbols
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Draw text with outline for visibility
            this.ctx.strokeText(plusSymbols, territory.x, territory.y + yOffset);
            this.ctx.fillText(plusSymbols, territory.x, territory.y + yOffset);
        }
    }
    
    renderFloatingText(territory) {
        if (!territory.floatingText || Date.now() > territory.floatingText.endTime) {
            territory.floatingText = null;
            return;
        }
        
        const elapsed = Date.now() - territory.floatingText.startTime;
        const progress = elapsed / territory.floatingText.duration;
        const yOffset = -progress * 30;
        const alpha = 1.0 - progress;
        
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const text = territory.floatingText.text;
        const textY = territory.y + yOffset - territory.radius - 10;
        
        this.ctx.strokeText(text, territory.x, textY);
        this.ctx.fillText(text, territory.x, textY);
    }
    
    renderHumanPlayerFlag(territory) {
        const flagSize = 6;
        const flagX = territory.x + territory.radius - flagSize;
        const flagY = territory.y - territory.radius + flagSize;
        
        // Flag pole
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(flagX, flagY);
        this.ctx.lineTo(flagX, flagY + flagSize * 2);
        this.ctx.stroke();
        
        // Flag
        this.ctx.fillStyle = '#00ffff';
        this.ctx.fillRect(flagX, flagY, flagSize, flagSize);
        
        // Star on flag
        this.ctx.fillStyle = 'white';
        this.ctx.font = '8px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('★', flagX + flagSize/2, flagY + flagSize/2);
    }
    
    renderProbes(probes, gameMap) {
        const currentTime = Date.now();
        
        for (const probe of probes) {
            if (!probe.isVisible) continue;
            
            const fromTerritory = gameMap.territories[probe.fromTerritoryId];
            const toTerritory = gameMap.territories[probe.toTerritoryId];
            
            if (!fromTerritory || !toTerritory) continue;
            
            // Calculate current position
            const progress = probe.progress;
            const x = fromTerritory.x + (toTerritory.x - fromTerritory.x) * progress;
            const y = fromTerritory.y + (toTerritory.y - fromTerritory.y) * progress;
            
            // Check if probe is in nebula
            let inNebula = false;
            if (gameMap.nebulas) {
                for (const nebula of gameMap.nebulas) {
                    const distance = Math.sqrt((x - nebula.x) ** 2 + (y - nebula.y) ** 2);
                    if (distance < nebula.radius) {
                        inNebula = true;
                        break;
                    }
                }
            }
            
            this.ctx.save();
            
            // Probe visual effects
            if (inNebula) {
                const fadeAlpha = 0.3 + 0.4 * Math.sin(currentTime * 0.01);
                this.ctx.globalAlpha = fadeAlpha;
            }
            
            // Probe circle
            this.ctx.fillStyle = probe.playerColor;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Probe trail
            this.ctx.strokeStyle = probe.playerColor;
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            
            const trailLength = 20;
            const trailStartProgress = Math.max(0, progress - 0.1);
            const trailStartX = fromTerritory.x + (toTerritory.x - fromTerritory.x) * trailStartProgress;
            const trailStartY = fromTerritory.y + (toTerritory.y - fromTerritory.y) * trailStartProgress;
            
            this.ctx.moveTo(trailStartX, trailStartY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            this.ctx.restore();
        }
    }
    
    renderShipAnimations() {
        const currentTime = Date.now();
        
        for (let i = this.activeShipAnimations.length - 1; i >= 0; i--) {
            const animation = this.activeShipAnimations[i];
            
            if (currentTime >= animation.endTime) {
                // Return to pool
                this.shipAnimationPool.push(animation);
                this.activeShipAnimations.splice(i, 1);
                continue;
            }
            
            this.renderShipAnimation(animation, currentTime);
        }
    }
    
    renderShipAnimation(animation, currentTime) {
        const elapsed = currentTime - animation.startTime;
        const progress = elapsed / animation.duration;
        
        // Multi-hop animation
        if (animation.segments && animation.segments.length > 1) {
            this.renderMultiHopShipAnimation(animation, progress);
        } else {
            this.renderSingleShipAnimation(animation, progress);
        }
    }
    
    renderSingleShipAnimation(animation, progress) {
        const x = animation.from.x + (animation.to.x - animation.from.x) * progress;
        const y = animation.from.y + (animation.to.y - animation.from.y) * progress;
        
        this.ctx.save();
        this.ctx.fillStyle = animation.color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.8;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    renderMultiHopShipAnimation(animation, totalProgress) {
        const segmentProgress = totalProgress * animation.segments.length;
        const currentSegmentIndex = Math.floor(segmentProgress);
        const segmentLocalProgress = segmentProgress - currentSegmentIndex;
        
        if (currentSegmentIndex >= animation.segments.length) return;
        
        const segment = animation.segments[currentSegmentIndex];
        const x = segment.from.x + (segment.to.x - segment.from.x) * segmentLocalProgress;
        const y = segment.from.y + (segment.to.y - segment.from.y) * segmentLocalProgress;
        
        this.ctx.save();
        this.ctx.fillStyle = animation.color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.8;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    renderSelection(selectedTerritory) {
        if (!selectedTerritory) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.lineDashOffset = Date.now() * 0.01;
        
        this.ctx.beginPath();
        this.ctx.arc(selectedTerritory.x, selectedTerritory.y, selectedTerritory.radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    renderDragPreview(gameData) {
        // Render proportional drag preview
        if (gameData.isProportionalDrag && gameData.proportionalDragStart && gameData.dragEnd) {
            this.renderProportionalDragPreview(gameData);
        }
    }
    
    renderProportionalDragPreview(gameData) {
        const from = gameData.proportionalDragStart.territory;
        const to = gameData.dragEnd;
        const percentage = gameData.fleetPercentage;
        
        if (!from || !to) return;
        
        this.ctx.save();
        
        // Drag line
        const lineColor = to.isColonizable ? '#ffff00' : 
                         (to.ownerId === gameData.humanPlayer?.id ? '#00ff00' : '#ff0000');
        
        this.ctx.strokeStyle = lineColor;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();
        
        // Percentage indicator
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(midX - 30, midY - 10, 60, 20);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${Math.round(percentage * 100)}%`, midX, midY);
        
        this.ctx.restore();
    }
    
    renderUI(gameData) {
        // UI rendering is handled by the GameUI class
        // This method exists for extensibility
    }
    
    // Helper methods
    findPlayerById(playerId, players = []) {
        return players.find(p => p.id === playerId);
    }
    
    // Object pooling for ship animations
    createShipAnimation(from, to, color, duration, segments = null) {
        let animation;
        
        if (this.shipAnimationPool.length > 0) {
            animation = this.shipAnimationPool.pop();
        } else {
            animation = {};
        }
        
        animation.from = from;
        animation.to = to;
        animation.color = color;
        animation.duration = duration;
        animation.startTime = Date.now();
        animation.endTime = animation.startTime + duration;
        animation.segments = segments;
        
        this.activeShipAnimations.push(animation);
        return animation;
    }
    
    // Performance monitoring
    getPerformanceStats() {
        return {
            visibleTerritories: this.visibleTerritories,
            activeShipAnimations: this.activeShipAnimations.length,
            pooledAnimations: this.shipAnimationPool.length
        };
    }
}