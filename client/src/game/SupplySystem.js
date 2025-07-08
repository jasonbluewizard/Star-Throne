/**
 * SupplySystem.js - Supply route management module
 * 
 * Manages the creation, validation, and processing of supply routes.
 * Uses the new PathfindingService for route calculations.
 */

import { GAME_CONSTANTS } from '../../../common/gameConstants';
// Removed unused PathfindingService import (dead code eliminated)

export class SupplySystem {
    constructor(game) {
        this.game = game;
        this.supplyRoutes = [];
        this.routeValidationFrame = 0;
        this.routeProcessingFrame = 0;
    }
    
    async createSupplyRoute(fromTerritory, toTerritory) {
        console.log('SupplySystem: createSupplyRoute called', fromTerritory.id, toTerritory.id);
        
        if (!this.validateSupplyRouteCreation(fromTerritory, toTerritory)) {
            console.log('SupplySystem: validation failed');
            return false;
        }
        
        /*────────  NEW  ────────*
         * A source star may supply ONE destination at a time.
         * If the source already has a route, remove / replace it.          */
        this.supplyRoutes = this.supplyRoutes.filter(r => {
            const keep = r.from !== fromTerritory.id;
            if (!keep) console.log(`SupplySystem: replacing route ${r.id} from ${r.from}`);
            return keep;
        });
        
        // Check if pathfinding service exists
        if (!this.game.pathfindingService) {
            console.log('SupplySystem: pathfindingService not available');
            return false;
        }
        
        // Find path between territories using PathfindingService
        console.log('SupplySystem: calling pathfindingService.findShortestPath');
        
        // Create proper graph structure for pathfinding
        // Convert gameMap.territories object to array for pathfinding service
        const territoriesArray = Object.values(this.game.gameMap.territories);
        const graph = {
            territories: territoriesArray
        };
        
        console.log('SupplySystem: created graph with', territoriesArray.length, 'territories');
        console.log('SupplySystem: first few territories:', territoriesArray.slice(0, 2));
        console.log('SupplySystem: humanPlayer:', this.game.humanPlayer);
        const path = await this.game.pathfindingService.findShortestPath(
            fromTerritory.id, 
            toTerritory.id, 
            graph, 
            this.game.humanPlayer?.id
        );
        
        console.log('SupplySystem: pathfinding result:', path);
        
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
            transferCooldown: GAME_CONSTANTS.SUPPLY_ROUTE.TRANSFER_INTERVAL,
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
    
    // Removed unused: findExistingRoute (no other code calls this)
    
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
        // Path contains territory IDs, not territory objects
        for (const territoryId of path) {
            const territory = this.game.gameMap.territories[territoryId];
            if (!territory || territory.ownerId !== ownerId) {
                return false;
            }
        }
        
        // Check path connectivity
        for (let i = 0; i < path.length - 1; i++) {
            const currentId = path[i];
            const nextId = path[i + 1];
            const current = this.game.gameMap.territories[currentId];
            
            if (!current || !current.neighbors.includes(nextId)) {
                return false;
            }
        }
        
        return true;
    }
    
    processSupplyRoutes(deltaTime) {
        // Supply routes now redirect army generation instead of transferring armies
        // Validation is handled in validateSupplyRoutes() method called from main game loop
        // This method is no longer needed but kept for interface compatibility
    }
    
    // Supply routes now redirect army generation instead of transferring armies
    // The old transfer-based methods are no longer needed
    
    generateRouteId() {
        return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Check if a territory is redirecting its army generation via supply route
    isSupplySource(territoryId) {
        return this.supplyRoutes.some(route => route.active && route.from === territoryId);
    }
    
    // Get the destination territory for a supply source
    getSupplyDestination(territoryId) {
        const route = this.supplyRoutes.find(route => route.active && route.from === territoryId);
        return route ? route.to : null;
    }
    
    // Public interface
    getActiveSupplyRoutes() {
        return this.supplyRoutes.filter(route => route.active);
    }
    
    // Removed unused: getSupplyRouteCount (simply this.supplyRoutes.length)
    
    removeSupplyRoute(routeId) {
        const index = this.supplyRoutes.findIndex(route => route.id === routeId);
        if (index > -1) {
            this.supplyRoutes.splice(index, 1);
            console.log(`Supply route ${routeId} removed`);
            return true;
        }
        return false;
    }
    
    // Removed unused: removeAllSupplyRoutes (no callers found)
    
    renderSupplyRoutes(ctx, territories) {
        // Render active supply routes with animated arrows
        this.supplyRoutes.forEach(route => {
            if (!route.active) return;
            
            const fromTerritory = territories[route.from];
            const toTerritory = territories[route.to];
            
            if (fromTerritory && toTerritory && route.path && route.path.length > 1) {
                ctx.save();
                
                // Draw route path with animated dashes - color based on activity
                const routeActive = fromTerritory.armySize > 10; // Route is active if source has armies
                if (routeActive) {
                    ctx.strokeStyle = '#00ffff'; // Bright cyan for active routes
                    ctx.globalAlpha = 0.9;
                } else {
                    ctx.strokeStyle = '#006666'; // Dimmed cyan for inactive routes
                    ctx.globalAlpha = 0.5;
                }
                ctx.lineWidth = 3;
                
                /* Dynamic dash speed : faster when more lines converge */
                const currentTime   = Date.now();
                const inboundCount  = this.supplyRoutes.filter(r =>
                      r.active && r.to === route.to).length;
                const speedFactor   = Math.min(inboundCount, 6); // cap at 6 ×
                const animationOffset = (currentTime * (0.02 * speedFactor)) % 20;
                ctx.setLineDash([8, 12]);
                ctx.lineDashOffset = -animationOffset;
                
                // Draw path segments using territory IDs to get coordinates
                for (let i = 0; i < route.path.length - 1; i++) {
                    const currentId = route.path[i];
                    const nextId = route.path[i + 1];
                    const current = territories[currentId];
                    const next = territories[nextId];
                    
                    if (current && next) {
                        ctx.beginPath();
                        ctx.moveTo(current.x, current.y);
                        ctx.lineTo(next.x, next.y);
                        ctx.stroke();
                    }
                }
                
                ctx.restore();
                
                /* White pulsing highlight while either end is hovered */
                const hoveredId = this.game.inputHandler?.hoveredTerritory?.id;
                if (hoveredId === route.from || hoveredId === route.to) {
                    const pulse = 0.5 + 0.5 * Math.sin(currentTime * 0.006);
                    ctx.save();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth   = 4;
                    ctx.globalAlpha = pulse;
                    ctx.setLineDash([]);   // solid white pulse
                    ctx.beginPath();
                    for (let i = 0; i < route.path.length - 1; i++) {
                        const c = territories[route.path[i]];
                        const n = territories[route.path[i + 1]];
                        if (c && n) {
                            if (i === 0) ctx.moveTo(c.x, c.y);
                            ctx.lineTo(n.x, n.y);
                        }
                    }
                    ctx.stroke();
                    ctx.restore();
                }
            }
        });
    }
    
    stopSupplyRoutesFromTerritory(territoryId) {
        const routesToRemove = this.supplyRoutes.filter(route => route.from === territoryId);
        const count = routesToRemove.length;
        
        if (count > 0) {
            this.supplyRoutes = this.supplyRoutes.filter(route => route.from !== territoryId);
            console.log(`Supply Stopped - ${count} route(s) from territory ${territoryId} halted`);
            return true;
        }
        return false;
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