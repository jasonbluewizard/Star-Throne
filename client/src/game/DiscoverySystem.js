import { GameUtils } from './utils.js';
import { GAME_CONSTANTS } from '../../../common/gameConstants';

export class DiscoverySystem {
    constructor(game) {
        this.game = game;
        this.discoveries = {
            precursorWeapons: 0,
            precursorDrive: 0,
            precursorShield: 0,
            precursorNanotechnology: 0,
            factoryPlanets: [],
            richMinerals: 0,
            voidStorms: 0,
            ancientRuins: 0,
            hostileAliens: 0,
            friendlyAliens: 0
        };
        
        // Floating discovery announcements
        this.floatingDiscoveries = [];
        
        // Recent discovery log for UI panel
        this.recentDiscoveries = [];
    }

    // Define discovery types and their probabilities
    getDiscoveryTypes() {
        return [
            {
                id: 'hostile_aliens',
                name: 'Hostile Aliens',
                description: 'Hostile alien life destroys your probe!',
                probability: 0.15,
                type: 'negative',
                color: '#ff4444',
                icon: '👽'
            },
            {
                id: 'standard_planet',
                name: 'Standard Planet',
                description: 'A typical world with no special features.',
                probability: 0.25,
                type: 'neutral',
                color: '#888888',
                icon: '🌍'
            },
            {
                id: 'rich_minerals',
                name: 'Rich Mineral Deposits',
                description: 'Valuable resources boost this planet\'s output!',
                probability: 0.15,
                type: 'positive',
                color: '#ffaa00',
                icon: '💎'
            },
            {
                id: 'precursor_weapons',
                name: 'Precursor Weapons',
                description: 'Ancient weapon systems enhance your combat effectiveness!',
                probability: 0.10,
                type: 'empire_bonus',
                color: '#ff6666',
                icon: '⚔️'
            },
            {
                id: 'precursor_drive',
                name: 'Precursor Drive System',
                description: 'Advanced propulsion technology found!',
                probability: 0.10,
                type: 'empire_bonus',
                color: '#66ccff',
                icon: '🚀'
            },
            {
                id: 'precursor_shield',
                name: 'Precursor Shield Matrix',
                description: 'Defensive technology strengthens your empire!',
                probability: 0.10,
                type: 'empire_bonus',
                color: '#66ff66',
                icon: '🛡️'
            },
            {
                id: 'precursor_nanotech',
                name: 'Precursor Nanotechnology',
                description: 'Self-replicating technology spreads across your empire!',
                probability: 0.08,
                type: 'empire_bonus',
                color: '#cc66ff',
                icon: '🔬'
            },
            {
                id: 'factory_complex',
                name: 'Precursor Factory Complex',
                description: 'Ancient manufacturing facilities boost production!',
                probability: 0.05,
                type: 'planet_bonus',
                color: '#ffcc00',
                icon: '🏭'
            },
            {
                id: 'friendly_aliens',
                name: 'Friendly Aliens',
                description: 'Friendly aliens join your empire!',
                probability: 0.02,
                type: 'positive',
                color: '#00ff88',
                icon: '👾'
            }
        ];
    }

    // Process discovery when probe reaches planet
    processDiscovery(territory, player) {
        const discoveryTypes = this.getDiscoveryTypes();
        const random = Math.random();
        let cumulativeProbability = 0;
        
        for (const discovery of discoveryTypes) {
            cumulativeProbability += discovery.probability;
            if (random <= cumulativeProbability) {
                return this.applyDiscovery(discovery, territory, player);
            }
        }
        
        // Fallback to standard planet if no discovery triggered
        const standardPlanet = discoveryTypes.find(d => d.id === 'standard_planet');
        return this.applyDiscovery(standardPlanet, territory, player);
    }

    // Apply discovery effects and track for player
    applyDiscovery(discovery, territory, player) {
        // Only track discoveries for human player in UI
        const isHumanPlayer = player.type === 'human';
        
        // Apply discovery effects
        switch (discovery.id) {
            case 'hostile_aliens':
                // Probe destroyed, colonization fails
                if (isHumanPlayer) {
                    this.discoveries.hostileAliens++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                return false; // Colonization fails
                
            case 'precursor_weapons':
                if (isHumanPlayer) {
                    this.discoveries.precursorWeapons++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                break;
                
            case 'precursor_drive':
                if (isHumanPlayer) {
                    this.discoveries.precursorDrive++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                break;
                
            case 'precursor_shield':
                if (isHumanPlayer) {
                    this.discoveries.precursorShield++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                break;
                
            case 'precursor_nanotech':
                if (isHumanPlayer) {
                    this.discoveries.precursorNanotechnology++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                break;
                
            case 'factory_complex':
                territory.armyGenerationRate = GAME_CONSTANTS.ARMY_GENERATION_INTERVAL * 0.5; // 200% generation rate
                territory.hasFactory = true;
                if (isHumanPlayer) {
                    this.discoveries.factoryPlanets.push(territory.id);
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                break;
                
            case 'rich_minerals':
                territory.armyGenerationRate = GAME_CONSTANTS.ARMY_GENERATION_INTERVAL * 0.67; // 150% generation rate
                if (isHumanPlayer) {
                    this.discoveries.richMinerals++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                break;
                
            case 'friendly_aliens':
                territory.armySize += 50; // Instant fleet bonus
                if (isHumanPlayer) {
                    this.discoveries.friendlyAliens++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                break;
                
            case 'standard_planet':
                if (isHumanPlayer) {
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                }
                break;
        }
        
        return true; // Colonization succeeds
    }

    // Add floating discovery announcement above territory
    addFloatingDiscovery(territory, discovery) {
        this.floatingDiscoveries.push({
            x: territory.x,
            y: territory.y - 40,
            text: discovery.name,
            icon: discovery.icon,
            color: discovery.color,
            opacity: 1.0,
            createdAt: Date.now(),
            duration: 4000
        });
    }

    // Add to recent discoveries log
    addRecentDiscovery(discovery) {
        this.recentDiscoveries.unshift({
            ...discovery,
            timestamp: Date.now()
        });
        
        // Keep only last 3 discoveries
        if (this.recentDiscoveries.length > 3) {
            this.recentDiscoveries = this.recentDiscoveries.slice(0, 3);
        }
    }

    // Update floating discovery animations
    updateFloatingDiscoveries() {
        const now = Date.now();
        this.floatingDiscoveries = this.floatingDiscoveries.filter(discovery => {
            const age = now - discovery.createdAt;
            if (age > discovery.duration) {
                return false; // Remove expired
            }
            
            // Fade out in last 1000ms
            if (age > discovery.duration - 1000) {
                discovery.opacity = (discovery.duration - age) / 1000;
            }
            
            // Float upward
            discovery.y -= 0.5;
            
            return true;
        });
    }

    // Render floating discovery announcements
    renderFloatingDiscoveries(ctx, camera) {
        for (const discovery of this.floatingDiscoveries) {
            const screenPos = camera.worldToScreen(discovery.x, discovery.y);
            
            if (screenPos.x < -100 || screenPos.x > camera.width + 100 ||
                screenPos.y < -100 || screenPos.y > camera.height + 100) {
                continue; // Skip off-screen discoveries
            }
            
            ctx.save();
            ctx.globalAlpha = discovery.opacity;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Icon
            ctx.font = '20px Arial';
            ctx.fillText(discovery.icon, screenPos.x, screenPos.y - 10);
            
            // Text
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = discovery.color;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText(discovery.text, screenPos.x, screenPos.y + 10);
            ctx.fillText(discovery.text, screenPos.x, screenPos.y + 10);
            
            ctx.restore();
        }
    }

    // Get discovery bonuses for combat calculations
    getCombatBonuses() {
        return {
            attackBonus: this.discoveries.precursorWeapons * 0.1, // +10% per weapon discovery
            defenseBonus: this.discoveries.precursorShield * 0.1, // +10% per shield discovery
            speedBonus: this.discoveries.precursorDrive * 0.2 // +20% per drive discovery
        };
    }

    // Get army generation bonus
    getArmyGenerationBonus() {
        return this.discoveries.precursorNanotechnology * 0.1; // +10% per nanotech discovery
    }

    // Reset discoveries (for new games)
    reset() {
        this.discoveries = {
            precursorWeapons: 0,
            precursorDrive: 0,
            precursorShield: 0,
            precursorNanotechnology: 0,
            factoryPlanets: [],
            richMinerals: 0,
            voidStorms: 0,
            ancientRuins: 0,
            hostileAliens: 0,
            friendlyAliens: 0
        };
        this.floatingDiscoveries = [];
        this.recentDiscoveries = [];
    }

    // Get discoveries for UI display
    getDiscoveriesForUI() {
        // Return an object containing all permanent empire-wide discovery values
        return {
            // Imperial bonuses
            precursorWeapons: this.discoveries.precursorWeapons || 0,
            precursorDrive: this.discoveries.precursorDrive || 0,
            precursorShield: this.discoveries.precursorShield || 0,
            precursorNanotech: this.discoveries.precursorNanotechnology || 0,
            // Planet bonuses (per-world)
            factoryPlanets: this.discoveries.factoryPlanets || [],
            richMinerals: this.discoveries.richMinerals || 0,
            // Friendly aliens (count of events triggered)
            friendlyAliens: this.discoveries.friendlyAliens || 0,
            // Recent discoveries for temporary notifications
            recentDiscoveries: this.recentDiscoveries
        };
    }
}