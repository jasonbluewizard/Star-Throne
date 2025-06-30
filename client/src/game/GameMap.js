import { Territory } from './Territory.js';

export class GameMap {
    constructor(width, height) {
        this.width = width * 1.4; // Expand width by 40%
        this.height = height * 1.4; // Expand height by 40%
        this.territories = {};
        this.nebulas = []; // Purple nebula clouds
        this.gridSize = 80; // Space between territory centers
        this.connectionDistance = 120; // Max distance for territory connections
    }
    
    generateTerritories(count) {
        console.log(`Generating ${count} territories on ${this.width}x${this.height} map...`);
        
        // Generate territories using Poisson disk sampling for even distribution
        const territories = this.poissonDiskSampling(count);
        
        // Create Territory objects - ALL are now colonizable requiring probes
        territories.forEach((pos, index) => {
            // ALL territories are now colonizable
            const territory = new Territory(index, pos.x, pos.y, 25, true);
            
            // Hidden army count from 1 to 50, only revealed when probed
            territory.hiddenArmySize = Math.floor(Math.random() * 50) + 1;
            territory.armySize = 0; // Unknown until colonized
            
            this.territories[index] = territory;
        });
        
        // Generate nebulas after territories
        this.generateNebulas();
        
        // Connect neighboring territories
        this.connectTerritories();
        
        // All territories are now colonizable
        console.log(`Generated ${Object.keys(this.territories).length} territories with connections`);
        console.log(`Generated ${this.nebulas.length} nebula clouds`);
        console.log(`All territories are colonizable planets requiring probes`);
        
        // Ensure connectivity by connecting isolated territories
        this.ensureConnectivity();
    }
    
    generateNebulas() {
        // Generate 8-15 nebula clouds scattered across the map
        const nebulaCount = Math.floor(Math.random() * 8) + 8;
        
        for (let i = 0; i < nebulaCount; i++) {
            const nebula = {
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: 80 + Math.random() * 120, // Size varies from 80 to 200
                opacity: 0.3 + Math.random() * 0.4, // Opacity varies from 0.3 to 0.7
                color: `rgba(147, 51, 234, ${0.3 + Math.random() * 0.4})` // Purple with varying opacity
            };
            this.nebulas.push(nebula);
        }
    }
    
    poissonDiskSampling(numSamples) {
        const points = [];
        const cellSize = this.gridSize / Math.sqrt(2);
        const gridWidth = Math.ceil(this.width / cellSize);
        const gridHeight = Math.ceil(this.height / cellSize);
        const grid = new Array(gridWidth * gridHeight).fill(null);
        const activeList = [];
        
        // Helper function to get grid index
        const getGridIndex = (x, y) => {
            const i = Math.floor(x / cellSize);
            const j = Math.floor(y / cellSize);
            return j * gridWidth + i;
        };
        
        // Helper function to check if a point is valid
        const isValidPoint = (x, y) => {
            // More natural boundaries - allow points closer to edges for organic scattering
            const margin = 20;
            if (x < margin || x >= this.width - margin || y < margin || y >= this.height - margin) return false;
            
            const gridIndex = getGridIndex(x, y);
            const gridX = gridIndex % gridWidth;
            const gridY = Math.floor(gridIndex / gridWidth);
            
            // Check neighboring grid cells
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const nx = gridX + dx;
                    const ny = gridY + dy;
                    
                    if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                        const neighborIndex = ny * gridWidth + nx;
                        const neighbor = grid[neighborIndex];
                        
                        if (neighbor) {
                            const dist = Math.sqrt((x - neighbor.x) ** 2 + (y - neighbor.y) ** 2);
                            if (dist < this.gridSize) return false;
                        }
                    }
                }
            }
            
            return true;
        };
        
        // Generate initial point - more scattered placement
        const initialX = this.width * 0.2 + Math.random() * this.width * 0.6;
        const initialY = this.height * 0.2 + Math.random() * this.height * 0.6;
        const initialPoint = { x: initialX, y: initialY };
        
        points.push(initialPoint);
        activeList.push(initialPoint);
        grid[getGridIndex(initialX, initialY)] = initialPoint;
        
        // Generate points using Poisson disk sampling
        while (activeList.length > 0 && points.length < numSamples) {
            const randomIndex = Math.floor(Math.random() * activeList.length);
            const point = activeList[randomIndex];
            let found = false;
            
            // Try to generate a new point around the selected point
            for (let tries = 0; tries < 30; tries++) {
                const angle = Math.random() * 2 * Math.PI;
                const distance = this.gridSize + Math.random() * this.gridSize;
                const newX = point.x + Math.cos(angle) * distance;
                const newY = point.y + Math.sin(angle) * distance;
                
                if (isValidPoint(newX, newY)) {
                    const newPoint = { x: newX, y: newY };
                    points.push(newPoint);
                    activeList.push(newPoint);
                    grid[getGridIndex(newX, newY)] = newPoint;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                activeList.splice(randomIndex, 1);
            }
        }
        
        // If we need more points, fill in with random placement
        while (points.length < numSamples) {
            const x = 50 + Math.random() * (this.width - 100);
            const y = 50 + Math.random() * (this.height - 100);
            
            if (isValidPoint(x, y)) {
                points.push({ x, y });
            }
        }
        
        return points.slice(0, numSamples);
    }
    
    connectTerritories() {
        const territoryList = Object.values(this.territories);
        
        // Use Delaunay triangulation approximation for natural connections
        for (let i = 0; i < territoryList.length; i++) {
            const territory = territoryList[i];
            const nearbyTerritories = [];
            
            // Find all territories within connection distance
            for (let j = 0; j < territoryList.length; j++) {
                if (i === j) continue;
                
                const other = territoryList[j];
                const distance = territory.getDistanceTo(other);
                
                if (distance <= this.connectionDistance) {
                    nearbyTerritories.push({ territory: other, distance });
                }
            }
            
            // Sort by distance and connect to closest neighbors
            nearbyTerritories.sort((a, b) => a.distance - b.distance);
            
            // Connect to 2-6 closest neighbors
            const maxConnections = Math.min(6, Math.max(2, nearbyTerritories.length));
            const numConnections = Math.min(maxConnections, 2 + Math.floor(Math.random() * 3));
            
            for (let k = 0; k < numConnections && k < nearbyTerritories.length; k++) {
                const neighbor = nearbyTerritories[k].territory;
                
                // If either territory is colonizable, make it a hidden connection
                if (territory.isColonizable || neighbor.isColonizable) {
                    territory.addHiddenNeighbor(neighbor.id);
                    neighbor.addHiddenNeighbor(territory.id);
                } else {
                    territory.addNeighbor(neighbor.id);
                    neighbor.addNeighbor(territory.id);
                }
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
}
