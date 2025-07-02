export class MemoryManager {
    constructor(game) {
        this.game = game;
        
        // Object pools for frequent allocations
        this.objectPools = {
            vector2: { pool: [], maxSize: 100 },
            combatResult: { pool: [], maxSize: 50 },
            eventData: { pool: [], maxSize: 200 },
            renderBatch: { pool: [], maxSize: 150 }
        };
        
        // Memory tracking
        this.memoryStats = {
            poolHits: 0,
            poolMisses: 0,
            gcTriggers: 0,
            lastCleanup: Date.now()
        };
        
        // Cleanup intervals
        this.cleanupInterval = 30000; // 30 seconds
        this.forceGCThreshold = 100; // Force GC after 100 pool misses
        
        // WeakMap for automatic cleanup of references
        this.weakReferences = new WeakMap();
        
        // Initialize pools
        this.initializePools();
    }

    // Initialize object pools with pre-allocated objects
    initializePools() {
        // Vector2 pool for position calculations
        for (let i = 0; i < this.objectPools.vector2.maxSize; i++) {
            this.objectPools.vector2.pool.push(this.createVector2());
        }
        
        // Combat result pool
        for (let i = 0; i < this.objectPools.combatResult.maxSize; i++) {
            this.objectPools.combatResult.pool.push(this.createCombatResult());
        }
        
        // Event data pool
        for (let i = 0; i < this.objectPools.eventData.maxSize; i++) {
            this.objectPools.eventData.pool.push(this.createEventData());
        }
        
        // Render batch pool
        for (let i = 0; i < this.objectPools.renderBatch.maxSize; i++) {
            this.objectPools.renderBatch.pool.push(this.createRenderBatch());
        }
        
        console.log('Memory pools initialized:', {
            vector2: this.objectPools.vector2.pool.length,
            combatResult: this.objectPools.combatResult.pool.length,
            eventData: this.objectPools.eventData.pool.length,
            renderBatch: this.objectPools.renderBatch.pool.length
        });
    }

    // Get object from pool or create new one
    getPooledObject(type) {
        const pool = this.objectPools[type];
        if (!pool) return null;
        
        if (pool.pool.length > 0) {
            this.memoryStats.poolHits++;
            return pool.pool.pop();
        } else {
            this.memoryStats.poolMisses++;
            
            // Trigger GC if too many misses
            if (this.memoryStats.poolMisses % this.forceGCThreshold === 0) {
                this.triggerGarbageCollection();
            }
            
            // Create new object
            switch (type) {
                case 'vector2': return this.createVector2();
                case 'combatResult': return this.createCombatResult();
                case 'eventData': return this.createEventData();
                case 'renderBatch': return this.createRenderBatch();
                default: return null;
            }
        }
    }

    // Return object to pool
    returnToPool(type, obj) {
        const pool = this.objectPools[type];
        if (!pool || pool.pool.length >= pool.maxSize) {
            return; // Pool full or invalid type
        }
        
        // Reset object properties
        this.resetObject(type, obj);
        
        // Return to pool
        pool.pool.push(obj);
    }

    // Create factory methods for pooled objects
    createVector2() {
        return { x: 0, y: 0, inUse: false };
    }

    createCombatResult() {
        return {
            success: false,
            attackerId: null,
            defenderId: null,
            survivingArmies: 0,
            timestamp: 0,
            inUse: false
        };
    }

    createEventData() {
        return {
            type: '',
            payload: null,
            timestamp: 0,
            processed: false,
            inUse: false
        };
    }

    createRenderBatch() {
        return {
            territories: [],
            connections: [],
            effects: [],
            lod: 'detailed',
            inUse: false
        };
    }

    // Reset object to default state
    resetObject(type, obj) {
        if (!obj) return;
        
        obj.inUse = false;
        
        switch (type) {
            case 'vector2':
                obj.x = 0;
                obj.y = 0;
                break;
                
            case 'combatResult':
                obj.success = false;
                obj.attackerId = null;
                obj.defenderId = null;
                obj.survivingArmies = 0;
                obj.timestamp = 0;
                break;
                
            case 'eventData':
                obj.type = '';
                obj.payload = null;
                obj.timestamp = 0;
                obj.processed = false;
                break;
                
            case 'renderBatch':
                obj.territories.length = 0;
                obj.connections.length = 0;
                obj.effects.length = 0;
                obj.lod = 'detailed';
                break;
        }
    }

    // Convenient methods for common operations
    getVector2(x = 0, y = 0) {
        const vec = this.getPooledObject('vector2');
        vec.x = x;
        vec.y = y;
        vec.inUse = true;
        return vec;
    }

    getCombatResult(success, attackerId, defenderId, survivingArmies) {
        const result = this.getPooledObject('combatResult');
        result.success = success;
        result.attackerId = attackerId;
        result.defenderId = defenderId;
        result.survivingArmies = survivingArmies;
        result.timestamp = Date.now();
        result.inUse = true;
        return result;
    }

    getEventData(type, payload) {
        const event = this.getPooledObject('eventData');
        event.type = type;
        event.payload = payload;
        event.timestamp = Date.now();
        event.processed = false;
        event.inUse = true;
        return event;
    }

    getRenderBatch(lod = 'detailed') {
        const batch = this.getPooledObject('renderBatch');
        batch.lod = lod;
        batch.inUse = true;
        return batch;
    }

    // Automatic cleanup of expired references
    performPeriodicCleanup() {
        const now = Date.now();
        if (now - this.memoryStats.lastCleanup < this.cleanupInterval) {
            return;
        }
        
        this.memoryStats.lastCleanup = now;
        
        // Clean up event system queue
        if (this.game.eventSystem) {
            this.cleanupEventQueue();
        }
        
        // Clean up animation pools
        if (this.game.animationSystem) {
            this.cleanupAnimationPools();
        }
        
        // Clean up discovery system
        if (this.game.discoverySystem) {
            this.cleanupDiscoverySystem();
        }
        
        // Clean up UI manager
        if (this.game.uiManager) {
            this.cleanupUIManager();
        }
        
        console.log('Periodic memory cleanup completed');
    }

    // Clean up event queue
    cleanupEventQueue() {
        // Remove processed events older than 5 seconds
        const cutoffTime = Date.now() - 5000;
        
        // Note: This would need to be implemented in EventSystem
        // this.game.eventSystem.removeProcessedEvents(cutoffTime);
    }

    // Clean up animation object pools
    cleanupAnimationPools() {
        if (!this.game.animationSystem.shipAnimationPool) return;
        
        // Remove excess objects from animation pool
        const maxPoolSize = this.game.animationSystem.maxPoolSize;
        const currentSize = this.game.animationSystem.shipAnimationPool.length;
        
        if (currentSize > maxPoolSize * 1.5) {
            const excessCount = currentSize - maxPoolSize;
            this.game.animationSystem.shipAnimationPool.splice(0, excessCount);
        }
    }

    // Clean up discovery system
    cleanupDiscoverySystem() {
        const discovery = this.game.discoverySystem;
        
        // Remove old floating discoveries
        const cutoffTime = Date.now() - 10000; // 10 seconds
        discovery.floatingDiscoveries = discovery.floatingDiscoveries.filter(
            d => d.createdAt > cutoffTime
        );
        
        // Limit recent discoveries to last 5
        if (discovery.recentDiscoveries.length > 5) {
            discovery.recentDiscoveries = discovery.recentDiscoveries.slice(0, 5);
        }
    }

    // Clean up UI manager
    cleanupUIManager() {
        const ui = this.game.uiManager;
        
        // Remove expired notifications
        const cutoffTime = Date.now() - 30000; // 30 seconds
        ui.notifications = ui.notifications.filter(
            n => n.createdAt > cutoffTime
        );
    }

    // Force garbage collection (browser permitting)
    triggerGarbageCollection() {
        this.memoryStats.gcTriggers++;
        
        // Clear any circular references
        this.clearCircularReferences();
        
        // Suggest garbage collection (if available)
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
        }
        
        console.log(`Forced GC trigger #${this.memoryStats.gcTriggers}`);
    }

    // Clear circular references
    clearCircularReferences() {
        // Remove expired weak references
        // WeakMap automatically handles this, but we can clear explicit references
        
        // Clear any cached DOM references
        this.clearDOMReferences();
        
        // Clear any cached function closures
        this.clearFunctionReferences();
    }

    // Clear DOM references that might prevent GC
    clearDOMReferences() {
        // Remove any cached canvas contexts or DOM elements
        // that might be holding references to the game objects
    }

    // Clear function references that might create closures
    clearFunctionReferences() {
        // Clear any event listeners or callbacks that might
        // be holding references to game objects
    }

    // Monitor memory usage
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    // Get detailed memory statistics
    getMemoryStats() {
        const poolStats = {};
        for (const [type, pool] of Object.entries(this.objectPools)) {
            poolStats[type] = {
                available: pool.pool.length,
                maxSize: pool.maxSize,
                utilization: ((pool.maxSize - pool.pool.length) / pool.maxSize * 100).toFixed(1) + '%'
            };
        }
        
        return {
            pools: poolStats,
            performance: {
                poolHits: this.memoryStats.poolHits,
                poolMisses: this.memoryStats.poolMisses,
                hitRate: (this.memoryStats.poolHits / (this.memoryStats.poolHits + this.memoryStats.poolMisses) * 100).toFixed(1) + '%',
                gcTriggers: this.memoryStats.gcTriggers
            },
            system: this.getMemoryUsage(),
            lastCleanup: new Date(this.memoryStats.lastCleanup).toLocaleTimeString()
        };
    }

    // Update method called from game loop
    update() {
        this.performPeriodicCleanup();
    }

    // Reset all pools and stats
    reset() {
        // Clear all pools
        for (const pool of Object.values(this.objectPools)) {
            pool.pool.length = 0;
        }
        
        // Reset stats
        this.memoryStats = {
            poolHits: 0,
            poolMisses: 0,
            gcTriggers: 0,
            lastCleanup: Date.now()
        };
        
        // Reinitialize pools
        this.initializePools();
    }

    // Cleanup on game end
    destroy() {
        this.clearCircularReferences();
        this.reset();
        console.log('Memory manager destroyed');
    }
}