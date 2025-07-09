/**
 * PathfindingService.js - Reusable pathfinding module for Star Throne
 * Extracted from SupplySystem.js to provide generic pathfinding capabilities
 * Uses Dijkstra's algorithm to find shortest paths through friendly territory
 */

export class PathfindingService {
    constructor(game) {
        this.game = game;
    }

    /**
     * Find attack path from player territory to enemy/neutral territory via warp lanes
     * @param {number} startNodeId - Starting territory ID (must be player-owned)
     * @param {number} endNodeId - Target territory ID (enemy/neutral)
     * @param {Object} graph - Game graph containing territories and ownership
     * @param {string} playerId - Player ID for territory ownership validation
     * @returns {Promise<Array|null>} Array of territory IDs representing path, or null if no path exists
     */
    async findAttackPath(startNodeId, endNodeId, graph, playerId) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('PathfindingService: findAttackPath timeout');
                resolve(null);
            }, 5000);
            
            if (!graph || !graph.territories || startNodeId === endNodeId) {
                clearTimeout(timeout);
                resolve(null);
                return;
            }

            const territories = graph.territories;
            const startTerritory = territories[startNodeId];
            const endTerritory = territories[endNodeId];

            console.log(`🛣️ ATTACK PATH: Finding path from ${startNodeId} (player ${playerId}) to ${endNodeId}`);

            // Validate start territory is player-owned, end territory exists
            if (!startTerritory || !endTerritory || startTerritory.ownerId !== playerId) {
                clearTimeout(timeout);
                console.log('PathfindingService: attack path validation failed');
                resolve(null);
                return;
            }

            // Check if target is adjacent to any player territory
            for (let territory of territories) {
                if (territory && territory.ownerId === playerId) {
                    const isAdjacent = territory.neighbors && territory.neighbors.includes(endNodeId);
                    if (isAdjacent) {
                        // Found a player territory adjacent to target
                        if (territory.id === startNodeId) {
                            // Direct attack - no path needed
                            clearTimeout(timeout);
                            console.log(`🛣️ DIRECT: Target ${endNodeId} is adjacent to source ${startNodeId}`);
                            resolve(null);
                            return;
                        } else {
                            // Multi-hop attack: find path from start to adjacent territory
                            console.log(`🛣️ MULTI-HOP: Target ${endNodeId} is adjacent to player territory ${territory.id}`);
                            const pathToAdjacent = await this.findShortestPath(startNodeId, territory.id, graph, playerId);
                            if (pathToAdjacent && pathToAdjacent.length > 1) {
                                // Add target to the end of path
                                const fullPath = [...pathToAdjacent, endNodeId];
                                clearTimeout(timeout);
                                console.log(`🛣️ ATTACK PATH FOUND: ${fullPath.join(' -> ')}`);
                                resolve(fullPath);
                                return;
                            }
                        }
                    }
                }
            }

            clearTimeout(timeout);
            console.log(`🛣️ NO ATTACK PATH: No route found to ${endNodeId}`);
            resolve(null);
        });
    }

    /**
     * Find the shortest path between two nodes through friendly territory
     * @param {number} startNodeId - Starting territory ID
     * @param {number} endNodeId - Destination territory ID
     * @param {Object} graph - Game graph containing territories and ownership
     * @param {string} playerId - Player ID for territory ownership validation
     * @returns {Promise<Array|null>} Array of territory IDs representing path, or null if no path exists
     */
    async findShortestPath(startNodeId, endNodeId, graph, playerId) {
        return new Promise((resolve) => {
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                console.log('PathfindingService: timeout after 5 seconds');
                resolve(null);
            }, 5000);
            
            // Validate inputs
            if (!graph || !graph.territories || startNodeId === endNodeId) {
                clearTimeout(timeout);
                console.log('PathfindingService: invalid inputs');
                resolve(null);
                return;
            }

            const territories = graph.territories;
            const startTerritory = territories[startNodeId];
            const endTerritory = territories[endNodeId];

            console.log('PathfindingService: territories array length:', territories.length);
            console.log('PathfindingService: startTerritory:', startTerritory);
            console.log('PathfindingService: endTerritory:', endTerritory);
            console.log('PathfindingService: playerId:', playerId);

            // Validate start and end territories exist and are owned by player
            if (!startTerritory || !endTerritory || 
                startTerritory.ownerId !== playerId || 
                endTerritory.ownerId !== playerId) {
                clearTimeout(timeout);
                console.log('PathfindingService: territory validation failed');
                resolve(null);
                return;
            }

            // Initialize Dijkstra's algorithm data structures
            const distances = new Map();
            const previous = new Map();
            const unvisited = new Set();

            // Initialize all player-owned territories
            for (let territory of territories) {
                if (territory && territory.ownerId === playerId) {
                    distances.set(territory.id, territory.id === startNodeId ? 0 : Infinity);
                    previous.set(territory.id, null);
                    unvisited.add(territory.id);
                }
            }

            // If end territory is not in unvisited set, no path exists
            if (!unvisited.has(endNodeId)) {
                resolve(null);
                return;
            }

            // Dijkstra's algorithm main loop
            while (unvisited.size > 0) {
                // Find unvisited node with minimum distance
                let currentNode = null;
                let minDistance = Infinity;
                
                for (let nodeId of unvisited) {
                    const distance = distances.get(nodeId);
                    if (distance < minDistance) {
                        minDistance = distance;
                        currentNode = nodeId;
                    }
                }

                // If no reachable unvisited nodes remain
                if (currentNode === null || minDistance === Infinity) {
                    break;
                }

                // Remove current node from unvisited
                unvisited.delete(currentNode);

                // If we reached the destination, reconstruct path
                if (currentNode === endNodeId) {
                    clearTimeout(timeout);
                    const path = this.reconstructPath(previous, startNodeId, endNodeId);
                    console.log('PathfindingService: path found:', path);
                    resolve(path);
                    return;
                }

                // Examine neighbors of current node
                const currentTerritory = territories[currentNode];
                if (currentTerritory && currentTerritory.neighbors) {
                    for (let neighborId of currentTerritory.neighbors) {
                        const neighborTerritory = territories[neighborId];
                        
                        // Only consider neighbors owned by the same player
                        if (neighborTerritory && 
                            neighborTerritory.ownerId === playerId && 
                            unvisited.has(neighborId)) {
                            
                            const altDistance = distances.get(currentNode) + 1;
                            
                            if (altDistance < distances.get(neighborId)) {
                                distances.set(neighborId, altDistance);
                                previous.set(neighborId, currentNode);
                            }
                        }
                    }
                }
            }

            // No path found
            clearTimeout(timeout);
            console.log('PathfindingService: no path found');
            resolve(null);
        });
    }

    /**
     * Reconstruct the shortest path from previous node mapping
     * @param {Map} previous - Map of nodeId -> previousNodeId
     * @param {number} startNodeId - Starting node ID
     * @param {number} endNodeId - Ending node ID
     * @returns {Array} Array of node IDs representing the path
     */
    reconstructPath(previous, startNodeId, endNodeId) {
        const path = [];
        let currentNode = endNodeId;

        // Work backwards from end to start
        while (currentNode !== null) {
            path.unshift(currentNode);
            currentNode = previous.get(currentNode);
        }

        // Validate that we have a complete path
        if (path.length === 0 || path[0] !== startNodeId) {
            return null;
        }

        return path;
    }

    /**
     * Check if two territories are adjacent (directly connected)
     * @param {Object} territory1 - First territory
     * @param {Object} territory2 - Second territory
     * @returns {boolean} True if territories are adjacent
     */
    areTerritoriesAdjacent(territory1, territory2) {
        if (!territory1 || !territory2 || !territory1.neighbors) {
            return false;
        }
        
        return territory1.neighbors.includes(territory2.id);
    }

    /**
     * Validate if a territory is owned by a specific player
     * @param {Object} territory - Territory to check
     * @param {string} playerId - Player ID to validate ownership
     * @returns {boolean} True if territory is owned by player
     */
    isOwnedByPlayer(territory, playerId) {
        return territory && territory.ownerId === playerId;
    }

    /**
     * Get territory ownership type relative to a player
     * @param {Object} territory - Territory to check
     * @param {string} playerId - Player ID for comparison
     * @returns {string} 'friendly', 'enemy', 'neutral', or 'invalid'
     */
    getTerritoryOwnershipType(territory, playerId) {
        if (!territory) {
            return 'invalid';
        }

        // Check for colonizable planets first (legacy system - should be removed)
        if (territory.isColonizable) {
            return 'colonizable';
        }

        if (territory.ownerId === playerId) {
            return 'friendly';
        } else if (territory.ownerId === null || territory.ownerId === 0) {
            return 'neutral';
        } else {
            return 'enemy';
        }
    }

    /**
     * Calculate path distance (number of hops)
     * @param {Array} path - Array of territory IDs
     * @returns {number} Number of hops in the path
     */
    calculatePathDistance(path) {
        return path ? Math.max(0, path.length - 1) : 0;
    }
}