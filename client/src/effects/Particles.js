/**
 * Centralized particle / SFX helpers.
 * Pure visuals – no state-mutation, no network I/O.
 */

/* ------------------------------------------------------------------ *
 * Very small "poor-man's" particle pool – enough for browser games.  *
 * ------------------------------------------------------------------ */
const particles = [];

export const ParticlePool = {
    add(p) { 
        particles.push({ ...p, born: performance.now() }); 
    },
    
    tick(dt) {
        const now = performance.now();
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            const age = now - p.born;
            if (age >= p.life) { 
                particles.splice(i, 1); 
                continue; 
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha = p.fade ? (1 - age / p.life) : 1;
            
            // Handle pulsing effect
            if (p.pulse) {
                p.radius = p.baseRadius * (1 + Math.sin(age * 0.01) * 0.3);
            }
        }
    },
    
    draw(ctx) {
        particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha || 1;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    },
    
    clear() {
        particles.length = 0;
    },
    
    getCount() {
        return particles.length;
    }
};

export function spawnExplosion(ctx, { x, y, baseColor = '#FFAA33', count = 6, intensity = 1.0 }) {
    const particleCount = Math.floor(count * intensity);
    
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 120; // pixels/second
        const life = 300 + Math.random() * 200; // ms
        const vx = Math.cos(angle) * speed * 0.001; // convert to pixels/ms
        const vy = Math.sin(angle) * speed * 0.001;
        
        ParticlePool.add({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx,
            vy,
            life,
            color: baseColor,
            radius: 1 + Math.random() * 1,
            fade: true,
        });
    }
}

export function spawnHitFlash(ctx, { x, y, radius = 22, color = '#FFFFFF' }) {
    ParticlePool.add({
        x, 
        y, 
        vx: 0, 
        vy: 0, 
        life: 120,
        color, 
        radius,
        baseRadius: radius,
        pulse: true,
        fade: true,
    });
}

export function spawnWarpTrail(ctx, { x, y, targetX, targetY, color = '#00DDFF', segments = 8 }) {
    const dx = targetX - x;
    const dy = targetY - y;
    
    for (let i = 0; i < segments; i++) {
        const progress = i / segments;
        const trailX = x + dx * progress;
        const trailY = y + dy * progress;
        
        ParticlePool.add({
            x: trailX,
            y: trailY,
            vx: 0,
            vy: 0,
            life: 500 + Math.random() * 300,
            color,
            radius: 2 + Math.random() * 1,
            fade: true,
        });
    }
}

export function spawnShieldBubble(ctx, { x, y, radius = 30, color = '#44AAFF' }) {
    ParticlePool.add({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 800,
        color,
        radius,
        baseRadius: radius,
        pulse: true,
        fade: true,
    });
}

// Helper function to spawn colored particles matching player colors
export function spawnCombatParticles(ctx, { x, y, color, intensity = 1.0 }) {
    spawnExplosion(ctx, {
        x,
        y,
        baseColor: color,
        count: 6,
        intensity
    });
}

// Helper function for territory flash effects
export function spawnTerritoryFlash(ctx, { x, y, radius = 25, color = '#FF0000' }) {
    spawnHitFlash(ctx, {
        x,
        y,
        radius,
        color
    });
}