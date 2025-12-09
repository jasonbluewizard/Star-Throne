/**
 * FeedbackSystem.js - Centralized tactile, audio, and visual feedback
 *
 * Provides polished, elegant feedback for all user interactions including:
 * - Audio feedback (clicks, combat, success/failure)
 * - Haptic/vibration feedback for mobile devices
 * - Screen shake effects for impacts
 * - Visual glow and pulse effects
 * - Spring physics for smooth interactions
 * - Particle burst effects
 */

export class FeedbackSystem {
    constructor(game) {
        this.game = game;

        // Audio system
        this.sounds = {};
        this.audioContext = null;
        this.masterVolume = 0.5;
        this.sfxVolume = 0.7;
        this.musicVolume = 0.3;
        this.audioEnabled = true;

        // Screen shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeStartTime = 0;
        this.shakeOffset = { x: 0, y: 0 };

        // Territory glow effects
        this.glowEffects = new Map(); // territoryId -> { intensity, color, startTime, duration }

        // Territory pulse effects (for action feedback)
        this.pulseEffects = new Map(); // territoryId -> { scale, startTime, duration, color }

        // Selection particle bursts
        this.selectionParticles = [];
        this.maxSelectionParticles = 50;

        // Hover state tracking
        this.hoveredTerritoryId = null;
        this.hoverGlowIntensity = 0;
        this.targetHoverGlow = 0;

        // Spring physics for drag line
        this.springState = {
            currentX: 0,
            currentY: 0,
            targetX: 0,
            targetY: 0,
            velocityX: 0,
            velocityY: 0,
            stiffness: 300,  // Spring constant
            damping: 20,     // Friction
            mass: 1
        };

        // Number animation system
        this.numberAnimations = new Map(); // territoryId -> { from, to, current, startTime, duration }

        // Combat flash enhancement
        this.combatFlashes = new Map(); // territoryId -> { color, intensity, startTime }

        // Click ripple effects
        this.clickRipples = [];

        // Haptic patterns
        this.hapticPatterns = {
            light: [10],
            medium: [20],
            heavy: [40],
            success: [10, 50, 20],
            error: [50, 30, 50],
            double: [15, 50, 15],
            selection: [5, 30, 10],
            attack: [30, 20, 50],
            capture: [20, 50, 20, 50, 30]
        };

        // Initialize audio
        this.initAudio();
    }

    // ==================== AUDIO SYSTEM ====================

    async initAudio() {
        try {
            // Create audio context on first user interaction
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Preload sound effects
            await this.loadSound('click', '/sounds/success.mp3');
            await this.loadSound('attack', '/sounds/hit.mp3');
            await this.loadSound('success', '/sounds/success.mp3');
            await this.loadSound('hit', '/sounds/hit.mp3');

            console.log('FeedbackSystem: Audio initialized successfully');
        } catch (error) {
            console.warn('FeedbackSystem: Audio initialization failed', error);
            this.audioEnabled = false;
        }
    }

    async loadSound(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds[name] = audioBuffer;
        } catch (error) {
            console.warn(`FeedbackSystem: Failed to load sound ${name}`, error);
        }
    }

    playSound(name, volume = 1.0, pitch = 1.0) {
        if (!this.audioEnabled || !this.sounds[name] || !this.audioContext) return;

        try {
            // Resume audio context if suspended (browser autoplay policy)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();

            source.buffer = this.sounds[name];
            source.playbackRate.value = pitch;

            gainNode.gain.value = volume * this.sfxVolume * this.masterVolume;

            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            source.start(0);
        } catch (error) {
            console.warn('FeedbackSystem: Error playing sound', error);
        }
    }

    // Convenience methods for specific sounds
    playClickSound() {
        this.playSound('click', 0.3, 1.2);
    }

    playAttackSound() {
        this.playSound('attack', 0.6, 0.9 + Math.random() * 0.2);
    }

    playSuccessSound() {
        this.playSound('success', 0.5, 1.0);
    }

    playCaptureSound() {
        this.playSound('success', 0.7, 0.8);
    }

    playHitSound() {
        this.playSound('hit', 0.5, 0.8 + Math.random() * 0.4);
    }

    // ==================== HAPTIC FEEDBACK ====================

    vibrate(pattern = 'light') {
        if (!navigator.vibrate) return;

        const vibrationPattern = this.hapticPatterns[pattern] || this.hapticPatterns.light;

        try {
            navigator.vibrate(vibrationPattern);
        } catch (error) {
            // Silently fail - vibration not supported or blocked
        }
    }

    vibrateCustom(duration) {
        if (!navigator.vibrate) return;
        try {
            navigator.vibrate(duration);
        } catch (error) {
            // Silently fail
        }
    }

    // ==================== SCREEN SHAKE ====================

    triggerScreenShake(intensity = 5, duration = 200) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeStartTime = Date.now();
    }

    // Combat-specific shake with intensity based on army size
    triggerCombatShake(armySize) {
        const intensity = Math.min(15, 3 + armySize * 0.5);
        const duration = Math.min(400, 150 + armySize * 10);
        this.triggerScreenShake(intensity, duration);
    }

    updateScreenShake() {
        if (this.shakeDuration <= 0) {
            this.shakeOffset = { x: 0, y: 0 };
            return;
        }

        const elapsed = Date.now() - this.shakeStartTime;
        if (elapsed >= this.shakeDuration) {
            this.shakeDuration = 0;
            this.shakeOffset = { x: 0, y: 0 };
            return;
        }

        // Decay the shake over time
        const progress = elapsed / this.shakeDuration;
        const decay = 1 - progress;
        const currentIntensity = this.shakeIntensity * decay;

        // Random offset with decay
        this.shakeOffset = {
            x: (Math.random() - 0.5) * 2 * currentIntensity,
            y: (Math.random() - 0.5) * 2 * currentIntensity
        };
    }

    getShakeOffset() {
        return this.shakeOffset;
    }

    // ==================== GLOW EFFECTS ====================

    addGlowEffect(territoryId, color, intensity = 1.0, duration = 500) {
        this.glowEffects.set(territoryId, {
            color,
            intensity,
            startTime: Date.now(),
            duration,
            maxIntensity: intensity
        });
    }

    // Success glow (green pulse)
    addSuccessGlow(territoryId) {
        this.addGlowEffect(territoryId, '#00ff00', 1.5, 600);
    }

    // Attack glow (red pulse)
    addAttackGlow(territoryId) {
        this.addGlowEffect(territoryId, '#ff3333', 1.8, 400);
    }

    // Selection glow (cyan)
    addSelectionGlow(territoryId) {
        this.addGlowEffect(territoryId, '#00ffff', 1.2, 300);
    }

    // Capture glow (gold burst)
    addCaptureGlow(territoryId) {
        this.addGlowEffect(territoryId, '#ffd700', 2.0, 800);
    }

    updateGlowEffects() {
        const now = Date.now();

        for (const [territoryId, glow] of this.glowEffects) {
            const elapsed = now - glow.startTime;
            if (elapsed >= glow.duration) {
                this.glowEffects.delete(territoryId);
                continue;
            }

            // Ease out the glow
            const progress = elapsed / glow.duration;
            glow.intensity = glow.maxIntensity * (1 - this.easeOutCubic(progress));
        }
    }

    getGlowEffect(territoryId) {
        return this.glowEffects.get(territoryId);
    }

    // ==================== PULSE EFFECTS ====================

    addPulseEffect(territoryId, color = '#ffffff', scale = 1.3, duration = 400) {
        this.pulseEffects.set(territoryId, {
            color,
            scale,
            currentScale: 1.0,
            startTime: Date.now(),
            duration
        });
    }

    updatePulseEffects() {
        const now = Date.now();

        for (const [territoryId, pulse] of this.pulseEffects) {
            const elapsed = now - pulse.startTime;
            if (elapsed >= pulse.duration) {
                this.pulseEffects.delete(territoryId);
                continue;
            }

            // Ease out elastic for bouncy feel
            const progress = elapsed / pulse.duration;
            const eased = this.easeOutElastic(progress);
            pulse.currentScale = 1 + (pulse.scale - 1) * (1 - eased);
        }
    }

    getPulseEffect(territoryId) {
        return this.pulseEffects.get(territoryId);
    }

    // ==================== SELECTION PARTICLES ====================

    createSelectionBurst(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            if (this.selectionParticles.length >= this.maxSelectionParticles) {
                // Reuse oldest particle
                const particle = this.selectionParticles.shift();
                this.initParticle(particle, x, y, color, i, count);
                this.selectionParticles.push(particle);
            } else {
                const particle = {};
                this.initParticle(particle, x, y, color, i, count);
                this.selectionParticles.push(particle);
            }
        }
    }

    initParticle(particle, x, y, color, index, total) {
        const angle = (index / total) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 80 + Math.random() * 60;

        particle.x = x;
        particle.y = y;
        particle.vx = Math.cos(angle) * speed;
        particle.vy = Math.sin(angle) * speed;
        particle.life = 0;
        particle.maxLife = 400 + Math.random() * 200;
        particle.size = 2 + Math.random() * 2;
        particle.color = color;
        particle.alpha = 1.0;
        particle.startTime = Date.now();
    }

    updateSelectionParticles(deltaTime) {
        const dt = deltaTime / 1000;

        for (let i = this.selectionParticles.length - 1; i >= 0; i--) {
            const particle = this.selectionParticles[i];

            // Update position with deceleration
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vx *= 0.95;
            particle.vy *= 0.95;

            // Update life and alpha
            particle.life += deltaTime;
            particle.alpha = 1.0 - (particle.life / particle.maxLife);

            // Remove dead particles
            if (particle.life >= particle.maxLife) {
                this.selectionParticles.splice(i, 1);
            }
        }
    }

    renderSelectionParticles(ctx, camera) {
        ctx.save();

        for (const particle of this.selectionParticles) {
            if (particle.alpha <= 0) continue;

            ctx.globalAlpha = particle.alpha;
            ctx.fillStyle = particle.color;

            // Add subtle glow
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = particle.size * 2;

            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size * particle.alpha, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // ==================== HOVER GLOW ====================

    setHoveredTerritory(territoryId) {
        if (territoryId !== this.hoveredTerritoryId) {
            this.hoveredTerritoryId = territoryId;
            this.targetHoverGlow = territoryId ? 1.0 : 0;
        }
    }

    updateHoverGlow(deltaTime) {
        const speed = 8; // Glow transition speed
        const dt = deltaTime / 1000;

        if (this.hoverGlowIntensity < this.targetHoverGlow) {
            this.hoverGlowIntensity = Math.min(this.targetHoverGlow, this.hoverGlowIntensity + speed * dt);
        } else if (this.hoverGlowIntensity > this.targetHoverGlow) {
            this.hoverGlowIntensity = Math.max(this.targetHoverGlow, this.hoverGlowIntensity - speed * dt);
        }
    }

    getHoverGlowIntensity() {
        return this.hoverGlowIntensity;
    }

    getHoveredTerritoryId() {
        return this.hoveredTerritoryId;
    }

    // ==================== SPRING PHYSICS ====================

    setSpringTarget(x, y) {
        this.springState.targetX = x;
        this.springState.targetY = y;
    }

    resetSpring(x, y) {
        this.springState.currentX = x;
        this.springState.currentY = y;
        this.springState.targetX = x;
        this.springState.targetY = y;
        this.springState.velocityX = 0;
        this.springState.velocityY = 0;
    }

    updateSpring(deltaTime) {
        const dt = Math.min(deltaTime / 1000, 0.033); // Cap at 30fps equivalent for stability
        const { stiffness, damping, mass } = this.springState;

        // Calculate spring force
        const dx = this.springState.targetX - this.springState.currentX;
        const dy = this.springState.targetY - this.springState.currentY;

        // F = -kx - bv (spring force - damping force)
        const forceX = stiffness * dx - damping * this.springState.velocityX;
        const forceY = stiffness * dy - damping * this.springState.velocityY;

        // a = F/m
        const accelX = forceX / mass;
        const accelY = forceY / mass;

        // Update velocity
        this.springState.velocityX += accelX * dt;
        this.springState.velocityY += accelY * dt;

        // Update position
        this.springState.currentX += this.springState.velocityX * dt;
        this.springState.currentY += this.springState.velocityY * dt;
    }

    getSpringPosition() {
        return {
            x: this.springState.currentX,
            y: this.springState.currentY
        };
    }

    // ==================== NUMBER ANIMATIONS ====================

    animateNumber(territoryId, fromValue, toValue, duration = 500) {
        this.numberAnimations.set(territoryId, {
            from: fromValue,
            to: toValue,
            current: fromValue,
            startTime: Date.now(),
            duration
        });
    }

    updateNumberAnimations() {
        const now = Date.now();

        for (const [territoryId, anim] of this.numberAnimations) {
            const elapsed = now - anim.startTime;
            if (elapsed >= anim.duration) {
                anim.current = anim.to;
                this.numberAnimations.delete(territoryId);
                continue;
            }

            const progress = elapsed / anim.duration;
            const eased = this.easeOutCubic(progress);
            anim.current = Math.round(anim.from + (anim.to - anim.from) * eased);
        }
    }

    getAnimatedNumber(territoryId, actualValue) {
        const anim = this.numberAnimations.get(territoryId);
        return anim ? anim.current : actualValue;
    }

    // ==================== CLICK RIPPLES ====================

    createClickRipple(x, y, color = '#ffffff') {
        this.clickRipples.push({
            x,
            y,
            color,
            radius: 0,
            maxRadius: 40,
            alpha: 0.6,
            startTime: Date.now(),
            duration: 400
        });
    }

    updateClickRipples() {
        const now = Date.now();

        for (let i = this.clickRipples.length - 1; i >= 0; i--) {
            const ripple = this.clickRipples[i];
            const elapsed = now - ripple.startTime;

            if (elapsed >= ripple.duration) {
                this.clickRipples.splice(i, 1);
                continue;
            }

            const progress = elapsed / ripple.duration;
            ripple.radius = ripple.maxRadius * this.easeOutCubic(progress);
            ripple.alpha = 0.6 * (1 - progress);
        }
    }

    renderClickRipples(ctx) {
        ctx.save();

        for (const ripple of this.clickRipples) {
            ctx.strokeStyle = ripple.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = ripple.alpha;

            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    // ==================== COMBAT FLASH ENHANCEMENT ====================

    addCombatFlash(territoryId, attackerColor, defenderColor) {
        this.combatFlashes.set(territoryId, {
            attackerColor,
            defenderColor,
            startTime: Date.now(),
            duration: 600,
            phase: 0
        });
    }

    updateCombatFlashes() {
        const now = Date.now();

        for (const [territoryId, flash] of this.combatFlashes) {
            const elapsed = now - flash.startTime;
            if (elapsed >= flash.duration) {
                this.combatFlashes.delete(territoryId);
                continue;
            }

            flash.phase = (elapsed / flash.duration);
        }
    }

    getCombatFlash(territoryId) {
        return this.combatFlashes.get(territoryId);
    }

    // ==================== EASING FUNCTIONS ====================

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 :
            Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    // ==================== COMBINED FEEDBACK TRIGGERS ====================

    // Trigger feedback for territory selection
    onTerritorySelect(territory) {
        this.playClickSound();
        this.vibrate('selection');
        this.addSelectionGlow(territory.id);
        this.createSelectionBurst(territory.x, territory.y, '#00ffff', 10);
        this.addPulseEffect(territory.id, '#00ffff', 1.15, 300);
    }

    // Trigger feedback for fleet command issued
    onFleetCommandIssued(fromTerritory, toTerritory, isAttack) {
        if (isAttack) {
            this.playAttackSound();
            this.vibrate('attack');
            this.addAttackGlow(fromTerritory.id);
        } else {
            this.playClickSound();
            this.vibrate('medium');
            this.addSuccessGlow(fromTerritory.id);
        }
        this.createClickRipple(fromTerritory.x, fromTerritory.y, isAttack ? '#ff3333' : '#00ff00');
    }

    // Trigger feedback for combat
    onCombat(territory, attackerColor, defenderColor, armySize) {
        this.playHitSound();
        this.vibrate('heavy');
        this.triggerCombatShake(armySize);
        this.addCombatFlash(territory.id, attackerColor, defenderColor);
    }

    // Trigger feedback for territory capture
    onTerritoryCapture(territory, capturedByPlayer) {
        this.playCaptureSound();
        this.vibrate('capture');
        this.triggerScreenShake(8, 300);
        this.addCaptureGlow(territory.id);
        this.createSelectionBurst(territory.x, territory.y, '#ffd700', 20);
        this.addPulseEffect(territory.id, '#ffd700', 1.4, 600);
    }

    // Trigger feedback for hover
    onTerritoryHover(territory) {
        this.setHoveredTerritory(territory?.id || null);
    }

    // Trigger feedback for army size change
    onArmySizeChange(territory, oldSize, newSize) {
        if (oldSize !== newSize) {
            this.animateNumber(territory.id, oldSize, newSize, 400);
        }
    }

    // ==================== UPDATE LOOP ====================

    update(deltaTime) {
        this.updateScreenShake();
        this.updateGlowEffects();
        this.updatePulseEffects();
        this.updateSelectionParticles(deltaTime);
        this.updateHoverGlow(deltaTime);
        this.updateSpring(deltaTime);
        this.updateNumberAnimations();
        this.updateClickRipples();
        this.updateCombatFlashes();
    }

    // ==================== RENDER ====================

    render(ctx, camera) {
        // Render selection particles (in world space)
        this.renderSelectionParticles(ctx, camera);

        // Render click ripples (in world space)
        this.renderClickRipples(ctx);
    }

    // ==================== CLEANUP ====================

    cleanup() {
        this.glowEffects.clear();
        this.pulseEffects.clear();
        this.selectionParticles = [];
        this.numberAnimations.clear();
        this.clickRipples = [];
        this.combatFlashes.clear();

        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}
