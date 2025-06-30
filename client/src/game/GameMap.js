import { Territory } from './Territory.js';

export class GameMap {
    constructor(width, height, layout = 'organic') {
        this.width = width * 1.4; // Expand width by 40%
        this.height = height * 1.4; // Expand height by 40%
        this.territories = {};
        this.nebulas = []; // Purple nebula clouds
        this.gridSize = 80; // Space between territory centers
        this.connectionDistance = 120; // Max distance for territory connections
        this.layout = layout; // Layout type: organic, clusters, spiral, core, ring, binary
    }
    
    generateTerritories(count) {
        console.log(`Generating ${count} territories using ${this.layout} layout on ${this.width}x${this.height} map...`);
        
        // Generate territories based on selected layout
        let territories;
        switch (this.layout) {
            case 'clusters':
                territories = this.generateClusterLayout(count);
                break;
            case 'spiral':
                territories = this.generateSpiralLayout(count);
                break;
            case 'core':
                territories = this.generateCoreLayout(count);
                break;
            case 'ring':
                territories = this.generateRingLayout(count);
                break;
            case 'binary':
                territories = this.generateBinaryLayout(count);
                break;
            case 'organic':
            default:
                territories = this.poissonDiskSampling(count);
                break;
        }
        
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
        
        // Connect territories based on layout
        this.connectTerritoriesForLayout();
        
        // All territories are now colonizable
        console.log(`Generated ${Object.keys(this.territories).length} territories with ${this.layout} layout`);
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
    
    generateClusterLayout(count) {
        const points = [];
        const clusterCount = Math.max(3, Math.floor(count / 15)); // Create 3-8 clusters
        const pointsPerCluster = Math.floor(count / clusterCount);
        
        for (let cluster = 0; cluster < clusterCount; cluster++) {
            // Random cluster center
            const centerX = 100 + Math.random() * (this.width - 200);
            const centerY = 100 + Math.random() * (this.height - 200);
            const clusterRadius = 80 + Math.random() * 120; // Varying cluster sizes
            
            let clusterPoints = cluster === clusterCount - 1 ? 
                count - points.length : pointsPerCluster; // Last cluster gets remaining points
            
            for (let i = 0; i < clusterPoints; i++) {
                let attempts = 0;
                let validPoint = false;
                
                while (!validPoint && attempts < 50) {
                    // Use normal distribution for more natural clustering
                    const angle = Math.random() * 2 * Math.PI;
                    const distance = Math.random() * clusterRadius;
                    const x = centerX + Math.cos(angle) * distance;
                    const y = centerY + Math.sin(angle) * distance;
                    
                    // Check if point is valid and not too close to existing points
                    if (x > 30 && x < this.width - 30 && y > 30 && y < this.height - 30) {
                        let tooClose = false;
                        for (const existing of points) {
                            const dist = Math.sqrt((x - existing.x) ** 2 + (y - existing.y) ** 2);
                            if (dist < 40) {
                                tooClose = true;
                                break;
                            }
                        }
                        
                        if (!tooClose) {
                            points.push({ x, y });
                            validPoint = true;
                        }
                    }
                    attempts++;
                }
            }
        }
        
        return points;
    }
    
    generateSpiralLayout(count) {
        const points = [];
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const arms = 3 + Math.floor(Math.random() * 3); // 3-5 spiral arms
        const maxRadius = Math.min(this.width, this.height) * 0.4;
        
        for (let i = 0; i < count; i++) {
            const armIndex = i % arms;
            const armProgress = Math.floor(i / arms) / Math.floor(count / arms);
            
            // Spiral equation with some randomness
            const baseAngle = (armIndex * 2 * Math.PI / arms) + (armProgress * 4 * Math.PI);
            const angle = baseAngle + (Math.random() - 0.5) * 0.8; // Add jitter
            const radius = armProgress * maxRadius + Math.random() * 30;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            // Ensure points stay within bounds
            const clampedX = Math.max(30, Math.min(this.width - 30, x));
            const clampedY = Math.max(30, Math.min(this.height - 30, y));
            
            points.push({ x: clampedX, y: clampedY });
        }
        
        return points;
    }
    
    generateCoreLayout(count) {
        const points = [];
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const coreRadius = 80;
        const shellThickness = 100;
        
        // Dense core (20% of planets)
        const coreCount = Math.floor(count * 0.2);
        for (let i = 0; i < coreCount; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * coreRadius;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            points.push({ x, y });
        }
        
        // Concentric shells (80% of planets)
        const shellCount = count - coreCount;
        const shells = 3;
        const planetsPerShell = Math.floor(shellCount / shells);
        
        for (let shell = 0; shell < shells; shell++) {
            const shellRadius = coreRadius + (shell + 1) * shellThickness;
            const shellPlanets = shell === shells - 1 ? 
                shellCount - (planetsPerShell * shell) : planetsPerShell;
            
            for (let i = 0; i < shellPlanets; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = shellRadius + (Math.random() - 0.5) * shellThickness * 0.5;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                // Keep within bounds
                const clampedX = Math.max(30, Math.min(this.width - 30, x));
                const clampedY = Math.max(30, Math.min(this.height - 30, y));
                points.push({ x: clampedX, y: clampedY });
            }
        }
        
        return points;
    }
    
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
                const angle = (i / ringPlanets) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
                const ringRadius = radius + (Math.random() - 0.5) * 30; // Slight radius variation
                
                const x = centerX + Math.cos(angle) * ringRadius;
                const y = centerY + Math.sin(angle) * ringRadius;
                
                const clampedX = Math.max(30, Math.min(this.width - 30, x));
                const clampedY = Math.max(30, Math.min(this.height - 30, y));
                points.push({ x: clampedX, y: clampedY });
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
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * systemRadius;
            const x = leftCenterX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            const clampedX = Math.max(30, Math.min(this.width - 30, x));
            const clampedY = Math.max(30, Math.min(this.height - 30, y));
            points.push({ x: clampedX, y: clampedY });
        }
        
        // Right system
        for (let i = 0; i < rightCount; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * systemRadius;
            const x = rightCenterX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            const clampedX = Math.max(30, Math.min(this.width - 30, x));
            const clampedY = Math.max(30, Math.min(this.height - 30, y));
            points.push({ x: clampedX, y: clampedY });
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
                
                if (distance <= 80) { // Close cluster connections
                    closeNeighbors.push({ territory: other, distance });
                }
            }
            
            closeNeighbors.sort((a, b) => a.distance - b.distance);
            const connections = Math.min(4, closeNeighbors.length);
            
            for (let k = 0; k < connections; k++) {
                const neighbor = closeNeighbors[k].territory;
                territory.addHiddenNeighbor(neighbor.id);
                neighbor.addHiddenNeighbor(territory.id);
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
                
                if (distance > 80 && distance <= 200) { // Bridge connections
                    bridgeTargets.push({ territory: other, distance });
                }
            }
            
            if (bridgeTargets.length > 0) {
                bridgeTargets.sort((a, b) => a.distance - b.distance);
                const neighbor = bridgeTargets[0].territory;
                territory.addHiddenNeighbor(neighbor.id);
                neighbor.addHiddenNeighbor(territory.id);
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
                territory.addHiddenNeighbor(neighbor.id);
                neighbor.addHiddenNeighbor(territory.id);
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
                
                if (distance <= 120) {
                    coreNeighbors.push({ territory: other, distance });
                }
            }
            
            coreNeighbors.sort((a, b) => a.distance - b.distance);
            const connections = Math.min(5, coreNeighbors.length); // Dense core
            
            for (let k = 0; k < connections; k++) {
                const neighbor = coreNeighbors[k].territory;
                territory.addHiddenNeighbor(neighbor.id);
                neighbor.addHiddenNeighbor(territory.id);
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
                territory.addHiddenNeighbor(neighbor.id);
                neighbor.addHiddenNeighbor(territory.id);
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
                territory.addHiddenNeighbor(neighbor.id);
                neighbor.addHiddenNeighbor(territory.id);
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
                    territory.addHiddenNeighbor(neighbor.id);
                    neighbor.addHiddenNeighbor(territory.id);
                }
            }
        });
        
        // Add bridge connections between systems
        const bridgeConnections = Math.min(3, Math.min(leftSystem.length, rightSystem.length));
        for (let i = 0; i < bridgeConnections; i++) {
            const leftTerr = leftSystem[Math.floor(Math.random() * leftSystem.length)];
            const rightTerr = rightSystem[Math.floor(Math.random() * rightSystem.length)];
            
            leftTerr.addHiddenNeighbor(rightTerr.id);
            rightTerr.addHiddenNeighbor(leftTerr.id);
        }
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
    
    isInNebula(x, y) {
        // Check if a point is inside any nebula
        for (const nebula of this.nebulas) {
            const distance = Math.sqrt((x - nebula.x) ** 2 + (y - nebula.y) ** 2);
            if (distance <= nebula.radius) {
                return true;
            }
        }
        return false;
    }
}
