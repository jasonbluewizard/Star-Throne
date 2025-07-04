import { GAME_CONSTANTS } from '../../../common/gameConstants';
import { GameUtils } from './utils.js';

export class AIManager {
    constructor(game) {
        this.game = game;
        this.frameCount = 0;
        this.lastAIThinkTime = 0;
        this.aiThinkInterval = 2000; // AI thinks every 2 seconds
        
        // Cache AI players list to avoid filtering every frame
        this.aiPlayers = null;
        this.playerListDirty = true;
    }

    // Update AI players with staggered processing for performance
    updateAI(deltaTime) {
        this.frameCount++;
        
        // Compute AI players list once and reuse it
        if (!this.aiPlayers || this.playerListDirty) {
            this.aiPlayers = this.game.players.filter(p => p.type !== 'human' && !p.isEliminated);
            this.playerListDirty = false;
        }
        
        const batchCount = 3;
        const frameIndex = this.frameCount % batchCount;
        const batchSize = Math.ceil(this.aiPlayers.length / batchCount);
        const aiStartIndex = frameIndex * batchSize;
        const aiEndIndex = Math.min(this.aiPlayers.length, aiStartIndex + batchSize);
        
        // Update subset of AI players this frame
        for (let i = aiStartIndex; i < aiEndIndex; i++) {
            if (i < this.aiPlayers.length) {
                const player = this.aiPlayers[i];
                try {
                    this.updateAIPlayer(player, deltaTime);
                } catch (error) {
                    GameUtils.logError(`Error updating AI player ${player.name}:`, error);
                }
            }
        }
    }

    // Update individual AI player
    updateAIPlayer(player, deltaTime) {
        if (player.type === 'human' || player.isEliminated) return;
        
        // Use the player's own update method
        player.update(deltaTime, this.game.gameMap, this.game.config.gameSpeed, this.game);
    }

    // Mark player list as dirty when players are eliminated or added
    invalidatePlayerCache() {
        this.playerListDirty = true;
    }

    // Get cached AI players count for performance monitoring
    getAIPlayerCount() {
        if (!this.aiPlayers) {
            return 0;
        }
        return this.aiPlayers.length;
    }

    // Generate realistic AI player names
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

        const clanNames = [
            'StarForge', 'VoidHunters', 'NebulaRise', 'CosmicFury', 'SolarFlare',
            'DarkMatter', 'CubClan', 'GalaxyGuard', 'StellarWings', 'AstroForce',
            'CelestialArmy', 'SpaceRaiders', 'OrbitCrusher', 'PlanetStorm', 'MeteorStrike',
            'BlackHoleInc', 'CrystalShards', 'EnergyPulse', 'HyperDrive', 'QuantumLeap',
            'TitanForge', 'NovaBlast', 'WarpSpeed', 'GalacticLords', 'SkyBorne',
            'StormBreaker', 'CyberNova', 'PhaseShift', 'LightSpeed', 'CosmicEdge',
            'VoidWalkers', 'StellarFlame', 'GalacticRift', 'StarCrusher', 'NebulaStorm',
            'HyperNova', 'QuantumFlux', 'DarkEnergy', 'CelestialBlade', 'VoidStrike',
            'GalaxyForge', 'StardustLegion', 'CosmicTempest', 'SolarWinds', 'AstroVanguard',
            'PlanetCrushers', 'StarHunters', 'VoidReapers'
        ];

        const militaryRanks = [
            'Admiral', 'Captain', 'Commander', 'General', 'Colonel', 'Major',
            'Lieutenant', 'Sergeant', 'Marshal', 'Commodore', 'Warlord', 'Chief'
        ];

        // Use deterministic distribution based on index for consistent variety
        const nameType = index % 8; // Cycle through 8 patterns for variety
        const firstName = firstNames[index % firstNames.length];
        
        if (nameType === 0 || nameType === 1) {
            // 25% clan format: [ClanName] FirstName
            const clan = clanNames[Math.floor(index / 3) % clanNames.length]; // Better clan distribution
            return `[${clan}] ${firstName}`;
        } else if (nameType === 2 || nameType === 3) {
            // 25% military rank format: Rank FirstName
            const rank = militaryRanks[Math.floor(index / 2) % militaryRanks.length];
            return `${rank} ${firstName}`;
        } else {
            // 50% simple first name only
            return firstName;
        }
    }

    // Generate player colors ensuring no duplicates
    static generatePlayerColor(index) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D5A6BD',
            '#A569BD', '#5DADE2', '#58D68D', '#F4D03F', '#EB984E',
            '#FF8A80', '#80CBC4', '#81C784', '#FFB74D', '#9575CD',
            '#64B5F6', '#4DB6AC', '#AED581', '#FFD54F', '#F06292',
            '#BA68C8', '#4FC3F7', '#26A69A', '#CDDC39', '#FF8A65',
            '#CE93D8', '#4DD0E1', '#66BB6A', '#FFCC02', '#FFAB91',
            '#B39DDB', '#26C6DA', '#42A5F5', '#FFEB3B', '#A1C181',
            '#FF7043', '#8E24AA', '#039BE5', '#43A047', '#FBC02D'
        ];
        return colors[index % colors.length];
    }

    // Reset AI manager state
    reset() {
        this.frameCount = 0;
        this.lastAIThinkTime = 0;
    }

    // Get AI statistics for debugging
    getStats() {
        const aiPlayers = this.game.players.filter(p => p.type !== 'human' && !p.isEliminated);
        return {
            totalAI: aiPlayers.length,
            activeAI: aiPlayers.filter(p => !p.isEliminated).length,
            frameCount: this.frameCount
        };
    }
}