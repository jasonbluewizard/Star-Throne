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
import { GAME_CONSTANTS } from '../../../common/gameConstants';
import { gameEvents, GAME_EVENTS, EVENT_PRIORITY, EventHelpers } from './EventSystem.js';
import { PerformanceManager } from './PerformanceManager.js';
import { PerformanceOverlay } from './PerformanceOverlay.js';
import { DiscoverySystem } from './DiscoverySystem.js';
import { AnimationSystem } from './AnimationSystem.js';
import { UIManager } from './UIManager.js';
import { AudioSystem } from './AudioSystem.js';
import { AIManager } from './AIManager.js';
import { TerritoryRenderer } from './TerritoryRenderer.js';
import { MemoryManager } from './MemoryManager.js';
import { DistanceCache } from './DistanceCache.js';

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
        this.audioSystem = null;
        this.aiManager = null;
        this.territoryRenderer = null;
        this.memoryManager = null;
        this.distanceCache = null;
        
        // Legacy properties for backward compatibility
        this.hoveredTerritory = null;
        
        // Performance
        this.lastFrameTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        // Performance optimizations
        this.visibleTerritories = [];
        this.lastVisibilityUpdate = 0;
        this.performanceStats = {
            frameTime: 0,
            renderTime: 0,
            updateTime: 0,
            visibleTerritories: 0
        };
        this.showPerformancePanel = false; // Toggle with P key
        
        // Ship movement animations
        this.shipAnimations = [];
        this.shipAnimationPool = []; // Reuse objects to reduce garbage collection
        
        // Pre-populate animation pool with multi-hop support
        for (let i = 0; i < 20; i++) {
            this.shipAnimationPool.push({
                fromX: 0, fromY: 0, toX: 0, toY: 0,
                progress: 0, duration: 0, startTime: 0,
                isAttack: false, playerColor: '#ffffff', id: 0,
                path: null, currentSegment: 0, isMultiHop: false
            });
        }
        this.leaderboardMinimized = false;
        this.minimapMinimized = true; // Default minimap to off
        
        // Probe system
        this.probes = [];
        this.nextProbeId = 0;
        
        // Discovery announcements
        this.floatingDiscoveryTexts = [];
        this.discoveryLog = []; // Recent discovery announcements for panel display
        
        // Ship funneling system
        this.supplyRoutes = new Map(); // territoryId -> { targetId, path, delay }
        this.dragStart = null;
        this.dragEnd = null;
        this.isDraggingForSupplyRoute = false;
        
        // Background image system
        this.backgroundImage = null;
        this.backgroundLoaded = false;
        this.backgroundScale = 1.0;
        
        // Parallax starfield system
        this.starfield = {
            farStars: [],      // Slowest moving, smallest stars
            midStars: [],      // Medium speed, medium stars  
            nearStars: [],     // Fastest moving, larger stars
            initialized: false
        };
        
        // Static background optimization
        this.staticBg = document.createElement('canvas');
        this.staticBgCtx = this.staticBg.getContext('2d');
        
        // Discovery system for planet colonization - per player tracking
        this.playerDiscoveries = new Map(); // Map of playerId -> discoveries
        
        // Initialize event system for decoupled component communication
        this.eventProcessingEnabled = true;
        
        // Global discovery log for all players
        this.discoveryLog = [];
        
        // Recent probe results for UI announcements
        this.recentProbeResults = [];
        
        // Notification system
        this.notifications = [];
        
        // Bonus panel state
        this.showBonusPanel = true;
        
        // Message display system
        this.messageText = '';
        this.messageTimer = 0;
        
        // Performance optimization: Throttled logging system
        this.debugMode = false; // Set to true for development, false for production
        this.logThrottles = new Map(); // Track throttled log messages
        this.lastLogTimes = new Map(); // Track last log timestamp per message type
        
        this.init();
        this.loadBackgroundImage();
    }
    
    /**
     * Performance-optimized logging with throttling
     * @param {string} message - Log message
     * @param {string} type - Log type (info, warn, error)
     * @param {number} throttleMs - Minimum time between identical messages
     */
    log(message, type = 'info', throttleMs = 1000) {
        if (!this.debugMode && type === 'info') return; // Skip info logs in production
        
        const key = `${type}:${message}`;
        const now = Date.now();
        const lastTime = this.lastLogTimes.get(key) || 0;
        
        if (now - lastTime >= throttleMs) {
            this.lastLogTimes.set(key, now);
            if (type === 'error') {
                console.error(message);
            } else if (type === 'warn') {
                console.warn(message);
            } else {
                console.log(message);
            }
        }
    }
    
    // Background rendering moved to UIManager
    
    /**
     * Setup event listeners for event-driven architecture
     */
    setupEventListeners() {
        // Listen for territory capture events to update UI
        gameEvents.on(GAME_EVENTS.TERRITORY_CAPTURED, (event) => {
            this.handleTerritoryCapture(event.data);
        }, EVENT_PRIORITY.HIGH);
        
        // Listen for throne capture events for game ending
        gameEvents.on(GAME_EVENTS.THRONE_CAPTURED, (event) => {
            this.handleThroneCapture(event.data);
        }, EVENT_PRIORITY.CRITICAL);
        
        // Listen for discovery events to update UI
        gameEvents.on(GAME_EVENTS.DISCOVERY_MADE, (event) => {
            this.handleDiscoveryEvent(event.data);
        }, EVENT_PRIORITY.MEDIUM);
        
        // Listen for combat events for animations
        gameEvents.on(GAME_EVENTS.COMBAT_STARTED, (event) => {
            this.handleCombatStart(event.data);
        }, EVENT_PRIORITY.HIGH);
        
        // Process event queue each frame
        this.eventProcessingEnabled = true;
    }
    
    /**
     * Handle territory capture events
     */
    handleTerritoryCapture(data) {
        if (data.player && data.player.id === this.humanPlayer?.id) {
            this.addNotification(`Territory ${data.territory.id} captured!`, '#44ff44');
        }
    }
    
    /**
     * Handle throne capture events
     */
    handleThroneCapture(data) {
        if (data.gameEnded) {
            if (data.attacker.id === this.humanPlayer?.id) {
                this.addNotification(`Victory! You captured ${data.defender.name}'s throne!`, '#ffff44', 8000);
            } else if (data.defender.id === this.humanPlayer?.id) {
                this.addNotification(`Defeat! Your throne was captured by ${data.attacker.name}!`, '#ff4444', 8000);
                this.endGame();
            }
        }
    }
    
    /**
     * Handle discovery events
     */
    handleDiscoveryEvent(data) {
        if (data.player.id === this.humanPlayer?.id) {
            this.addNotification(`Discovery: ${data.discovery.name}`, '#44ffff', 5000);
        }
    }
    
    /**
     * Handle combat start events
     */
    handleCombatStart(data) {
        // Could trigger special effects, sounds, etc.
        if (data.attacker.id === this.humanPlayer?.id || data.defender?.id === this.humanPlayer?.id) {
            // Human player is involved in combat - maybe add special visual effects
        }
    }

    // Notification and message systems moved to UIManager
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.gameMap = new GameMap(2000, 1500, this.config); // Large map with advanced configuration
        this.gameMap.game = this; // Reference for AI animations
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        
        // Update camera map boundaries to match actual expanded map size
        this.camera.mapWidth = this.gameMap.width;
        this.camera.mapHeight = this.gameMap.height;
        
        // Center camera on map and set appropriate zoom
        this.camera.centerOn(this.gameMap.width / 2, this.gameMap.height / 2); // Center of expanded map
        this.camera.targetZoom = 0.25; // Zoom out further to see more territories
        this.camera.zoom = 0.25;
        
        this.ui = new GameUI(this.canvas, this.camera);
        
        // Initialize modular systems
        this.inputHandler = new InputHandler(this);
        this.renderer = new Renderer(this.canvas, this.camera);
        this.combatSystem = new CombatSystem(this);
        this.supplySystem = new SupplySystem(this);
        this.performanceManager = new PerformanceManager(this);
        this.performanceOverlay = new PerformanceOverlay(this.canvas, this.performanceManager);
        this.discoverySystem = new DiscoverySystem(this);
        this.animationSystem = new AnimationSystem(this);
        this.uiManager = new UIManager(this);
        this.audioSystem = new AudioSystem(this);
        this.aiManager = new AIManager(this);
        this.territoryRenderer = new TerritoryRenderer(this);
        this.memoryManager = new MemoryManager(this);
        this.distanceCache = new DistanceCache(this);
        
        // Auto-detect optimal performance profile
        this.performanceManager.detectOptimalProfile();
        
        this.gameStartTime = Date.now(); // Track when game actually starts
        this.startGame();
        this.gameLoop();
    }
    
    // Discovery system moved to DiscoverySystem module
    
    logDiscoveryForUI(territory, playerId, discovery) {
        const player = this.players[playerId];
        if (!player) return;
        
        // Add to discovery log for UI display
        this.discoveryLog.push({
            timestamp: Date.now(),
            territoryId: territory.id,
            playerId: playerId,
            discovery: discovery,
            playerName: player.name
        });
        
        console.log(`🔍 Discovery on planet ${territory.id}: ${discovery.name} - ${discovery.description}`);
        
        // Add floating discovery text above the planet
        this.addFloatingDiscoveryText(territory, discovery, playerId);
        
        // Track probe result for UI announcements
        this.recentProbeResults.push({
            timestamp: Date.now(),
            territoryId: territory.id,
            playerId: playerId,
            discoveryName: discovery.name,
            success: discovery.effect !== 'probe_lost',
            discovery: discovery
        });
        
        // Keep only recent results (last 10)
        if (this.recentProbeResults.length > 10) {
            this.recentProbeResults.shift();
        }
    }
    
    // Process discovery when a planet is successfully colonized - MOVED TO UTILS.JS
    
    addFloatingDiscoveryText(territory, discovery, playerId) {
        // Create floating text object
        const floatingText = {
            x: territory.x,
            y: territory.y - 40, // Start above the planet
            text: discovery.name,
            icon: this.getDiscoveryIcon(discovery.effect),
            color: this.getDiscoveryColor(discovery.effect),
            startTime: Date.now(),
            duration: 4000, // 4 seconds
            fadeOutDuration: 1000, // Last 1 second fades out
            playerId: playerId
        };
        
        this.floatingDiscoveryTexts.push(floatingText);
        
        // Limit to 10 floating texts to prevent clutter
        if (this.floatingDiscoveryTexts.length > 10) {
            this.floatingDiscoveryTexts.shift();
        }
    }
    
    getDiscoveryIcon(effect) {
        const icons = {
            'probe_lost': '💀',
            'extra_fleet': '👽',
            'precursor_weapons': '⚔️',
            'precursor_drive': '🚀',
            'precursor_shield': '🛡️',
            'precursor_nanotech': '🔬',
            'factory_complex': '🏭',
            'mineral_deposits': '💎',
            'void_storm': '⚡',
            'ancient_ruins': '🏛️'
        };
        return icons[effect] || '🔍';
    }
    
    getDiscoveryColor(effect) {
        const colors = {
            'probe_lost': '#ff4444',
            'extra_fleet': '#44ff44',
            'precursor_weapons': '#ff6b6b',
            'precursor_drive': '#4ecdc4',
            'precursor_shield': '#45b7d1',
            'precursor_nanotech': '#96ceb4',
            'factory_complex': '#feca57',
            'mineral_deposits': '#ff9ff3',
            'void_storm': '#a55eea',
            'ancient_ruins': '#ffa726'
        };
        return colors[effect] || '#ffffff';
    }
    
    updateFloatingDiscoveryTexts(deltaTime) {
        const now = Date.now();
        
        // Update and remove expired floating texts
        this.floatingDiscoveryTexts = this.floatingDiscoveryTexts.filter(text => {
            const age = now - text.startTime;
            
            if (age > text.duration) {
                return false; // Remove expired text
            }
            
            // Animate the text (float upward)
            text.y -= 20 * (deltaTime / 1000); // Move up 20 pixels per second
            
            return true;
        });
    }
    
    // REMOVED: Second duplicate processDiscovery function - logic moved to GameUtils.js
    
    // Create ship movement animation
    createShipAnimation(fromTerritory, toTerritory, isAttack = false) {
        // Use object pooling to reduce garbage collection
        let animation = this.shipAnimationPool.pop();
        if (!animation) {
            animation = {
                fromX: 0, fromY: 0, toX: 0, toY: 0,
                progress: 0, duration: 0, startTime: 0,
                isAttack: false, playerColor: '#ffffff', id: 0,
                path: null, currentSegment: 0, isMultiHop: false
            };
        }
        
        const player = this.players[fromTerritory.ownerId];
        const playerColor = player ? player.color : '#ffffff';
        
        // Reset animation properties
        animation.fromX = fromTerritory.x;
        animation.fromY = fromTerritory.y;
        animation.toX = toTerritory.x;
        animation.toY = toTerritory.y;
        animation.progress = 0;
        animation.duration = 1000 / this.config.gameSpeed;
        animation.startTime = Date.now();
        animation.isAttack = isAttack;
        animation.playerColor = playerColor;
        animation.id = Math.random();
        animation.path = null;
        animation.currentSegment = 0;
        animation.isMultiHop = false;
        
        this.shipAnimations.push(animation);
    }

    // Create multi-hop ship animation following supply route path
    createSupplyRouteAnimation(path, playerColor) {
        if (!path || path.length < 2) return;
        
        let animation = this.shipAnimationPool.pop();
        if (!animation) {
            animation = {
                fromX: 0, fromY: 0, toX: 0, toY: 0,
                progress: 0, duration: 0, startTime: 0,
                isAttack: false, playerColor: '#ffffff', id: 0,
                path: null, currentSegment: 0, isMultiHop: false
            };
        }
        
        // Set up multi-hop animation
        animation.path = path;
        animation.currentSegment = 0;
        animation.isMultiHop = true;
        animation.playerColor = playerColor;
        animation.isAttack = false;
        animation.id = Math.random();
        
        // Start with first segment
        this.initializeAnimationSegment(animation);
        
        this.shipAnimations.push(animation);
    }

    // Initialize animation segment for multi-hop
    initializeAnimationSegment(animation) {
        if (!animation.path || animation.currentSegment >= animation.path.length - 1) {
            return false;
        }
        
        const fromTerritory = animation.path[animation.currentSegment];
        const toTerritory = animation.path[animation.currentSegment + 1];
        
        animation.fromX = fromTerritory.x;
        animation.fromY = fromTerritory.y;
        animation.toX = toTerritory.x;
        animation.toY = toTerritory.y;
        animation.progress = 0;
        animation.duration = 800 / this.config.gameSpeed; // Faster per-segment animation
        animation.startTime = Date.now();
        
        return true;
    }
    
    // Update ship animations
    updateShipAnimations(deltaTime) {
        const currentTime = Date.now();
        
        // Optimize with object pooling and manual iteration
        for (let i = this.shipAnimations.length - 1; i >= 0; i--) {
            const animation = this.shipAnimations[i];
            animation.progress = (currentTime - animation.startTime) / animation.duration;
            
            if (animation.progress >= 1) {
                if (animation.isMultiHop && animation.path) {
                    // Move to next segment in multi-hop animation
                    animation.currentSegment++;
                    
                    if (this.initializeAnimationSegment(animation)) {
                        // Continue to next segment
                        continue;
                    }
                }
                
                // Return completed animation to pool for reuse
                this.shipAnimationPool.push(animation);
                this.shipAnimations.splice(i, 1);
            }
        }
    }
    
    // Update probes
    updateProbes(deltaTime) {
        for (let i = this.probes.length - 1; i >= 0; i--) {
            const probe = this.probes[i];
            const reachedDestination = probe.update(deltaTime);
            
            if (reachedDestination) {
                // Probe reached destination - colonize the planet
                this.colonizePlanet(probe);
                this.probes.splice(i, 1);
            }
        }
    }
    
    // Colonize planet when probe arrives
    colonizePlanet(probe) {
        const planet = probe.toTerritory;
        const player = this.players.find(p => p.id === probe.playerId);
        
        if (!planet || !player) return;
        
        // Check if planet is already colonized by another player
        if (planet.ownerId !== null && planet.ownerId !== player.id) {
            console.log(`Probe from ${player.name} destroyed! Planet ${planet.id} already colonized by another player.`);
            return;
        }
        
        console.log(`Probe colonizing planet ${planet.id} for player ${player.name}`);
        
        // Trigger discovery event before colonization
        const discovery = this.selectRandomDiscovery();
        const discoveryResult = GameUtils.processDiscovery(discovery.id, player.id, planet.id, this.playerDiscoveries, this);
        const colonizationSuccessful = discoveryResult.success;
        
        // Always log the discovery for UI display (both success and failure)
        this.logDiscoveryForUI(planet, player.id, discovery);
        
        // If probe was lost to hostile aliens, colonization fails
        if (!colonizationSuccessful) {
            console.log(`Colonization of planet ${planet.id} failed due to hostile encounter!`);
            return;
        }
        
        // Set ownership - discovery might have already set army size
        planet.ownerId = player.id;
        if (planet.armySize === 0 || planet.armySize === planet.hiddenArmySize) {
            planet.armySize = 1; // Default if not set by discovery
        }
        
        // Mark as no longer colonizable
        planet.isColonizable = false;
        
        // Add to player's territories
        player.territories.push(planet.id);
        
        // Reveal hidden connections
        planet.revealConnections();
        
        // Update neighboring territories' connections
        Object.values(this.gameMap.territories).forEach(territory => {
            if (territory.hiddenNeighbors.includes(planet.id)) {
                territory.hiddenNeighbors = territory.hiddenNeighbors.filter(id => id !== planet.id);
                territory.neighbors.push(planet.id);
            }
        });
        
        // Update player stats
        player.updateStats();
        
        console.log(`Planet ${planet.id} colonized successfully! Discovery: ${discovery.name}`);
    }
    
    // Ship animation rendering moved to AnimationSystem
    
    // Easing function for smooth animation
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    setupCanvas() {
        // Create canvas element
        const canvasElement = document.createElement('canvas');
        canvasElement.id = 'gameCanvas';
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
        canvasElement.style.display = 'block';
        canvasElement.style.background = '#1a1a2e';
        
        console.log('Creating canvas:', canvasElement.width, 'x', canvasElement.height);
        
        // Replace the root div content
        const root = document.getElementById('root');
        if (root) {
            root.innerHTML = '';
            root.appendChild(canvasElement);
            console.log('Canvas appended to root');
        } else {
            console.error('Root element not found!');
            return;
        }
        
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        
        if (!this.ctx) {
            console.error('Failed to get 2D context!');
            return;
        }
        
        console.log('Canvas setup complete');
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            if (this.camera) {
                this.camera.updateViewport(this.canvas.width, this.canvas.height);
            }
        });
    }
    
    setupEventListeners() {
        // Safety check to ensure canvas exists
        if (!this.canvas) {
            console.error('Canvas not available for event listeners');
            return;
        }
        
        // Mouse events now handled by InputHandler.js - removed to prevent conflicts
        // Wheel events handled by InputHandler
        
        // Touch events for mobile - with better event handling
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
        
        // Also add document-level listeners to catch events outside canvas
        document.addEventListener('touchmove', (e) => {
            if (e.target === this.canvas) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchstart', (e) => {
            if (e.target === this.canvas) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Enhanced touch state tracking for better pinch-to-zoom
        this.touchStartTime = 0;
        this.touchStartDistance = null;
        this.lastPinchDistance = null;
        this.isMultiTouch = false;
        this.touchDebugInfo = '';
        this.showTouchDebug = true;
        this.leaderboardMinimized = false;
        this.lastZoomTime = 0;
        this.pinchCenter = null;
        this.initialZoom = 1.0;
        
        // Long press functionality
        this.longPressTimer = null;
        this.longPressThreshold = 800; // 800ms for long press
        this.longPressTarget = null;
        this.longPressStartPos = null;
        
        // Keyboard events now handled by InputHandler
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    startGame() {
        console.log('Starting Star Throne game with config:', this.config);
        
        // Generate territories using configured map size
        this.gameMap.generateTerritories(this.config.mapSize);
        
        // Build spatial index for O(1) territory lookups (60% performance improvement)
        this.gameMap.buildSpatialIndex();
        this.log('Spatial index built for optimized territory lookups', 'info');
        
        // Create players: 1 human + configured AI count
        const totalPlayers = 1 + this.config.aiCount;
        this.createPlayers(Math.min(totalPlayers, this.maxPlayers));
        
        // Update human player name from config
        if (this.humanPlayer) {
            this.humanPlayer.name = this.config.playerName;
        }
        
        // Distribute initial territories
        this.distributeStartingTerritories();
        
        // Center camera on human player's starting territory
        if (this.humanPlayer && this.humanPlayer.territories.length > 0) {
            const startTerritory = this.gameMap.territories[this.humanPlayer.territories[0]];
            this.camera.centerOn(startTerritory.x, startTerritory.y);
        }
        
        this.gameState = 'playing';
        
        // Initialize modular systems after map generation
        this.animationSystem.initializeStarfield();
        this.animationSystem.preRenderStaticBackground();
        this.uiManager.loadBackgroundImage();
        this.distanceCache.buildDistanceMatrix();
        this.aiManager.initializeAIPersonalities();
        
        // Start home system flashing for player identification
        this.homeSystemFlashStart = Date.now();
        
        console.log(`Game started with ${this.players.length} players (${this.config.playerName} + ${this.config.aiCount} AI) and ${Object.keys(this.gameMap.territories).length} territories`);
    }
    
    generateAIName(index) {
        const firstNames = [
            'Alex', 'Blake', 'Casey', 'Dana', 'Emma', 'Felix', 'Grace', 'Hunter', 'Iris', 'Jack',
            'Kai', 'Luna', 'Max', 'Nova', 'Owen', 'Piper', 'Quinn', 'Riley', 'Sage', 'Tyler',
            'Uma', 'Victor', 'Wade', 'Xara', 'Yuki', 'Zara', 'Ash', 'Beck', 'Cole', 'Drew',
            'Echo', 'Finn', 'Gale', 'Hope', 'Ivan', 'Jade', 'Kane', 'Lexi', 'Mika', 'Nora',
            'Orion', 'Phoenix', 'Raven', 'Storm', 'Tara', 'Vale', 'Wren', 'Zane', 'Aria', 'Brix',
            'Coda', 'Dex', 'Eden', 'Fox', 'Gray', 'Hawk', 'Juno', 'Kira', 'Lux', 'Moss',
            'Neo', 'Oslo', 'Pike', 'Rain', 'Sky', 'Tex', 'Vex', 'Wolf', 'Zed', 'Atlas',
            'Bear', 'Cruz', 'Dash', 'Enzo', 'Flint', 'Ghost', 'Haze', 'Jett', 'Knox', 'Link'
        ];
        
        const clanNames = [
            'StarForge', 'VoidHunters', 'NebulaRise', 'CosmicFury', 'SolarFlare', 'DarkMatter',
            'GalaxyCorp', 'NovaStrike', 'CelestialWar', 'SpaceRaiders', 'StellarWolves', 'OrbitClan',
            'AstroElite', 'CubClan', 'ZenithForce', 'PlasmaBorn', 'StarDust', 'VoidWalkers',
            'QuantumLeap', 'PhotonStorm', 'EtherGuard', 'CosmoKnights', 'StarVeins', 'NebulaCrest',
            'VortexClan', 'AstralFire', 'MeteoRiders', 'IonStorm', 'PulsarWave', 'GravityWell',
            'SolarWind', 'BlackHole', 'RedGiant', 'WhiteDwarf', 'SuperNova', 'Constellation',
            'MilkyWay', 'Andromeda', 'Centauri', 'Proxima', 'Kepler', 'Hubble', 'Armstrong',
            'Gagarin', 'Apollo', 'Artemis', 'Orion', 'Pegasus', 'Phoenix', 'Dragon', 'Falcon'
        ];
        
        const additionalNames = [
            'Admiral Voss', 'Captain Zara', 'Commander Rex', 'Colonel Stone', 'General Mars',
            'Chief Khan', 'Major Swift', 'Lieutenant Nova', 'Sergeant Blade', 'Marshal Iron',
            'Dr. Quantum', 'Professor Void', 'Scientist Echo', 'Engineer Prime', 'Architect Zero',
            'The Shadow', 'The Phoenix', 'The Storm', 'The Hunter', 'The Ghost',
            'Cyber Wolf', 'Steel Eagle', 'Iron Hawk', 'Gold Tiger', 'Silver Fox',
            'Red Baron', 'Blue Devil', 'Green Arrow', 'Black Knight', 'White Falcon',
            'Star Runner', 'Moon Walker', 'Sun Rider', 'Sky Dancer', 'Wind Chaser',
            'Fire Brand', 'Ice Queen', 'Thunder Lord', 'Lightning Strike', 'Storm Bringer'
        ];
        
        // Only 25% chance of clan name, 75% for varied names
        if (index % 4 === 0) {
            // Clan name format
            const firstName = firstNames[index % firstNames.length];
            const clanName = clanNames[Math.floor(index / firstNames.length) % clanNames.length];
            return `[${clanName}] ${firstName}`;
        } else {
            // Varied name format - mix of first names and additional names
            const namePool = [...firstNames, ...additionalNames];
            return namePool[index % namePool.length];
        }
    }

    createPlayers(numPlayers) {
        // Expanded unique color palette - no duplicates
        const baseColors = [
            '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', 
            '#ff8844', '#88ff44', '#4488ff', '#ff4488', '#88ff88', '#8844ff',
            '#ffaa44', '#aaff44', '#44aaff', '#ff44aa', '#aaff88', '#aa44ff',
            '#ff6644', '#66ff44', '#4466ff', '#ff4466', '#66ff88', '#6644ff',
            '#ff9944', '#99ff44', '#4499ff', '#ff4499', '#99ff88', '#9944ff',
            '#ffcc44', '#ccff44', '#44ccff', '#ff44cc', '#ccff88', '#cc44ff',
            '#ff7744', '#77ff44', '#4477ff', '#ff4477', '#77ff88', '#7744ff',
            '#ffdd44', '#ddff44', '#44ddff', '#ff44dd', '#ddff88', '#dd44ff'
        ];
        
        // Create human player with distinctive bright cyan color
        this.humanPlayer = new Player(0, 'You', '#00ffff', 'human');
        this.players.push(this.humanPlayer);
        this.initializePlayerDiscoveries(this.humanPlayer.id);
        
        // Create AI players with unique colors and human-like names
        const usedColors = new Set(['#00ffff']); // Reserve human color
        
        for (let i = 1; i < numPlayers && i < this.maxPlayers; i++) {
            let playerColor;
            let attempts = 0;
            
            // Find a unique color
            do {
                const colorIndex = (i - 1) % baseColors.length;
                playerColor = baseColors[colorIndex];
                
                // If we've used this color, generate a slight variation
                if (usedColors.has(playerColor)) {
                    const variation = Math.floor(attempts / baseColors.length) * 0.1 + 0.1;
                    playerColor = this.adjustColorBrightness(playerColor, variation);
                }
                attempts++;
            } while (usedColors.has(playerColor) && attempts < 100);
            
            usedColors.add(playerColor);
            
            // Generate human-like name with clan designation
            const aiName = this.aiManager.generateAIName(i - 1);
            const aiPlayer = new Player(i, aiName, playerColor, 'ai');
            this.players.push(aiPlayer);
            this.initializePlayerDiscoveries(aiPlayer.id);
        }
        
        this.currentPlayers = this.players.length;
    }
    
    initializePlayerDiscoveries(playerId) {
        this.playerDiscoveries.set(playerId, {
            // Empire-wide bonuses (levels stack)
            precursorWeapons: 0,    // +10% attack per level
            precursorDrive: 0,      // +20% probe/ship speed per level
            precursorShield: 0,     // +10% defense per level
            precursorNanotech: 0,   // +10% empire-wide generation per level
            
            // Planet-specific bonuses
            factoryPlanets: new Set(), // Planets with 200% generation
            friendlyAliens: 0,      // Count of friendly alien encounters
            richMinerals: 0,        // Count of rich mineral discoveries
            voidStorms: 0,          // Count of void storm discoveries
            ancientRuins: 0,        // Count of ancient ruin discoveries
            hostileAliens: 0        // Count of hostile alien encounters
        });
    }
    
    adjustColorBrightness(hex, percent) {
        const num = parseInt(hex.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent * 100);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    distributeStartingTerritories() {
        // Since all territories are now colonizable, manually colonize starting territories
        const allTerritories = Object.values(this.gameMap.territories);
        const usedTerritories = [];
        const minDistance = 200; // Minimum distance between starting territories
        
        console.log(`Available territories for distribution: ${allTerritories.length} (all are colonizable planets)`);
        
        // Give each player exactly one starting territory with spacing
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            let bestTerritory = null;
            let bestMinDistance = 0;
            
            // Find territory with maximum distance from all previously assigned territories
            for (const territory of allTerritories) {
                if (usedTerritories.includes(territory.id)) continue;
                
                let minDistanceToUsed = Infinity;
                for (const usedId of usedTerritories) {
                    const usedTerritory = this.gameMap.territories[usedId];
                    const distance = Math.sqrt(
                        (territory.x - usedTerritory.x) ** 2 + 
                        (territory.y - usedTerritory.y) ** 2
                    );
                    minDistanceToUsed = Math.min(minDistanceToUsed, distance);
                }
                
                // If first player or this territory is far enough from others
                if (usedTerritories.length === 0 || minDistanceToUsed > bestMinDistance) {
                    bestTerritory = territory;
                    bestMinDistance = minDistanceToUsed;
                }
            }
            
            if (bestTerritory) {
                // Manually colonize this territory for the player
                bestTerritory.ownerId = player.id;
                bestTerritory.isColonizable = false; // Make it a normal territory
                bestTerritory.armySize = GAME_CONSTANTS.INITIAL_STARTING_ARMY_SIZE;
                bestTerritory.isThronestar = true; // Mark as throne star
                
                console.log(`🏠 Starting territory ${bestTerritory.id} for ${player.name}: ${GAME_CONSTANTS.INITIAL_STARTING_ARMY_SIZE} armies`);
                
                // Debug: Track army changes for human player
                if (player.id === 0) { // Human player ID
                    console.log(`👤 HUMAN PLAYER starting territory ${bestTerritory.id} initialized with ${bestTerritory.armySize} armies`);
                }
                
                // Reveal connections for starting territories
                bestTerritory.revealConnections();
                
                player.territories.push(bestTerritory.id);
                player.totalArmies += bestTerritory.armySize;
                player.throneStarId = bestTerritory.id; // Assign throne star ID
                
                usedTerritories.push(bestTerritory.id);
                
                console.log(`👑 Player ${player.name} assigned throne star: Territory ${bestTerritory.id} (distance from others: ${bestMinDistance.toFixed(1)})`);
            }
        }
        
        // Update player stats
        this.players.forEach(player => player.updateStats());
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    gameLoop(currentTime = 0) {
        try {
            const frameStart = performance.now();
            const deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;
            
            // Update FPS counter
            this.updateFPS(currentTime);
            
            if (this.gameState === 'playing') {
                this.update(deltaTime);
            }
            
            this.render();
            
            // Track overall frame performance
            this.performanceStats.frameTime = performance.now() - frameStart;
        } catch (error) {
            console.error('Game loop error:', error);
            // Continue running to prevent complete game halt
        }
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    updateFPS(currentTime) {
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }
    }
    
    update(deltaTime) {
        const updateStart = performance.now();
        
        // Update game timer
        this.gameTimer -= deltaTime;
        
        if (this.gameTimer <= 0) {
            this.endGame();
            return;
        }
        
        // High-performance AI processing: Staggered updates across 4 frames
        // Process only 1/4 of AI players per frame for 4x performance improvement
        const aiPlayers = this.players.filter(p => p.type !== 'human' && !p.isEliminated);
        const playersPerFrame = Math.ceil(aiPlayers.length / 4);
        const frameOffset = this.frameCount % 4;
        const startIndex = frameOffset * playersPerFrame;
        const endIndex = Math.min(startIndex + playersPerFrame, aiPlayers.length);
        
        // Always update human player every frame for responsiveness
        const humanPlayer = this.players.find(p => p.type === 'human');
        if (humanPlayer && !humanPlayer.isEliminated) {
            try {
                humanPlayer.update(deltaTime, this.gameMap, this.config.gameSpeed, this);
            } catch (error) {
                console.error(`Error updating human player:`, error);
            }
        }
        
        // Update subset of AI players this frame
        for (let i = startIndex; i < endIndex; i++) {
            if (i < aiPlayers.length) {
                const player = aiPlayers[i];
                try {
                    player.update(deltaTime, this.gameMap, this.config.gameSpeed, this);
                } catch (error) {
                    console.error(`Error updating AI player ${player.name}:`, error);
                }
            }
        }
        
        // Update ship animations and probes with normal delta time (speed applied internally)
        try {
            this.updateShipAnimations(deltaTime);
            this.updateProbes(deltaTime);
            this.updateFloatingDiscoveryTexts(deltaTime);
        } catch (error) {
            console.error('Error updating animations:', error);
        }
        
        // Update modular UI systems
        if (this.uiManager) {
            this.uiManager.update(deltaTime);
        }
        if (this.discoverySystem) {
            this.discoverySystem.updateFloatingDiscoveries();
        }
        if (this.animationSystem) {
            try {
                this.animationSystem.update(deltaTime);
            } catch (error) {
                console.error('Error updating animations:', error);
            }
        }
        if (this.memoryManager) {
            this.memoryManager.update();
        }
        if (this.aiManager) {
            this.aiManager.incrementFrame();
        }
        
        // Process event queue for event-driven architecture
        if (this.eventProcessingEnabled) {
            gameEvents.processQueue(5); // Process up to 5 events per frame
        }
        
        // Update performance management and track frame metrics
        if (this.performanceManager) {
            this.performanceManager.frameMetrics.updateTime = performance.now() - updateStart;
            this.performanceManager.update(deltaTime);
            
            // Trigger memory cleanup if memory usage is high
            if (this.performanceManager.getMemoryUsageMB() > 250) {
                this.performanceManager.triggerMemoryCleanup();
            }
        }
        
        // Throttled heavy operations for better performance
        if (this.frameCount % 45 === 0) { // Every 45 frames (~0.75 seconds)
            this.validateSupplyRoutes();
        }
        if (this.frameCount % 90 === 0) { // Every 90 frames (~1.5 seconds)
            this.processSupplyRoutes(this.config.gameSpeed);
        }
        
        // Check for player elimination (throttled)
        if (this.frameCount % 20 === 0) {
            this.checkPlayerElimination();
        }
        
        // Check win conditions (throttled)
        if (this.frameCount % 30 === 0) {
            this.checkWinConditions();
        }
        
        // Update camera with edge panning
        this.camera.update(deltaTime);
        
        // Edge panning when mouse is near screen edges (desktop only)
        if (this.mousePos && !this.isDragging && !this.isMultiTouch) {
            this.camera.updateEdgePanning(this.mousePos.x, this.mousePos.y, deltaTime);
        }
        
        // Track performance
        this.performanceStats.updateTime = performance.now() - updateStart;
    }
    
    checkPlayerElimination() {
        this.players.forEach(player => {
            if (!player.isEliminated && player.territories.length === 0) {
                player.isEliminated = true;
                console.log(`Player ${player.name} has been eliminated!`);
                
                if (player === this.humanPlayer) {
                    console.log('You have been eliminated! Entering spectator mode.');
                    // TODO: Show elimination message and spectator UI
                }
            }
        });
    }
    
    checkWinConditions() {
        const alivePlayers = this.players.filter(p => !p.isEliminated);
        
        if (alivePlayers.length === 1) {
            this.endGame(alivePlayers[0]);
        } else if (alivePlayers.length === 0) {
            this.endGame(); // Draw
        }
    }
    
    endGame(winner = null) {
        this.gameState = 'ended';
        
        if (winner) {
            console.log(`Game Over! Winner: ${winner.name}`);
            this.showMessage(`Victory! ${winner.name} has conquered the galaxy!`, 10000);
        } else {
            console.log('Game Over! It\'s a draw.');
            this.showMessage('Game Over! Your empire has fallen.', 10000);
        }
        
        // Stop game loop
        if (this.gameLoopRunning) {
            this.gameLoopRunning = false;
        }
        
        // Show game over message for human player defeat
        if (this.humanPlayer && this.humanPlayer.isEliminated) {
            this.showMessage(`Your throne star has been captured! Your empire has fallen to ${winner?.name || 'your enemies'}.`, 15000);
        }
    }
    
    render() {
        if (!this.ctx || !this.canvas) {
            console.error('No canvas context available for rendering');
            return;
        }
        
        const renderStart = performance.now();
        
        // Update visible territories for culling
        this.updateVisibleTerritories();
        
        // Clear canvas with space background
        this.ctx.fillStyle = '#001122';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context for camera transform
        this.ctx.save();
        
        // Apply camera transformation
        this.camera.applyTransform(this.ctx);
        
        // Use modular rendering systems
        const lodLevel = this.getLODLevel();
        
        // Render background elements (starfield, nebulas)
        if (this.animationSystem) {
            this.animationSystem.renderStarfield(this.ctx, this.camera);
            this.animationSystem.renderNebulas(this.ctx, this.camera);
        }
        
        // Render territories using optimized renderer
        if (this.territoryRenderer) {
            this.territoryRenderer.render(this.ctx, this.camera, lodLevel);
        }
        
        // Render ship animations using animation system
        if (this.animationSystem && lodLevel >= 2) {
            this.animationSystem.renderShipAnimations(this.ctx, this.camera);
        }
        
        // Render discovery floating texts
        if (this.discoverySystem) {
            this.discoverySystem.renderFloatingDiscoveries(this.ctx, this.camera);
        }
        
        // Restore context
        this.ctx.restore();
        
        // Render UI using modular UIManager
        if (this.uiManager) {
            this.uiManager.renderUI(this.ctx, this.canvas);
        }
        
        // Track performance
        this.performanceStats.renderTime = performance.now() - renderStart;
    }
    
    /**
     * Get Level of Detail based on camera zoom level
     * Level 1: Strategic view (very zoomed out) - minimal detail
     * Level 2: Operational view (medium zoom) - moderate detail  
     * Level 3: Tactical view (zoomed in) - full detail
     */
    getLODLevel() {
        const zoom = this.camera.zoom;
        if (zoom <= 0.15) return 1; // Strategic view
        if (zoom <= 0.8) return 2;  // Operational view
        return 3; // Tactical view
    }
    
    restart() {
        // Clear game state
        this.gameState = 'playing';
        this.gameTimer = 0;
        
        // Clear all arrays
        this.players = [];
        this.humanPlayer = null;
        
        // Regenerate map and restart game
        this.gameMap = new GameMap(2000, 1500, this.config);
        this.startGame();
    }
}
