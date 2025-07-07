import { GameUtils } from './utils.js';
import { GAME_CONSTANTS } from '../../../common/gameConstants.ts';

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
        
        // Top discovery bar announcements
        this.topDiscoveryAnnouncements = [];
    }

    // Define discovery types and their probabilities
    getDiscoveryTypes() {
        return [

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

    // Process discovery when conquering neutral territory
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
            case 'precursor_weapons':
                // Apply effect to all players
                if (isHumanPlayer) {
                    this.discoveries.precursorWeapons++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                    this.addTopDiscoveryAnnouncement(discovery);
                }
                break;
                
            case 'precursor_drive':
                if (isHumanPlayer) {
                    this.discoveries.precursorDrive++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                    this.addTopDiscoveryAnnouncement(discovery);
                }
                break;
                
            case 'precursor_shield':
                if (isHumanPlayer) {
                    this.discoveries.precursorShield++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                    this.addTopDiscoveryAnnouncement(discovery);
                }
                break;
                
            case 'precursor_nanotech':
                if (isHumanPlayer) {
                    this.discoveries.precursorNanotechnology++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                    this.addTopDiscoveryAnnouncement(discovery);
                }
                break;
                
            case 'factory_complex':
                territory.armyGenerationRate = GAME_CONSTANTS.ARMY_GENERATION_INTERVAL * 0.5; // 200% generation rate
                territory.hasFactory = true;
                if (isHumanPlayer) {
                    this.discoveries.factoryPlanets.push(territory.id);
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                    this.addTopDiscoveryAnnouncement(discovery);
                }
                break;
                
            case 'rich_minerals':
                territory.armyGenerationRate = GAME_CONSTANTS.ARMY_GENERATION_INTERVAL * 0.67; // 150% generation rate
                if (isHumanPlayer) {
                    this.discoveries.richMinerals++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                    this.addTopDiscoveryAnnouncement(discovery);
                }
                break;
                
            case 'friendly_aliens':
                territory.armySize += 50; // Instant fleet bonus
                if (isHumanPlayer) {
                    this.discoveries.friendlyAliens++;
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                    this.addTopDiscoveryAnnouncement(discovery);
                }
                break;
                
            case 'standard_planet':
                if (isHumanPlayer) {
                    this.addFloatingDiscovery(territory, discovery);
                    this.addRecentDiscovery(discovery);
                    this.addTopDiscoveryAnnouncement(discovery);
                }
                break;
        }
        
        // For human player, also update the global discovery stats for UI display
        if (isHumanPlayer) {
            // Map internal discovery ID to the key used in playerDiscoveries map
            let discoveryType = discovery.id;
            if (discoveryType === 'factory_complex') discoveryType = 'precursor_factory'; 
            if (discoveryType === 'rich_minerals')   discoveryType = 'mineral_deposits';
            // Increment the corresponding value in the player's discovery record
            GameUtils.processDiscovery(discoveryType, player.id, territory.id, this.game.playerDiscoveries, this.game);
        }
        return discovery; // Return the discovery object
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

    // Add to top discovery bar
    addTopDiscoveryAnnouncement(discovery) {
        this.topDiscoveryAnnouncements.push({
            ...discovery,
            createdAt: Date.now(),
            duration: 4000, // 4 seconds
            opacity: 1.0
        });

        // Keep only last 1 announcement
        if (this.topDiscoveryAnnouncements.length > 1) {
            this.topDiscoveryAnnouncements = this.topDiscoveryAnnouncements.slice(-1);
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

    // Update top discovery bar animations
    updateTopDiscoveryAnnouncements() {
        const now = Date.now();
        this.topDiscoveryAnnouncements = this.topDiscoveryAnnouncements.filter(discovery => {
            const age = now - discovery.createdAt;
            if (age > discovery.duration) {
                return false; // Remove expired
            }
            
            // Fade out in last 1000ms
            if (age > discovery.duration - 1000) {
                discovery.opacity = (discovery.duration - age) / 1000;
            }
            
            return true;
        });
    }

    // Render top discovery bar
    renderTopDiscoveryBar(ctx) {
        if (this.topDiscoveryAnnouncements.length === 0) return;

        const discovery = this.topDiscoveryAnnouncements[0];
        const centerX = ctx.canvas.width / 2;
        const topY = 40;

        ctx.save();
        ctx.globalAlpha = discovery.opacity;
        
        // Background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.roundRect(centerX - 200, topY - 20, 400, 40, 8);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = discovery.color;
        ctx.lineWidth = 2;
        ctx.roundRect(centerX - 200, topY - 20, 400, 40, 8);
        ctx.stroke();
        
        // Icon
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(discovery.icon, centerX - 120, topY);
        
        // Text
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = discovery.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeText(`${discovery.name} Discovered!`, centerX + 20, topY);
        ctx.fillText(`${discovery.name} Discovered!`, centerX + 20, topY);
        
        ctx.restore();
    }

    // Get discoveries for UI display
    getDiscoveriesForUI() {
        return {
            ...this.discoveries,
            recentDiscoveries: this.recentDiscoveries
        };
    }
}