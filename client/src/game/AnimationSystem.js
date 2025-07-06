import { GAME_CONSTANTS } from '../../../common/gameConstants';

export class AnimationSystem {
    constructor(game) {
        this.game = game;
        
        // Ship animations with object pooling
        this.shipAnimations = [];
        this.shipAnimationPool = [];
        this.maxPoolSize = 100;
        
        // Parallax starfield
        this.starfieldLayers = [];
        this.backgroundStars = null; // Pre-rendered background canvas
        
        // Initialize pool
        for (let i = 0; i < this.maxPoolSize; i++) {
            this.shipAnimationPool.push(this.createShipAnimation());
        }
    }

    // Object pool management for ship animations
    createShipAnimation() {
        return {
            from: { x: 0, y: 0 },
            to: { x: 0, y: 0 },
            progress: 0,
            duration: 1000,
            color: '#ffffff',
            isAttack: false,
            isActive: false,
            segments: null, // For multi-hop animations
            currentSegment: 0
        };
    }

    getPooledShipAnimation() {
        const animation = this.shipAnimationPool.pop();
        if (animation) {
            animation.isActive = true;
            return animation;
        }
        // Pool exhausted, create new one
        return this.createShipAnimation();
    }

    returnToPool(animation) {
        animation.isActive = false;
        animation.progress = 0;
        animation.segments = null;
        animation.currentSegment = 0;
        
        if (this.shipAnimationPool.length < this.maxPoolSize) {
            this.shipAnimationPool.push(animation);
        }
    }
    
    // FOG OF WAR: Check if ship animation should be visible
    shouldRenderAnimation(animation) {
        const humanPlayerId = this.game.humanPlayer?.id;
        if (!humanPlayerId) return true; // Show all if no human player
        
        // Find the territories this animation is traveling between
        let fromTerritory, toTerritory;
        
        if (animation.segments && animation.segments.length > 0) {
            // Multi-hop animation - check current segment
            const currentSegment = animation.currentSegment || 0;
            if (currentSegment < animation.segments.length) {
                // Find territories by coordinates
                fromTerritory = this.findTerritoryByCoords(animation.segments[currentSegment].from);
                toTerritory = this.findTerritoryByCoords(animation.segments[currentSegment].to);
            }
        } else {
            // Single hop animation
            fromTerritory = this.findTerritoryByCoords(animation.from);
            toTerritory = this.findTerritoryByCoords(animation.to);
        }
        
        if (!fromTerritory || !toTerritory) return true; // Safe fallback
        
        // SHOW ALL SHIP ANIMATIONS: Display all ship movements for better visibility
        // (At least one end must be owned by human player)
        return true; // Show all ship animations
    }
    
    // Helper to find territory by coordinates
    findTerritoryByCoords(coords) {
        for (const territory of Object.values(this.game.gameMap.territories)) {
            if (Math.abs(territory.x - coords.x) < 1 && Math.abs(territory.y - coords.y) < 1) {
                return territory;
            }
        }
        return null;
    }

    // Create ship animation for attacks/transfers
    createBasicShipAnimation(fromTerritory, toTerritory, color, isAttack = false) {
        const animation = this.getPooledShipAnimation();
        
        animation.from = { x: fromTerritory.x, y: fromTerritory.y };
        animation.to = { x: toTerritory.x, y: toTerritory.y };
        animation.progress = 0;
        animation.duration = 1000;
        animation.color = color;
        animation.isAttack = isAttack;
        animation.segments = null;
        animation.currentSegment = 0;
        
        this.shipAnimations.push(animation);
        return animation;
    }

    // Create multi-hop supply route animation
    createSupplyRouteAnimation(supplyRoute, color) {
        const animation = this.getPooledShipAnimation();
        
        // Build path segments
        const segments = [];
        for (let i = 0; i < supplyRoute.path.length - 1; i++) {
            const fromTerritory = this.game.gameMap.territories[supplyRoute.path[i]];
            const toTerritory = this.game.gameMap.territories[supplyRoute.path[i + 1]];
            
            if (fromTerritory && toTerritory) {
                segments.push({
                    from: { x: fromTerritory.x, y: fromTerritory.y },
                    to: { x: toTerritory.x, y: toTerritory.y },
                    duration: 800 // Faster per-segment for multi-hop
                });
            }
        }
        
        if (segments.length > 0) {
            animation.segments = segments;
            animation.currentSegment = 0;
            animation.from = segments[0].from;
            animation.to = segments[0].to;
            animation.progress = 0;
            animation.duration = segments[0].duration;
            animation.color = color;
            animation.isAttack = false;
            
            this.shipAnimations.push(animation);
        }
        
        return animation;
    }

    // Update all ship animations
    updateShipAnimations(deltaTime) {
        const gameSpeed = this.game.config.gameSpeed || 1.0;
        const adjustedDeltaTime = deltaTime * gameSpeed;
        
        for (let i = this.shipAnimations.length - 1; i >= 0; i--) {
            const animation = this.shipAnimations[i];
            animation.progress += adjustedDeltaTime;
            
            // Check if current segment is complete
            if (animation.progress >= animation.duration) {
                if (animation.segments && animation.currentSegment < animation.segments.length - 1) {
                    // Move to next segment
                    animation.currentSegment++;
                    const nextSegment = animation.segments[animation.currentSegment];
                    animation.from = nextSegment.from;
                    animation.to = nextSegment.to;
                    animation.progress = 0;
                    animation.duration = nextSegment.duration;
                } else {
                    // Animation complete
                    this.returnToPool(animation);
                    this.shipAnimations.splice(i, 1);
                }
            }
        }
    }

    // Render ship animations
    renderShipAnimations(ctx, camera) {
        for (const animation of this.shipAnimations) {
            // FOG OF WAR: Check if animation should be visible
            if (!this.shouldRenderAnimation(animation)) {
                continue;
            }
            
            const t = Math.min(animation.progress / animation.duration, 1.0);
            const currentX = animation.from.x + (animation.to.x - animation.from.x) * t;
            const currentY = animation.from.y + (animation.to.y - animation.from.y) * t;
            
            const screenPos = camera.worldToScreen(currentX, currentY);
            
            // Skip if off-screen
            if (screenPos.x < -50 || screenPos.x > camera.width + 50 ||
                screenPos.y < -50 || screenPos.y > camera.height + 50) {
                continue;
            }
            
            ctx.save();
            ctx.fillStyle = animation.color;
            ctx.strokeStyle = animation.color;
            ctx.lineWidth = 2;
            
            // Draw ship as circle with trail
            const size = animation.isAttack ? 4 : 3;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw trail
            const trailLength = 15;
            const trailX = currentX - (animation.to.x - animation.from.x) * 0.1;
            const trailY = currentY - (animation.to.y - animation.from.y) * 0.1;
            const trailScreenPos = camera.worldToScreen(trailX, trailY);
            
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(screenPos.x, screenPos.y);
            ctx.lineTo(trailScreenPos.x, trailScreenPos.y);
            ctx.stroke();
            
            ctx.restore();
        }
    }

    // Initialize parallax starfield
    initializeStarfield() {
        const mapWidth = this.game.gameMap.width;
        const mapHeight = this.game.gameMap.height;
        
        // Create three layers of stars with different parallax speeds
        this.starfieldLayers = [
            this.createStarLayer(300, 0.25, 1, 0.05, mapWidth, mapHeight), // Far layer: tiny, dim, slow
            this.createStarLayer(150, 0.5, 2, 0.15, mapWidth, mapHeight), // Mid layer: small, moderate
            this.createStarLayer(80, 0.75, 3, 0.30, mapWidth, mapHeight)   // Near layer: medium, bright, fast
        ];
        
        console.log('Parallax starfield initialized with 530 stars across 3 layers');
    }

    // Create a layer of stars
    createStarLayer(count, minSize, maxSize, parallaxSpeed, mapWidth, mapHeight) {
        const stars = [];
        const padding = 500; // Extra padding for parallax movement
        
        for (let i = 0; i < count; i++) {
            stars.push({
                x: (Math.random() - 0.5) * (mapWidth + padding * 2),
                y: (Math.random() - 0.5) * (mapHeight + padding * 2),
                size: minSize + Math.random() * (maxSize - minSize),
                brightness: 0.3 + Math.random() * 0.7,
                twinkleSpeed: 0.5 + Math.random() * 2.0,
                twinklePhase: Math.random() * Math.PI * 2
            });
        }
        
        return {
            stars: stars,
            parallaxSpeed: parallaxSpeed
        };
    }

    // Pre-render static background (now unused - both starfield and nebulas are dynamic)
    preRenderStaticBackground() {
        // Both starfield and nebulas are now rendered dynamically for proper camera tracking
        // This method is kept for compatibility but no longer pre-renders anything
        console.log('Background rendering switched to dynamic mode for proper parallax and camera tracking');
    }

    // Render starfield to static canvas
    renderStarfieldStatic(ctx) {
        const now = Date.now();
        
        for (const layer of this.starfieldLayers) {
            for (const star of layer.stars) {
                // Calculate parallax position
                const parallaxX = star.x + (this.game.camera.x * layer.parallaxSpeed);
                const parallaxY = star.y + (this.game.camera.y * layer.parallaxSpeed);
                
                const screenPos = this.game.camera.worldToScreen(parallaxX, parallaxY);
                
                // Skip stars outside viewport
                if (screenPos.x < -10 || screenPos.x > ctx.canvas.width + 10 ||
                    screenPos.y < -10 || screenPos.y > ctx.canvas.height + 10) {
                    continue;
                }
                
                // Twinkling effect
                const twinkle = 0.7 + 0.3 * Math.sin(now * 0.001 * star.twinkleSpeed + star.twinklePhase);
                const alpha = star.brightness * twinkle;
                
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, star.size * this.game.camera.zoom, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Render dynamic parallax starfield and dynamic nebulas
    renderStaticBackground(ctx) {
        // First render dynamic parallax starfield
        this.renderParallaxStarfield(ctx);
        
        // Then render dynamic nebulas that follow camera properly
        this.renderDynamicNebulas(ctx);
    }
    
    // Render nebulas dynamically with proper camera tracking
    renderDynamicNebulas(ctx) {
        if (!this.game.gameMap || !this.game.gameMap.nebulas) return;
        
        for (const nebula of this.game.gameMap.nebulas) {
            const screenPos = this.game.camera.worldToScreen(nebula.x, nebula.y);
            const screenRadius = nebula.radius * this.game.camera.zoom;
            
            // Skip off-screen nebulas for performance
            if (screenPos.x + screenRadius < -50 || screenPos.x - screenRadius > ctx.canvas.width + 50 ||
                screenPos.y + screenRadius < -50 || screenPos.y - screenRadius > ctx.canvas.height + 50) {
                continue;
            }
            
            const gradient = ctx.createRadialGradient(
                screenPos.x, screenPos.y, 0,
                screenPos.x, screenPos.y, screenRadius
            );
            gradient.addColorStop(0, 'rgba(147, 112, 219, 0.4)');
            gradient.addColorStop(0.7, 'rgba(147, 112, 219, 0.15)');
            gradient.addColorStop(1, 'rgba(147, 112, 219, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Render parallax starfield with camera movement
    renderParallaxStarfield(ctx) {
        if (!this.starfieldLayers || this.starfieldLayers.length === 0) return;
        
        const now = Date.now();
        
        for (const layer of this.starfieldLayers) {
            for (const star of layer.stars) {
                // Calculate parallax offset based on camera position
                const parallaxX = star.x - (this.game.camera.x * layer.parallaxSpeed);
                const parallaxY = star.y - (this.game.camera.y * layer.parallaxSpeed);
                
                // Convert to screen coordinates (but don't apply camera transform since we're in screen space)
                const screenX = parallaxX + ctx.canvas.width / 2;
                const screenY = parallaxY + ctx.canvas.height / 2;
                
                // Skip stars outside viewport with padding
                if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                    screenY < -50 || screenY > ctx.canvas.height + 50) {
                    continue;
                }
                
                // Twinkling effect with 25% dimmer stars
                const twinkle = 0.7 + 0.3 * Math.sin(now * 0.001 * star.twinkleSpeed + star.twinklePhase);
                const alpha = star.brightness * twinkle * 0.75; // 25% dimmer
                
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(screenX, screenY, star.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Update animations based on game speed
    update(deltaTime) {
        this.updateShipAnimations(deltaTime);
        
        // Update starfield twinkling (handled in render for performance)
        // No heavy calculations here, just timing
    }

    // Reset all animations
    reset() {
        // Return all active animations to pool
        for (const animation of this.shipAnimations) {
            this.returnToPool(animation);
        }
        this.shipAnimations = [];
        
        // Clear starfield
        this.starfieldLayers = [];
        this.backgroundStars = null;
    }

    // Get animation stats for performance monitoring
    getStats() {
        return {
            activeAnimations: this.shipAnimations.length,
            poolSize: this.shipAnimationPool.length,
            starCount: this.starfieldLayers.reduce((sum, layer) => sum + layer.stars.length, 0)
        };
    }
}