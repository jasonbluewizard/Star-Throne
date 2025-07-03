/**
 * Shared utility functions for Star Throne game
 * Centralizes commonly used calculations and rendering helpers to eliminate code duplication
 */

export default class GameUtils {
    // Compute Euclidean distance between two points (x1,y1) and (x2,y2)
    // Uses Math.hypot for better performance and precision than Math.sqrt(Math.pow(...))
    static distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }
    
    // Map discovery ID to display color
    // Centralizes the color mapping logic used across discovery rendering
    static getDiscoveryColor(id) {
        switch (id) {
            case 'precursor_weapons': return '#ff6666';
            case 'precursor_drive':   return '#66ffff'; 
            case 'precursor_shield':  return '#66ff66';
            case 'precursor_nanotech': return '#ffff66';
            case 'factory_complex':   return '#ff9966';
            case 'mineral_deposits':  return '#ffcc66';
            case 'friendly_aliens':   return '#99ff99';
            case 'hostile_aliens':    return '#ff4444';
            case 'ancient_ruins':     return '#cc99ff';
            case 'void_storms':       return '#9966ff';
            default:                  return '#ffffff';
        }
    }
    
    // Draw centered text with a shadow for better visibility
    // Centralizes the duplicate text shadow rendering logic
    static drawTextShadow(ctx, text, x, y, color, font = 'bold 14px Arial') {
        ctx.save();
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(text, x + 1, y + 1); // Shadow offset
        ctx.fillStyle = color;
        ctx.fillText(text, x, y); // Main text
        ctx.restore();
    }
    
    // Draw a panel with background fill and outline stroke
    // Centralizes the UI panel drawing pattern used in overlays, notifications, etc.
    static drawPanel(ctx, x, y, width, height, fillColor = 'rgba(0,0,0,0.8)', strokeColor = '#ffffff', lineWidth = 2) {
        ctx.save();
        
        // Fill background
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, width, height);
        
        // Draw outline
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x, y, width, height);
        
        ctx.restore();
    }
    
    // Generate AI player names with variety (clan names, ranks, etc.)
    // Centralized name generation logic
    static generateAIName(index) {
        const firstNames = [
            'Alex', 'Blake', 'Casey', 'Dana', 'Emma', 'Felix', 'Grace', 'Hunter',
            'Iris', 'Jack', 'Kai', 'Luna', 'Max', 'Nova', 'Owen', 'Piper',
            'Quinn', 'Riley', 'Sage', 'Taylor', 'Uma', 'Vale', 'Wade', 'Xara',
            'Yuki', 'Zara', 'Aria', 'Blaze', 'Cora', 'Dex', 'Echo', 'Finn',
            'Gaia', 'Halo', 'Ion', 'Jinx', 'Koda', 'Lyra', 'Mira', 'Nyx',
            'Orion', 'Phoenix', 'Quill', 'Raven', 'Storm', 'Tala', 'Vega', 'Wren',
            'Astra', 'Bolt', 'Cosmo', 'Drift', 'Ember', 'Flash', 'Ghost', 'Hawk',
            'Comet', 'Viper', 'Titan', 'Cipher', 'Razor', 'Surge', 'Pulse', 'Void',
            'Nexus', 'Frost', 'Blitz', 'Omega', 'Saber', 'Nova', 'Zephyr', 'Apex',
            'Rogue', 'Spark', 'Flare', 'Shadow', 'Rebel', 'Quantum', 'Vector', 'Cyber'
        ];
        
        const clans = [
            'StarForge', 'VoidHunters', 'CubClan', 'SolarFlare', 'NebulaRise',
            'CosmicFury', 'GalaxyStorm', 'AstroNova', 'StarCrusher', 'VoidWalker',
            'QuantumLeap', 'NebulaCorp', 'StellarCorp', 'VoidForge', 'StarNova',
            'CosmicVoid', 'GalacticCorp', 'SolarWind', 'VoidStorm', 'StarCore',
            'NebulaCore', 'QuantumCorp', 'StellarWind', 'VoidCore', 'StarWind',
            'CosmicCore', 'GalacticWind', 'SolarCore', 'VoidWind', 'StarStorm',
            'NebulaWind', 'QuantumStorm', 'StellarCore', 'VoidNova', 'StarCore',
            'CosmicStorm', 'GalacticCore', 'SolarStorm', 'VoidCore', 'StarWind',
            'NebulaStorm', 'QuantumCore', 'StellarStorm', 'VoidWind', 'StarCore',
            'CosmicWind', 'GalacticStorm', 'SolarWind', 'VoidStorm'
        ];
        
        const titles = [
            'Admiral', 'Captain', 'Commander', 'General', 'Major', 'Colonel',
            'Chief', 'Lord', 'Baron', 'Duke', 'Count', 'Marshal'
        ];
        
        const firstName = firstNames[index % firstNames.length];
        
        // 25% clan format, 25% title format, 50% plain names
        const format = Math.floor(index / firstNames.length) % 4;
        
        if (format === 0) {
            const clan = clans[Math.floor(index / 4) % clans.length];
            return `[${clan}] ${firstName}`;
        } else if (format === 1) {
            const title = titles[Math.floor(index / 8) % titles.length];
            return `${title} ${firstName}`;
        } else {
            return firstName;
        }
    }
    
    // Process discovery events and return formatted results
    // Centralizes discovery processing logic
    static processDiscovery(discoveries, discoveryType, territoryId) {
        const discoveryData = {
            precursor_weapons: {
                name: 'Precursor Weapons Cache',
                description: 'Ancient weapon technology discovered!',
                type: 'empire_bonus',
                property: 'precursorWeapons'
            },
            precursor_drive: {
                name: 'Precursor Drive Core',
                description: 'Advanced propulsion technology found!',
                type: 'empire_bonus', 
                property: 'precursorDrive'
            },
            precursor_shield: {
                name: 'Precursor Shield Matrix',
                description: 'Defensive technology discovered!',
                type: 'empire_bonus',
                property: 'precursorShield'
            },
            precursor_nanotech: {
                name: 'Precursor Nanotechnology',
                description: 'Self-replicating technology found!',
                type: 'empire_bonus',
                property: 'precursorNanotech'
            },
            factory_complex: {
                name: 'Precursor Factory Complex',
                description: 'Automated manufacturing facility discovered!',
                type: 'planet_bonus',
                property: 'factoryPlanets'
            },
            mineral_deposits: {
                name: 'Rich Mineral Deposits',
                description: 'Valuable mining resources found!',
                type: 'planet_bonus',
                property: 'mineralPlanets'
            },
            friendly_aliens: {
                name: 'Friendly Alien Colony',
                description: 'Peaceful aliens offer assistance!',
                type: 'instant_bonus',
                property: 'friendlyAliens'
            },
            hostile_aliens: {
                name: 'Hostile Alien Outpost',
                description: 'Aggressive aliens destroy the probe!',
                type: 'negative',
                property: 'hostileAliens'
            },
            ancient_ruins: {
                name: 'Ancient Ruins',
                description: 'Mysterious structures of unknown origin.',
                type: 'planet_bonus',
                property: 'ancientRuins'
            },
            void_storms: {
                name: 'Void Storm Activity',
                description: 'Dangerous energy storms slow development.',
                type: 'planet_penalty',
                property: 'voidStorms'
            }
        };
        
        const discovery = discoveryData[discoveryType];
        if (!discovery) return null;
        
        // Apply the discovery effect
        switch (discovery.type) {
            case 'empire_bonus':
                discoveries[discovery.property]++;
                break;
            case 'planet_bonus':
                discoveries[discovery.property].add(territoryId);
                break;
            case 'planet_penalty':
                discoveries[discovery.property].add(territoryId);
                break;
            case 'instant_bonus':
                discoveries[discovery.property]++;
                break;
            case 'negative':
                discoveries[discovery.property]++;
                break;
        }
        
        return {
            id: discoveryType,
            name: discovery.name,
            description: discovery.description,
            type: discovery.type
        };
    }
}