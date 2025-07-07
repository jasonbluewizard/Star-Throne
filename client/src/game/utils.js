/**
 * Centralized utility functions for Star Throne game
 * Eliminates code duplication across game modules
 */

import { GAME_CONSTANTS } from '../../../common/gameConstants';

export class GameUtils {
    /**
     * Centralized error logging that respects debug mode
     * @param {string} message - Error message to log
     * @param {Error} error - Error object to log
     */
    static logError(message, error) {
        if (GAME_CONSTANTS.DEBUG_MODE) {
            console.error(message, error);
        }
        // In non-debug mode, we could send these errors to a server or store them if needed,
        // but avoid spamming the console.
    }
    
    /**
     * Centralized debug logging that respects debug mode
     * @param {string} message - Debug message to log
     * @param {...any} args - Additional arguments to log
     */
    static logDebug(message, ...args) {
        if (GAME_CONSTANTS.DEBUG_MODE) {
            console.log(message, ...args);
        }
    }
    
    /**
     * Generate random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    /**
     * Generate random float between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random float
     */
    static randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    /**
     * Get random element from array
     * @param {Array} array - Array to select from
     * @returns {*} Random element from array
     */
    static getRandomElement(array) {
        if (!array || array.length === 0) {
            this.logError('getRandomElement called with empty or null array');
            return null;
        }
        return array[Math.floor(Math.random() * array.length)];
    }
    
    /**
     * Validate that a value is a number and within optional bounds
     * @param {*} value - Value to validate
     * @param {number} min - Optional minimum value
     * @param {number} max - Optional maximum value
     * @returns {boolean} True if valid number within bounds
     */
    static isValidNumber(value, min = null, max = null) {
        if (typeof value !== 'number' || isNaN(value)) {
            return false;
        }
        if (min !== null && value < min) return false;
        if (max !== null && value > max) return false;
        return true;
    }
    
    /**
     * Safe array access with bounds checking
     * @param {Array} array - Array to access
     * @param {number} index - Index to access
     * @returns {*} Element at index or null if invalid
     */
    static safeArrayAccess(array, index) {
        if (!array || !Array.isArray(array) || index < 0 || index >= array.length) {
            return null;
        }
        return array[index];
    }
    
    /**
     * Process discovery effects for a player
     * Centralized discovery logic used by both client and server
     */
    static processDiscovery(discoveryType, playerId, territoryId, playerDiscoveries, game) {
        // Get existing discoveries (should already be initialized)
        let discoveries = playerDiscoveries.get(playerId);
        if (!discoveries) {
            console.error(`Discoveries not initialized for player ${playerId}`);
            return { success: false, effectText: 'Discovery system error', icon: '❌' };
        }
        
        let effectText = '';
        let icon = '';

        switch (discoveryType) {
            case 'precursor_weapons':
                discoveries.precursorWeapons++;
                effectText = `⚔️ Precursor Weapons Level ${discoveries.precursorWeapons}! Empire attack increased by ${discoveries.precursorWeapons * 10}%`;
                icon = '⚔️';
                break;

            case 'precursor_drive':
                discoveries.precursorDrive++;
                effectText = `🚀 Precursor Drive Level ${discoveries.precursorDrive}! Empire speed increased by ${discoveries.precursorDrive * 20}%`;
                icon = '🚀';
                break;

            case 'precursor_shield':
                discoveries.precursorShield++;
                effectText = `🛡️ Precursor Shield Level ${discoveries.precursorShield}! Empire defense increased by ${discoveries.precursorShield * 10}%`;
                icon = '🛡️';
                break;

            case 'precursor_nanotech':
                discoveries.precursorNanotech++;
                effectText = `🔬 Precursor Nanotech Level ${discoveries.precursorNanotech}! Empire generation increased by ${discoveries.precursorNanotech * 10}%`;
                icon = '🔬';
                break;

            case 'precursor_factory':
                discoveries.richMinerals++; // Track factory count since factoryPlanets doesn't exist
                effectText = `🏭 Precursor Factory discovered! Planet ${territoryId} has 200% generation rate`;
                icon = '🏭';
                break;

            case 'friendly_aliens':
                discoveries.friendlyAliens++;
                effectText = `👽 Friendly aliens provide 50 fleet strength!`;
                icon = '👽';
                // Apply immediate fleet bonus if game instance available
                if (game && territoryId !== undefined) {
                    const territory = game.gameMap?.territories[territoryId];
                    if (territory) {
                        territory.armySize += 50;
                    }
                }
                break;

            case 'mineral_deposits':
                discoveries.richMinerals++;
                effectText = `💎 Rich minerals found! Planet ${territoryId} has 150% generation rate`;
                icon = '💎';
                break;

            case 'void_storm':
                discoveries.voidStorms++;
                effectText = `⚡ Void storm remnants! Planet ${territoryId} has 75% generation rate`;
                icon = '⚡';
                break;

            case 'ancient_ruins':
                discoveries.ancientRuins++;
                effectText = `🏛️ Ancient ruins discovered on planet ${territoryId}`;
                icon = '🏛️';
                break;

            case 'hostile_aliens':
                discoveries.hostileAliens++;
                effectText = `💀 Probe lost to hostile aliens! Planet ${territoryId} remains unexplored.`;
                icon = '💀';
                return { success: false, effectText, icon }; // Probe failed

            case 'standard_planet':
            default:
                effectText = `🌍 Standard planet colonized: ${territoryId}`;
                icon = '🌍';
                break;
        }

        return { success: true, effectText, icon, discoveries };
    }

    /**
     * Get discovery probabilities based on game constants
     */
    static getDiscoveryProbabilities() {
        return {
            hostile_aliens: 0.15,      // 15% chance probe fails
            friendly_aliens: 0.08,     // 8% chance for bonus fleet
            precursor_weapons: 0.06,   // 6% chance for weapons
            precursor_drive: 0.06,     // 6% chance for drive
            precursor_shield: 0.06,    // 6% chance for shield
            precursor_nanotech: 0.06,  // 6% chance for nanotech
            precursor_factory: 0.05,   // 5% chance for factory
            rich_minerals: 0.10,       // 10% chance for minerals
            void_storm: 0.08,          // 8% chance for void storm
            ancient_ruins: 0.05,       // 5% chance for ruins
            standard_planet: 0.25      // 25% chance for standard (remainder)
        };
    }

    /**
     * Calculate combat result using centralized logic
     */
    static calculateCombatResult(attackPower, defensePower, attackerDiscoveries, defenderDiscoveries) {
        // Apply discovery bonuses
        if (attackerDiscoveries?.precursorWeapons > 0) {
            attackPower *= (1 + attackerDiscoveries.precursorWeapons * 0.1);
        }
        if (defenderDiscoveries?.precursorShield > 0) {
            defensePower *= (1 + defenderDiscoveries.precursorShield * 0.1);
        }

        // Add randomness for combat uncertainty
        const attackRoll = attackPower * (0.8 + Math.random() * 0.4);
        const defenseRoll = defensePower * (0.8 + Math.random() * 0.4);

        return attackRoll > defenseRoll;
    }

    /**
     * Generate army generation rate with discovery bonuses
     */
    static calculateArmyGenerationRate(baseRate, discoveries) {
        let rate = baseRate;
        
        if (discoveries?.precursorNanotech > 0) {
            rate *= (1 + discoveries.precursorNanotech * 0.1);
        }
        
        return rate;
    }

    /**
     * Calculate probe speed with discovery bonuses
     */
    static calculateProbeSpeed(baseSpeed, discoveries) {
        let speed = baseSpeed;
        
        if (discoveries?.precursorDrive > 0) {
            speed *= (1 + discoveries.precursorDrive * 0.2);
        }
        
        return speed;
    }

    /**
     * Validate territory connection distance
     */
    static isValidConnection(territory1, territory2, maxDistance = 80) {
        const distance = Math.sqrt(
            (territory1.x - territory2.x) ** 2 + 
            (territory1.y - territory2.y) ** 2
        );
        return distance <= maxDistance;
    }

    /**
     * Generate AI player name with variety
     */
    static generateAIName(index) {
        const firstNames = [
            'Alex', 'Blake', 'Casey', 'Dana', 'Emma', 'Felix', 'Grace', 'Hunter',
            'Iris', 'Jack', 'Kai', 'Luna', 'Max', 'Nova', 'Owen', 'Piper',
            'Quinn', 'Riley', 'Sage', 'Tara', 'Uma', 'Val', 'Wade', 'Xara',
            'York', 'Zara', 'Ace', 'Bay', 'Cora', 'Drew', 'Eve', 'Fox',
            'Gem', 'Hope', 'Ion', 'Jazz', 'Kit', 'Lee', 'Mae', 'Neo'
        ];

        const clans = [
            'StarForge', 'VoidHunters', 'NebulaRise', 'CosmicFury', 'SolarFlare',
            'AstroLegion', 'GalaxyGuard', 'StellarWolves', 'NovaClan', 'OrbitStorm',
            'CubClan', 'DarkMatter', 'PhotonLords', 'QuantumKnights', 'StarShards'
        ];

        const ranks = [
            'Admiral', 'Captain', 'Commander', 'Colonel', 'General', 'Marshal',
            'Commodore', 'Major', 'Lieutenant', 'Sergeant', 'Chief', 'Director'
        ];

        // 25% clan format, 25% rank format, 50% simple names
        const nameType = Math.random();
        const firstName = firstNames[index % firstNames.length];
        
        if (nameType < 0.25) {
            const clan = clans[Math.floor(index / firstNames.length) % clans.length];
            return `[${clan}] ${firstName}`;
        } else if (nameType < 0.5) {
            const rank = ranks[Math.floor(index / firstNames.length) % ranks.length];
            return `${rank} ${firstName}`;
        } else {
            return firstName;
        }
    }

    /**
     * Generate player colors with good contrast
     */
    static generatePlayerColors(count) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#F4D03F',
            '#D7BDE2', '#A3E4D7', '#FAD7A0', '#D5A6BD', '#A9DFBF'
        ];
        
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }

    /**
     * Format time display
     */
    static formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Clamp value between min and max
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Linear interpolation
     */
    static lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    /**
     * Calculate distance between two points
     */
    static distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    /**
     * Generate random color
     */
    static randomColor() {
        return `hsl(${Math.random() * 360}, 70%, 60%)`;
    }

    /**
     * Shuffle array in place
     */
    static shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

export default GameUtils;