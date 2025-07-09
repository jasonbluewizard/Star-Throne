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
        
        // Combat particle system
        this.combatParticles = [];
        this.particlePool = [];
        this.maxParticlePoolSize = 200;
        
        // Initialize pools
        for (let i = 0; i < this.maxPoolSize; i++) {
            this.shipAnimationPool.push(this.createShipAnimation());
        }
        
        for (let i = 0; i < this.maxParticlePoolSize; i++) {
            this.particlePool.push(this.createParticle());
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
            currentSegment: 0,
            isLongRange: false, // Long-range attack flag
            armyCount: 0, // Army count for display
            targetTerritory: null, // Target territory for dotted line
            fromOwnerId: null, // Track attacking player for AI limits
            isSupplyShip: false, // Supply ship flag
            isPaused: false, // Pause state for supply ships
            pauseEndTime: 0, // When pause ends
            finalDestination: null // Final destination territory ID
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
        animation.isLongRange = false;
        animation.armyCount = 0;
        animation.targetTerritory = null;
        animation.fromOwnerId = null;
        animation.isSupplyShip = false;
        animation.isPaused = false;
        animation.pauseEndTime = 0;
        animation.finalDestination = null;
        
        if (this.shipAnimationPool.length < this.maxPoolSize) {
            this.shipAnimationPool.push(animation);
        }
    }

    // Combat particle system
    createParticle() {
        return {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            life: 0,
            maxLife: 0,
            size: 0,
            color: '#ffffff',
            isActive: false
        };
    }

    getPooledParticle() {
        const particle = this.particlePool.pop();
        if (particle) {
            particle.isActive = true;
            return particle;
        }
        return this.createParticle();
    }

    returnParticleToPool(particle) {
        particle.isActive = false;
        if (this.particlePool.length < this.maxParticlePoolSize) {
            this.particlePool.push(particle);
        }
    }

    // Create particle explosion at combat location
    createCombatParticles(x, y, color, intensity = 1.0) {
        const particleCount = Math.floor(8 + Math.random() * 12) * intensity; // 8-20 particles
        
        for (let i = 0; i < particleCount; i++) {
            const particle = this.getPooledParticle();
            if (!particle) continue;
            
            // Random direction and speed
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 100; // 50-150 pixels/second
            
            particle.x = x + (Math.random() - 0.5) * 10; // Small initial spread
            particle.y = y + (Math.random() - 0.5) * 10;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.life = 0;
            particle.maxLife = 800 + Math.random() * 400; // 0.8-1.2 seconds
            particle.size = 2 + Math.random() * 3; // 2-5 pixel particles
            particle.color = color;
            particle.isActive = true;
            
            this.combatParticles.push(particle);
        }
        
        console.log(`💥 PARTICLES: Created ${particleCount} combat particles at (${x.toFixed(1)}, ${y.toFixed(1)}) in color ${color}`);
        console.log(`💥 PARTICLES: Active particles now: ${this.combatParticles.length}, Pool size: ${this.particlePool.length}`);
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
        animation.startTime = Date.now(); // Initialize startTime for timestamp-based timing
        animation.color = color;
        animation.isAttack = isAttack;
        animation.segments = null;
        animation.currentSegment = 0;
        
        this.shipAnimations.push(animation);
        return animation;
    }
    
    // Create individual supply ship animation with hop-by-hop movement
    createSupplyShipAnimation(routePath, color) {
        const animation = this.getPooledShipAnimation();
        
        // Build path segments for hop-by-hop movement
        const segments = [];
        for (let i = 0; i < routePath.length - 1; i++) {
            const fromTerritory = this.game.gameMap.territories[routePath[i]];
            const toTerritory = this.game.gameMap.territories[routePath[i + 1]];
            
            if (fromTerritory && toTerritory) {
                segments.push({
                    from: { x: fromTerritory.x, y: fromTerritory.y },
                    to: { x: toTerritory.x, y: toTerritory.y },
                    fromId: fromTerritory.id,
                    toId: toTerritory.id,
                    duration: 600, // Ship movement duration per hop
                    pauseDuration: 500 // Half-second pause at each intermediate stop
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
            animation.startTime = Date.now();
            animation.color = color;
            animation.isSupplyShip = true;
            animation.isPaused = false;
            animation.pauseEndTime = 0;
            animation.finalDestination = routePath[routePath.length - 1]; // Track final destination
            
            this.shipAnimations.push(animation);
            console.log(`🚢 ANIMATION CREATED: Supply ship with ${segments.length} segments, path: ${routePath.join(' → ')}`);
            console.log(`🚢 TOTAL ANIMATIONS: ${this.shipAnimations.length} ships active`);
            return animation;
        }
        
        return null;
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
            animation.startTime = Date.now(); // Initialize startTime for timestamp-based timing
            animation.color = color;
            animation.isAttack = false;
            
            this.shipAnimations.push(animation);
        }
        
        return animation;
    }

    // Update combat particles
    updateCombatParticles(deltaTime) {
        for (let i = this.combatParticles.length - 1; i >= 0; i--) {
            const particle = this.combatParticles[i];
            
            // Update particle physics
            particle.life += deltaTime;
            particle.x += particle.vx * (deltaTime / 1000);
            particle.y += particle.vy * (deltaTime / 1000);
            
            // Apply gravity/deceleration
            particle.vy += 80 * (deltaTime / 1000); // Gravity
            particle.vx *= 0.98; // Air resistance
            particle.vy *= 0.98;
            
            // Remove dead particles
            if (particle.life >= particle.maxLife) {
                this.combatParticles.splice(i, 1);
                this.returnParticleToPool(particle);
            }
        }
    }

    // Update all ship animations
    updateShipAnimations(deltaTime) {
        const currentTime = Date.now();
        
        for (let i = this.shipAnimations.length - 1; i >= 0; i--) {
            const animation = this.shipAnimations[i];
            
            // Use timestamp-based progress calculation for consistency with StarThrone rendering
            if (animation.startTime) {
                animation.progress = (currentTime - animation.startTime);
                
                // Debug logging for long-range animations
                if (animation.isLongRange) {
                    const progressPercent = ((currentTime - animation.startTime) / animation.duration * 100).toFixed(1);
                    console.log(`🎯 ANIM PROGRESS: Long-range ${animation.fromOwnerId} progress=${progressPercent}%, elapsed=${currentTime - animation.startTime}ms, duration=${animation.duration}ms`);
                }
            } else {
                // Fallback to deltaTime accumulation for animations without startTime
                const gameSpeed = this.game.config.gameSpeed || 1.0;
                const adjustedDeltaTime = deltaTime * gameSpeed;
                animation.progress += adjustedDeltaTime;
            }
            
            // Handle supply ship hop-by-hop movement with pauses
            if (animation.isSupplyShip) {
                // Debug supply ship progress occasionally
                if (Math.random() < 0.01) {
                    console.log(`🚢 SUPPLY UPDATE: Ship at segment ${animation.currentSegment}/${animation.segments.length-1}, progress ${animation.progress}/${animation.duration}, paused: ${animation.isPaused}`);
                }
                
                // Check if currently paused at intermediate stop
                if (animation.isPaused) {
                    if (currentTime >= animation.pauseEndTime) {
                        // End pause, move to next segment
                        animation.isPaused = false;
                        animation.currentSegment++;
                        
                        if (animation.currentSegment < animation.segments.length) {
                            const nextSegment = animation.segments[animation.currentSegment];
                            animation.from = nextSegment.from;
                            animation.to = nextSegment.to;
                            animation.progress = 0;
                            animation.duration = nextSegment.duration;
                            animation.startTime = currentTime;
                        } else {
                            // Reached final destination - increment army count
                            const finalTerritory = this.game.gameMap.territories[animation.finalDestination];
                            if (finalTerritory) {
                                finalTerritory.armySize += 1;
                            }
                            
                            // Animation complete
                            this.returnToPool(animation);
                            this.shipAnimations.splice(i, 1);
                        }
                    }
                    continue; // Skip progress update while paused
                }
                
                // Check if current segment is complete
                if (animation.progress >= animation.duration) {
                    if (animation.currentSegment < animation.segments.length - 1) {
                        // Start pause at intermediate stop (not the final destination)
                        animation.isPaused = true;
                        animation.pauseEndTime = currentTime + animation.segments[animation.currentSegment].pauseDuration;
                        animation.progress = animation.duration; // Stay at end of current segment
                    } else {
                        // Reached final destination - increment army count
                        const finalTerritory = this.game.gameMap.territories[animation.finalDestination];
                        if (finalTerritory) {
                            finalTerritory.armySize += 1;
                        }
                        
                        // Animation complete
                        this.returnToPool(animation);
                        this.shipAnimations.splice(i, 1);
                    }
                }
            } else {
                // Original logic for non-supply ships
                if (animation.progress >= animation.duration) {
                    if (animation.segments && animation.currentSegment < animation.segments.length - 1) {
                        // Move to next segment
                        animation.currentSegment++;
                        const nextSegment = animation.segments[animation.currentSegment];
                        animation.from = nextSegment.from;
                        animation.to = nextSegment.to;
                        animation.progress = 0;
                        animation.duration = nextSegment.duration;
                        animation.startTime = currentTime; // Reset start time for new segment
                    } else {
                        // Animation complete
                        this.returnToPool(animation);
                        this.shipAnimations.splice(i, 1);
                    }
                }
            }
        }
    }

    // Render ship animations
    renderShipAnimations(ctx, camera) {
        // First, draw dotted lines for long-range attacks
        ctx.save();
        ctx.setLineDash([5, 5]); // dotted line pattern
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        
        for (const animation of this.shipAnimations) {
            if (animation.isLongRange && animation.targetTerritory) {
                // Use world coordinates directly since camera transform is already applied
                ctx.beginPath();
                ctx.moveTo(animation.from.x, animation.from.y);
                ctx.lineTo(animation.targetTerritory.x, animation.targetTerritory.y);
                ctx.stroke();
            }
        }
        ctx.restore();
        
        // Then draw ships
        for (const animation of this.shipAnimations) {
            // Debug supply ship rendering occasionally
            if (animation.isSupplyShip && Math.random() < 0.05) {
                console.log(`🚢 RENDER: Supply ship segment ${animation.currentSegment}/${animation.segments?.length || 0}, progress ${animation.progress}/${animation.duration}, paused: ${animation.isPaused}`);
            }
            
            // FOG OF WAR: Check if animation should be visible
            if (!this.shouldRenderAnimation(animation)) {
                continue;
            }
            
            // Handle supply ship position calculation (may be paused)
            let t, currentX, currentY;
            
            if (animation.isSupplyShip && animation.isPaused) {
                // If paused, stay at end of current segment
                t = 1.0;
                currentX = animation.to.x;
                currentY = animation.to.y;
            } else {
                t = Math.min(animation.progress / animation.duration, 1.0);
                currentX = animation.from.x + (animation.to.x - animation.from.x) * t;
                currentY = animation.from.y + (animation.to.y - animation.from.y) * t;
            }
            
            // Use world coordinates directly since camera transform is already applied
            // Debug supply ship position occasionally
            if (animation.isSupplyShip && Math.random() < 0.02) {
                console.log(`🚢 POSITION: Supply ship at World(${currentX.toFixed(1)}, ${currentY.toFixed(1)}) segment ${animation.currentSegment}/${animation.segments?.length || 0}`);
            }
            
            // Debug coordinate transformation for long-range attacks
            if (animation.isLongRange && Math.random() < 0.1) {
                console.log(`🎯 LONG-RANGE POS: World(${currentX.toFixed(1)}, ${currentY.toFixed(1)})`);
                console.log(`🎯 LONG-RANGE FROM: World(${animation.from.x}, ${animation.from.y}) TO: World(${animation.to.x}, ${animation.to.y})`);
                console.log(`🎯 PROGRESS: ${(animation.progress / animation.duration * 100).toFixed(1)}% (${animation.progress}ms / ${animation.duration}ms)`);
            }
            
            ctx.save();
            ctx.fillStyle = animation.color;
            ctx.strokeStyle = animation.color;
            ctx.lineWidth = 2;
            
            // Draw ship as circle with trail
            let size = animation.isLongRange ? 3 : (animation.isAttack ? 4 : 3); // Smaller for long-range (half size)
            
            // Special rendering for supply ships - make them more visible
            if (animation.isSupplyShip) {
                size = 5; // Larger supply ships
                ctx.shadowColor = animation.color;
                ctx.shadowBlur = 8;
                
                // Add pulsing effect if paused
                if (animation.isPaused) {
                    const pulseIntensity = 0.7 + 0.3 * Math.sin(Date.now() * 0.01);
                    ctx.globalAlpha = pulseIntensity;
                }
            }
            
            ctx.beginPath();
            ctx.arc(currentX, currentY, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw army count for long-range attacks
            if (animation.isLongRange && animation.armyCount) {
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${animation.armyCount}`, currentX, currentY + 25);
                ctx.fillStyle = animation.color; // Restore original color
            }
            
            // Draw trail
            const trailLength = 15;
            const trailX = currentX - (animation.to.x - animation.from.x) * 0.1;
            const trailY = currentY - (animation.to.y - animation.from.y) * 0.1;
            
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(currentX, currentY);
            ctx.lineTo(trailX, trailY);
            ctx.stroke();
            
            ctx.restore();
        }
    }

    // Render combat particles
    renderCombatParticles(ctx, camera) {
        ctx.save();
        
        for (const particle of this.combatParticles) {
            if (!particle.isActive) continue;
            
            // Convert world coordinates to screen coordinates
            const screenPos = camera.worldToScreen(particle.x, particle.y);
            
            // Skip particles outside viewport
            if (screenPos.x < -20 || screenPos.x > ctx.canvas.width + 20 ||
                screenPos.y < -20 || screenPos.y > ctx.canvas.height + 20) {
                continue;
            }
            
            // Calculate alpha based on particle life
            const lifeProgress = particle.life / particle.maxLife;
            const alpha = Math.max(0, 1.0 - lifeProgress); // Fade out over time
            
            // Set particle color with fade
            const rgba = this.hexToRgba(particle.color, alpha);
            ctx.fillStyle = rgba;
            
            // Draw particle with camera-adjusted size
            const adjustedSize = particle.size * camera.zoom;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, adjustedSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    // Helper to convert hex color to rgba with alpha
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

    // Removed unused preRenderStaticBackground method (dead code eliminated)

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
        this.updateCombatParticles(deltaTime);
        
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
        
        // Return all active particles to pool
        for (const particle of this.combatParticles) {
            this.returnParticleToPool(particle);
        }
        this.combatParticles = [];
        
        // Clear starfield
        this.starfieldLayers = [];
        this.backgroundStars = null;
    }

    // Get animation stats for performance monitoring
    getStats() {
        return {
            activeAnimations: this.shipAnimations.length,
            poolSize: this.shipAnimationPool.length,
            activeParticles: this.combatParticles.length,
            particlePoolSize: this.particlePool.length,
            starCount: this.starfieldLayers.reduce((sum, layer) => sum + layer.stars.length, 0)
        };
    }
}