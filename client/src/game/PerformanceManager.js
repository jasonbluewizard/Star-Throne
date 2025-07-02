/**
 * Performance Management System for Star Throne
 * Optimizes performance for Chromebook compatibility and large-scale gameplay
 */

import { gameEvents, GAME_EVENTS, EVENT_PRIORITY } from './EventSystem.js';

// Performance profiles for different device capabilities
export const PERFORMANCE_PROFILES = {
    HIGH: {
        name: 'High Performance',
        maxParticles: 200,
        maxAnimations: 50,
        renderDistance: 2000,
        updateFrequency: 60,
        aiProcessingBatch: 25,
        eventQueueSize: 20,
        enableAdvancedEffects: true
    },
    MEDIUM: {
        name: 'Medium Performance',
        maxParticles: 100,
        maxAnimations: 30,
        renderDistance: 1500,
        updateFrequency: 45,
        aiProcessingBatch: 15,
        eventQueueSize: 15,
        enableAdvancedEffects: true
    },
    LOW: {
        name: 'Low Performance (Chromebook)',
        maxParticles: 50,
        maxAnimations: 15,
        renderDistance: 1000,
        updateFrequency: 30,
        aiProcessingBatch: 8,
        eventQueueSize: 10,
        enableAdvancedEffects: false
    },
    MINIMAL: {
        name: 'Minimal Performance',
        maxParticles: 20,
        maxAnimations: 8,
        renderDistance: 800,
        updateFrequency: 20,
        aiProcessingBatch: 5,
        eventQueueSize: 5,
        enableAdvancedEffects: false
    }
};

export class PerformanceManager {
    constructor(game) {
        this.game = game;
        this.currentProfile = PERFORMANCE_PROFILES.MEDIUM;
        
        // Performance monitoring
        this.frameMetrics = {
            frameTime: 0,
            renderTime: 0,
            updateTime: 0,
            eventTime: 0,
            fps: 60,
            averageFPS: 60,
            frameHistory: []
        };
        
        // Adaptive performance tracking
        this.performanceHistory = [];
        this.adaptiveThreshold = {
            targetFPS: 30,
            warningFPS: 20,
            criticalFPS: 15
        };
        
        // Object pooling for memory efficiency
        this.objectPools = {
            animations: new ObjectPool(() => this.createAnimationObject(), 100),
            particles: new ObjectPool(() => this.createParticleObject(), 200),
            events: new ObjectPool(() => this.createEventObject(), 50)
        };
        
        // Memory management
        this.memoryStats = {
            totalAllocated: 0,
            peakUsage: 0,
            gcCount: 0,
            lastGC: 0
        };
        
        // Culling and optimization flags
        this.cullingEnabled = true;
        this.lodEnabled = true;
        this.batchRenderingEnabled = true;
        
        // Auto-tuning system
        this.autoTuningEnabled = true;
        this.lastTuningCheck = Date.now();
        this.tuningInterval = 5000; // 5 seconds
        
        console.log(`PerformanceManager initialized with ${this.currentProfile.name} profile`);
    }
    
    /**
     * Automatically detect and set appropriate performance profile
     */
    detectOptimalProfile() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isChromebook = userAgent.includes('cros') || userAgent.includes('chromebook');
        const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        
        // Hardware detection
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const renderer = gl ? gl.getParameter(gl.RENDERER) : '';
        const isLowEndGPU = renderer.includes('Intel') || renderer.includes('integrated');
        
        // Memory detection (approximate)
        const memoryInfo = performance.memory || {};
        const estimatedRAM = memoryInfo.jsHeapSizeLimit ? memoryInfo.jsHeapSizeLimit / (1024 * 1024 * 1024) : 4; // GB
        
        // Determine profile based on hardware
        if (isChromebook || (isMobile && estimatedRAM < 3) || isLowEndGPU) {
            this.setProfile(PERFORMANCE_PROFILES.LOW);
        } else if (isMobile || estimatedRAM < 6) {
            this.setProfile(PERFORMANCE_PROFILES.MEDIUM);
        } else {
            this.setProfile(PERFORMANCE_PROFILES.HIGH);
        }
        
        console.log(`Detected device: Chromebook=${isChromebook}, Mobile=${isMobile}, RAM≈${estimatedRAM.toFixed(1)}GB`);
        console.log(`Selected profile: ${this.currentProfile.name}`);
    }
    
    /**
     * Set performance profile and update game settings
     */
    setProfile(profile) {
        this.currentProfile = profile;
        this.applyProfileSettings();
        
        // Emit performance profile change event
        gameEvents.emit(GAME_EVENTS.PERFORMANCE_WARNING, {
            profile: profile.name,
            settings: profile
        }, EVENT_PRIORITY.LOW);
    }
    
    /**
     * Apply current profile settings to the game
     */
    applyProfileSettings() {
        const profile = this.currentProfile;
        
        // Update game settings based on profile
        if (this.game) {
            // AI processing batch size
            this.game.aiProcessingBatch = profile.aiProcessingBatch;
            
            // Animation limits
            this.game.maxShipAnimations = profile.maxAnimations;
            
            // Event queue size
            if (this.game.eventProcessingEnabled) {
                gameEvents.eventQueue = gameEvents.eventQueue.slice(0, profile.eventQueueSize);
            }
            
            // Visual effects
            this.game.enableAdvancedEffects = profile.enableAdvancedEffects;
        }
    }
    
    /**
     * Update performance metrics and auto-tune if enabled
     */
    update(deltaTime) {
        this.updateMetrics(deltaTime);
        
        if (this.autoTuningEnabled) {
            this.autoTunePerformance();
        }
        
        this.manageMemory();
    }
    
    /**
     * Update performance metrics
     */
    updateMetrics(deltaTime) {
        const now = performance.now();
        
        // Update FPS calculation
        if (deltaTime > 0) {
            const currentFPS = 1000 / deltaTime;
            this.frameMetrics.fps = currentFPS;
            
            // Maintain rolling average
            this.frameMetrics.frameHistory.push(currentFPS);
            if (this.frameMetrics.frameHistory.length > 60) {
                this.frameMetrics.frameHistory.shift();
            }
            
            this.frameMetrics.averageFPS = this.frameMetrics.frameHistory.reduce((a, b) => a + b, 0) / this.frameMetrics.frameHistory.length;
        }
        
        // Track performance history for auto-tuning
        this.performanceHistory.push({
            timestamp: now,
            fps: this.frameMetrics.fps,
            frameTime: this.frameMetrics.frameTime
        });
        
        // Keep only recent history (last 30 seconds)
        const cutoff = now - 30000;
        this.performanceHistory = this.performanceHistory.filter(entry => entry.timestamp > cutoff);
    }
    
    /**
     * Auto-tune performance based on current metrics
     */
    autoTunePerformance() {
        const now = Date.now();
        if (now - this.lastTuningCheck < this.tuningInterval) return;
        
        this.lastTuningCheck = now;
        const avgFPS = this.frameMetrics.averageFPS;
        
        // Check if we need to adjust performance profile
        if (avgFPS < this.adaptiveThreshold.criticalFPS) {
            // Performance is critical - downgrade profile
            if (this.currentProfile === PERFORMANCE_PROFILES.HIGH) {
                this.setProfile(PERFORMANCE_PROFILES.MEDIUM);
                console.warn(`Performance degraded (${avgFPS.toFixed(1)} FPS), switching to Medium profile`);
            } else if (this.currentProfile === PERFORMANCE_PROFILES.MEDIUM) {
                this.setProfile(PERFORMANCE_PROFILES.LOW);
                console.warn(`Performance degraded (${avgFPS.toFixed(1)} FPS), switching to Low profile`);
            } else if (this.currentProfile === PERFORMANCE_PROFILES.LOW) {
                this.setProfile(PERFORMANCE_PROFILES.MINIMAL);
                console.warn(`Performance critical (${avgFPS.toFixed(1)} FPS), switching to Minimal profile`);
            }
        } else if (avgFPS > this.adaptiveThreshold.targetFPS + 10) {
            // Performance is good - try upgrading profile
            if (this.currentProfile === PERFORMANCE_PROFILES.MINIMAL) {
                this.setProfile(PERFORMANCE_PROFILES.LOW);
                console.log(`Performance improved (${avgFPS.toFixed(1)} FPS), switching to Low profile`);
            } else if (this.currentProfile === PERFORMANCE_PROFILES.LOW) {
                this.setProfile(PERFORMANCE_PROFILES.MEDIUM);
                console.log(`Performance improved (${avgFPS.toFixed(1)} FPS), switching to Medium profile`);
            }
        }
    }
    
    /**
     * Manage memory usage and trigger garbage collection hints
     */
    manageMemory() {
        if (performance.memory) {
            const memInfo = performance.memory;
            this.memoryStats.totalAllocated = memInfo.usedJSHeapSize;
            this.memoryStats.peakUsage = Math.max(this.memoryStats.peakUsage, memInfo.usedJSHeapSize);
            
            // Check for memory pressure
            const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
            if (usageRatio > 0.85) {
                this.triggerMemoryCleanup();
                
                gameEvents.emit(GAME_EVENTS.PERFORMANCE_WARNING, {
                    type: 'memory_pressure',
                    usage: usageRatio,
                    totalMB: memInfo.usedJSHeapSize / (1024 * 1024)
                }, EVENT_PRIORITY.HIGH);
            }
        }
    }
    
    /**
     * Trigger memory cleanup procedures
     */
    triggerMemoryCleanup() {
        // Clean up object pools
        Object.values(this.objectPools).forEach(pool => pool.cleanup());
        
        // Clear old performance history
        if (this.performanceHistory.length > 100) {
            this.performanceHistory = this.performanceHistory.slice(-50);
        }
        
        // Clear old frame metrics
        if (this.frameMetrics.frameHistory.length > 60) {
            this.frameMetrics.frameHistory = this.frameMetrics.frameHistory.slice(-30);
        }
        
        // Suggest garbage collection (hint only)
        if (window.gc) {
            window.gc();
            this.memoryStats.gcCount++;
            this.memoryStats.lastGC = Date.now();
        }
        
        console.log('Memory cleanup triggered');
    }
    
    /**
     * Get performance statistics for debugging
     */
    getPerformanceStats() {
        return {
            profile: this.currentProfile.name,
            fps: this.frameMetrics.averageFPS,
            frameTime: this.frameMetrics.frameTime,
            memoryMB: this.memoryStats.totalAllocated / (1024 * 1024),
            peakMemoryMB: this.memoryStats.peakUsage / (1024 * 1024),
            gcCount: this.memoryStats.gcCount,
            poolStats: Object.fromEntries(
                Object.entries(this.objectPools).map(([key, pool]) => [key, pool.getStats()])
            )
        };
    }
    
    /**
     * Enable or disable specific optimizations
     */
    toggleOptimization(optimization, enabled) {
        switch (optimization) {
            case 'culling':
                this.cullingEnabled = enabled;
                break;
            case 'lod':
                this.lodEnabled = enabled;
                break;
            case 'batching':
                this.batchRenderingEnabled = enabled;
                break;
            case 'autoTuning':
                this.autoTuningEnabled = enabled;
                break;
        }
        
        console.log(`Performance optimization '${optimization}' ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Factory methods for object pools
    createAnimationObject() {
        return {
            x: 0, y: 0, startX: 0, startY: 0, endX: 0, endY: 0,
            progress: 0, duration: 1000, color: '#ffffff',
            type: 'ship', active: false, startTime: 0
        };
    }
    
    createParticleObject() {
        return {
            x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1000,
            color: '#ffffff', size: 1, active: false
        };
    }
    
    createEventObject() {
        return {
            type: '', data: {}, timestamp: 0, priority: 2, processed: false
        };
    }
}

/**
 * Generic Object Pool for memory efficiency
 */
class ObjectPool {
    constructor(createFn, initialSize = 10) {
        this.createFn = createFn;
        this.pool = [];
        this.active = [];
        this.totalCreated = 0;
        this.totalReused = 0;
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
            this.totalCreated++;
        }
    }
    
    /**
     * Get an object from the pool
     */
    get() {
        let obj;
        
        if (this.pool.length > 0) {
            obj = this.pool.pop();
            this.totalReused++;
        } else {
            obj = this.createFn();
            this.totalCreated++;
        }
        
        this.active.push(obj);
        return obj;
    }
    
    /**
     * Return an object to the pool
     */
    release(obj) {
        const index = this.active.indexOf(obj);
        if (index !== -1) {
            this.active.splice(index, 1);
            
            // Reset object state
            if (typeof obj.reset === 'function') {
                obj.reset();
            } else {
                obj.active = false;
            }
            
            this.pool.push(obj);
        }
    }
    
    /**
     * Clean up old objects to free memory
     */
    cleanup() {
        // Keep only a reasonable number of pooled objects
        const maxPoolSize = Math.max(10, this.active.length);
        if (this.pool.length > maxPoolSize) {
            this.pool.splice(maxPoolSize);
        }
    }
    
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            pooled: this.pool.length,
            active: this.active.length,
            totalCreated: this.totalCreated,
            totalReused: this.totalReused,
            reuseRate: this.totalCreated > 0 ? (this.totalReused / this.totalCreated) : 0
        };
    }
}