/**
 * SupplySystem.js - Supply route management module
 * 
 * Manages the creation, validation, and processing of supply routes.
 * Uses the new PathfindingService for route calculations.
 */

import { GAME_CONSTANTS } from '../../../common/gameConstants';
import PathfindingService from './PathfindingService.js';

export class SupplySystem {
    constructor(game) {
        this.game = game;
        this.supplyRoutes = [];
        this.routeValidationFrame = 0;
        this.routeProcessingFrame = 0;
    }
    
    async createSupplyRoute(fromTerritory, toTerritory) {
        if (!this.validateSupplyRouteCreation(fromTerritory, toTerritory)) {
            return false;
        }
        
        // Check if route already exists
        const existingRoute = this.findExistingRoute(fromTerritory.id, toTerritory.id);
        if (existingRoute) {
            console.log('Supply route already exists between these territories');
            return false;
        }
        
        // Find path between territories using PathfindingService
        const path = await PathfindingService.findShortestPath(
            fromTerritory.id, 
            toTerritory.id, 
            this.game.gameMap, 
            this.game.humanPlayer?.id
        );
        
        if (!path || path.length < 2) {
            console.log('No valid path found between territories');
            return false;
        }
        
        // Create new supply route
        const route = {
            id: this.generateRouteId(),
            from: fromTerritory.id,
            to: toTerritory.id,
            path: path,
            active: true,
            lastTransfer: 0,
            transferCooldown: GAME_CONSTANTS.SUPPLY_ROUTE_TRANSFER_COOLDOWN,
            createdTime: Date.now()
        };
        
        this.supplyRoutes.push(route);
        
        console.log(`Supply route created: ${fromTerritory.id} → ${toTerritory.id} (${path.length} hops)`);
        
        // Visual feedback
        this.game.showMessage(`Supply route established: ${path.length - 1} hop${path.length > 2 ? 's' : ''}`, 2000);
        
        return true;
    }
    
    validateSupplyRouteCreation(fromTerritory, toTerritory) {
        const humanPlayerId = this.game.humanPlayer?.id;
        
        // Check ownership
        if (fromTerritory.ownerId !== humanPlayerId || toTerritory.ownerId !== humanPlayerId) {
            console.log('Both territories must be owned by player to create supply route');
            return false;
        }
        
        // Check if territories are different
        if (fromTerritory.id === toTerritory.id) {
            console.log('Cannot create supply route to same territory');
            return false;
        }
        
        return true;
    }
    
    findExistingRoute(fromId, toId) {
        return this.supplyRoutes.find(route => 
            (route.from === fromId && route.to === toId) ||
            (route.from === toId && route.to === fromId)
        );
    }
    
    findPathBetweenTerritories(fromTerritory, toTerritory) {
        const humanPlayerId = this.game.humanPlayer?.id;
        const visited = new Set();
        const queue = [{
            territory: fromTerritory,
            path: [fromTerritory]
        }];
        
        visited.add(fromTerritory.id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            // Found target
            if (current.territory.id === toTerritory.id) {
                return current.path;
            }
            
            // Explore neighbors
            for (const neighborId of current.territory.neighbors) {
                if (visited.has(neighborId)) continue;
                
                const neighbor = this.game.gameMap.territories[neighborId];
                if (!neighbor) continue;
                
                // Only traverse through owned territories
                if (neighbor.ownerId !== humanPlayerId) continue;
                
                visited.add(neighborId);
                queue.push({
                    territory: neighbor,
                    path: [...current.path, neighbor]
                });
            }
        }
        
        return null; // No path found
    }
    
    validateSupplyRoutes() {
        // Throttle validation to every 45 frames
        this.routeValidationFrame++;
        if (this.routeValidationFrame < 45) return;
        this.routeValidationFrame = 0;
        
        const humanPlayerId = this.game.humanPlayer?.id;
        
        for (let i = this.supplyRoutes.length - 1; i >= 0; i--) {
            const route = this.supplyRoutes[i];
            
            // Check if territories still exist and are owned
            const fromTerritory = this.game.gameMap.territories[route.from];
            const toTerritory = this.game.gameMap.territories[route.to];
            
            if (!fromTerritory || !toTerritory ||
                fromTerritory.ownerId !== humanPlayerId ||
                toTerritory.ownerId !== humanPlayerId) {
                
                console.log(`Supply route ${route.id} invalidated - territory ownership changed`);
                this.supplyRoutes.splice(i, 1);
                continue;
            }
            
            // Validate path integrity
            if (!this.isPathValid(route.path, humanPlayerId)) {
                console.log(`Supply route ${route.id} invalidated - path broken`);
                route.active = false;
                
                // Try to find new path
                const newPath = this.findPathBetweenTerritories(fromTerritory, toTerritory);
                if (newPath) {
                    route.path = newPath;
                    route.active = true;
                    console.log(`Supply route ${route.id} rerouted`);
                } else {
                    this.supplyRoutes.splice(i, 1);
                }
            }
        }
    }
    
    isPathValid(path, ownerId) {
        for (const territory of path) {
            if (territory.ownerId !== ownerId) {
                return false;
            }
        }
        
        // Check path connectivity
        for (let i = 0; i < path.length - 1; i++) {
            const current = path[i];
            const next = path[i + 1];
            
            if (!current.neighbors.includes(next.id)) {
                return false;
            }
        }
        
        return true;
    }
    
    processSupplyRoutes(deltaTime) {
        // Throttle processing to every 90 frames
        this.routeProcessingFrame++;
        if (this.routeProcessingFrame < 90) return;
        this.routeProcessingFrame = 0;
        
        const currentTime = Date.now();
        
        for (const route of this.supplyRoutes) {
            if (!route.active) continue;
            
            // Check transfer cooldown
            if (currentTime - route.lastTransfer < route.transferCooldown) continue;
            
            const fromTerritory = this.game.gameMap.territories[route.from];
            const toTerritory = this.game.gameMap.territories[route.to];
            
            if (!fromTerritory || !toTerritory) continue;
            
            // Check if transfer is needed and beneficial
            if (this.shouldTransferArmies(fromTerritory, toTerritory)) {
                this.executeSupplyTransfer(route, fromTerritory, toTerritory);
                route.lastTransfer = currentTime;
            }
        }
    }
    
    shouldTransferArmies(fromTerritory, toTerritory) {
        // Transfer threshold - only if source has significantly more armies
        const transferThreshold = GAME_CONSTANTS.SUPPLY_ROUTE_TRANSFER_THRESHOLD;
        const armyDifference = fromTerritory.armySize - toTerritory.armySize;
        
        return armyDifference >= transferThreshold && fromTerritory.armySize > 10;
    }
    
    executeSupplyTransfer(route, fromTerritory, toTerritory) {
        const transferAmount = Math.floor(fromTerritory.armySize * GAME_CONSTANTS.SUPPLY_ROUTE_TRANSFER_RATIO);
        
        if (transferAmount < 1) return;
        
        // Calculate delivery delay based on path length
        const hopsCount = route.path.length - 1;
        const deliveryDelay = hopsCount * GAME_CONSTANTS.SUPPLY_ROUTE_HOP_DELAY;
        
        // Immediate deduction from source
        fromTerritory.armySize -= transferAmount;
        
        // Schedule delayed delivery
        this.createDelayedSupplyTransfer(toTerritory, transferAmount, deliveryDelay, route);
        
        // Create multi-hop ship animation
        this.createSupplyRouteAnimation(route, transferAmount);
        
        console.log(`Supply transfer: ${transferAmount} armies via ${hopsCount} hop${hopsCount > 1 ? 's' : ''} (${deliveryDelay}ms delay)`);
    }
    
    createDelayedSupplyTransfer(toTerritory, amount, delay, route) {
        setTimeout(() => {
            // Verify territory still exists and is owned
            if (toTerritory && toTerritory.ownerId === this.game.humanPlayer?.id) {
                toTerritory.armySize += amount;
                
                // Visual feedback
                toTerritory.floatingText = {
                    text: `+${amount}`,
                    color: '#00ffff',
                    startTime: Date.now(),
                    duration: 2000,
                    endTime: Date.now() + 2000
                };
                
                console.log(`Supply delivery: +${amount} armies to territory ${toTerritory.id}`);
            }
        }, delay);
    }
    
    createSupplyRouteAnimation(route, amount) {
        if (!route.path || route.path.length < 2) return;
        
        const player = this.game.humanPlayer;
        if (!player) return;
        
        // Create multi-segment animation following the supply route path
        const segments = [];
        for (let i = 0; i < route.path.length - 1; i++) {
            segments.push({
                from: { x: route.path[i].x, y: route.path[i].y },
                to: { x: route.path[i + 1].x, y: route.path[i + 1].y }
            });
        }
        
        const totalDuration = segments.length * 800; // 800ms per segment
        
        this.game.renderer.createShipAnimation(
            { x: route.path[0].x, y: route.path[0].y },
            { x: route.path[route.path.length - 1].x, y: route.path[route.path.length - 1].y },
            player.color,
            totalDuration,
            segments
        );
    }
    
    generateRouteId() {
        return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Public interface
    getActiveSupplyRoutes() {
        return this.supplyRoutes.filter(route => route.active);
    }
    
    getSupplyRouteCount() {
        return this.supplyRoutes.length;
    }
    
    removeSupplyRoute(routeId) {
        const index = this.supplyRoutes.findIndex(route => route.id === routeId);
        if (index > -1) {
            this.supplyRoutes.splice(index, 1);
            console.log(`Supply route ${routeId} removed`);
            return true;
        }
        return false;
    }
    
    removeAllSupplyRoutes() {
        this.supplyRoutes = [];
        console.log('All supply routes cleared');
    }
    
    getSupplyRoutesBetween(territoryId1, territoryId2) {
        return this.supplyRoutes.filter(route => 
            (route.from === territoryId1 && route.to === territoryId2) ||
            (route.from === territoryId2 && route.to === territoryId1)
        );
    }
    
    // Debug and statistics
    getSupplyRouteStats() {
        const active = this.supplyRoutes.filter(r => r.active).length;
        const inactive = this.supplyRoutes.filter(r => !r.active).length;
        const totalPaths = this.supplyRoutes.reduce((sum, r) => sum + (r.path?.length || 0), 0);
        const avgPathLength = this.supplyRoutes.length > 0 ? totalPaths / this.supplyRoutes.length : 0;
        
        return {
            total: this.supplyRoutes.length,
            active,
            inactive,
            averagePathLength: Math.round(avgPathLength * 100) / 100
        };
    }
    
    logSupplyRouteDebug() {
        console.log('=== Supply Route Debug ===');
        console.log(`Total routes: ${this.supplyRoutes.length}`);
        
        for (const route of this.supplyRoutes) {
            const fromTerritory = this.game.gameMap.territories[route.from];
            const toTerritory = this.game.gameMap.territories[route.to];
            
            console.log(`Route ${route.id}: ${route.from} → ${route.to}`);
            console.log(`  Status: ${route.active ? 'Active' : 'Inactive'}`);
            console.log(`  Path length: ${route.path?.length || 0} territories`);
            console.log(`  From armies: ${fromTerritory?.armySize || 'N/A'}`);
            console.log(`  To armies: ${toTerritory?.armySize || 'N/A'}`);
            console.log(`  Last transfer: ${Date.now() - route.lastTransfer}ms ago`);
        }
    }
}