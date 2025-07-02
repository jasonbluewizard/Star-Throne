import { GameMap } from './GameMap.js';
import { Player } from './Player.js';
import { GameUI } from './GameUI.js';
import { Camera } from './Camera.js';
import { Probe } from './Probe.js';
import { InputHandler } from './InputHandler.js';
import { Renderer } from './Renderer.js';
import { CombatSystem } from './CombatSystem.js';
import { SupplySystem } from './SupplySystem.js';
import { GameUtils } from './utils.js';
import { GAME_CONSTANTS } from '../../../common/gameConstants.js';
import { gameEvents, GAME_EVENTS, EVENT_PRIORITY, EventHelpers } from './EventSystem.js';
import { PerformanceManager } from './PerformanceManager.js';
import { PerformanceOverlay } from './PerformanceOverlay.js';
import { DiscoverySystem } from './DiscoverySystem.js';
import { AnimationSystem } from './AnimationSystem.js';
import { UIManager } from './UIManager.js';

export default class StarThrone {
    constructor(config = {}) {
        this.canvas = null;
        this.ctx = null;
        this.gameMap = null;
        this.players = [];
        this.humanPlayer = null;
        this.camera = null;
        this.ui = null;
        
        // Game configuration from config screen
        this.config = {
            playerName: config.playerName || 'Player',
            aiCount: config.aiCount || GAME_CONSTANTS.DEFAULT_SINGLE_PLAYER_AI_COUNT,
            mapSize: config.mapSize || GAME_CONSTANTS.DEFAULT_MAP_SIZE_TERRITORIES,
            gameSpeed: config.gameSpeed || 1.0,
            layout: config.layout || 'organic',
            ...config
        };
        
        // Game state
        this.gameState = 'lobby'; // lobby, playing, ended
        this.gameTimer = 10 * 60 * 1000; // 10 minutes
        this.maxPlayers = 100;
        this.currentPlayers = 0;
        
        // Home system flashing
        this.homeSystemFlashStart = null;
        this.homeSystemFlashDuration = 3000; // 3 seconds
        
        // Modular systems (initialized in init())
        this.inputHandler = null;
        this.renderer = null;
        this.combatSystem = null;
        this.supplySystem = null;
        this.performanceManager = null;
        this.discoverySystem = null;
        this.animationSystem = null;
        this.uiManager = null;
        
        // Legacy properties for backward compatibility
        this.hoveredTerritory = null;
        this.selectedTerritory = null;
        this.shipAnimations = [];
        this.shipAnimationPool = [];
        this.supplyRoutes = new Map();
        this.probes = [];
        this.floatingTexts = [];
        this.backgroundImageLoaded = false;
        this.backgroundImage = null;
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.fps = 0;
        
        // Binding methods
        this.update = this.update.bind(this);
        this.render = this.render.bind(this);
        this.gameLoop = this.gameLoop.bind(this);
    }

    log(message, type = 'info', throttleMs = 1000) {
        if (this.config.debug !== false) {
            console.log(`[StarThrone] ${message}`);
        }
    }

    async init() {
        try {
            // Initialize modular systems
            this.performanceManager = new PerformanceManager();
            this.discoverySystem = new DiscoverySystem(this);
            this.animationSystem = new AnimationSystem(this);
            this.uiManager = new UIManager(this);
            
            // Create game map with specified layout
            this.gameMap = new GameMap(this.config.mapSize, this.config.layout);
            
            // Initialize camera
            this.camera = new Camera();
            this.camera.setTarget(this.gameMap.width / 2, this.gameMap.height / 2);
            
            // Initialize UI
            this.ui = new GameUI(this);
            
            // Initialize modular systems that depend on game map
            this.inputHandler = new InputHandler(this);
            this.renderer = new Renderer(this);
            this.combatSystem = new CombatSystem(this);
            this.supplySystem = new SupplySystem(this);
            
            // Create players
            this.createPlayers();
            
            // Start game
            this.gameState = 'playing';
            this.startGame();
            
            console.log('StarThrone initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize StarThrone:', error);
            return false;
        }
    }

    createPlayers() {
        const numPlayers = Math.min(this.config.aiCount + 1, this.maxPlayers);
        
        // Create human player first
        const humanPlayer = new Player(0, this.config.playerName, '#00ffff', 'human');
        this.players.push(humanPlayer);
        this.humanPlayer = humanPlayer;
        
        // Create AI players
        const baseColors = [
            '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#ffffff',
            '#ff8000', '#8000ff', '#00ff80', '#ff0080', '#80ff00', '#0080ff',
            '#ff4040', '#40ff40', '#4040ff', '#ffff40', '#ff40ff', '#40ffff',
            '#ff8040', '#8040ff', '#40ff80', '#ff4080', '#80ff40', '#4080ff'
        ];
        
        const usedColors = new Set(['#00ffff']); // Reserve human color
        
        for (let i = 1; i < numPlayers && i < this.maxPlayers; i++) {
            let playerColor;
            let attempts = 0;
            
            // Find a unique color
            do {
                const colorIndex = (i - 1) % baseColors.length;
                playerColor = baseColors[colorIndex];
                attempts++;
            } while (usedColors.has(playerColor) && attempts < 50);
            
            usedColors.add(playerColor);
            
            // Generate AI name
            const aiName = GameUtils.generateAIName(i - 1);
            const aiPlayer = new Player(i, aiName, playerColor, 'ai');
            this.players.push(aiPlayer);
        }
        
        console.log(`Created ${this.players.length} players (1 human, ${this.players.length - 1} AI)`);
    }

    startGame() {
        // Distribute starting territories (throne stars)
        this.distributeStartingTerritories();
        
        // Start home system flashing
        this.homeSystemFlashStart = Date.now();
        
        // Start game loop
        this.gameLoop();
        
        console.log('Game started');
    }

    distributeStartingTerritories() {
        // Find colonizable territories for starting positions
        const colonizableTerritories = Object.values(this.gameMap.territories)
            .filter(territory => territory.isColonizable);
        
        if (colonizableTerritories.length < this.players.length) {
            console.error('Not enough colonizable territories for all players');
            return;
        }
        
        // Distribute one territory per player, maximizing distance between players
        const usedTerritories = [];
        
        for (let player of this.players) {
            let bestTerritory = null;
            let bestMinDistance = 0;
            
            for (let territory of colonizableTerritories) {
                if (usedTerritories.includes(territory)) continue;
                
                // Calculate minimum distance to any used territory
                const minDistanceToUsed = usedTerritories.length === 0 ? Infinity :
                    Math.min(...usedTerritories.map(used => 
                        Math.sqrt((territory.x - used.x) ** 2 + (territory.y - used.y) ** 2)
                    ));
                
                if (usedTerritories.length === 0 || minDistanceToUsed > bestMinDistance) {
                    bestTerritory = territory;
                    bestMinDistance = minDistanceToUsed;
                }
            }
            
            if (bestTerritory) {
                // Colonize this territory for the player
                bestTerritory.ownerId = player.id;
                bestTerritory.isColonizable = false;
                bestTerritory.armySize = GAME_CONSTANTS.INITIAL_STARTING_ARMY_SIZE;
                bestTerritory.isThronestar = true;
                
                // Reveal connections
                bestTerritory.revealConnections();
                
                player.territories.push(bestTerritory.id);
                player.totalArmies += bestTerritory.armySize;
                player.throneStarId = bestTerritory.id;
                
                usedTerritories.push(bestTerritory);
                
                console.log(`Starting territory ${bestTerritory.id} for ${player.name}: ${GAME_CONSTANTS.INITIAL_STARTING_ARMY_SIZE} armies`);
            }
        }
    }

    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.lastFpsTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = currentTime;
        }
        
        // Update game systems
        this.update(deltaTime);
        this.render();
        
        // Continue game loop
        if (this.gameState === 'playing') {
            requestAnimationFrame(this.gameLoop);
        }
    }

    update(deltaTime) {
        try {
            // Update modular systems
            this.animationSystem?.update(deltaTime);
            this.discoverySystem?.update(deltaTime);
            this.supplySystem?.update(deltaTime);
            this.combatSystem?.update(deltaTime);
            
            // Update players (AI logic)
            this.updatePlayers(deltaTime);
            
            // Update probes
            this.updateProbes(deltaTime);
            
            // Update floating texts
            this.updateFloatingTexts(deltaTime);
            
            // Update performance manager
            this.performanceManager?.update(deltaTime);
            
        } catch (error) {
            console.error('Error in update loop:', error);
        }
    }

    render() {
        try {
            if (this.renderer) {
                this.renderer.render();
            }
        } catch (error) {
            console.error('Error in render loop:', error);
        }
    }

    updatePlayers(deltaTime) {
        // Stagger AI updates for performance (process 1/3 of players per frame)
        const aiPlayers = this.players.filter(p => p.type === 'ai' && !p.isEliminated);
        const playersPerFrame = Math.max(1, Math.ceil(aiPlayers.length / 3));
        const startIndex = (this.frameCount * playersPerFrame) % aiPlayers.length;
        
        for (let i = 0; i < playersPerFrame; i++) {
            const playerIndex = (startIndex + i) % aiPlayers.length;
            const player = aiPlayers[playerIndex];
            
            try {
                player.update(deltaTime);
            } catch (error) {
                console.error(`Error updating AI player ${player.name}:`, error);
            }
        }
    }

    updateProbes(deltaTime) {
        this.probes = this.probes.filter(probe => {
            try {
                probe.update(deltaTime);
                
                if (probe.hasArrived()) {
                    this.handleProbeArrival(probe);
                    return false; // Remove probe
                }
                
                return true; // Keep probe
            } catch (error) {
                console.error('Error updating probe:', error);
                return false; // Remove problematic probe
            }
        });
    }

    updateFloatingTexts(deltaTime) {
        this.floatingTexts = this.floatingTexts.filter(text => {
            text.age += deltaTime;
            text.y -= 30 * (deltaTime / 1000); // Float upward
            text.opacity = Math.max(0, 1 - (text.age / text.duration));
            return text.age < text.duration;
        });
    }

    handleProbeArrival(probe) {
        const targetTerritory = this.gameMap.territories[probe.targetTerritoryId];
        const player = this.players[probe.playerId];
        
        if (!targetTerritory || !player) return;
        
        // Process discovery and colonization
        const discovery = this.discoverySystem?.processProbeColonization(probe, targetTerritory, player);
        
        if (discovery && discovery.successful) {
            // Territory was successfully colonized
            targetTerritory.ownerId = player.id;
            targetTerritory.isColonizable = false;
            targetTerritory.armySize = GAME_CONSTANTS.INITIAL_COLONIZED_ARMY_SIZE;
            
            // Reveal connections
            targetTerritory.revealConnections();
            
            // Update player stats
            player.territories.push(targetTerritory.id);
            player.updateStats();
            
            console.log(`Probe colonized territory ${targetTerritory.id} for ${player.name}`);
        }
    }

    // Legacy methods for compatibility
    addFloatingText(x, y, text, color = '#ffffff', duration = 2000) {
        this.floatingTexts.push({
            x, y, text, color, duration,
            age: 0,
            opacity: 1
        });
    }

    launchProbe(fromTerritoryId, toTerritoryId, playerId) {
        const fromTerritory = this.gameMap.territories[fromTerritoryId];
        const toTerritory = this.gameMap.territories[toTerritoryId];
        const player = this.players[playerId];
        
        if (!fromTerritory || !toTerritory || !player) return false;
        if (fromTerritory.ownerId !== playerId) return false;
        if (fromTerritory.armySize < GAME_CONSTANTS.PROBE_COST) return false;
        if (!toTerritory.isColonizable) return false;
        
        // Deduct probe cost
        fromTerritory.armySize -= GAME_CONSTANTS.PROBE_COST;
        
        // Create probe
        const probe = new Probe(fromTerritory, toTerritory, playerId, this.config.gameSpeed);
        this.probes.push(probe);
        
        // Add visual feedback
        this.addFloatingText(fromTerritory.x, fromTerritory.y, `-${GAME_CONSTANTS.PROBE_COST}`, '#ff4444', 1500);
        
        console.log(`${player.name} launched probe from ${fromTerritoryId} to ${toTerritoryId}`);
        return true;
    }

    attackTerritory(fromTerritoryId, toTerritoryId, attackingArmies) {
        return this.combatSystem?.attackTerritory(fromTerritoryId, toTerritoryId, attackingArmies) || false;
    }

    transferArmies(fromTerritoryId, toTerritoryId, transferCount) {
        const fromTerritory = this.gameMap.territories[fromTerritoryId];
        const toTerritory = this.gameMap.territories[toTerritoryId];
        
        if (!fromTerritory || !toTerritory) return false;
        if (fromTerritory.ownerId !== toTerritory.ownerId) return false;
        if (fromTerritory.armySize <= transferCount) return false;
        
        // Execute transfer
        fromTerritory.armySize -= transferCount;
        toTerritory.armySize += transferCount;
        
        // Create ship animation
        this.animationSystem?.createShipAnimation(fromTerritory, toTerritory, false);
        
        return true;
    }

    // Event system integration
    setupEventListeners() {
        // Territory capture events
        gameEvents.on(GAME_EVENTS.TERRITORY_CAPTURED, this.handleTerritoryCapture.bind(this));
        gameEvents.on(GAME_EVENTS.THRONE_CAPTURED, this.handleThroneCapture.bind(this));
        gameEvents.on(GAME_EVENTS.DISCOVERY_MADE, this.handleDiscoveryEvent.bind(this));
        gameEvents.on(GAME_EVENTS.COMBAT_START, this.handleCombatStart.bind(this));
    }

    handleTerritoryCapture(data) {
        console.log(`Territory ${data.territoryId} captured by ${data.newOwner.name}`);
    }

    handleThroneCapture(data) {
        console.log(`🏆 Throne captured! ${data.attacker.name} defeats ${data.oldOwner.name}`);
        
        // Check for game end
        if (data.oldOwner.type === 'human') {
            this.gameState = 'ended';
            this.uiManager?.showGameOverScreen();
        }
    }

    handleDiscoveryEvent(data) {
        console.log(`Discovery made: ${data.discovery.name} by ${data.player.name}`);
    }

    handleCombatStart(data) {
        console.log(`Combat: ${data.attacker.name} attacks ${data.defender.name} at territory ${data.territoryId}`);
    }

    // Cleanup
    destroy() {
        this.gameState = 'ended';
        
        // Clean up modular systems
        this.inputHandler?.destroy();
        this.renderer?.destroy();
        this.combatSystem?.destroy();
        this.supplySystem?.destroy();
        this.performanceManager?.destroy();
        this.discoverySystem?.destroy();
        this.animationSystem?.destroy();
        this.uiManager?.destroy();
        
        // Clear arrays
        this.players = [];
        this.probes = [];
        this.shipAnimations = [];
        this.floatingTexts = [];
        
        console.log('StarThrone destroyed');
    }
}