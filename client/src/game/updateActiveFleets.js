import { GAME_CONSTANTS } from '../../../common/gameConstants';

/**
 * Lightweight per-frame hop advancement for multi-hop fleet movements
 * @param {Object} game - The main game instance
 * @param {number} deltaMs - Delta time in milliseconds
 */
export function updateActiveFleets(game, deltaMs) {
    const now = Date.now();
    
    for (let i = game.activeFleets.length - 1; i >= 0; i--) {
        const fleet = game.activeFleets[i];
        
        // Validate current position in path
        if (fleet.currentHop >= fleet.path.length - 1) {
            // Fleet has reached final destination
            const finalTerritory = game.gameMap.territories[fleet.path[fleet.path.length - 1]];
            if (finalTerritory) {
                if (fleet.isAttack) {
                    // Execute attack on arrival
                    game.combatSystem.executeAttack(
                        { id: fleet.sourceId, ownerId: fleet.ownerId }, 
                        finalTerritory, 
                        fleet.fleetSize
                    );
                    console.log(`💥 Multi-hop attack arrived: ${fleet.fleetSize} ships hit territory ${finalTerritory.id}`);
                } else {
                    // Reinforce friendly territory
                    finalTerritory.armySize += fleet.fleetSize;
                    console.log(`🛡️ Multi-hop reinforcements arrived: +${fleet.fleetSize} ships to territory ${finalTerritory.id}`);
                }
            }
            
            // Remove completed fleet
            game.activeFleets.splice(i, 1);
            continue;
        }
        
        // Get current hop territories
        const from = game.gameMap.territories[fleet.path[fleet.currentHop]];
        const to = game.gameMap.territories[fleet.path[fleet.currentHop + 1]];
        
        if (!from || !to) {
            // Invalid path - remove fleet
            console.warn(`Invalid multi-hop path segment: ${fleet.path[fleet.currentHop]} -> ${fleet.path[fleet.currentHop + 1]}`);
            game.activeFleets.splice(i, 1);
            continue;
        }
        
        // Check if territory ownership changed during transit (path compromised)
        if (to.ownerId !== fleet.ownerId && fleet.currentHop < fleet.path.length - 2) {
            // Intermediate territory captured - stop fleet here and engage
            console.log(`⚠️ Multi-hop path compromised at territory ${to.id} - engaging in combat`);
            if (fleet.isAttack || to.ownerId !== fleet.ownerId) {
                // Attack the compromised territory
                game.combatSystem.executeAttack(
                    { id: fleet.sourceId, ownerId: fleet.ownerId }, 
                    to, 
                    fleet.fleetSize
                );
            }
            game.activeFleets.splice(i, 1);
            continue;
        }
        
        // Calculate hop timing
        const hopDistance = Math.hypot(to.x - from.x, to.y - from.y);
        const hopTime = hopDistance * GAME_CONSTANTS.HOP_DELAY_PER_PIXEL_MS;
        
        if (now - fleet.launchTime >= hopTime) {
            // Advance to next hop
            fleet.launchTime = now;
            fleet.currentHop++;
            
            console.log(`🚀 Multi-hop fleet advanced: hop ${fleet.currentHop}/${fleet.path.length - 1} (${fleet.fleetSize} ships)`);
            
            // Create visual ship animation for this hop segment
            if (fleet.currentHop < fleet.path.length - 1) {
                const nextTo = game.gameMap.territories[fleet.path[fleet.currentHop + 1]];
                if (nextTo && game.createShipAnimation) {
                    game.createShipAnimation(to, nextTo, fleet.isAttack, fleet.fleetSize);
                }
            }
        }
    }
}