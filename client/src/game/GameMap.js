import { Territory } from './Territory';
import MapGenerator from './MapGenerator';
import Delaunator from 'delaunator';

export class GameMap {
    constructor(width, height, config = {}) {
        // Use the provided dimensions directly (already expanded in StarThrone.js)
        this.width = width;
        this.height = height;
        this.territories = {};
        this.nebulas = []; // Purple nebula clouds
        this.gridSize = 150; // Increased space between territory centers for less crowding
        
        // Spatial indexing for O(1) territory lookups instead of O(n)
        this.spatialGridSize = 100; // Grid cell size in pixels
        this.spatialGrid = new Map(); // Map of "x,y" -> Territory[]
        this.spatialIndexEnabled = true;
        
        // Advanced configuration options
        this.layout = config.layout || 'organic'; // Layout type: organic, clusters, spiral, core, ring, binary
        this.connectionDistance = config.connectionRange || 25; // Max distance for territory connections - prevent long-distance warp lanes
        this.warpLaneDensity = config.warpLaneDensity || 80; // Percentage density for connections
        this.nebulaCount = config.nebulaCount !== undefined ? config.nebulaCount : 10; // Number of nebula fields
        this.nebulaSlowdown = config.nebulaSlowdown !== undefined ? config.nebulaSlowdown : true;
        this.supplyRoutes = config.supplyRoutes !== undefined ? config.supplyRoutes : true;
        this.probeColonization = config.probeColonization !== undefined ? config.probeColonization : true;
    }
    
    // Helper function to check if a point is within organic galaxy boundaries
    isWithinGalaxyBounds(x, y) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Calculate normalized position (0 to 1 from center)
        const normalizedX = (x - centerX) / (this.width / 2);
        const normalizedY = (y - centerY) / (this.height / 2);
        
        // Create organic galaxy shape using multiple sine waves for irregular edges
        const baseRadius = 0.75; // Base galaxy size (75% of max) for more padding
        
        // Use angle from center for perlin-like noise effect
        const angle = Math.atan2(normalizedY, normalizedX);
        
        // Create multiple frequency sine waves for organic edge variation
        const edgeVariation = 
            0.15 * Math.sin(angle * 3.7) + // Large bumps
            0.08 * Math.sin(angle * 7.2) + // Medium bumps  
            0.05 * Math.sin(angle * 11.8) + // Small bumps
            0.03 * Math.sin(angle * 17.3); // Fine detail
        
        // Calculate distance from center
        const distanceFromCenter = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
        
        // Organic boundary with variation
        const maxDistance = baseRadius + edgeVariation;
        
        return distanceFromCenter <= maxDistance;
    }

    // Helper function to get max radius at a specific angle for organic boundary
    getMaxRadiusAtAngle(angle) {
        const baseRadius = 0.75; // Base galaxy size (75% of max) for more padding
        
        // Create organic edge variation using the same formula as boundary check
        const edgeVariation = 
            0.15 * Math.sin(angle * 3.7) + // Large bumps
            0.08 * Math.sin(angle * 7.2) + // Medium bumps  
            0.05 * Math.sin(angle * 11.8) + // Small bumps
            0.03 * Math.sin(angle * 17.3); // Fine detail
        
        return baseRadius + edgeVariation;
    }

    // Helper function to check if a point is too close to existing points
    isValidPosition(x, y, existingPoints, minDistance = this.gridSize) {
        // First check if within organic galaxy boundaries
        if (!this.isWithinGalaxyBounds(x, y)) return false;
        
        // Then check minimum distance from other territories
        for (const point of existingPoints) {
            const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
            if (dist < minDistance) return false;
        }
        return true;
    }

    generateTerritories(count) {
        console.log(`🌌 Generating ${count} territories using advanced ${this.layout} layout...`);
        
        // Set target dimensions for MapGenerator to use our expanded size
        MapGenerator.targetWidth = this.width;
        MapGenerator.targetHeight = this.height;
        
        // Use the advanced MapGenerator for sophisticated galaxy layouts
        const generatedTerritories = MapGenerator.generateMap(count, this.layout, 20); // Assume 20 players for cluster generation
        
        // Keep our expanded dimensions (don't overwrite with MapGenerator's)
        console.log(`📐 Using expanded map dimensions: ${this.width} x ${this.height}`);
        
        // Convert generated territories to our game format - ALL have neutral garrisons
        generatedTerritories.forEach((territory, index) => {
            // Set up neutral garrison (1-30 armies visible)
            territory.isColonizable = false;
            territory.armySize = Math.floor(Math.random() * 30) + 1; // Visible garrison size
            territory.ownerId = null; // Neutral until captured
            
            // All connections are visible from the start (no hidden neighbors)
            // territory.neighbors already set by MapGenerator - keep them visible
            territory.hiddenNeighbors = []; // No hidden connections with new visibility system
            
            this.territories[index] = territory;
            
            // Spatial indexing for performance
            this.addToSpatialIndex(territory);
        });
        
        console.log(`✨ Generated ${count} territories with advanced ${this.layout} galaxy layout`);
        console.log(`📐 Map dimensions: ${this.width} x ${this.height}`);
        console.log(`🔗 Sophisticated warp lane network with planar connectivity`);
        
        // Generate nebula fields AFTER territories to avoid overlaps
        this.generateNebulas();
    }
    
    /**
     * Fast map generation using simple algorithms to eliminate startup delay
     */
    generateTerritoriesFast(count) {
        // Removed debug map generation logging (dead code cleanup)
        
        const territories = [];
        const points = [];
        
        // Simple Poisson disk sampling without expensive algorithms
        let attempts = 0;
        const maxAttempts = count * 10; // Limit attempts to prevent infinite loops
        
        while (territories.length < count && attempts < maxAttempts) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            
            // Check if position is valid (within bounds and min distance from others)
            if (this.isValidPosition(x, y, points, this.gridSize * 0.8)) {
                const territory = new Territory({
                    id: territories.length,
                    x: x,
                    y: y,
                    armySize: Math.floor(Math.random() * 30) + 1, // Neutral garrison
                    ownerId: null,
                    neighbors: [],
                    hiddenNeighbors: []
                });
                
                territories.push(territory);
                points.push({ x, y });
                this.territories[territory.id] = territory;
                this.addToSpatialIndex(territory);
            }
            attempts++;
        }
        
        // No longer create warp lane connections - range-based movement only
        // Each territory remains isolated, connections determined by player range
        
        console.log(`⚡ Fast generated ${territories.length} territories in simplified layout`);
        console.log(`📐 Map dimensions: ${this.width} x ${this.height}`);
        
        // Generate fewer nebulas for faster startup
        this.generateNebulas();
    }
    
    generateNebulas() {
        // Use configurable nebula count (0-20)
        const nebulaCount = this.nebulaCount;
        
        for (let i = 0; i < nebulaCount; i++) {
            let attempts = 0;
            let x, y;
            
            // Find positions within organic galaxy boundaries
            do {
                x = Math.random() * this.width;
                y = Math.random() * this.height;
                attempts++;
            } while (!this.isWithinGalaxyBounds(x, y) && attempts < 50);
            
            // If we couldn't find a valid position after many attempts, skip this nebula
            if (attempts >= 50) continue;
            
            const nebula = {
                x: x,
                y: y,
                radius: 80 + Math.random() * 120, // Size varies from 80 to 200
                opacity: 0.3 + Math.random() * 0.4, // Opacity varies from 0.3 to 0.7
                color: `rgba(147, 51, 234, ${0.3 + Math.random() * 0.4})` // Purple with varying opacity
            };
            this.nebulas.push(nebula);
        }
        
        console.log(`Generated ${nebulaCount} nebula fields (configured: ${this.nebulaCount})`);
    }
    


    // ===== OBSOLETE METHODS REMOVED =====
    // The following legacy layout generation methods have been replaced by the advanced MapGenerator class:
    // - poissonDiskSampling() - replaced by MapGenerator.generateMap() with organic layout
    // - generateClusterLayout() - replaced by MapGenerator cluster algorithm with Delaunay triangulation
    // - generateSpiralLayout() - replaced by MapGenerator spiral algorithm with force-directed relaxation
    // - generateCoreLayout() - replaced by MapGenerator core algorithm with MST connectivity
    // - generateRingLayout() - replaced by MapGenerator ring algorithm with optimal spacing
    // - generateBinaryLayout() - replaced by MapGenerator binary algorithm with planar connections
    // - connectTerritoriesForLayout() - replaced by MapGenerator's sophisticated warp lane networks
    //
    // All map generation now uses the advanced MapGenerator class which provides:
    // ✅ Delaunay triangulation for planar connectivity (no crossing warp lanes)
    // ✅ Minimum Spanning Tree algorithms for optimal path networks
    // ✅ Force-directed relaxation for natural territory spacing
    // ✅ Collision detection preventing lanes from cutting through territories
    // ✅ Six distinct galaxy layouts with unique characteristics
    

    

    
    generateRingLayout(count) {
        const points = [];
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const rings = 4 + Math.floor(Math.random() * 3); // 4-6 rings
        const planetsPerRing = Math.floor(count / rings);
        
        for (let ring = 0; ring < rings; ring++) {
            const radius = 60 + ring * 70; // Rings spaced 70 units apart
            const ringPlanets = ring === rings - 1 ? 
                count - (planetsPerRing * ring) : planetsPerRing;
            
            for (let i = 0; i < ringPlanets; i++) {
                let attempts = 0;
                let validPoint = false;
                
                while (!validPoint && attempts < 100) {
                    const angle = (i / ringPlanets) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
                    const ringRadius = radius + (Math.random() - 0.5) * 30; // Slight radius variation
                    
                    const x = centerX + Math.cos(angle) * ringRadius;
                    const y = centerY + Math.sin(angle) * ringRadius;
                    
                    if (this.isValidPosition(x, y, points)) {
                        points.push({ x, y });
                        validPoint = true;
                    }
                    attempts++;
                }
                
                // Fallback: random placement if ring placement fails
                if (!validPoint) {
                    for (let j = 0; j < 50; j++) {
                        const x = Math.random() * (this.width - 60) + 30;
                        const y = Math.random() * (this.height - 60) + 30;
                        
                        if (this.isValidPosition(x, y, points)) {
                            points.push({ x, y });
                            break;
                        }
                    }
                }
            }
        }
        
        return points;
    }
    
    generateBinaryLayout(count) {
        const points = [];
        const leftCenterX = this.width * 0.3;
        const rightCenterX = this.width * 0.7;
        const centerY = this.height / 2;
        const systemRadius = Math.min(this.width, this.height) * 0.25;
        
        // Split planets between two major systems
        const leftCount = Math.floor(count / 2);
        const rightCount = count - leftCount;
        
        // Left system
        for (let i = 0; i < leftCount; i++) {
            let attempts = 0;
            let validPoint = false;
            
            while (!validPoint && attempts < 100) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.random() * systemRadius;
                const x = leftCenterX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                if (this.isValidPosition(x, y, points)) {
                    points.push({ x, y });
                    validPoint = true;
                }
                attempts++;
            }
            
            // Fallback: random placement if system placement fails
            if (!validPoint) {
                for (let j = 0; j < 50; j++) {
                    const x = Math.random() * (this.width - 60) + 30;
                    const y = Math.random() * (this.height - 60) + 30;
                    
                    if (this.isValidPosition(x, y, points)) {
                        points.push({ x, y });
                        break;
                    }
                }
            }
        }
        
        // Right system
        for (let i = 0; i < rightCount; i++) {
            let attempts = 0;
            let validPoint = false;
            
            while (!validPoint && attempts < 100) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.random() * systemRadius;
                const x = rightCenterX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                if (this.isValidPosition(x, y, points)) {
                    points.push({ x, y });
                    validPoint = true;
                }
                attempts++;
            }
            
            // Fallback: random placement if system placement fails
            if (!validPoint) {
                for (let j = 0; j < 50; j++) {
                    const x = Math.random() * (this.width - 60) + 30;
                    const y = Math.random() * (this.height - 60) + 30;
                    
                    if (this.isValidPosition(x, y, points)) {
                        points.push({ x, y });
                        break;
                    }
                }
            }
        }
        
        return points;
    }
    
    connectTerritoriesForLayout() {
        // Different connection strategies based on layout
        switch (this.layout) {
            case 'clusters':
                this.connectClusters();
                break;
            case 'spiral':
                this.connectSpiral();
                break;
            case 'core':
                this.connectCore();
                break;
            case 'ring':
                this.connectRings();
                break;
            case 'binary':
                this.connectBinary();
                break;
            case 'organic':
            default:
                this.connectTerritories();
                break;
        }
    }
    
    connectClusters() {
        const territoryList = Object.values(this.territories);
        
        // First connect within clusters (short distance connections)
        for (let i = 0; i < territoryList.length; i++) {
            const territory = territoryList[i];
            const closeNeighbors = [];
            
            for (let j = 0; j < territoryList.length; j++) {
                if (i === j) continue;
                const other = territoryList[j];
                const distance = territory.getDistanceTo(other);
                
                if (distance <= this.connectionDistance) { // Close cluster connections
                    closeNeighbors.push({ territory: other, distance });
                }
            }
            
            closeNeighbors.sort((a, b) => a.distance - b.distance);
            const connections = Math.min(4, closeNeighbors.length);
            
            for (let k = 0; k < connections; k++) {
                const neighbor = closeNeighbors[k].territory;
                territory.addNeighbor(neighbor.id);
                neighbor.addNeighbor(territory.id);
            }
        }
        
        // Then add bridge connections between clusters
        for (let i = 0; i < territoryList.length; i++) {
            const territory = territoryList[i];
            const bridgeTargets = [];
            
            for (let j = 0; j < territoryList.length; j++) {
                if (i === j) continue;
                const other = territoryList[j];
                const distance = territory.getDistanceTo(other);
                
                if (distance > this.connectionDistance * 0.8 && distance <= this.connectionDistance * 1.5) { // Bridge connections
                    bridgeTargets.push({ territory: other, distance });
                }
            }
            
            if (bridgeTargets.length > 0) {
                bridgeTargets.sort((a, b) => a.distance - b.distance);
                const neighbor = bridgeTargets[0].territory;
                territory.addNeighbor(neighbor.id);
                neighbor.addNeighbor(territory.id);
            }
        }
    }
    
    connectSpiral() {
        const territoryList = Object.values(this.territories);
        
        // Connect along spiral arms and between nearby arms
        for (let i = 0; i < territoryList.length; i++) {
            const territory = territoryList[i];
            const neighbors = [];
            
            for (let j = 0; j < territoryList.length; j++) {
                if (i === j) continue;
                const other = territoryList[j];
                const distance = territory.getDistanceTo(other);
                
                if (distance <= this.connectionDistance) {
                    neighbors.push({ territory: other, distance });
                }
            }
            
            neighbors.sort((a, b) => a.distance - b.distance);
            const connections = Math.min(3, neighbors.length); // Fewer connections for spiral
            
            for (let k = 0; k < connections; k++) {
                const neighbor = neighbors[k].territory;
                territory.addNeighbor(neighbor.id);
                neighbor.addNeighbor(territory.id);
            }
        }
    }
    
    connectCore() {
        const territoryList = Object.values(this.territories);
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Identify core territories (close to center)
        const coreTerritories = territoryList.filter(t => {
            const distToCenter = Math.sqrt((t.x - centerX) ** 2 + (t.y - centerY) ** 2);
            return distToCenter <= 100;
        });
        
        // Dense connections in core
        for (const territory of coreTerritories) {
            const coreNeighbors = [];
            
            for (const other of coreTerritories) {
                if (territory.id === other.id) continue;
                const distance = territory.getDistanceTo(other);
                
                if (distance <= this.connectionDistance) {
                    coreNeighbors.push({ territory: other, distance });
                }
            }
            
            coreNeighbors.sort((a, b) => a.distance - b.distance);
            const connections = Math.min(5, coreNeighbors.length); // Dense core
            
            for (let k = 0; k < connections; k++) {
                const neighbor = coreNeighbors[k].territory;
                territory.addNeighbor(neighbor.id);
                neighbor.addNeighbor(territory.id);
            }
        }
        
        // Radial connections from core to shells
        for (const territory of territoryList) {
            if (coreTerritories.includes(territory)) continue;
            
            const radialNeighbors = [];
            for (const other of territoryList) {
                if (territory.id === other.id) continue;
                const distance = territory.getDistanceTo(other);
                
                if (distance <= this.connectionDistance) {
                    radialNeighbors.push({ territory: other, distance });
                }
            }
            
            radialNeighbors.sort((a, b) => a.distance - b.distance);
            const connections = Math.min(3, radialNeighbors.length);
            
            for (let k = 0; k < connections; k++) {
                const neighbor = radialNeighbors[k].territory;
                territory.addNeighbor(neighbor.id);
                neighbor.addNeighbor(territory.id);
            }
        }
    }
    
    connectRings() {
        const territoryList = Object.values(this.territories);
        
        // Connect within rings and between adjacent rings
        for (let i = 0; i < territoryList.length; i++) {
            const territory = territoryList[i];
            const neighbors = [];
            
            for (let j = 0; j < territoryList.length; j++) {
                if (i === j) continue;
                const other = territoryList[j];
                const distance = territory.getDistanceTo(other);
                
                if (distance <= this.connectionDistance) {
                    neighbors.push({ territory: other, distance });
                }
            }
            
            neighbors.sort((a, b) => a.distance - b.distance);
            const connections = Math.min(4, neighbors.length);
            
            for (let k = 0; k < connections; k++) {
                const neighbor = neighbors[k].territory;
                territory.addNeighbor(neighbor.id);
                neighbor.addNeighbor(territory.id);
            }
        }
    }
    
    connectBinary() {
        const territoryList = Object.values(this.territories);
        const leftCenterX = this.width * 0.3;
        const rightCenterX = this.width * 0.7;
        const centerY = this.height / 2;
        
        // Identify left and right system territories
        const leftSystem = territoryList.filter(t => t.x < this.width / 2);
        const rightSystem = territoryList.filter(t => t.x >= this.width / 2);
        
        // Connect within each system
        [leftSystem, rightSystem].forEach(system => {
            for (const territory of system) {
                const systemNeighbors = [];
                
                for (const other of system) {
                    if (territory.id === other.id) continue;
                    const distance = territory.getDistanceTo(other);
                    
                    if (distance <= this.connectionDistance) {
                        systemNeighbors.push({ territory: other, distance });
                    }
                }
                
                systemNeighbors.sort((a, b) => a.distance - b.distance);
                const connections = Math.min(4, systemNeighbors.length);
                
                for (let k = 0; k < connections; k++) {
                    const neighbor = systemNeighbors[k].territory;
                    territory.addNeighbor(neighbor.id);
                    neighbor.addNeighbor(territory.id);
                }
            }
        });
        
        // Add bridge connections between systems
        const bridgeConnections = Math.min(3, Math.min(leftSystem.length, rightSystem.length));
        for (let i = 0; i < bridgeConnections; i++) {
            const leftTerr = leftSystem[Math.floor(Math.random() * leftSystem.length)];
            const rightTerr = rightSystem[Math.floor(Math.random() * rightSystem.length)];
            
            leftTerr.addNeighbor(rightTerr.id);
            rightTerr.addNeighbor(leftTerr.id);
        }
    }
    
    // Check if a line between two territories passes through any other territory or existing warp lanes
    linePassesThroughTerritory(from, to, allTerritories, existingConnections = []) {
        // Check collision with other territories
        for (const territory of allTerritories) {
            if (territory.id === from.id || territory.id === to.id) continue;
            
            // Calculate distance from territory center to line segment
            const A = from.x;
            const B = from.y;
            const C = to.x;
            const D = to.y;
            const E = territory.x;
            const F = territory.y;
            
            // Vector from from to to
            const dx = C - A;
            const dy = D - B;
            
            // Vector from from to territory
            const ex = E - A;
            const ey = F - B;
            
            // Project territory onto line
            const dot = ex * dx + ey * dy;
            const lenSquared = dx * dx + dy * dy;
            
            if (lenSquared === 0) continue; // Line has no length
            
            const t = Math.max(0, Math.min(1, dot / lenSquared));
            
            // Closest point on line segment
            const closestX = A + t * dx;
            const closestY = B + t * dy;
            
            // Distance from territory to closest point on line
            const distToLine = Math.sqrt((E - closestX) ** 2 + (F - closestY) ** 2);
            
            // If line passes too close to territory (within its radius + larger margin)
            if (distToLine < territory.radius + 30) { // Increased margin from 15 to 30
                return true;
            }
        }
        
        // Check collision with existing warp lanes
        for (const connection of existingConnections) {
            if (this.linesIntersect(from, to, connection.from, connection.to)) {
                return true;
            }
        }
        
        return false;
    }
    
    // Check if two line segments intersect
    linesIntersect(line1Start, line1End, line2Start, line2End) {
        const x1 = line1Start.x, y1 = line1Start.y;
        const x2 = line1End.x, y2 = line1End.y;
        const x3 = line2Start.x, y3 = line2Start.y;
        const x4 = line2End.x, y4 = line2End.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return false; // Lines are parallel
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        // Check if intersection point is within both line segments
        if (t >= 0.1 && t <= 0.9 && u >= 0.1 && u <= 0.9) { // Added small margin to avoid endpoint intersections
            return true;
        }
        
        return false;
    }

    connectTerritories() {
        const territoryList = Object.values(this.territories);
        const existingConnections = []; // Track existing warp lanes to prevent intersections

        if (territoryList.length < 2) return;

        const points = territoryList.map(t => [t.x, t.y]);
        let delaunay = null;
        try {
            delaunay = Delaunator.from(points);
        } catch (err) {
            console.warn('Delaunay triangulation failed, falling back to naive neighbor search');
        }

        const neighborSets = territoryList.map(() => new Set());

        if (delaunay) {
            for (let t = 0; t < delaunay.triangles.length; t += 3) {
                const a = delaunay.triangles[t];
                const b = delaunay.triangles[t + 1];
                const c = delaunay.triangles[t + 2];
                neighborSets[a].add(b); neighborSets[a].add(c);
                neighborSets[b].add(a); neighborSets[b].add(c);
                neighborSets[c].add(a); neighborSets[c].add(b);
            }
        } else {
            for (let i = 0; i < territoryList.length; i++) {
                for (let j = i + 1; j < territoryList.length; j++) {
                    neighborSets[i].add(j);
                    neighborSets[j].add(i);
                }
            }
        }

        for (let i = 0; i < territoryList.length; i++) {
            const territory = territoryList[i];
            const nearbyTerritories = [];

            neighborSets[i].forEach(j => {
                const other = territoryList[j];
                const distance = territory.getDistanceTo(other);

                if (distance <= this.connectionDistance && !this.linePassesThroughTerritory(territory, other, territoryList, existingConnections)) {
                    nearbyTerritories.push({ territory: other, distance });
                }
            });
            
            // Sort by distance and connect to closest neighbors
            nearbyTerritories.sort((a, b) => a.distance - b.distance);
            
            // Connect to 2-6 closest neighbors, influenced by warp lane density
            const baseDensity = this.warpLaneDensity / 100; // Convert percentage to decimal
            const maxConnections = Math.min(6, Math.max(2, nearbyTerritories.length));
            const adjustedConnections = Math.max(1, Math.floor(maxConnections * baseDensity));
            const numConnections = Math.min(adjustedConnections, 2 + Math.floor(Math.random() * 3));
            
            for (let k = 0; k < numConnections && k < nearbyTerritories.length; k++) {
                const neighbor = nearbyTerritories[k].territory;
                
                // Additional density check - some connections may be skipped based on density
                if (Math.random() * 100 > this.warpLaneDensity) continue;
                
                // Track this connection to prevent future intersections
                existingConnections.push({
                    from: territory,
                    to: neighbor
                });
                
                // All connections are now regular neighbors (no hidden connections)
                territory.addNeighbor(neighbor.id);
                neighbor.addNeighbor(territory.id);
            }
        }
        
        // Ensure connectivity by connecting isolated territories
        this.ensureConnectivity();
    }
    
    ensureConnectivity() {
        const visited = new Set();
        const territoryIds = Object.keys(this.territories);
        
        if (territoryIds.length === 0) return;
        
        // BFS to find connected components
        const bfs = (startId) => {
            const queue = [startId];
            const component = [];
            
            while (queue.length > 0) {
                const currentId = queue.shift();
                if (visited.has(currentId)) continue;
                
                visited.add(currentId);
                component.push(currentId);
                
                const territory = this.territories[currentId];
                territory.neighbors.forEach(neighborId => {
                    if (!visited.has(neighborId)) {
                        queue.push(neighborId);
                    }
                });
            }
            
            return component;
        };
        
        const components = [];
        
        // Find all connected components
        territoryIds.forEach(id => {
            if (!visited.has(id)) {
                components.push(bfs(id));
            }
        });
        
        // Connect isolated components
        while (components.length > 1) {
            const comp1 = components[0];
            const comp2 = components[1];
            
            // Find closest territories between components
            let minDistance = Infinity;
            let bestConnection = null;
            
            comp1.forEach(id1 => {
                const territory1 = this.territories[id1];
                comp2.forEach(id2 => {
                    const territory2 = this.territories[id2];
                    const distance = territory1.getDistanceTo(territory2);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestConnection = { territory1, territory2 };
                    }
                });
            });
            
            // Connect the closest territories
            if (bestConnection) {
                bestConnection.territory1.addNeighbor(bestConnection.territory2.id);
                bestConnection.territory2.addNeighbor(bestConnection.territory1.id);
            }
            
            // Merge components
            components[0] = comp1.concat(comp2);
            components.splice(1, 1);
        }
    }
    
    // Get territories within a rectangular area (for culling)
    getTerritoriesInBounds(bounds) {
        const result = [];
        
        Object.values(this.territories).forEach(territory => {
            if (territory.x + territory.radius >= bounds.left &&
                territory.x - territory.radius <= bounds.right &&
                territory.y + territory.radius >= bounds.top &&
                territory.y - territory.radius <= bounds.bottom) {
                result.push(territory);
            }
        });
        
        return result;
    }
    
    // Find nearest territory to a point
    findNearestTerritory(x, y) {
        let nearest = null;
        let minDistance = Infinity;
        
        Object.values(this.territories).forEach(territory => {
            const distance = Math.sqrt((x - territory.x) ** 2 + (y - territory.y) ** 2);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = territory;
            }
        });
        
        return nearest;
    }
    
    // Get map statistics
    getMapStats() {
        const territoryCount = Object.keys(this.territories).length;
        let totalConnections = 0;
        let neutralTerritories = 0;
        
        Object.values(this.territories).forEach(territory => {
            totalConnections += territory.neighbors.length;
            if (territory.ownerId === null) {
                neutralTerritories++;
            }
        });
        
        return {
            territories: territoryCount,
            connections: totalConnections / 2, // Each connection counted twice
            averageConnections: totalConnections / territoryCount,
            neutralTerritories: neutralTerritories,
            width: this.width,
            height: this.height
        };
    }
    
    // Serialize map data for network transmission (future multiplayer)
    serialize() {
        const serializedTerritories = {};
        
        Object.keys(this.territories).forEach(id => {
            serializedTerritories[id] = this.territories[id].serialize();
        });
        
        return {
            width: this.width,
            height: this.height,
            territories: serializedTerritories
        };
    }
    
    // Deserialize map data from network (future multiplayer)
    static deserialize(data) {
        const map = new GameMap(data.width, data.height);
        
        Object.keys(data.territories).forEach(id => {
            map.territories[id] = Territory.deserialize(data.territories[id]);
        });
        
        return map;
    }
    
    isInNebula(x, y, territoryRadius = 15) {
        // Check if a territory is FULLY inside any nebula (not just touching the edge)
        // The territory must be completely contained within the nebula for fog of war to apply
        for (const nebula of this.nebulas) {
            const distance = Math.sqrt((x - nebula.x) ** 2 + (y - nebula.y) ** 2);
            // Territory is only "in nebula" if its entire circle fits inside the nebula
            if (distance + territoryRadius <= nebula.radius) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Add territory to spatial index for O(1) lookups
     */
    addToSpatialIndex(territory) {
        if (!this.spatialIndexEnabled) return;
        
        const gridX = Math.floor(territory.x / this.spatialGridSize);
        const gridY = Math.floor(territory.y / this.spatialGridSize);
        const key = `${gridX},${gridY}`;
        
        if (!this.spatialGrid.has(key)) {
            this.spatialGrid.set(key, []);
        }
        this.spatialGrid.get(key).push(territory);
    }
    
    /**
     * Find territory at coordinates using spatial indexing (O(1) vs O(n))
     */
    findTerritoryAt(x, y) {
        if (!this.spatialIndexEnabled) {
            // Fallback to linear search
            return Object.values(this.territories).find(territory => {
                const distance = Math.sqrt((x - territory.x) ** 2 + (y - territory.y) ** 2);
                return distance <= territory.radius;
            });
        }
        
        // Spatial index lookup - check only nearby cells
        const gridX = Math.floor(x / this.spatialGridSize);
        const gridY = Math.floor(y / this.spatialGridSize);
        
        // Check current cell and adjacent cells (3x3 grid)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${gridX + dx},${gridY + dy}`;
                const cellTerritories = this.spatialGrid.get(key);
                
                if (cellTerritories) {
                    for (const territory of cellTerritories) {
                        const distance = Math.sqrt((x - territory.x) ** 2 + (y - territory.y) ** 2);
                        if (distance <= territory.radius) {
                            return territory;
                        }
                    }
                }
            }
        }
        return null;
    }
    
    /**
     * Build spatial index for all territories
     */
    buildSpatialIndex() {
        if (!this.spatialIndexEnabled) return;
        
        this.spatialGrid.clear();
        Object.values(this.territories).forEach(territory => {
            this.addToSpatialIndex(territory);
        });
    }
}
