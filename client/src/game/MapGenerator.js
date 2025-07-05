/**
 * MapGenerator.js - Advanced Procedural Map Generation
 * Generates non-overlapping, planar star maps using physics-based relaxation,
 * Delaunay triangulation, and Minimum Spanning Tree algorithms.
 * 
 * Features:
 * - Force-directed relaxation for optimal spacing
 * - Delaunay triangulation for planar connectivity
 * - MST-based warp lane generation (no crossing lanes)
 * - Collision detection to prevent lanes cutting through stars
 * - Six distinct galaxy layouts with unique characteristics
 */

import Delaunator from 'delaunator';
import { GAME_CONSTANTS } from '../../../common/gameConstants';
import { Territory } from './Territory.js';

/**
 * Helper: Returns true if line segment AB intersects circle centered at C with radius R
 */
function lineIntersectsCircle(A, B, C, R) {
    const vx = B.x - A.x;
    const vy = B.y - A.y;
    const wx = C.x - A.x;
    const wy = C.y - A.y;
    
    const dot = vx * vx + vy * vy;
    if (dot === 0) return false;
    
    const proj = (wx * vx + wy * vy) / dot;
    const t = Math.max(0, Math.min(1, proj));
    
    const px = A.x + t * vx;
    const py = A.y + t * vy;
    const dx = px - C.x;
    const dy = py - C.y;
    
    return (dx * dx + dy * dy) < (R * R);
}

/**
 * Union-Find data structure for MST algorithm
 */
class UnionFind {
    constructor(n) {
        this.parent = Array(n).fill(0).map((_, i) => i);
        this.rank = Array(n).fill(0);
    }
    
    find(x) {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]);
        }
        return this.parent[x];
    }
    
    union(x, y) {
        const px = this.find(x);
        const py = this.find(y);
        
        if (px === py) return false;
        
        if (this.rank[px] < this.rank[py]) {
            this.parent[px] = py;
        } else if (this.rank[px] > this.rank[py]) {
            this.parent[py] = px;
        } else {
            this.parent[py] = px;
            this.rank[px]++;
        }
        
        return true;
    }
}

export default class MapGenerator {
    // Map dimensions (set after generation)
    static mapWidth = 0;
    static mapHeight = 0;
    
    /**
     * Generate a map with specified parameters
     * @param {number} mapSize - Number of territories to generate
     * @param {string} layout - Galaxy layout type ('organic', 'clusters', 'spiral', 'core', 'rings', 'binary')
     * @param {number} numPlayers - Number of players (affects cluster generation)
     * @returns {Array} Array of territory objects
     */
    static generateMap(mapSize, layout, numPlayers = 1) {
        console.log(`🌌 Generating ${layout} galaxy with ${mapSize} territories for ${numPlayers} players`);
        
        // 1. INITIAL POINT PLACEMENT BASED ON LAYOUT
        const points = this.generateInitialPoints(mapSize, layout, numPlayers);
        
        // 2. FORCE-DIRECTED RELAXATION FOR OPTIMAL SPACING
        this.applyForceRelaxation(points, layout);
        
        // 3. DELAUNAY TRIANGULATION
        const edges = this.computeDelaunayEdges(points);
        
        // 4. MINIMUM SPANNING TREE WITH COLLISION DETECTION
        const connections = this.buildMST(points, edges);
        
        // 5. OPTIONAL: ADD EXTRA CONNECTIONS FOR STRATEGIC DEPTH
        this.addExtraConnections(points, connections, edges);
        
        // 6. ENSURE FULL CONNECTIVITY (CRITICAL FOR GAMEPLAY)
        this.ensureConnectivity(points, connections, edges);
        
        // 7. BUILD TERRITORY OBJECTS
        const territories = this.buildTerritories(points, connections);
        
        // 8. SET MAP DIMENSIONS
        this.calculateMapDimensions(points);
        
        console.log(`✨ Generated ${territories.length} territories with ${this.countConnections(connections)} warp lanes`);
        return territories;
    }
    
    /**
     * Generate initial point placement based on selected layout
     */
    static generateInitialPoints(mapSize, layout, numPlayers) {
        const points = [];
        const baseWidth = 2400;  // Increased for better distribution
        const baseHeight = 1800; // Increased for better distribution
        
        // Scale dimensions based on map size
        const scale = Math.sqrt(mapSize / 80); // 80 is our reference size
        const width = baseWidth * scale;
        const height = baseHeight * scale;
        
        switch (layout) {
            case 'clusters':
                return this.generateClusterLayout(points, mapSize, width, height, numPlayers);
            case 'spiral':
                return this.generateSpiralLayout(points, mapSize, width, height);
            case 'core':
                return this.generateCoreLayout(points, mapSize, width, height);
            case 'rings':
                return this.generateRingsLayout(points, mapSize, width, height);
            case 'binary':
                return this.generateBinaryLayout(points, mapSize, width, height);
            default: // 'organic'
                return this.generateOrganicLayout(points, mapSize, width, height);
        }
    }
    
    /**
     * Cluster layout: Multiple stellar clusters connected by bridges
     */
    static generateClusterLayout(points, mapSize, width, height, numPlayers) {
        const numClusters = Math.max(3, Math.min(numPlayers + 2, 8));
        const centers = [];
        
        // Generate cluster centers with minimum separation
        for (let i = 0; i < numClusters; i++) {
            let attempts = 0;
            let center;
            
            do {
                center = {
                    x: Math.random() * width * 0.7 + width * 0.15,
                    y: Math.random() * height * 0.7 + height * 0.15
                };
                attempts++;
            } while (attempts < 20 && centers.some(c => 
                Math.hypot(c.x - center.x, c.y - center.y) < Math.min(width, height) * 0.3
            ));
            
            centers.push(center);
        }
        
        // Distribute territories among clusters
        for (let i = 0; i < mapSize; i++) {
            const cluster = centers[i % centers.length];
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.sqrt(Math.random()) * 250 + 50;
            
            points.push({
                x: cluster.x + distance * Math.cos(angle),
                y: cluster.y + distance * Math.sin(angle)
            });
        }
        
        return points;
    }
    
    /**
     * Spiral layout: Galactic arms with reduced connection density
     */
    static generateSpiralLayout(points, mapSize, width, height) {
        const arms = 4;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) * 0.4;
        
        for (let i = 0; i < mapSize; i++) {
            const armIndex = i % arms;
            const progress = i / mapSize;
            const angle = (armIndex * 2 * Math.PI / arms) + (progress * 6 * Math.PI); // 3 full rotations
            const radius = 80 + progress * maxRadius;
            
            // Add spiral noise
            const noiseRadius = Math.random() * 60 - 30;
            const noiseAngle = Math.random() * 0.5 - 0.25;
            
            points.push({
                x: centerX + (radius + noiseRadius) * Math.cos(angle + noiseAngle),
                y: centerY + (radius + noiseRadius) * Math.sin(angle + noiseAngle)
            });
        }
        
        return points;
    }
    
    /**
     * Core layout: Dense central core with surrounding shells
     */
    static generateCoreLayout(points, mapSize, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) * 0.45;
        
        for (let i = 0; i < mapSize; i++) {
            // Bias toward center using power distribution
            const radiusProgress = Math.pow(Math.random(), 0.6); // Stronger center bias
            const radius = radiusProgress * maxRadius;
            const angle = Math.random() * 2 * Math.PI;
            
            points.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }
        
        return points;
    }
    
    /**
     * Rings layout: Concentric stellar rings
     */
    static generateRingsLayout(points, mapSize, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const rings = Math.max(4, Math.ceil(mapSize / 20));
        const maxRadius = Math.min(width, height) * 0.45;
        
        for (let i = 0; i < mapSize; i++) {
            const ring = i % rings;
            const baseRadius = (ring + 1) * (maxRadius / rings);
            const radiusVariation = Math.random() * 40 - 20;
            const radius = baseRadius + radiusVariation;
            const angle = Math.random() * 2 * Math.PI;
            
            points.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }
        
        return points;
    }
    
    /**
     * Binary layout: Two major stellar systems
     */
    static generateBinaryLayout(points, mapSize, width, height) {
        const separation = width * 0.4;
        const centers = [
            { x: width / 2 - separation, y: height / 2 },
            { x: width / 2 + separation, y: height / 2 }
        ];
        
        for (let i = 0; i < mapSize; i++) {
            const system = centers[i % 2];
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.sqrt(Math.random()) * 300 + 80;
            
            points.push({
                x: system.x + radius * Math.cos(angle),
                y: system.y + radius * Math.sin(angle)
            });
        }
        
        return points;
    }
    
    /**
     * Organic layout: Natural scattered distribution with galaxy boundaries
     */
    static generateOrganicLayout(points, mapSize, width, height) {
        const minDistance = Math.sqrt((width * height) / mapSize) * 0.6; // Closer together
        const maxAttempts = 50;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Generate organic galaxy boundary using multiple sine waves
        const boundaryFunction = (angle) => {
            const baseRadius = Math.min(width, height) * 0.42; // Use more of the available space
            const roughness1 = Math.sin(angle * 3) * 0.15;
            const roughness2 = Math.sin(angle * 7) * 0.08;
            const roughness3 = Math.sin(angle * 13) * 0.05;
            const roughness4 = Math.sin(angle * 19) * 0.03;
            
            return baseRadius * (1 + roughness1 + roughness2 + roughness3 + roughness4);
        };
        
        // Check if point is within organic galaxy boundary
        const isWithinGalaxy = (x, y) => {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            const maxDistance = boundaryFunction(angle);
            
            // Add some fuzziness to the boundary for more natural edges
            const fuzziness = Math.random() * 0.1 - 0.05;
            return distance <= maxDistance * (1 + fuzziness);
        };
        
        // Generate density clusters for natural star formation
        const numClusters = Math.floor(mapSize / 15) + 3;
        const densityClusters = [];
        
        for (let i = 0; i < numClusters; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * Math.min(width, height) * 0.3;
            const clusterX = centerX + distance * Math.cos(angle);
            const clusterY = centerY + distance * Math.sin(angle);
            
            if (isWithinGalaxy(clusterX, clusterY)) {
                densityClusters.push({
                    x: clusterX,
                    y: clusterY,
                    strength: 0.3 + Math.random() * 0.4,
                    radius: 100 + Math.random() * 150
                });
            }
        }
        
        // Start with central point
        points.push({
            x: centerX + (Math.random() - 0.5) * 100,
            y: centerY + (Math.random() - 0.5) * 100
        });
        
        const activeList = [0];
        
        while (activeList.length > 0 && points.length < mapSize) {
            const randomIndex = Math.floor(Math.random() * activeList.length);
            const activePoint = points[activeList[randomIndex]];
            
            let found = false;
            for (let attempts = 0; attempts < maxAttempts; attempts++) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = minDistance * (0.8 + Math.random() * 0.4); // Variable spacing
                const candidate = {
                    x: activePoint.x + radius * Math.cos(angle),
                    y: activePoint.y + radius * Math.sin(angle)
                };
                
                // Check galaxy boundary
                if (!isWithinGalaxy(candidate.x, candidate.y)) continue;
                
                // Check minimum distance
                let valid = true;
                for (const existing of points) {
                    if (Math.hypot(existing.x - candidate.x, existing.y - candidate.y) < minDistance) {
                        valid = false;
                        break;
                    }
                }
                
                if (valid) {
                    points.push(candidate);
                    activeList.push(points.length - 1);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                activeList.splice(randomIndex, 1);
            }
        }
        
        // Use density-based sampling for remaining points
        let attempts = 0;
        while (points.length < mapSize && attempts < mapSize * 10) {
            const candidate = {
                x: centerX + (Math.random() - 0.5) * width * 0.8,
                y: centerY + (Math.random() - 0.5) * height * 0.8
            };
            
            attempts++;
            
            // Check galaxy boundary
            if (!isWithinGalaxy(candidate.x, candidate.y)) continue;
            
            // Calculate density probability based on clusters
            let densityProbability = 0.3; // Base probability
            for (const cluster of densityClusters) {
                const distanceToCluster = Math.hypot(candidate.x - cluster.x, candidate.y - cluster.y);
                if (distanceToCluster < cluster.radius) {
                    const influence = Math.exp(-distanceToCluster / cluster.radius);
                    densityProbability += cluster.strength * influence;
                }
            }
            
            // Apply galactic bar density (higher towards center)
            const distanceFromCenter = Math.hypot(candidate.x - centerX, candidate.y - centerY);
            const centerDensity = Math.exp(-distanceFromCenter / (Math.min(width, height) * 0.2));
            densityProbability += centerDensity * 0.4;
            
            // Roll for placement
            if (Math.random() > densityProbability) continue;
            
            // Check minimum distance
            let valid = true;
            for (const existing of points) {
                if (Math.hypot(existing.x - candidate.x, existing.y - candidate.y) < minDistance * 0.7) {
                    valid = false;
                    break;
                }
            }
            
            if (valid) {
                points.push(candidate);
            }
        }
        
        return points;
    }
    
    /**
     * Apply force-directed relaxation to improve spacing
     */
    static applyForceRelaxation(points, layout) {
        const iterations = layout === 'organic' ? 8 : 5; // More iterations for organic
        const repulsionStrength = 2000;
        const damping = 0.8;
        
        for (let iter = 0; iter < iterations; iter++) {
            const forces = points.map(() => ({ x: 0, y: 0 }));
            
            // Calculate repulsive forces between all point pairs
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    const dx = points[j].x - points[i].x;
                    const dy = points[j].y - points[i].y;
                    const distance = Math.hypot(dx, dy);
                    
                    if (distance < 0.1) continue; // Avoid division by zero
                    
                    const force = repulsionStrength / (distance * distance);
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    forces[i].x -= fx;
                    forces[i].y -= fy;
                    forces[j].x += fx;
                    forces[j].y += fy;
                }
            }
            
            // Apply forces with damping and boundary constraints
            for (let i = 0; i < points.length; i++) {
                const maxForce = 15;
                forces[i].x = Math.max(-maxForce, Math.min(maxForce, forces[i].x * damping));
                forces[i].y = Math.max(-maxForce, Math.min(maxForce, forces[i].y * damping));
                
                points[i].x += forces[i].x;
                points[i].y += forces[i].y;
                
                // Keep points within bounds with margin
                const margin = 50;
                points[i].x = Math.max(margin, Math.min(2800 - margin, points[i].x));
                points[i].y = Math.max(margin, Math.min(2100 - margin, points[i].y));
            }
        }
    }
    
    /**
     * Compute Delaunay triangulation edges
     */
    static computeDelaunayEdges(points) {
        if (points.length < 3) {
            console.warn('Not enough points for Delaunay triangulation');
            return [];
        }
        
        try {
            const delaunay = Delaunator.from(points, p => p.x, p => p.y);
            const edges = new Set();
            
            // Extract unique edges from triangulation
            for (let e = 0; e < delaunay.triangles.length; e += 3) {
                const triangle = [
                    delaunay.triangles[e],
                    delaunay.triangles[e + 1],
                    delaunay.triangles[e + 2]
                ];
                
                // Add each edge of the triangle
                for (let i = 0; i < 3; i++) {
                    const a = Math.min(triangle[i], triangle[(i + 1) % 3]);
                    const b = Math.max(triangle[i], triangle[(i + 1) % 3]);
                    edges.add(`${a},${b}`);
                }
            }
            
            // Convert to edge list with distances
            return Array.from(edges).map(str => {
                const [a, b] = str.split(',').map(Number);
                return {
                    u: a,
                    v: b,
                    length: Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y)
                };
            });
        } catch (error) {
            console.error('Delaunay triangulation failed:', error);
            return [];
        }
    }
    
    /**
     * Build Minimum Spanning Tree with collision detection
     */
    static buildMST(points, edges) {
        const mapSize = points.length;
        const connections = Array.from({ length: mapSize }, () => []);
        const unionFind = new UnionFind(mapSize);
        
        // Sort edges by length for MST algorithm
        edges.sort((a, b) => a.length - b.length);
        
        const territoryRadius = 25; // Collision detection radius
        let edgesAdded = 0;
        
        for (const edge of edges) {
            if (edgesAdded >= mapSize - 1) break;
            
            // Check if adding this edge would create a cycle
            if (unionFind.find(edge.u) === unionFind.find(edge.v)) continue;
            
            // Check collision with other territories
            const A = points[edge.u];
            const B = points[edge.v];
            let collides = false;
            
            for (let k = 0; k < mapSize; k++) {
                if (k === edge.u || k === edge.v) continue;
                
                if (lineIntersectsCircle(A, B, points[k], territoryRadius)) {
                    collides = true;
                    break;
                }
            }
            
            if (!collides) {
                unionFind.union(edge.u, edge.v);
                connections[edge.u].push(edge.v);
                connections[edge.v].push(edge.u);
                edgesAdded++;
            }
        }
        
        return connections;
    }
    
    /**
     * Add extra connections for strategic depth (optional)
     */
    static addExtraConnections(points, connections, edges) {
        const maxExtraConnections = Math.floor(points.length * 0.12); // 12% extra connections
        const territoryRadius = 20; // Reduced for closer planets
        let extraAdded = 0;
        
        // Sort remaining edges by length
        const usedEdges = new Set();
        for (let i = 0; i < connections.length; i++) {
            for (const neighbor of connections[i]) {
                if (i < neighbor) {
                    usedEdges.add(`${i},${neighbor}`);
                }
            }
        }
        
        const availableEdges = edges.filter(edge => {
            const key = `${Math.min(edge.u, edge.v)},${Math.max(edge.u, edge.v)}`;
            return !usedEdges.has(key);
        });
        
        for (const edge of availableEdges) {
            if (extraAdded >= maxExtraConnections) break;
            
            // Only add short edges to avoid long-distance connections
            if (edge.length > 200) continue;
            
            // Check collision
            const A = points[edge.u];
            const B = points[edge.v];
            let collides = false;
            
            for (let k = 0; k < points.length; k++) {
                if (k === edge.u || k === edge.v) continue;
                
                if (lineIntersectsCircle(A, B, points[k], territoryRadius)) {
                    collides = true;
                    break;
                }
            }
            
            if (!collides) {
                connections[edge.u].push(edge.v);
                connections[edge.v].push(edge.u);
                extraAdded++;
            }
        }
    }
    
    /**
     * Build territory objects with proper initialization
     */
    static buildTerritories(points, connections) {
        const territories = [];
        
        for (let i = 0; i < points.length; i++) {
            // Create proper Territory instance
            const territory = new Territory(i, points[i].x, points[i].y, 20, true);
            
            // Set up connections
            territory.neighbors = connections[i].slice(); // Copy array
            
            // Set initial properties
            territory.armySize = Math.floor(Math.random() * 10) + 1; // 1-10 armies for neutrals
            territory.isThronestar = false;
            
            // Additional properties for compatibility
            territory.attackFlash = 0;
            territory.reinforcementArrivedFlash = 0;
            territory.hasFactory = false;
            
            territories.push(territory);
        }
        
        return territories;
    }
    
    /**
     * Calculate map dimensions and center territories for optimal display
     */
    static calculateMapDimensions(points) {
        if (points.length === 0) {
            this.mapWidth = 2000;
            this.mapHeight = 1500;
            return;
        }
        
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const margin = 200;
        this.mapWidth = maxX - minX + margin * 2;
        this.mapHeight = maxY - minY + margin * 2;
        
        // Center all territories within the map bounds
        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        const currentCenterX = (minX + maxX) / 2;
        const currentCenterY = (minY + maxY) / 2;
        
        const offsetX = centerX - currentCenterX;
        const offsetY = centerY - currentCenterY;
        
        // Apply centering offset to all points
        for (const point of points) {
            point.x += offsetX;
            point.y += offsetY;
        }
        
        console.log(`📐 Map dimensions: ${this.mapWidth} x ${this.mapHeight}`);
        console.log(`🎯 Centered ${points.length} territories with offset (${Math.round(offsetX)}, ${Math.round(offsetY)})`);
    }
    
    /**
     * Ensure all territories are connected via a path (critical for gameplay)
     */
    static ensureConnectivity(points, connections, edges) {
        console.log('🔗 Ensuring full galaxy connectivity...');
        
        // Find all connected components using BFS
        const visited = new Set();
        const components = [];
        
        for (let i = 0; i < points.length; i++) {
            if (!visited.has(i)) {
                // Start a new component
                const component = [];
                const queue = [i];
                visited.add(i);
                
                while (queue.length > 0) {
                    const current = queue.shift();
                    component.push(current);
                    
                    // Visit all neighbors
                    for (const neighbor of connections[current] || []) {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                }
                
                components.push(component);
            }
        }
        
        console.log(`Found ${components.length} connected components`);
        
        // If we have multiple components, connect them
        if (components.length > 1) {
            // Connect components by finding shortest edges between them
            for (let i = 1; i < components.length; i++) {
                const comp1 = components[0]; // Always connect to main component
                const comp2 = components[i];
                
                let bestEdge = null;
                let bestDistance = Infinity;
                
                // Find shortest edge between the two components
                for (const node1 of comp1) {
                    for (const node2 of comp2) {
                        const distance = Math.hypot(
                            points[node1].x - points[node2].x,
                            points[node1].y - points[node2].y
                        );
                        
                        if (distance < bestDistance) {
                            bestDistance = distance;
                            bestEdge = { u: node1, v: node2, length: distance };
                        }
                    }
                }
                
                // Add the connection
                if (bestEdge) {
                    connections[bestEdge.u].push(bestEdge.v);
                    connections[bestEdge.v].push(bestEdge.u);
                    console.log(`🌉 Connected components via bridge: ${bestEdge.u} ↔ ${bestEdge.v} (distance: ${Math.round(bestEdge.length)})`);
                    
                    // Merge component i into component 0
                    components[0] = components[0].concat(comp2);
                }
            }
            
            console.log(`✅ All territories now connected in single component`);
        } else {
            console.log(`✅ Galaxy already fully connected`);
        }
        
        // Final validation
        const finalComponents = this.countConnectedComponents(points.length, connections);
        if (finalComponents > 1) {
            console.warn(`⚠️ Still have ${finalComponents} disconnected components after repair!`);
        }
    }
    
    /**
     * Count connected components for validation
     */
    static countConnectedComponents(numPoints, connections) {
        const visited = new Set();
        let components = 0;
        
        for (let i = 0; i < numPoints; i++) {
            if (!visited.has(i)) {
                components++;
                const stack = [i];
                
                while (stack.length > 0) {
                    const current = stack.pop();
                    if (!visited.has(current)) {
                        visited.add(current);
                        for (const neighbor of connections[current] || []) {
                            if (!visited.has(neighbor)) {
                                stack.push(neighbor);
                            }
                        }
                    }
                }
            }
        }
        
        return components;
    }
    
    /**
     * Count total connections for debugging
     */
    static countConnections(connections) {
        let total = 0;
        for (const connectionList of connections) {
            total += connectionList.length;
        }
        return total / 2; // Each connection is counted twice
    }
    
    /**
     * Validate map integrity (for debugging)
     */
    static validateMap(territories) {
        console.log('🔍 Validating map integrity...');
        
        let issues = 0;
        
        // Check bidirectional connections
        for (const territory of Object.values(territories)) {
            for (const neighborId of territory.neighbors) {
                const neighbor = territories[neighborId];
                if (!neighbor) {
                    console.warn(`❌ Territory ${territory.id} references non-existent neighbor ${neighborId}`);
                    issues++;
                    continue;
                }
                
                if (!neighbor.neighbors.includes(territory.id)) {
                    console.warn(`❌ Unidirectional connection: ${territory.id} -> ${neighborId}`);
                    issues++;
                }
            }
        }
        
        console.log(issues === 0 ? '✅ Map validation passed' : `⚠️ Map validation found ${issues} issues`);
        return issues === 0;
    }
}