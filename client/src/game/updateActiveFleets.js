import { HOP_DELAY_PER_PIXEL_MS } from '../../../common/gameConstants';

/**
 * Lightweight per-frame hop advancement for multi-hop fleet movements
 * @param {Object} game - The main game instance
 * @param {number} deltaMs - Delta time in milliseconds
 */
export function updateActiveFleets(game, deltaMs) {
    const now = Date.now();
    for (let i = game.activeFleets.length - 1; i >= 0; i--) {
        const f = game.activeFleets[i];
        const from = game.gameMap.territories[f.path[f.currentHop]];
        const to = game.gameMap.territories[f.path[f.currentHop + 1]];
        
        if (!to) { 
            game.activeFleets.splice(i, 1); 
            continue; 
        }

        const hopDist = Math.hypot(to.x - from.x, to.y - from.y);
        const hopTime = hopDist * HOP_DELAY_PER_PIXEL_MS;
        
        if (now - f.launchTime >= hopTime) {
            f.launchTime = now;
            f.currentHop++;
            
            // Check if fleet has reached destination
            if (f.currentHop >= f.path.length - 1) {
                // Fleet has arrived at destination - execute arrival behavior
                const finalTerritory = game.gameMap.territories[f.path[f.path.length - 1]];
                if (finalTerritory) {
                    if (f.isAttack) {
                        // Execute attack on arrival
                        game.combatSystem.executeAttack(
                            { id: f.sourceId, ownerId: f.ownerId }, 
                            finalTerritory, 
                            f.fleetSize
                        );
                        console.log(`💥 Multi-hop attack arrived: ${f.fleetSize} ships hit territory ${finalTerritory.id}`);
                    } else {
                        // Reinforce friendly territory
                        finalTerritory.armySize += f.fleetSize;
                        console.log(`🛡️ Multi-hop reinforcements arrived: +${f.fleetSize} ships to territory ${finalTerritory.id}`);
                    }
                }
                game.activeFleets.splice(i, 1);
                continue;
            }
            
            // Create visual animation for this hop
            if (from && to) {
                game.createShipAnimation(from, to, f.isAttack, f.fleetSize);
                console.log(`🚀 Fleet hop ${f.currentHop}/${f.path.length - 1}: ${from.id} → ${to.id}`);
            }
        }
    }
}