export class DistanceCache {
    constructor(game) {
        this.game = game;
        
        // Pre-computed distance matrix
        this.distanceMatrix = new Map();
        this.connectionMatrix = new Map();
        
        // Cache statistics
        this.cacheStats = {
            hits: 0,
            misses: 0,
            computations: 0,
            lastBuild: 0
        };
        
        // Cache configuration
        this.maxCacheSize = 10000; // Maximum number of cached distances
        this.rebuildThreshold = 1000; // Rebuild cache after this many misses
    }

    // Build complete distance matrix for all territories
    buildDistanceMatrix() {
        if (!this.game.gameMap || !this.game.gameMap.territories) {
            console.warn('Cannot build distance matrix: no territories available');
            return;
        }
        
        const startTime = performance.now();
        const territories = Object.values(this.game.gameMap.territories);
        const territoryCount = territories.length;
        
        console.log(`Building distance matrix for ${territoryCount} territories...`);
        
        // Clear existing cache
        this.distanceMatrix.clear();
        this.connectionMatrix.clear();
        
        // Compute all pairwise distances
        for (let i = 0; i < territories.length; i++) {
            const territory1 = territories[i];
            
            for (let j = i + 1; j < territories.length; j++) {
                const territory2 = territories[j];
                
                // Calculate Euclidean distance
                const distance = this.computeDistance(territory1, territory2);
                
                // Store in both directions for O(1) lookup
                const key1 = this.getDistanceKey(territory1.id, territory2.id);
                const key2 = this.getDistanceKey(territory2.id, territory1.id);
                
                this.distanceMatrix.set(key1, distance);
                this.distanceMatrix.set(key2, distance);
                
                // Pre-compute connection feasibility
                const isConnectable = distance <= 200; // Max connection distance
                this.connectionMatrix.set(key1, isConnectable);
                this.connectionMatrix.set(key2, isConnectable);
                
                this.cacheStats.computations++;
            }
        }
        
        const buildTime = performance.now() - startTime;
        this.cacheStats.lastBuild = Date.now();
        
        console.log(`Distance matrix built in ${buildTime.toFixed(2)}ms:`);
        console.log(`- ${this.distanceMatrix.size} distance entries`);
        console.log(`- ${this.connectionMatrix.size} connection entries`);
        console.log(`- ${this.cacheStats.computations} total computations`);
    }

    // Get distance key for caching
    getDistanceKey(id1, id2) {
        // Ensure consistent key regardless of parameter order
        return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    }

    // Get cached distance between territories
    getDistance(territory1, territory2) {
        const key = this.getDistanceKey(territory1.id, territory2.id);
        
        if (this.distanceMatrix.has(key)) {
            this.cacheStats.hits++;
            return this.distanceMatrix.get(key);
        }
        
        // Cache miss - compute and store
        this.cacheStats.misses++;
        const distance = this.computeDistance(territory1, territory2);
        
        // Only cache if we haven't exceeded max size
        if (this.distanceMatrix.size < this.maxCacheSize) {
            this.distanceMatrix.set(key, distance);
            
            // Also cache connection feasibility
            const isConnectable = distance <= 200;
            this.connectionMatrix.set(key, isConnectable);
        }
        
        // Trigger rebuild if too many misses
        if (this.cacheStats.misses % this.rebuildThreshold === 0) {
            console.log(`Distance cache rebuild triggered after ${this.cacheStats.misses} misses`);
            this.buildDistanceMatrix();
        }
        
        return distance;
    }

    // Get distance by territory IDs
    getDistanceById(territoryId1, territoryId2) {
        const key = this.getDistanceKey(territoryId1, territoryId2);
        
        if (this.distanceMatrix.has(key)) {
            this.cacheStats.hits++;
            return this.distanceMatrix.get(key);
        }
        
        // Fallback to territory lookup
        const territory1 = this.game.gameMap.territories[territoryId1];
        const territory2 = this.game.gameMap.territories[territoryId2];
        
        if (!territory1 || !territory2) {
            return Infinity;
        }
        
        return this.getDistance(territory1, territory2);
    }

    // Check if territories can be connected
    canConnect(territory1, territory2) {
        const key = this.getDistanceKey(territory1.id, territory2.id);
        
        if (this.connectionMatrix.has(key)) {
            this.cacheStats.hits++;
            return this.connectionMatrix.get(key);
        }
        
        // Compute and cache
        const distance = this.getDistance(territory1, territory2);
        const canConnect = distance <= 200; // Max connection distance
        
        if (this.connectionMatrix.size < this.maxCacheSize) {
            this.connectionMatrix.set(key, canConnect);
        }
        
        return canConnect;
    }

    // Compute actual Euclidean distance
    computeDistance(territory1, territory2) {
        const dx = territory1.x - territory2.x;
        const dy = territory1.y - territory2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Get territories within a specific range
    getTerritoriesInRange(centerTerritory, maxDistance) {
        const result = [];
        const territories = Object.values(this.game.gameMap.territories);
        
        for (const territory of territories) {
            if (territory.id === centerTerritory.id) continue;
            
            const distance = this.getDistance(centerTerritory, territory);
            if (distance <= maxDistance) {
                result.push({
                    territory,
                    distance
                });
            }
        }
        
        // Sort by distance
        result.sort((a, b) => a.distance - b.distance);
        return result;
    }

    // Find nearest territories
    findNearestTerritories(centerTerritory, count = 5) {
        const allDistances = [];
        const territories = Object.values(this.game.gameMap.territories);
        
        for (const territory of territories) {
            if (territory.id === centerTerritory.id) continue;
            
            const distance = this.getDistance(centerTerritory, territory);
            allDistances.push({
                territory,
                distance
            });
        }
        
        // Sort and return top N
        allDistances.sort((a, b) => a.distance - b.distance);
        return allDistances.slice(0, count);
    }

    // Optimized pathfinding with cached distances
    findShortestPath(startTerritoryId, endTerritoryId, ownerId = null) {
        const startTerritory = this.game.gameMap.territories[startTerritoryId];
        const endTerritory = this.game.gameMap.territories[endTerritoryId];
        
        if (!startTerritory || !endTerritory) {
            return [];
        }
        
        // Use A* algorithm with cached distances as heuristic
        const openSet = new Set([startTerritoryId]);
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        gScore.set(startTerritoryId, 0);
        fScore.set(startTerritoryId, this.getDistanceById(startTerritoryId, endTerritoryId));
        
        while (openSet.size > 0) {
            // Find node with lowest fScore
            let current = null;
            let lowestScore = Infinity;
            
            for (const nodeId of openSet) {
                const score = fScore.get(nodeId) || Infinity;
                if (score < lowestScore) {
                    lowestScore = score;
                    current = nodeId;
                }
            }
            
            if (current === endTerritoryId) {
                // Reconstruct path
                const path = [];
                let node = current;
                
                while (node !== undefined) {
                    path.unshift(node);
                    node = cameFrom.get(node);
                }
                
                return path;
            }
            
            openSet.delete(current);
            const currentTerritory = this.game.gameMap.territories[current];
            
            // Check neighbors
            for (const neighborId of currentTerritory.neighbors || []) {
                const neighbor = this.game.gameMap.territories[neighborId];
                
                // Skip if not owned by player (if ownership filter specified)
                if (ownerId && neighbor.ownerId !== ownerId) {
                    continue;
                }
                
                const tentativeGScore = (gScore.get(current) || Infinity) + 
                                       this.getDistanceById(current, neighborId);
                
                if (tentativeGScore < (gScore.get(neighborId) || Infinity)) {
                    cameFrom.set(neighborId, current);
                    gScore.set(neighborId, tentativeGScore);
                    fScore.set(neighborId, tentativeGScore + this.getDistanceById(neighborId, endTerritoryId));
                    
                    openSet.add(neighborId);
                }
            }
        }
        
        return []; // No path found
    }

    // Calculate travel time with cached distances
    calculateTravelTime(fromTerritoryId, toTerritoryId, baseSpeed = 50) {
        const distance = this.getDistanceById(fromTerritoryId, toTerritoryId);
        return distance / baseSpeed; // Time in seconds
    }

    // Get cache statistics
    getCacheStats() {
        const hitRate = this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100;
        
        return {
            distanceEntries: this.distanceMatrix.size,
            connectionEntries: this.connectionMatrix.size,
            cacheHits: this.cacheStats.hits,
            cacheMisses: this.cacheStats.misses,
            hitRate: hitRate.toFixed(1) + '%',
            totalComputations: this.cacheStats.computations,
            lastBuild: new Date(this.cacheStats.lastBuild).toLocaleTimeString(),
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    // Estimate memory usage of cache
    estimateMemoryUsage() {
        const keySize = 20; // Estimated bytes per key
        const valueSize = 8;  // 8 bytes per number
        
        const distanceMemory = this.distanceMatrix.size * (keySize + valueSize);
        const connectionMemory = this.connectionMatrix.size * (keySize + 1);
        
        const totalBytes = distanceMemory + connectionMemory;
        const totalKB = (totalBytes / 1024).toFixed(1);
        
        return `${totalKB} KB`;
    }

    // Clear cache
    clearCache() {
        this.distanceMatrix.clear();
        this.connectionMatrix.clear();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            computations: 0,
            lastBuild: 0
        };
    }

    // Update cache when territories change
    invalidateCache() {
        console.log('Distance cache invalidated due to territory changes');
        this.clearCache();
        
        // Rebuild in next frame to avoid blocking
        setTimeout(() => {
            this.buildDistanceMatrix();
        }, 0);
    }

    // Optimize cache by removing least used entries
    optimizeCache() {
        // This is a simplified optimization - in a real implementation,
        // you might track usage frequency and remove least-used entries
        
        if (this.distanceMatrix.size > this.maxCacheSize * 0.9) {
            console.log('Optimizing distance cache...');
            
            // Clear oldest entries (simplified approach)
            const entries = Array.from(this.distanceMatrix.entries());
            const keepCount = Math.floor(this.maxCacheSize * 0.7);
            
            this.distanceMatrix.clear();
            this.connectionMatrix.clear();
            
            // Keep most recently used entries
            for (let i = 0; i < keepCount && i < entries.length; i++) {
                const [key, value] = entries[i];
                this.distanceMatrix.set(key, value);
            }
            
            console.log(`Cache optimized: kept ${keepCount} entries`);
        }
    }

    // Preload frequently used distances
    preloadCommonDistances() {
        if (!this.game.humanPlayer || !this.game.humanPlayer.territories) {
            return;
        }
        
        // Preload distances from human player territories
        for (const territoryId of this.game.humanPlayer.territories) {
            const territory = this.game.gameMap.territories[territoryId];
            if (!territory) continue;
            
            // Preload distances to all neighbors
            for (const neighborId of territory.neighbors || []) {
                this.getDistanceById(territoryId, neighborId);
            }
            
            // Preload distances to nearby colonizable planets
            const nearby = this.getTerritoriesInRange(territory, 300);
            for (const entry of nearby.slice(0, 10)) { // Top 10 nearest
                // Distance already computed in getTerritoriesInRange
            }
        }
        
        console.log('Common distances preloaded');
    }

    // Reset cache for new game
    reset() {
        this.clearCache();
        console.log('Distance cache reset for new game');
    }
}