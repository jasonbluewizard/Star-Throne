import { buildDistanceMatrix, buildAdjacencyList, findPath, updatePlayerRange } from '../../../common/rangePathfinding';

export class RangePathfindingManager {
    constructor(game) {
        this.game = game;
        this.distanceMatrix = null;
        this.playerAdjacencyLists = new Map(); // playerId -> adjacency list
    }

    initialize() {
        if (!this.game.gameMap || !this.game.gameMap.territories) return;

        // Convert territories object to array if needed
        const territories = Array.isArray(this.game.gameMap.territories) 
            ? this.game.gameMap.territories 
            : Object.values(this.game.gameMap.territories);
            
        const positions = territories.map(t => ({ x: t.x, y: t.y }));
        
        this.distanceMatrix = buildDistanceMatrix(positions);
        
        // Initialize adjacency lists for all players
        for (const player of this.game.players) {
            this.updatePlayerRange(player);
        }
    }

    updatePlayerRange(player) {
        if (!this.distanceMatrix) return;
        
        const adjacencyList = updatePlayerRange(player.range, this.distanceMatrix);
        this.playerAdjacencyLists.set(player.id, adjacencyList);
    }

    findRangePath(playerId, fromTerritoryId, toTerritoryId) {
        const adjacencyList = this.playerAdjacencyLists.get(playerId);
        if (!adjacencyList) return null;

        // Find the array indices for the territory IDs
        const territories = Array.isArray(this.game.gameMap.territories) 
            ? this.game.gameMap.territories 
            : Object.values(this.game.gameMap.territories);
            
        const fromIndex = territories.findIndex(t => t.id === fromTerritoryId);
        const toIndex = territories.findIndex(t => t.id === toTerritoryId);
        
        if (fromIndex === -1 || toIndex === -1) return null;

        return findPath(adjacencyList, fromIndex, toIndex);
    }

    canReach(playerId, fromTerritoryId, toTerritoryId) {
        const path = this.findRangePath(playerId, fromTerritoryId, toTerritoryId);
        return path !== null;
    }

    getReachableTerritories(playerId, fromTerritoryId) {
        const adjacencyList = this.playerAdjacencyLists.get(playerId);
        if (!adjacencyList) return [];

        const territories = Array.isArray(this.game.gameMap.territories) 
            ? this.game.gameMap.territories 
            : Object.values(this.game.gameMap.territories);
            
        const fromIndex = territories.findIndex(t => t.id === fromTerritoryId);
        if (fromIndex === -1 || !adjacencyList[fromIndex]) return [];

        const reachable = new Set();
        const queue = [fromIndex];
        const visited = new Set([fromIndex]);

        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = adjacencyList[current] || [];

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    reachable.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }

        // Convert indices back to territory IDs
        return Array.from(reachable).map(index => territories[index].id);
    }
}