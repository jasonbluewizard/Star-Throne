import { GAME_CONSTANTS } from '../../../common/gameConstants';

/**
 * Lightweight per-frame hop advancement for multi-hop fleet movements
 * Handles step-by-step movement along paths with timing calculations
 */
export function updateActiveFleets(game, deltaMs) {
    const now = Date.now();
    
    for (let i = game.activeFleets.length - 1; i >= 0; i--) {
        const f = game.activeFleets[i];
        
        // Validate fleet has valid path
        if (!f.path || f.currentHop >= f.path.length - 1) {
            game.activeFleets.splice(i, 1);
            continue;
        }
        
        const from = game.gameMap.territories[f.path[f.currentHop]];
        const to = game.gameMap.territories[f.path[f.currentHop + 1]];
        
        // Remove invalid fleets
        if (!from || !to) {
            game.activeFleets.splice(i, 1);
            continue;
        }

        // Calculate hop distance and timing
        const hopDist = Math.hypot(to.x - from.x, to.y - from.y);
        const hopTime = hopDist * GAME_CONSTANTS.HOP_DELAY_PER_PIXEL_MS;
        
        // Check if hop is complete
        if (now - f.launchTime >= hopTime) {
            f.launchTime = now;
            f.currentHop++;
            
            // Check if fleet has reached final destination
            if (f.currentHop >= f.path.length - 1) {
                // Fleet arrival at destination
                const sourceTerritory = game.gameMap.territories[f.fromTerritoryId];
                const targetTerritory = game.gameMap.territories[f.toTerritoryId];
                
                if (targetTerritory && sourceTerritory && game.combatSystem) {
                    if (f.isAttack) {
                        // Execute attack on arrival
                        game.combatSystem.executeAttack(sourceTerritory, targetTerritory, f.fleetSize);
                        console.log(`🎯 Multi-hop attack arrived: ${f.fleetSize} ships attacking ${f.toTerritoryId}`);
                    } else {
                        // Execute transfer on arrival
                        game.combatSystem.executeTransfer(sourceTerritory, targetTerritory, f.fleetSize);
                        console.log(`🚢 Multi-hop reinforcement arrived: ${f.fleetSize} ships to ${f.toTerritoryId}`);
                    }
                }
                
                // Remove completed fleet
                game.activeFleets.splice(i, 1);
            } else {
                // Log intermediate hop
                console.log(`🛸 Fleet ${f.id} hopped from ${f.path[f.currentHop-1]} to ${f.path[f.currentHop]} (${f.path.length - f.currentHop - 1} hops remaining)`);
            }
        }
    }
}