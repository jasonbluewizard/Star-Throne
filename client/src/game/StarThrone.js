import { GameMap } from './GameMap';
import { Player } from './Player';
import { GameUI } from './GameUI';
import { Camera } from './Camera';
// Removed disabled Probe import (dead code cleanup)
import { InputHandler } from './InputHandler';
import { Renderer } from './Renderer';
import { CombatSystem } from './CombatSystem';
import { SupplySystem } from './SupplySystem';
import { PathfindingService } from './PathfindingService';
import { GameUtils } from './utils';
import { GAME_CONSTANTS } from '../../../common/gameConstants';
import { gameEvents, GAME_EVENTS, EVENT_PRIORITY, EventHelpers } from './EventSystem';
import { PerformanceManager } from './PerformanceManager';
import { PerformanceOverlay } from './PerformanceOverlay';
import { DiscoverySystem } from './DiscoverySystem';
import { AnimationSystem } from './AnimationSystem';
import { UIManager } from './UIManager';
import { AIManager } from './AIManager';
import Controls from './Controls';

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
        this.gameInitialized = false; // Prevent early win condition checks
        
        // Persistent star lane discovery system
        this.discoveredLanes = new Set(); // Stores "id1-id2" strings for permanently visible lanes
        
        // Throne star validation timer
        this.throneStarValidationTimer = 0;
        
        // Home system flashing
        this.homeSystemFlashStart = null;
        this.homeSystemFlashDuration = 3000; // 3 seconds
        
        // Modular systems (initialized in init())
        this.inputHandler = null;
        this.renderer = null;
        this.combatSystem = null;
        this.supplySystem = null;
        this.pathfindingService = null;
        this.performanceManager = null;
        this.discoverySystem = null;
        this.animationSystem = null;
        this.uiManager = null;
        this.controls = null;
        
        // Legacy properties for backward compatibility
        this.hoveredTerritory = null;
        
        // Performance
        this.lastFrameTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        // Performance optimizations
        this.visibleTerritories = new Set();
        this.lastVisibilityUpdate = 0;
        this.cullingBatchIndex = 0; // For incremental visibility processing
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
        this.pendingLongRangeCombats = []; // Track delayed long-range combat arrivals
        
        // Removed legacy long-range attacks array (dead code cleanup)
        
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
        // Removed disabled probe system variables (dead code eliminated)
        
        // Discovery announcements
        this.floatingDiscoveryTexts = [];
        this.discoveryLog = []; // Recent discovery announcements for panel display
        
        // Discovery system - Map of playerId -> discovery object
        this.playerDiscoveries = new Map();
        
        // Throne connectivity tracking
        this.disconnectedTerritories = new Set();
        this.lastConnectivityCheck = 0;
        this.connectivityCheckInterval = 2000; // Check every 2 seconds
        
        // Legacy drag variables (kept for compatibility)
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
        
        // Track active long-range attacks (fleets in transit)
        this.longRangeAttacks = [];
        
        // Recent probe results for UI announcements
        // this.recentProbeResults = []; // Probe results tracking disabled
        
        // Notification system
        this.notifications = [];
        
        // Bonus panel state
        this.showBonusPanel = true;
        
        // Message display system
        this.messageText = '';
        this.messageTimer = 0;
        
        // Performance optimization: Throttled logging system
        // Removed unused debugMode variable (dead code eliminated)
        this.logThrottles = new Map(); // Track throttled log messages
        this.lastLogTimes = new Map(); // Track last log timestamp per message type
        
        // DOM optimization: Cache layout measurements
        this.cachedCanvasRect = null;
        this.canvasRectUpdateTime = 0;
        this.canvasRectCacheDuration = 1000; // Cache for 1 second
        
        // Input throttling for performance
        this.lastMouseMoveTime = 0;
        this.mouseMoveThrottleMs = 16; // ~60 FPS, one event per frame
        this.pendingMouseEvent = null;
        
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
        // Removed debugMode check (unused UI variable)
        
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
    
    /**
     * Get cached canvas bounding rectangle with automatic cache invalidation
     * Prevents expensive getBoundingClientRect() calls on every mouse event
     */
    getCachedCanvasRect() {
        const now = Date.now();
        
        // Return cached rect if still valid
        if (this.cachedCanvasRect && (now - this.canvasRectUpdateTime) < this.canvasRectCacheDuration) {
            return this.cachedCanvasRect;
        }
        
        // Update cache with fresh measurement
        if (this.canvas) {
            this.cachedCanvasRect = this.canvas.getBoundingClientRect();
            this.canvasRectUpdateTime = now;
        }
        
        return this.cachedCanvasRect;
    }
    
    /**
     * Invalidate canvas rect cache on window resize or scroll
     */
    invalidateCanvasRectCache() {
        this.cachedCanvasRect = null;
        this.canvasRectUpdateTime = 0;
    }
    
    /**
     * Throttled mouse event processing - limits to one event per frame
     * @param {MouseEvent} event - Raw mouse event
     * @param {Function} handler - Event handler function
     */
    handleThrottledMouseEvent(event, handler) {
        const now = Date.now();
        
        // Store the latest event for processing
        this.pendingMouseEvent = { event, handler, timestamp: now };
        
        // Only process if enough time has passed (throttle to ~60 FPS)
        if (now - this.lastMouseMoveTime >= this.mouseMoveThrottleMs) {
            this.processPendingMouseEvent();
        }
    }
    
    /**
     * Process the most recent pending mouse event
     */
    processPendingMouseEvent() {
        if (!this.pendingMouseEvent) return;
        
        const { event, handler } = this.pendingMouseEvent;
        this.lastMouseMoveTime = Date.now();
        
        // Get cached canvas rect to avoid expensive DOM measurement
        const rect = this.getCachedCanvasRect();
        if (rect) {
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            handler(x, y, event);
        }
        
        this.pendingMouseEvent = null;
    }
    
    loadBackgroundImage() {
        // Load the background galaxy image
        this.backgroundImage = new Image();
        this.backgroundImage.onload = () => {
            this.backgroundLoaded = true;
            console.log('Background galaxy image loaded');
        };
        this.backgroundImage.onerror = () => {
            console.log('Background image failed to load, using default starfield');
            this.backgroundLoaded = false;
        };
        // Set the image path
        this.backgroundImage.src = '/galaxy-background.jpg';
    }
    
    renderBackgroundImage() {
        if (!this.backgroundImage || !this.backgroundLoaded) return;
        
        this.ctx.save();
        
        // Calculate parallax offset (background moves slower than camera)
        const parallaxFactor = 0.2; // Background moves at 20% of camera speed
        const offsetX = -this.camera.x * parallaxFactor;
        const offsetY = -this.camera.y * parallaxFactor;
        
        // Calculate scale to ensure image covers the entire viewport
        const imageAspect = this.backgroundImage.width / this.backgroundImage.height;
        const canvasAspect = this.canvas.width / this.canvas.height;
        
        let drawWidth, drawHeight;
        if (imageAspect > canvasAspect) {
            // Image is wider - fit to height
            drawHeight = this.canvas.height * 1.5; // Scale up for parallax coverage
            drawWidth = drawHeight * imageAspect;
        } else {
            // Image is taller - fit to width
            drawWidth = this.canvas.width * 1.5; // Scale up for parallax coverage
            drawHeight = drawWidth / imageAspect;
        }
        
        // Center the image with parallax offset
        const drawX = (this.canvas.width - drawWidth) / 2 + offsetX;
        const drawY = (this.canvas.height - drawHeight) / 2 + offsetY;
        
        // Draw the background image with very low opacity
        this.ctx.globalAlpha = 0.15; // Even more transparent for very subtle background effect
        this.ctx.drawImage(this.backgroundImage, drawX, drawY, drawWidth, drawHeight);
        
        // Add dark overlay to further dim the background
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.globalAlpha = 1.0;
        
        this.ctx.restore();
    }
    
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

    // Add notification to display queue
    addNotification(text, color = '#44ff44', duration = 4000) {
        this.notifications.push({
            text: text,
            color: color,
            createdAt: Date.now(),
            duration: duration,
            opacity: 1.0
        });
    }
    
    // Update and clean up notifications
    updateNotifications() {
        const now = Date.now();
        this.notifications = this.notifications.filter(notification => {
            const age = now - notification.createdAt;
            if (age > notification.duration) {
                return false; // Remove expired notifications
            }
            
            // Fade out in the last 500ms
            if (age > notification.duration - 500) {
                notification.opacity = (notification.duration - age) / 500;
            }
            
            return true;
        });
    }
    
    // Message display system for FSM feedback
    showMessage(text, duration = 3000) {
        this.messageText = text;
        this.messageTimer = duration;
        console.log(`Message: ${text}`);
    }
    
    hideMessage() {
        this.messageText = '';
        this.messageTimer = 0;
    }
    
    showError(text) {
        this.showMessage(`❌ ${text}`, 2000);
    }
    
    updateMessage(deltaTime) {
        if (this.messageTimer > 0) {
            this.messageTimer -= deltaTime;
            if (this.messageTimer <= 0) {
                this.hideMessage();
            }
        }
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.gameMap = new GameMap(2000, 1500, this.config); // Large map with advanced configuration
        this.gameMap.game = this; // Reference for AI animations
        
        // Use logical dimensions for camera, not physical canvas dimensions
        const logicalWidth = this.canvas.style.width ? parseInt(this.canvas.style.width) : window.innerWidth;
        const logicalHeight = this.canvas.style.height ? parseInt(this.canvas.style.height) : window.innerHeight;
        this.camera = new Camera(logicalWidth, logicalHeight);
        
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
        this.renderer = new Renderer(this.canvas, this.camera, this);
        this.combatSystem = new CombatSystem(this);
        this.supplySystem = new SupplySystem(this);
        this.pathfindingService = new PathfindingService(this);
        this.performanceManager = new PerformanceManager(this);
        this.performanceOverlay = new PerformanceOverlay(this.canvas, this.performanceManager);
        this.discoverySystem = new DiscoverySystem(this);
        this.animationSystem = new AnimationSystem(this);
        this.uiManager = new UIManager(this);
        this.aiManager = new AIManager(this);
        this.controls = new Controls(this);
        
        // Removed deprecated global game reference (dead code cleanup)
        window.game = this; // Temporary global access - to be replaced with dependency injection
        
        // Auto-detect optimal performance profile
        this.performanceManager.detectOptimalProfile();
        
        this.gameStartTime = Date.now(); // Track when game actually starts
        this.startGame();
        this.gameLoop();
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
                effect: 'probe_lost'
            },
            {
                id: 'friendly_aliens',
                name: 'Friendly Aliens',
                description: 'Friendly aliens join your empire!',
                probability: 0.12,
                type: 'positive',
                effect: 'extra_fleet',
                bonus: 50
            },
            {
                id: 'precursor_weapons',
                name: 'Precursor Weapons Cache',
                description: 'Ancient weapon technology discovered!',
                probability: 0.08,
                type: 'empire_bonus',
                effect: 'attack_bonus',
                bonus: 10 // +10% attack
            },
            {
                id: 'precursor_drive',
                name: 'Precursor Drive System',
                description: 'Advanced propulsion technology found!',
                probability: 0.08,
                type: 'empire_bonus',
                effect: 'speed_bonus',
                bonus: 20 // +20% speed
            },
            {
                id: 'precursor_shield',
                name: 'Precursor Shield Matrix',
                description: 'Defensive technology enhances your empire!',
                probability: 0.08,
                type: 'empire_bonus',
                effect: 'defense_bonus',
                bonus: 10 // +10% defense
            },
            {
                id: 'precursor_factory',
                name: 'Precursor Factory Complex',
                description: 'Ancient manufacturing facility still operational!',
                probability: 0.06,
                type: 'planet_bonus',
                effect: 'factory_planet',
                bonus: 100 // +100% generation (200% total)
            },
            {
                id: 'precursor_nanotech',
                name: 'Precursor Nanotechnology',
                description: 'Self-replicating technology spreads across your empire!',
                probability: 0.05,
                type: 'empire_bonus',
                effect: 'generation_bonus',
                bonus: 10 // +10% empire-wide generation
            },
            {
                id: 'mineral_deposits',
                name: 'Rich Mineral Deposits',
                description: 'Valuable resources boost this planet\'s output!',
                probability: 0.10,
                type: 'planet_bonus',
                effect: 'mineral_planet',
                bonus: 50 // +50% generation
            },
            {
                id: 'ancient_ruins',
                name: 'Ancient Ruins',
                description: 'Mysterious structures provide no immediate benefit.',
                probability: 0.08,
                type: 'neutral',
                effect: 'cosmetic'
            },
            {
                id: 'void_storm',
                name: 'Void Storm Remnants',
                description: 'Dangerous energy storms reduce planet effectiveness.',
                probability: 0.06,
                type: 'negative',
                effect: 'reduced_generation',
                bonus: -25 // -25% generation
            },
            {
                id: 'no_discovery',
                name: 'Standard Planet',
                description: 'A typical world with no special features.',
                probability: 0.14,
                type: 'neutral',
                effect: 'none'
            }
        ];
    }
    
    // Initialize parallax starfield layers
    initializeStarfield() {
        if (this.starfield.initialized) return;
        
        // Expand starfield area beyond visible map for smooth parallax
        const starfieldWidth = this.gameMap.width * 2;
        const starfieldHeight = this.gameMap.height * 2;
        const offsetX = -this.gameMap.width * 0.5;
        const offsetY = -this.gameMap.height * 0.5;
        
        // Far layer: Many small, dim stars that barely move
        for (let i = 0; i < 300; i++) {
            this.starfield.farStars.push({
                x: Math.random() * starfieldWidth + offsetX,
                y: Math.random() * starfieldHeight + offsetY,
                size: Math.random() * 1 + 0.5,
                brightness: Math.random() * 0.3 + 0.1,
                twinkle: Math.random() * 0.2 + 0.8
            });
        }
        
        // Mid layer: Medium stars with moderate movement
        for (let i = 0; i < 150; i++) {
            this.starfield.midStars.push({
                x: Math.random() * starfieldWidth + offsetX,
                y: Math.random() * starfieldHeight + offsetY,
                size: Math.random() * 1.5 + 1,
                brightness: Math.random() * 0.4 + 0.2,
                twinkle: Math.random() * 0.3 + 0.7
            });
        }
        
        // Near layer: Fewer large stars with most movement
        for (let i = 0; i < 80; i++) {
            this.starfield.nearStars.push({
                x: Math.random() * starfieldWidth + offsetX,
                y: Math.random() * starfieldHeight + offsetY,
                size: Math.random() * 2 + 1.5,
                brightness: Math.random() * 0.5 + 0.3,
                twinkle: Math.random() * 0.4 + 0.6
            });
        }
        
        this.starfield.initialized = true;
        console.log('Parallax starfield initialized with 530 stars across 3 layers');
    }
    
    // Pre-render static background elements once for performance optimization
    preRenderStaticBackground() {
        // Set static canvas to game map size
        this.staticBg.width = this.gameMap.width;
        this.staticBg.height = this.gameMap.height;
        
        // Clear the static background
        this.staticBgCtx.fillStyle = '#0a0a1a';
        this.staticBgCtx.fillRect(0, 0, this.staticBg.width, this.staticBg.height);
        
        // Render starfield to static background (once only)
        this.renderStarfieldStatic(this.staticBgCtx);
        
        // Render nebulas to static background (once only)
        this.renderNebulasStatic(this.staticBgCtx);
        
        console.log('Static background pre-rendered for performance optimization');
    }
    
    // Render starfield without parallax for static background
    renderStarfieldStatic(ctx) {
        if (!this.starfield.initialized) return;
        
        ctx.save();
        
        // Render all star layers at base positions (no parallax)
        const renderLayer = (stars, baseOpacity) => {
            stars.forEach(star => {
                // Simple twinkling effect for static background
                const twinkle = 0.8; // Static brightness
                const opacity = star.brightness * baseOpacity * twinkle;
                
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });
        };
        
        // Render all layers
        renderLayer(this.starfield.farStars, 0.7);
        renderLayer(this.starfield.midStars, 0.8);
        renderLayer(this.starfield.nearStars, 1.0);
        
        ctx.restore();
    }
    
    // Render nebulas for static background
    renderNebulasStatic(ctx) {
        if (!this.gameMap.nebulas) return;
        
        this.gameMap.nebulas.forEach(nebula => {
            const gradient = ctx.createRadialGradient(
                nebula.x, nebula.y, 0,
                nebula.x, nebula.y, nebula.radius
            );
            gradient.addColorStop(0, nebula.color);
            gradient.addColorStop(1, 'rgba(147, 112, 219, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    // Random discovery selection based on probabilities
    selectRandomDiscovery() {
        const discoveries = this.getDiscoveryTypes();
        const random = Math.random();
        let cumulative = 0;
        
        for (const discovery of discoveries) {
            cumulative += discovery.probability;
            if (random <= cumulative) {
                return discovery;
            }
        }
        
        // Fallback to no discovery
        return discoveries.find(d => d.id === 'no_discovery');
    }
    
    // Log discovery for UI display (called for both successful and failed probes)
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
        
        // Probe result tracking disabled (probe system inactive)
        // this.recentProbeResults.push({ ... }); // No longer tracking probe results
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
    createShipAnimation(fromTerritory, toTerritory, isAttack = false, fleetSize = 0) {
        // Use object pooling to reduce garbage collection
        let animation = this.shipAnimationPool.pop();
        if (!animation) {
            animation = {
                fromX: 0, fromY: 0, toX: 0, toY: 0,
                progress: 0, duration: 0, startTime: 0,
                isAttack: false, playerColor: '#ffffff', id: 0,
                path: null, currentSegment: 0, isMultiHop: false,
                fleetSize: 0
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
        animation.fleetSize = fleetSize;
        
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
    
    // Launch long-range attack (slow-moving ship that crosses the map)
    launchLongRangeAttack(fromTerritory, toTerritory, fleetSize) {
        console.log(`🔧 Creating long-range attack: ${fromTerritory.id} -> ${toTerritory.id} with ${fleetSize} ships`);
        console.log(`🔧 Human player ID: ${this.humanPlayer?.id}, From territory owner: ${fromTerritory.ownerId}, To territory owner: ${toTerritory.ownerId}`);
        console.log(`🔧 AnimationSystem available: ${!!this.animationSystem}`);
        
        // Generate unique battleId for tracking
        const battleId = `longrange_${Date.now()}_${Math.random()}`;
        
        // Reduce attacking territory's armies immediately
        fromTerritory.armySize = Math.max(1, fromTerritory.armySize - fleetSize);
        
        // Create long-range ship animation (slower and with army count display)
        this.createLongRangeShipAnimation(fromTerritory, toTerritory, fleetSize);
        
        // Calculate distance-based arrival time using constant speed
        const distance = Math.sqrt(
            Math.pow(toTerritory.x - fromTerritory.x, 2) + 
            Math.pow(toTerritory.y - fromTerritory.y, 2)
        );
        const animationDuration = this.calculateLongRangeAnimationDuration(fromTerritory, toTerritory);
        const startTime = Date.now();
        const arrivalTime = startTime + animationDuration;
        this.scheduleLongRangeCombat(fromTerritory, toTerritory, fleetSize, arrivalTime, distance, startTime, battleId);
        
        // Show visual feedback with accurate arrival time
        this.showMessage(`Long-range attack launched: ${fleetSize} ships (arriving in ${Math.round(animationDuration/1000)}s)`, 3000);
        
        // Flash the source territory
        this.flashTerritory(fromTerritory.id, '#ff0000', 300);
        
        console.log(`Long-range attack launched successfully: ${fromTerritory.id} -> ${toTerritory.id} (${fleetSize} ships) - arriving in ${Math.round(animationDuration/1000)}s`);
        
        // Return battleId for tracking
        return { battleId: battleId };
    }
    
    // Schedule delayed combat resolution for long-range attacks
    scheduleLongRangeCombat(fromTerritory, toTerritory, fleetSize, arrivalTime, distance, startTime, battleId) {
        if (!this.pendingLongRangeCombats) {
            this.pendingLongRangeCombats = [];
        }
        
        this.pendingLongRangeCombats.push({
            fromTerritory: fromTerritory,
            toTerritory: toTerritory,
            fromTerritoryId: fromTerritory.id, // Store IDs for validation
            toTerritoryId: toTerritory.id,
            fleetSize: fleetSize,
            arrivalTime: arrivalTime,
            distance: distance,
            startTime: startTime,
            fromOwnerId: fromTerritory.ownerId, // Store attacking player ID
            battleId: battleId // Store battleId for tracking
        });
        
        console.log(`⏰ Long-range combat scheduled: ${fromTerritory.id} -> ${toTerritory.id} distance=${distance.toFixed(1)}px, travel=${(arrivalTime-startTime)/1000}s, battleId=${battleId}`);
    }
    
    // Process pending long-range combat arrivals
    processLongRangeCombatArrivals() {
        if (!this.pendingLongRangeCombats) return;
        
        const currentTime = Date.now();
        for (let i = this.pendingLongRangeCombats.length - 1; i >= 0; i--) {
            const combat = this.pendingLongRangeCombats[i];
            
            if (currentTime >= combat.arrivalTime) {
                // Fleet has arrived - process combat
                console.log(`⚔️ LONG-RANGE ARRIVAL: Fleet from ${combat.fromTerritoryId} attacking ${combat.toTerritoryId} with ${combat.fleetSize} ships`);
                console.log(`🔍 DEBUG: gameMap.territories structure:`, typeof this.gameMap.territories, Object.keys(this.gameMap.territories).length);
                
                // Validate territories still exist and are valid targets
                const targetTerritory = this.gameMap.territories[combat.toTerritoryId] || 
                                      Object.values(this.gameMap.territories).find(t => t.id === combat.toTerritoryId);
                const sourceTerritory = this.gameMap.territories[combat.fromTerritoryId] || 
                                      Object.values(this.gameMap.territories).find(t => t.id === combat.fromTerritoryId);
                
                console.log(`🔍 LONG-RANGE DEBUG: Target territory ${combat.toTerritoryId} found: ${!!targetTerritory}, Source territory ${combat.fromTerritoryId} found: ${!!sourceTerritory}`);
                console.log(`🔍 DEBUG: Target lookup result:`, targetTerritory ? `Territory ${targetTerritory.id} owner ${targetTerritory.ownerId}` : 'NOT FOUND');
                console.log(`🔍 DEBUG: Source lookup result:`, sourceTerritory ? `Territory ${sourceTerritory.id} owner ${sourceTerritory.ownerId}` : 'NOT FOUND');
                
                if (targetTerritory && sourceTerritory) {
                    // Process the actual combat
                    console.log(`✅ LONG-RANGE: Processing combat for valid territories`);
                    this.processLongRangeArrival(combat, sourceTerritory, targetTerritory);
                } else {
                    console.log(`❌ Long-range combat cancelled: invalid territories (source: ${!!sourceTerritory}, target: ${!!targetTerritory})`);
                    if (!targetTerritory) {
                        console.log(`❌ Target territory ${combat.toTerritoryId} not found in gameMap.territories`);
                        console.log(`❌ Available territory IDs:`, Object.keys(this.gameMap.territories).slice(0, 10));
                    }
                    if (!sourceTerritory) {
                        console.log(`❌ Source territory ${combat.fromTerritoryId} not found in gameMap.territories`);
                    }
                }
                
                // Remove completed combat
                this.pendingLongRangeCombats.splice(i, 1);
            }
        }
    }
    
    // Process long-range fleet arrival and combat
    processLongRangeArrival(combat, sourceTerritory, targetTerritory) {
        console.log(`💥 Long-range fleet arrives! ${combat.fleetSize} ships attacking territory ${targetTerritory.id} (${targetTerritory.armySize} defenders)`);
        
        // Create a temporary attacking territory for the long-range attack
        const tempAttackingTerritory = {
            id: sourceTerritory.id,
            ownerId: combat.fromOwnerId,
            armySize: combat.fleetSize + 1, // +1 so the attack system can deduct armies
            x: sourceTerritory.x,
            y: sourceTerritory.y,
            neighbors: [targetTerritory.id] // Temporary connection for attack validation
        };
        
        // Trigger combat flash effects
        targetTerritory.triggerCombatFlash();
        if (sourceTerritory.triggerCombatFlash) {
            sourceTerritory.triggerCombatFlash();
        }
        
        // Use the combat system's attackTerritory method
        console.log(`🔍 LONG-RANGE COMBAT: Calling attackTerritory with temp attacking territory (${tempAttackingTerritory.id}, owner: ${tempAttackingTerritory.ownerId}, armies: ${tempAttackingTerritory.armySize}) vs target (${targetTerritory.id}, owner: ${targetTerritory.ownerId}, armies: ${targetTerritory.armySize})`);
        const result = this.combatSystem.attackTerritory(tempAttackingTerritory, targetTerritory);
        console.log(`🔍 LONG-RANGE RESULT:`, result);
        
        // Notify InputStateMachine about long-range battle outcome if there's a tracked battle
        if (combat.battleId && this.inputHandler && this.inputHandler.inputFSM) {
            // For long-range attacks, we need to check the battle outcome after it's resolved
            // Since long-range uses delayed combat, check if territory ownership changed
            const attackerWins = targetTerritory.ownerId === combat.fromOwnerId;
            this.inputHandler.inputFSM.onBattleComplete(combat.battleId, attackerWins, sourceTerritory.id);
        }
        
        if (result.success) {
            console.log(`🏆 Long-range attack successful! Territory ${targetTerritory.id} captured by player ${combat.fromOwnerId}`);
            
            // Visual feedback
            if (this.flashTerritory) {
                this.flashTerritory(targetTerritory.id, '#00ff00', 500);
            }
            if (this.uiManager && this.uiManager.showMessage) {
                this.uiManager.showMessage(`Long-range attack successful! Territory captured`, 3000);
            }
            
            // Check for game end conditions
            this.checkWinConditions();
        } else {
            console.log(`🛡️ Long-range attack failed! Territory ${targetTerritory.id} defended`);
            
            // Visual feedback for failed attack
            if (this.flashTerritory) {
                this.flashTerritory(targetTerritory.id, '#ff0000', 500);
            }
            if (this.uiManager && this.uiManager.showMessage) {
                this.uiManager.showMessage(`Long-range attack failed! Defense held`, 2000);
            }
        }
        
        // Update player stats
        if (this.players) {
            this.players.forEach(player => player.updateStats());
        }
    }

    // Check if a territory is disconnected from its throne star (uses cached results)
    isDisconnectedFromThrone(territoryId) {
        // Use cached results from periodic updates for performance
        return this.disconnectedTerritories.has(territoryId);
    }
    
    // Internal method to calculate throne connectivity (used by updateThroneConnectivity)
    _calculateThroneConnectivity(territoryId) {
        const territory = this.gameMap.territories[territoryId];
        if (!territory || territory.ownerId === null) {
            return false; // Neutral territories don't have supply issues
        }
        
        const player = this.players[territory.ownerId];
        if (!player || !player.throneStarId) {
            return false; // No throne star to check connectivity to
        }
        
        // If this IS the throne star, it's always connected
        if (territoryId === player.throneStarId) {
            return false;
        }
        
        // Use breadth-first search to check if throne star is reachable through owned territories
        const visited = new Set();
        const queue = [territoryId];
        visited.add(territoryId);
        
        while (queue.length > 0) {
            const currentId = queue.shift();
            const current = this.gameMap.territories[currentId];
            
            if (!current) continue;
            
            // Check all neighbors
            for (const neighborId of current.neighbors) {
                if (visited.has(neighborId)) continue;
                
                const neighbor = this.gameMap.territories[neighborId];
                if (!neighbor || neighbor.ownerId !== territory.ownerId) {
                    continue; // Skip unowned territories
                }
                
                // Found the throne star!
                if (neighborId === player.throneStarId) {
                    return false; // Connected to throne
                }
                
                visited.add(neighborId);
                queue.push(neighborId);
            }
        }
        
        return true; // Could not reach throne star = disconnected
    }

    // Periodically update throne connectivity for all territories
    updateThroneConnectivity() {
        const currentTime = Date.now();
        if (currentTime - this.lastConnectivityCheck < this.connectivityCheckInterval) {
            return; // Not time to check yet
        }
        
        this.lastConnectivityCheck = currentTime;
        this.disconnectedTerritories.clear();
        
        // Check all owned territories for throne connectivity
        Object.values(this.gameMap.territories).forEach(territory => {
            if (territory.ownerId !== null && this._calculateThroneConnectivity(territory.id)) {
                this.disconnectedTerritories.add(territory.id);
            }
        });
        
        // Debug logging occasionally to track disconnected territories
        if (this.disconnectedTerritories.size > 0 && Math.random() < 0.1) {
            console.log(`📡 Throne connectivity: ${this.disconnectedTerritories.size} territories disconnected from throne stars`);
        }
    }

    // Calculate distance-based animation duration for long-range attacks
    calculateLongRangeAnimationDuration(fromTerritory, toTerritory) {
        const distance = Math.sqrt(
            Math.pow(toTerritory.x - fromTerritory.x, 2) + 
            Math.pow(toTerritory.y - fromTerritory.y, 2)
        );
        
        // Duration = distance / speed (in milliseconds) - using constant speed with engine tech bonus
        let baseSpeed = GAME_CONSTANTS.LONG_RANGE_BASE_SPEED;
        
        // Apply engine tech bonus to long-range speed if launching player has tech
        if (fromTerritory.ownerId !== null && this.players && this.players[fromTerritory.ownerId] && this.players[fromTerritory.ownerId].tech) {
            const engineTech = this.players[fromTerritory.ownerId].tech.engines;
            baseSpeed *= (1 + engineTech * 0.1); // +10% speed per engine tech level
        }
        
        const travelTime = (distance / baseSpeed) * 1000;
        
        console.log(`📐 CONSTANT SPEED: Distance=${distance.toFixed(1)}px, BaseSpeed=${GAME_CONSTANTS.LONG_RANGE_BASE_SPEED}px/s, ActualSpeed=${baseSpeed.toFixed(1)}px/s, TravelTime=${travelTime.toFixed(0)}ms`);
        return travelTime;
    }

    // Create long-range ship animation with visual tracking line
    createLongRangeShipAnimation(fromTerritory, toTerritory, fleetSize) {
        const player = this.players[fromTerritory.ownerId];
        const playerColor = player ? player.color : '#ffffff';
        
        // Calculate distance-based duration
        const distance = Math.sqrt(
            Math.pow(toTerritory.x - fromTerritory.x, 2) + 
            Math.pow(toTerritory.y - fromTerritory.y, 2)
        );
        const animationDuration = this.calculateLongRangeAnimationDuration(fromTerritory, toTerritory);
        
        console.log(`🚀 Creating long-range ship animation: ${fromTerritory.id} -> ${toTerritory.id}, fleet size: ${fleetSize}, color: ${playerColor}`);
        console.log(`🚀 Distance: ${distance.toFixed(1)}px, Duration: ${animationDuration/1000}s (${GAME_CONSTANTS.LONG_RANGE_BASE_SPEED}px/s)`);
        console.log(`🚀 FROM Territory coordinates: (${fromTerritory.x}, ${fromTerritory.y})`);
        console.log(`🚀 TO Territory coordinates: (${toTerritory.x}, ${toTerritory.y})`);
        
        // Create ship animation with long-range properties
        const animation = this.animationSystem.getPooledShipAnimation();
        if (animation) {
            animation.from = { x: fromTerritory.x, y: fromTerritory.y };
            animation.to = { x: toTerritory.x, y: toTerritory.y };
            animation.progress = 0;
            animation.duration = animationDuration; // Distance-based duration
            animation.startTime = Date.now(); // Critical: set start time for timestamp-based progress
            animation.color = playerColor;
            animation.isAttack = true;
            animation.isLongRange = true; // Mark as long-range
            animation.armyCount = fleetSize; // Store army count for display
            animation.targetTerritory = toTerritory; // Store target for dotted line
            animation.fromOwnerId = fromTerritory.ownerId; // Track attacking player for AI limits
            animation.isActive = true; // Ensure it's marked as active
            
            console.log(`🚀 Animation object created with: from(${animation.from.x}, ${animation.from.y}) to(${animation.to.x}, ${animation.to.y}), duration: ${animationDuration}ms`);
            
            this.animationSystem.shipAnimations.push(animation);
            console.log(`✅ Long-range animation added. Total animations: ${this.animationSystem.shipAnimations.length}`);
        } else {
            console.log(`❌ Failed to get pooled animation for long-range attack`);
        }
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
    
    // Update probes (disabled - probe system inactive)
    updateProbes(deltaTime) {
        // Probe update logic disabled (no active probes)
        // for (let i = this.probes.length - 1; i >= 0; i--) { ... }
    }
    
    // Removed legacy updateLongRangeAttacks method (dead code cleanup - replaced by scheduled combat system)
    
    // Colonize planet when probe arrives
    colonizePlanet(probe) {
        const planet = probe.toTerritory;
        const player = this.players.find(p => p.id === probe.playerId);
        
        if (!planet || !player) return;
        
        // Check if planet is already colonized by another player
        if (planet.ownerId !== player.id) { // Simplified condition (null check redundant)
            console.log(`Probe from ${player.name} destroyed! Planet ${planet.id} already colonized by another player.`);
            return;
        }
        
        console.log(`Probe colonizing planet ${planet.id} for player ${player.name}`);
        
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
    
    // Render ship animations
    renderShipAnimations() {
        this.shipAnimations.forEach(animation => {
            const progress = Math.min(1, animation.progress);
            const eased = this.easeInOutQuad(progress);
            
            const x = animation.fromX + (animation.toX - animation.fromX) * eased;
            const y = animation.fromY + (animation.toY - animation.fromY) * eased;
            
            // Draw ship using player's color
            this.ctx.save();
            this.ctx.fillStyle = animation.playerColor;
            this.ctx.shadowColor = animation.playerColor;
            this.ctx.shadowBlur = 8;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add trail effect
            const trailLength = 5;
            for (let i = 1; i <= trailLength; i++) {
                const trailProgress = Math.max(0, eased - (i * 0.1));
                const trailX = animation.fromX + (animation.toX - animation.fromX) * trailProgress;
                const trailY = animation.fromY + (animation.toY - animation.fromY) * trailProgress;
                
                this.ctx.globalAlpha = (trailLength - i) / trailLength * 0.5;
                this.ctx.beginPath();
                this.ctx.arc(trailX, trailY, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        });
        
        // RENDER LONG-RANGE ATTACKS from AnimationSystem using working coordinate system
        this.renderLongRangeAnimationsFixed();
    }
    
    renderLongRangeAnimationsFixed() {
        if (!this.animationSystem || !this.animationSystem.shipAnimations) return;
        
        // Draw dotted lines for long-range attacks (world coordinates, no manual transformation)
        this.ctx.save();
        this.ctx.setLineDash([8, 8]);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        this.ctx.lineWidth = 2;
        
        for (const animation of this.animationSystem.shipAnimations) {
            if (animation.isLongRange && animation.targetTerritory) {
                this.ctx.beginPath();
                this.ctx.moveTo(animation.from.x, animation.from.y);
                this.ctx.lineTo(animation.targetTerritory.x, animation.targetTerritory.y);
                this.ctx.stroke();
            }
        }
        this.ctx.restore();
        
        // Draw long-range ships (world coordinates, same as territories and other ships)
        for (const animation of this.animationSystem.shipAnimations) {
            if (!animation.isLongRange) continue;
            
            const progress = Math.min(1, animation.progress / animation.duration);
            const eased = this.easeInOutQuad(progress);
            const currentX = animation.from.x + (animation.to.x - animation.from.x) * eased;
            const currentY = animation.from.y + (animation.to.y - animation.from.y) * eased;
            
            // Debug long-range ship position occasionally
            if (Math.random() < 0.05) {
                console.log(`🚀 LONG-RANGE SHIP: World pos (${currentX.toFixed(1)}, ${currentY.toFixed(1)}) Progress: ${(progress*100).toFixed(1)}%`);
            }
            
            this.ctx.save();
            this.ctx.fillStyle = animation.color;
            this.ctx.strokeStyle = animation.color;
            this.ctx.shadowColor = animation.color;
            this.ctx.shadowBlur = 8;
            
            // Calculate ship direction angle
            const dx = animation.to.x - animation.from.x;
            const dy = animation.to.y - animation.from.y;
            const angle = Math.atan2(dy, dx);
            
            // Draw ship shape (triangle pointing in direction of travel)
            this.ctx.translate(currentX, currentY);
            this.ctx.rotate(angle);
            
            this.ctx.beginPath();
            this.ctx.moveTo(12, 0);      // Ship nose (pointing right before rotation)
            this.ctx.lineTo(-8, -6);     // Left wing
            this.ctx.lineTo(-5, 0);      // Back center
            this.ctx.lineTo(-8, 6);      // Right wing
            this.ctx.closePath();
            this.ctx.fill();
            
            // Add ship outline
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.restore();
            
            // Draw army count above ship
            if (animation.armyCount) {
                this.ctx.save();
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 3;
                this.ctx.strokeText(`${animation.armyCount}`, currentX, currentY - 18);
                this.ctx.fillText(`${animation.armyCount}`, currentX, currentY - 18);
                this.ctx.restore();
            }
        }
    }
    
    // Render probes
    renderProbes() {
        // Probe rendering disabled (no active probes)
        // this.probes.forEach(probe => { probe.render(this.ctx); });
    }
    
    // Render long-range attacks (slow-moving ships crossing the map)
    // Removed legacy renderLongRangeAttacks method (dead code cleanup - now handled by ship animation system)
    _removedRenderLongRangeAttacks() {
        // Dead code cleanup - this method was replaced by the ship animation system
        
        this.longRangeAttacks.forEach(attack => {
            // Use same rendering approach as regular ship animations (no manual camera transformation)
            this.ctx.save();
            
            // Draw the long-range attack ship (larger than normal ships)
            this.ctx.fillStyle = attack.playerColor;
            this.ctx.shadowColor = attack.playerColor;
            this.ctx.shadowBlur = 12;
            
            this.ctx.beginPath();
            this.ctx.arc(attack.x, attack.y, 6, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add glowing trail effect
            const trailLength = 8;
            for (let i = 1; i <= trailLength; i++) {
                const trailDistance = i * 8; // Longer trail
                const trailX = attack.x - (attack.direction.x * trailDistance);
                const trailY = attack.y - (attack.direction.y * trailDistance);
                
                this.ctx.globalAlpha = (trailLength - i) / trailLength * 0.6;
                this.ctx.beginPath();
                this.ctx.arc(trailX, trailY, 4 - (i * 0.4), 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // Draw fleet size indicator next to the ship
            this.ctx.globalAlpha = 1;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            
            const fleetText = `${attack.fleetSize}`;
            this.ctx.strokeText(fleetText, attack.x, attack.y - 15);
            this.ctx.fillText(fleetText, attack.x, attack.y - 15);
            
            this.ctx.restore();
        });
    }
    
    renderFloatingDiscoveryTexts() {
        if (!this.floatingDiscoveryTexts || this.floatingDiscoveryTexts.length === 0) return;
        
        this.ctx.save();
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        
        this.floatingDiscoveryTexts.forEach(text => {
            const now = Date.now();
            const age = now - text.startTime;
            const progress = age / text.duration;
            
            // Calculate opacity (fade out in the last 25% of duration)
            let opacity = 1;
            if (progress > 0.75) {
                opacity = 1 - ((progress - 0.75) / 0.25);
            }
            
            // Only render if text is within camera view
            const screenPos = this.camera.worldToScreen(text.x, text.y);
            if (screenPos.x >= -100 && screenPos.x <= this.canvas.width + 100 &&
                screenPos.y >= -100 && screenPos.y <= this.canvas.height + 100) {
                
                // Draw background
                this.ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.8})`;
                const textWidth = this.ctx.measureText(text.text).width;
                this.ctx.fillRect(screenPos.x - textWidth/2 - 15, screenPos.y - 15, textWidth + 30, 20);
                
                // Draw border
                this.ctx.strokeStyle = text.color;
                this.ctx.globalAlpha = opacity;
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(screenPos.x - textWidth/2 - 15, screenPos.y - 15, textWidth + 30, 20);
                
                // Draw icon
                this.ctx.fillStyle = text.color;
                this.ctx.fillText(text.icon, screenPos.x - textWidth/2 - 5, screenPos.y - 2);
                
                // Draw text
                this.ctx.fillStyle = text.color;
                this.ctx.fillText(text.text, screenPos.x + 10, screenPos.y - 2);
            }
        });
        
        this.ctx.restore();
    }
    
    // Easing function for smooth animation
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    setupCanvas() {
        // Create canvas element
        const canvasElement = document.createElement('canvas');
        canvasElement.id = 'gameCanvas';
        
        // Get device pixel ratio for crisp rendering on high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = { width: window.innerWidth, height: window.innerHeight };
        
        // Set canvas size with DPI scaling
        canvasElement.width = rect.width * dpr;
        canvasElement.height = rect.height * dpr;
        canvasElement.style.width = rect.width + 'px';
        canvasElement.style.height = rect.height + 'px';
        canvasElement.style.display = 'block';
        canvasElement.style.background = '#1a1a2e';
        canvasElement.style.position = 'fixed';
        canvasElement.style.top = '0';
        canvasElement.style.left = '0';
        canvasElement.style.zIndex = '1';
        
        console.log(`Creating canvas: ${rect.width}x${rect.height} (${canvasElement.width}x${canvasElement.height} with DPR ${dpr})`);
        
        // Append to root without destroying React content
        const root = document.getElementById('root');
        if (root) {
            // Check if canvas already exists
            const existingCanvas = document.getElementById('gameCanvas');
            if (existingCanvas) {
                existingCanvas.remove();
            }
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
        
        // Scale context to match device pixel ratio for crisp rendering
        this.ctx.scale(dpr, dpr);
        
        // Store DPI ratio for resize handling
        this.devicePixelRatio = dpr;
        
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
        
        // Window events for DOM optimization
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('scroll', this.invalidateCanvasRectCache.bind(this));
        
        // Initialize canvas rect cache
        this.getCachedCanvasRect();
        
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
    
    /**
     * Handle window resize events with DOM cache invalidation
     */
    handleResize() {
        if (!this.canvas) return;
        
        // Get device pixel ratio for crisp rendering on high-DPI displays
        const dpr = this.devicePixelRatio || window.devicePixelRatio || 1;
        const rect = { width: window.innerWidth, height: window.innerHeight };
        
        // Set canvas size with DPI scaling
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Re-scale context after resize
        this.ctx.scale(dpr, dpr);
        
        if (this.camera) {
            // Camera uses logical pixels, not physical pixels
            this.camera.updateViewport(rect.width, rect.height);
        }
        
        // Invalidate canvas rect cache after resize
        this.invalidateCanvasRectCache();
        
        console.log(`Resized canvas: ${rect.width}x${rect.height} (${this.canvas.width}x${this.canvas.height} with DPR ${dpr})`);
    }
    
    /**
     * Throttled mouse move handler - called via the throttling system
     * @param {number} x - Canvas-relative X coordinate
     * @param {number} y - Canvas-relative Y coordinate
     * @param {MouseEvent} event - Original mouse event
     */
    handleMouseMoveThrottled(x, y, event) {
        // Update mouse position for other systems
        this.mousePos = { x, y };
        
        // Update hovered territory without expensive DOM operations
        const worldPos = this.camera.screenToWorld(x, y);
        this.updateHoveredTerritory(worldPos.x, worldPos.y);
        
        // Handle camera edge panning for desktop
        if (!(this.isDragging || this.isMultiTouch)) { // Consolidated negative conditions using De Morgan's law
            this.camera.updateEdgePanning(x, y, 16); // 16ms frame time approximation
        }
    }
    
    startGame() {
        console.log('Starting Star Throne game with config:', this.config);
        
        // Initialize background systems immediately  
        this.animationSystem.initializeStarfield();
        this.uiManager.loadBackgroundImage();
        this.showMessage('Generating galaxy map, please wait...', 15000);
        
        try {
            // Generate map using the sophisticated algorithm
            this.gameMap.generateTerritories(this.config.mapSize);
            this.gameMap.buildSpatialIndex();
            this.log('Spatial index built for optimized territory lookups', 'info');
            
            // Update camera bounds after map generation
            this.camera.mapWidth = this.gameMap.width;
            this.camera.mapHeight = this.gameMap.height;
            console.log(`🎥 Camera bounds updated: ${this.camera.mapWidth} x ${this.camera.mapHeight} with ${this.camera.boundaryPadding}px padding`);

            // Create players: 1 human + configured AI count
            const requestedAI = this.config.aiCount || GAME_CONSTANTS.DEFAULT_SINGLE_PLAYER_AI_COUNT;
            const totalPlayers = 1 + requestedAI;
            console.log(`🔍 PLAYER COUNT DEBUG: config.aiCount = ${this.config.aiCount}, requestedAI = ${requestedAI}, totalPlayers = ${totalPlayers}`);
            this.createPlayers(totalPlayers);
            
            // Update human player name from config
            if (this.humanPlayer) {
                this.humanPlayer.name = this.config.playerName;
            }
            
            // Distribute initial territories to give each player a throne star
            this.distributeStartingTerritories();

            // Center camera on the human player's starting system
            if (this.humanPlayer && this.humanPlayer.territories.length > 0) {
                const startId = this.humanPlayer.territories[0];
                const startTerritory = this.gameMap.territories[startId];
                this.camera.centerOn(startTerritory.x, startTerritory.y);
            }

            this.gameState = 'playing';
            
            // Consolidated duplicate starfield initialization (dead code eliminated)
            
            // Start home system flashing for player identification
            this.homeSystemFlashStart = Date.now();
            
            this.gameInitialized = true;
            console.log('🕐 Running initial throne star validation...');
            this.validateThroneStars();
            console.log(`Game started with ${this.players.length} players (${this.config.playerName} + ${this.config.aiCount} AI) and ${Object.keys(this.gameMap.territories).length} territories`);
            
            // Hide loading message
            this.hideMessage();
        } catch (error) {
            console.error('Failed to generate galaxy map:', error);
            this.showMessage('Map generation failed. Please try again.', 5000);
        }
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
        console.log(`🔍 CREATE PLAYERS DEBUG: Creating ${numPlayers} total players (1 human + ${numPlayers-1} AI)`);
        
        // Clear any existing players to prevent duplicates
        this.players = [];
        this.humanPlayer = null;
        
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
        
        // Create exactly one human player with distinctive bright cyan color
        this.humanPlayer = new Player(0, 'You', '#00ffff', 'human');
        this.players.push(this.humanPlayer);
        console.log(`🔍 HUMAN PLAYER CREATED: ID=${this.humanPlayer.id}, type=${this.humanPlayer.type}, total players now: ${this.players.length}`);
        // Consolidated duplicate initialization call
        
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
            const aiName = AIManager.generateAIName(i - 1);
            const aiPlayer = new Player(i, aiName, playerColor, 'ai');
            this.players.push(aiPlayer);
            // Consolidated duplicate initialization call
        }
        
        this.currentPlayers = this.players.length;
        console.log(`🔍 CREATED PLAYERS: Total ${this.players.length} players`);
        console.log(`🔍 PLAYER BREAKDOWN: Human: ${this.players.filter(p => p.type === 'human').length}, AI: ${this.players.filter(p => p.type === 'ai').length}`);
        
        // Consolidated player discovery initialization (duplicate calls eliminated)
        this.players.forEach(player => {
            this.initializePlayerDiscoveries(player.id);
        });
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
        
        console.log(`Available territories for distribution: ${allTerritories.length} (all have neutral garrisons)`);
        
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
                // Colonize this territory for the player (defeating the neutral garrison)
                bestTerritory.ownerId = player.id;
                bestTerritory.armySize = GAME_CONSTANTS.INITIAL_STARTING_ARMY_SIZE;
                bestTerritory.isThronestar = true; // Mark as throne star
                
                console.log(`🏠 Starting territory ${bestTerritory.id} for ${player.name}: ${GAME_CONSTANTS.INITIAL_STARTING_ARMY_SIZE} armies`);
                
                // Debug: Track army changes for human player
                if (player.id === 0) { // Human player ID
                    console.log(`👤 HUMAN PLAYER starting territory ${bestTerritory.id} initialized with ${bestTerritory.armySize} armies`);
                }
                
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
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Game state:', this.gameState);
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
        
        // Always update human player every frame for responsiveness
        const humanPlayer = this.players.find(p => p.type === 'human');
        if (humanPlayer && !humanPlayer.isEliminated) {
            try {
                humanPlayer.update(deltaTime, this.gameMap, this.config.gameSpeed, this);
            } catch (error) {
                console.error(`Error updating human player:`, error);
            }
        }
        
        // Delegate AI updates to AIManager for performance and organization
        if (this.aiManager) {
            this.aiManager.updateAI(deltaTime);
        }
        
        // Process any pending throttled mouse events
        this.processPendingMouseEvent();
        
        // Update input handler for FSM timeouts
        if (this.inputHandler) {
            this.inputHandler.update();
        }
        
        // Update ship animations and probes with normal delta time (speed applied internally)
        try {
            // Update AnimationSystem (new modular system for long-range attacks)
            if (this.animationSystem) {
                this.animationSystem.updateShipAnimations(deltaTime);
            }
            
            // Update legacy ship animations (for backwards compatibility)
            this.updateShipAnimations(deltaTime);
            this.updateProbes(deltaTime);
            // Removed updateLongRangeAttacks call (dead code cleanup - now using scheduled combat system)
            this.updateFloatingDiscoveryTexts(deltaTime);
            
            // Process pending long-range combat arrivals
            this.processLongRangeCombatArrivals();
        } catch (error) {
            console.error('Error updating animations:', error);
        }
        
        // Update combat system for delayed battles
        if (this.combatSystem) {
            try {
                this.combatSystem.update(deltaTime);
            } catch (error) {
                console.error('Combat system error:', error);
                console.error('Combat system error message:', error.message);
                console.error('Combat system error stack:', error.stack);
            }
        }
        
        // Update modular UI systems
        if (this.uiManager) {
            this.uiManager.update(deltaTime);
        }
        if (this.discoverySystem) {
            this.discoverySystem.updateFloatingDiscoveries();
            this.discoverySystem.updateTopDiscoveryAnnouncements();
        }
        if (this.animationSystem) {
            this.animationSystem.update(deltaTime);
        }
        if (this.controls) {
            this.controls.update(deltaTime);
        }
        
        // Process event queue for event-driven architecture
        if (this.eventProcessingEnabled) {
            gameEvents.processQueue(5); // Process up to 5 events per frame
        }
        
        // Periodically update throne connectivity
        this.updateThroneConnectivity();
        
        // Update performance management and track frame metrics
        if (this.performanceManager) {
            this.performanceManager.frameMetrics.updateTime = performance.now() - updateStart;
            this.performanceManager.update(deltaTime);
            
            // Trigger memory cleanup if memory usage is high
            if (this.performanceManager.getMemoryUsageMB() > 250) {
                this.performanceManager.triggerMemoryCleanup();
            }
        }
        
        // Throttled heavy operations for better performance - use SupplySystem module
        if (this.frameCount % 45 === 0) { // Every 45 frames (~0.75 seconds)
            this.supplySystem.validateSupplyRoutes();
        }
        // (Removed redundant 90-frame check; supply logic now in Territory.generateArmies())
        
        // Validate throne stars every 5 seconds to fix double throne bugs
        this.throneStarValidationTimer += deltaTime;
        if (this.throneStarValidationTimer >= 5000) {
            console.log('🕐 Running throne star validation...');
            this.validateThroneStars();
            this.throneStarValidationTimer = 0;
        }
        
        // MANUAL DEBUG: Run validation every 60 frames for debugging
        if (this.frameCount % 60 === 0) {
            console.log(`🔍 DEBUG: AI players: ${this.players.filter(p => p.type === 'ai').length}, Human players: ${this.players.filter(p => p.type === 'human').length}, Total: ${this.players.length}`);
            this.validateThroneStars();
        }
        
        // Check for player elimination (throttled)
        if (this.frameCount % 20 === 0) {
            this.checkPlayerElimination();
        }
        
        // Check win conditions (throttled) - only after game is properly initialized
        if (this.gameInitialized && this.frameCount % 30 === 0) {
            this.checkWinConditions();
        }
        
        // Update camera with edge panning
        this.camera.update(deltaTime);
        
        // Edge panning when mouse is near screen edges (desktop only)
        if (this.mousePos && !(this.isDragging || this.isMultiTouch)) { // Consolidated negative conditions using De Morgan's law
            this.camera.updateEdgePanning(this.mousePos.x, this.mousePos.y, deltaTime);
        }
        
        // Track performance
        this.performanceStats.updateTime = performance.now() - updateStart;
    }
    
    checkPlayerElimination() {
        let playersEliminated = false;
        
        this.players.forEach(player => {
            if (!player.isEliminated && player.territories.length === 0) {
                player.isEliminated = true;
                playersEliminated = true;
                console.log(`Player ${player.name} has been eliminated!`);
                
                if (player === this.humanPlayer) {
                    console.log('You have been eliminated! Entering spectator mode.');
                    // Removed obsolete TODO comment (no effect on runtime)
                }
            }
        });
        
        // Invalidate AI player cache if any players were eliminated
        if (playersEliminated && this.aiManager) {
            this.aiManager.invalidatePlayerCache();
        }
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
        
        // Render parallax starfield behind everything via AnimationSystem (before camera transform)
        if (this.animationSystem) {
            this.animationSystem.renderStaticBackground(this.ctx);
        }
        
        // Save context for camera transform
        this.ctx.save();
        
        // Apply camera transformation
        this.camera.applyTransform(this.ctx);
        
        // Render game world with Level of Detail (LOD) optimizations
        const lodLevel = this.getLODLevel();
        
        this.renderNebulas();
        this.renderTerritories();
        
        // Render connections based on LOD level
        if (lodLevel >= 2) {
            this.renderConnections();
        }
        
        // Render supply routes for operational and tactical view
        if (lodLevel >= 2) {
            this.renderSupplyRoutes();
        }
        
        this.renderDragPreview();
        this.renderProportionalDragUI();
        this.renderTransferPreview();
        
        // Ship animations and probes for tactical view
        if (lodLevel >= 2) {
            // Use AnimationSystem for ship animations
            if (this.animationSystem) {
                this.animationSystem.renderShipAnimations(this.ctx, this.camera);
            }
            // this.renderProbes(); // Probe rendering disabled
        }
        
        // Use DiscoverySystem for floating discovery texts
        if (this.discoverySystem) {
            this.discoverySystem.renderFloatingDiscoveries(this.ctx, this.camera);
        }
        this.renderArmies();
        this.renderFloatingTexts();
        
        // Restore context
        this.ctx.restore();
        
        // Render UI (not affected by camera)
        this.renderUI();
        
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
    
    updateVisibleTerritories() {
        // Enhanced viewport culling with incremental processing for smooth performance
        const now = Date.now();
        const updateInterval = GAME_CONSTANTS.VISIBLE_TERRITORIES_UPDATE_INTERVAL_MS;
        
        // Adaptive interval based on performance - increase on slower devices
        const adaptiveInterval = this.fps < 30 ? updateInterval * 1.5 : updateInterval;
        
        if (now - this.lastVisibilityUpdate < adaptiveInterval) return;
        this.lastVisibilityUpdate = now;
        
        const bounds = this.camera.getViewBounds();
        const margin = GAME_CONSTANTS.TERRITORY_VISIBILITY_PADDING;
        
        // Initialize visibility tracking as Set for O(1) lookups
        if (!this.visibleTerritories || !this.visibleTerritories.has) {
            this.visibleTerritories = new Set();
        }
        
        this.visibleTerritories.clear();
        const territories = Object.values(this.gameMap.territories);
        
        // Incremental processing: split territory checks across multiple frames on large maps
        const batchSize = territories.length > 200 ? Math.ceil(territories.length / 3) : territories.length;
        const startIndex = (this.cullingBatchIndex || 0) % territories.length;
        const endIndex = Math.min(startIndex + batchSize, territories.length);
        
        // Process current batch
        for (let i = startIndex; i < endIndex; i++) {
            const territory = territories[i];
            if (territory.x + territory.radius >= bounds.left - margin &&
                territory.x - territory.radius <= bounds.right + margin &&
                territory.y + territory.radius >= bounds.top - margin &&
                territory.y - territory.radius <= bounds.bottom + margin) {
                this.visibleTerritories.add(territory.id);
            }
        }
        
        // Update batch index for next frame (if processing incrementally)
        if (batchSize < territories.length) {
            this.cullingBatchIndex = endIndex >= territories.length ? 0 : endIndex;
        }
        
        this.performanceStats.visibleTerritories = this.visibleTerritories.size;
    }
    
    // Render parallax starfield with multiple depth layers
    renderParallaxStarfield() {
        if (!this.starfield.initialized) return;
        
        const time = Date.now() * 0.001; // For subtle twinkling
        const cameraPosX = this.camera.x;
        const cameraPosY = this.camera.y;
        
        this.ctx.save();
        
        // Far stars (slowest parallax, barely moves)
        this.ctx.globalAlpha = 0.7; // Brighter for better visibility against background
        this.starfield.farStars.forEach(star => {
            // Very subtle parallax movement (5% of camera movement)
            const parallaxX = star.x - (cameraPosX * 0.05);
            const parallaxY = star.y - (cameraPosY * 0.05);
            
            // Skip stars outside visible area for performance
            if (!this.camera.isPointVisible(parallaxX, parallaxY, 100)) return;
            
            // Subtle twinkling effect
            const twinkle = star.twinkle + Math.sin(time * 0.5 + star.x * 0.01) * 0.1;
            this.ctx.globalAlpha = star.brightness * twinkle * 0.7;
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(parallaxX, parallaxY, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Mid stars (moderate parallax)
        this.ctx.globalAlpha = 0.8;
        this.starfield.midStars.forEach(star => {
            // Moderate parallax movement (15% of camera movement)
            const parallaxX = star.x - (cameraPosX * 0.15);
            const parallaxY = star.y - (cameraPosY * 0.15);
            
            if (!this.camera.isPointVisible(parallaxX, parallaxY, 100)) return;
            
            const twinkle = star.twinkle + Math.sin(time * 0.8 + star.x * 0.02) * 0.15;
            this.ctx.globalAlpha = star.brightness * twinkle * 0.8;
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(parallaxX, parallaxY, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Near stars (most parallax movement)
        this.ctx.globalAlpha = 1.0;
        this.starfield.nearStars.forEach(star => {
            // Stronger parallax movement (30% of camera movement)
            const parallaxX = star.x - (cameraPosX * 0.3);
            const parallaxY = star.y - (cameraPosY * 0.3);
            
            if (!this.camera.isPointVisible(parallaxX, parallaxY, 100)) return;
            
            const twinkle = star.twinkle + Math.sin(time * 1.2 + star.x * 0.03) * 0.2;
            this.ctx.globalAlpha = star.brightness * twinkle * 1.0;
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(parallaxX, parallaxY, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.restore();
    }
    
    renderNebulas() {
        if (!this.gameMap.nebulas) return;
        
        this.ctx.save();
        
        // Render each nebula as a purple cloud
        this.gameMap.nebulas.forEach(nebula => {
            // Create radial gradient for cloud effect
            const gradient = this.ctx.createRadialGradient(
                nebula.x, nebula.y, 0,
                nebula.x, nebula.y, nebula.radius
            );
            
            gradient.addColorStop(0, `rgba(147, 51, 234, ${nebula.opacity})`);
            gradient.addColorStop(0.5, `rgba(147, 51, 234, ${nebula.opacity * 0.6})`);
            gradient.addColorStop(1, 'rgba(147, 51, 234, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.restore();
    }
    
    renderTerritories() {
        this.updateVisibleTerritories();
        
        // Get current selected territory from input handler
        const inputState = this.inputHandler ? this.inputHandler.getInputState() : {};
        const selectedTerritory = inputState.selectedTerritory;
        
        // Render only visible territories
        for (const territoryId of this.visibleTerritories) {
            const territory = this.gameMap.territories[territoryId];
            if (territory) {
                territory.render(this.ctx, this.players, selectedTerritory, {
                    humanPlayer: this.humanPlayer,
                    homeSystemFlashStart: this.homeSystemFlashStart,
                    homeSystemFlashDuration: this.homeSystemFlashDuration,
                    gameMap: this.gameMap, // Include game map for fog of war logic
                    isDisconnectedFromThrone: (territoryId) => this.isDisconnectedFromThrone(territoryId)
                }, this.hoveredTerritory);
            }
        }
    }
    
    renderConnections() {
        this.ctx.lineWidth = 4;
        this.ctx.globalAlpha = 0.7;
        
        // Cache connections to avoid duplicate rendering
        const drawnConnections = new Set();
        
        // Use visible territories for optimized rendering
        const territoriesToCheck = this.visibleTerritories && this.visibleTerritories.size > 0 
            ? Array.from(this.visibleTerritories).map(id => this.gameMap.territories[id]).filter(t => t)
            : Object.values(this.gameMap.territories);
        
        territoriesToCheck.forEach(territory => {
            territory.neighbors.forEach(neighborId => {
                const neighbor = this.gameMap.territories[neighborId];
                if (!neighbor) return;
                
                // Create unique connection ID (smaller ID first)
                const connectionId = territory.id < neighborId 
                    ? `${territory.id}-${neighborId}` 
                    : `${neighborId}-${territory.id}`;
                
                if (drawnConnections.has(connectionId)) return;
                drawnConnections.add(connectionId);
                
                // SHOW ALL STAR LANES: Display all connections for better visibility
                const territoryOwnedByPlayer = territory.ownerId === this.humanPlayer?.id;
                const neighborOwnedByPlayer = neighbor.ownerId === this.humanPlayer?.id;
                const laneDiscovered = this.discoveredLanes.has(connectionId);
                
                // Removed commented-out fog of war code (dead code cleanup)
                
                // Add newly visible lanes to permanent discovery
                if ((territoryOwnedByPlayer || neighborOwnedByPlayer) && !laneDiscovered) {
                    this.discoveredLanes.add(connectionId);
                    console.log(`🗺️ Star lane discovered: ${territory.id} ↔ ${neighborId}`);
                }
                
                // Set color based on ownership
                if (territory.ownerId !== null && 
                    neighbor.ownerId !== null && 
                    territory.ownerId === neighbor.ownerId) {
                    const owner = this.players[territory.ownerId];
                    this.ctx.strokeStyle = owner ? owner.color : '#666677';
                } else {
                    this.ctx.strokeStyle = '#666677';
                }
                
                this.ctx.beginPath();
                this.ctx.moveTo(territory.x, territory.y);
                this.ctx.lineTo(neighbor.x, neighbor.y);
                this.ctx.stroke();
            });
        });
        
        this.ctx.globalAlpha = 1;
    }
    
    renderSupplyRoutes() {
        // Delegate to SupplySystem module for rendering
        this.supplySystem.renderSupplyRoutes(this.ctx, this.gameMap.territories);
    }
    
    // Render active long-range attacks with dotted lines and moving army counts
    renderLongRangeAttacks() {
        if (!this.longRangeAttacks || this.longRangeAttacks.length === 0) {
            // No long-range attacks to render
            return;
        }
        
        this.ctx.save();
        this.ctx.strokeStyle = "#FFFFFF";
        this.ctx.lineWidth = 2;
        
        // Use a dashed line style for long-range attack paths
        if (this.ctx.setLineDash) {
            this.ctx.setLineDash([5, 5]);
        }
        
        for (let i = this.longRangeAttacks.length - 1; i >= 0; i--) {
            const attack = this.longRangeAttacks[i];
            
            // Source and target territory center coordinates
            const sx = attack.source.x || attack.source.centerX;
            const sy = attack.source.y || attack.source.centerY;
            const tx = attack.target.x || attack.target.centerX;
            const ty = attack.target.y || attack.target.centerY;
            
            // Draw a dotted line from source to target
            this.ctx.beginPath();
            this.ctx.moveTo(sx, sy);
            this.ctx.lineTo(tx, ty);
            this.ctx.stroke();
            
            // Determine current fleet position (progress 0.0 to 1.0)
            const p = Math.min(1, (attack.progress != null) ? attack.progress : 0);
            const fx = sx + (tx - sx) * p;
            const fy = sy + (ty - sy) * p;
            
            // Draw the floating army count at the fleet's position
            const num = attack.count || attack.armyCount || attack.armies;
            if (num != null) {
                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.strokeStyle = "#000000";
                this.ctx.lineWidth = 3;
                this.ctx.font = "bold 16px sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.strokeText(String(num), fx, fy);
                this.ctx.fillText(String(num), fx, fy);
            }
            
            // Clean up the attack if it has reached the target
            if (p >= 1) {
                this.longRangeAttacks.splice(i, 1);
            }
        }
        
        this.ctx.restore();
    }
    
    getTransferPercentage(event) {
        // Default to 50% transfer
        if (!event) return 0.5;
        
        // Modifier key controls for different transfer amounts
        if (event.shiftKey) return 0.95; // Send almost all (leave 1)
        if (event.ctrlKey) return 0.25;  // Send quarter
        return 0.5; // Default 50%
    }
    
    renderDragPreview() {
        // Show drag preview when creating supply route
        if (this.isDraggingForSupplyRoute && this.dragStart) {
            const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
            const targetTerritory = this.findTerritoryAt(worldPos.x, worldPos.y);
            
            this.ctx.save();
            
            // Color-coded preview based on target validity
            if (targetTerritory && targetTerritory.ownerId === this.humanPlayer?.id && 
                targetTerritory.id !== this.dragStart.id) {
                this.ctx.strokeStyle = '#00ff00'; // Green for valid supply route target
                this.ctx.lineWidth = 3;
            } else {
                this.ctx.strokeStyle = '#ffff00'; // Yellow for neutral/unknown target
                this.ctx.lineWidth = 2;
            }
            
            this.ctx.globalAlpha = 0.8;
            this.ctx.setLineDash([5, 5]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.dragStart.x, this.dragStart.y);
            this.ctx.lineTo(worldPos.x, worldPos.y);
            this.ctx.stroke();
            
            this.ctx.restore();
        }
    }
    
    renderProportionalDragUI() {
        if (!this.isProportionalDrag || !this.proportionalDragStart) return;
        
        this.ctx.save();
        
        const territory = this.proportionalDragStart.territory;
        const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const targetTerritory = this.findTerritoryAt(worldPos.x, worldPos.y);
        
        // Draw radial percentage indicator around source territory
        const radius = territory.radius + 15;
        const percentage = this.fleetPercentage;
        
        // Background circle
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.arc(territory.x, territory.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Percentage arc
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (percentage * Math.PI * 2);
        
        // Color based on percentage
        let color = '#44ff44'; // Green for low
        if (percentage > 0.7) color = '#ff4444'; // Red for high
        else if (percentage > 0.4) color = '#ffaa00'; // Orange for medium
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.arc(territory.x, territory.y, radius, startAngle, endAngle);
        this.ctx.stroke();
        
        // Calculate ships to send
        const availableShips = Math.max(0, territory.armySize - 1);
        const shipsToSend = Math.max(1, Math.floor(availableShips * percentage));
        const remaining = territory.armySize - shipsToSend;
        
        // Display text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        
        // Sending text
        const sendText = `Send: ${shipsToSend}`;
        this.ctx.strokeText(sendText, territory.x, territory.y - 8);
        this.ctx.fillText(sendText, territory.x, territory.y - 8);
        
        // Remaining text
        const remainText = `Keep: ${remaining}`;
        this.ctx.strokeText(remainText, territory.x, territory.y + 8);
        this.ctx.fillText(remainText, territory.x, territory.y + 8);
        
        // Draw drag line to target
        if (targetTerritory) {
            // Color based on action type
            let lineColor = '#666666';
            if (targetTerritory.ownerId === this.humanPlayer?.id) {
                lineColor = '#44ff44'; // Green for transfer
            } else if (targetTerritory.isColonizable) {
                lineColor = '#ffff00'; // Yellow for probe
            } else {
                lineColor = '#ff4444'; // Red for attack
            }
            
            this.ctx.strokeStyle = lineColor;
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 4]);
            this.ctx.beginPath();
            this.ctx.moveTo(territory.x, territory.y);
            this.ctx.lineTo(worldPos.x, worldPos.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        this.ctx.restore();
    }
    
    renderTransferPreview() {
        // Show fleet allocation preview when hovering over targets during selection
        if (!this.selectedTerritory || !this.hoveredTerritory || 
            this.selectedTerritory.id === this.hoveredTerritory.id ||
            this.selectedTerritory.ownerId !== this.humanPlayer?.id ||
            this.isProportionalDrag) { // Don't show during proportional drag
            return;
        }
        
        const from = this.selectedTerritory;
        const to = this.hoveredTerritory;
        
        // Only show preview for valid targets (neighbors or colonizable)
        const isValidTarget = from.neighbors.includes(to.id) || to.isColonizable;
        if (!isValidTarget) return;
        
        // Determine transfer percentage based on target type
        let transferPercentage = 0.5; // Default 50%
        if (to.ownerId === this.humanPlayer?.id) {
            transferPercentage = 0.5; // Transfer to own territory
        } else if (to.isColonizable) {
            transferPercentage = Math.min(1.0, 10 / from.armySize); // Probe cost (10 ships or all if less)
        } else {
            transferPercentage = 0.75; // Attack enemy territory
        }
        
        // Calculate amounts
        const availableShips = Math.max(0, from.armySize - 1);
        const shipsToSend = Math.min(availableShips, Math.max(1, Math.floor(from.armySize * transferPercentage)));
        const remaining = from.armySize - shipsToSend;
        
        // Convert to screen coordinates for UI display
        const screenPos = this.camera.worldToScreen(to.x, to.y);
        
        this.ctx.save();
        
        // Background for readability
        const padding = 8;
        const lineHeight = 16;
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'left';
        
        const sendText = `Send: ${shipsToSend}`;
        const keepText = `Keep: ${remaining}`;
        const maxWidth = Math.max(this.ctx.measureText(sendText).width, this.ctx.measureText(keepText).width);
        
        const bgX = screenPos.x + 20;
        const bgY = screenPos.y - 25;
        const bgWidth = maxWidth + padding * 2;
        const bgHeight = lineHeight * 2 + padding;
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        
        // Border with action-specific color
        let borderColor = '#ffffff';
        if (to.ownerId === this.humanPlayer?.id) {
            borderColor = '#00ff00'; // Green for transfer
        } else if (to.isColonizable) {
            borderColor = '#ffff00'; // Yellow for probe
        } else {
            borderColor = '#ff4444'; // Red for attack
        }
        
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
        
        // Text
        this.ctx.fillStyle = '#00ff00'; // Green for send
        this.ctx.fillText(sendText, bgX + padding, bgY + lineHeight);
        
        this.ctx.fillStyle = '#ffffff'; // White for keep
        this.ctx.fillText(keepText, bgX + padding, bgY + lineHeight * 2);
        
        this.ctx.restore();
    }
    
    renderFloatingTexts() {
        if (!this.floatingTexts) return;
        
        this.ctx.save();
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        
        // Update and render floating texts
        const now = Date.now();
        this.floatingTexts = this.floatingTexts.filter(text => {
            const elapsed = now - text.startTime;
            if (elapsed >= text.duration) return false;
            
            // Calculate animation progress
            const progress = elapsed / text.duration;
            const alpha = 1 - progress;
            const yOffset = progress * 30; // Float upward
            
            // Render text
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = text.color;
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            
            this.ctx.strokeText(text.text, text.x, text.y - yOffset);
            this.ctx.fillText(text.text, text.x, text.y - yOffset);
            
            return true;
        });
        
        this.ctx.restore();
    }
    
    renderArmies() {
        // Dynamic Level of Detail based on camera zoom level
        const zoomLevel = this.camera.getZoomLevel();
        const currentZoom = this.camera.zoom;
        
        // Supply system is now handled by Territory.js render method
        
        this.ctx.save();
        
        // Handle territories: visibleTerritories is a Set of IDs, convert to objects
        let territories;
        if (this.visibleTerritories && this.visibleTerritories.size > 0) {
            territories = Array.from(this.visibleTerritories).map(id => this.gameMap.territories[id]).filter(t => t);
        } else {
            territories = Object.values(this.gameMap.territories);
        }
        
        const playersLookup = {}; // Cache player lookups
        
        // Strategic View (zoomed out) - Show simplified information
        if (zoomLevel === 'strategic') {
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            
            for (let i = 0; i < territories.length; i++) {
                const territory = territories[i];
                if (territory.ownerId !== null) {
                    // FOG OF WAR: Check if this is a mysterious enemy territory
                    const isEnemyMystery = territory.ownerId !== this.humanPlayer?.id && !territory.neighbors.some(neighborId => {
                        const neighbor = this.gameMap.territories[neighborId];
                        return neighbor && neighbor.ownerId === this.humanPlayer?.id;
                    });
                    
                    // Skip army numbers for mysterious enemy territories
                    // if (isEnemyMystery) continue; // SHOW ALL FLEET COUNTS
                    
                    // Use cached player lookup
                    let owner = playersLookup[territory.ownerId];
                    if (!owner) {
                        owner = this.players[territory.ownerId];
                        if (owner) playersLookup[territory.ownerId] = owner;
                    }
                    
                    if (owner && territory.armySize >= 10) { // Only show significant fleets
                        let armyText = territory.armySize >= 100 ? `${Math.floor(territory.armySize / 10)}0+` : territory.armySize.toString();
                        
                        // Add black dot indicator for reinforcing stars
                        if (this.supplySystem?.isSupplySource(territory.id)) {
                            armyText = `● ${armyText}`;
                        }
                        
                        // Simplified text rendering for performance
                        this.ctx.fillStyle = '#ffffff';
                        this.ctx.fillText(armyText, territory.x, territory.y + 3);
                    }
                }
            }
        }
        // Operational View (mid zoom) - Show fleet counts as icons
        else if (zoomLevel === 'operational') {
            this.ctx.font = 'bold 13px Arial';
            this.ctx.textAlign = 'center';
            
            for (let i = 0; i < territories.length; i++) {
                const territory = territories[i];
                if (territory.ownerId !== null && territory.armySize > 0) {
                    // FOG OF WAR: Check if this is a mysterious enemy territory
                    const isEnemyMystery = territory.ownerId !== this.humanPlayer?.id && !territory.neighbors.some(neighborId => {
                        const neighbor = this.gameMap.territories[neighborId];
                        return neighbor && neighbor.ownerId === this.humanPlayer?.id;
                    });
                    
                    // Skip army numbers for mysterious enemy territories
                    // if (isEnemyMystery) continue; // SHOW ALL FLEET COUNTS
                    
                    // Use cached player lookup
                    let owner = playersLookup[territory.ownerId];
                    if (!owner) {
                        owner = this.players[territory.ownerId];
                        if (owner) playersLookup[territory.ownerId] = owner;
                    }
                    
                    if (owner) {
                        let armyText = territory.armySize.toString();
                        
                        // Add black dot indicator for reinforcing stars
                        if (this.supplySystem?.isSupplySource(territory.id)) {
                            armyText = `● ${armyText}`;
                        }
                        
                        // White outline for readability
                        this.ctx.strokeStyle = '#ffffff';
                        this.ctx.lineWidth = 2;
                        this.ctx.strokeText(armyText, territory.x, territory.y + 4);
                        
                        // Color-coded text based on owner
                        this.ctx.fillStyle = owner.id === this.humanPlayer?.id ? '#000000' : '#333333';
                        this.ctx.fillText(armyText, territory.x, territory.y + 4);
                    }
                }
            }
        }
        // Tactical View (zoomed in) - Show full detail
        else {
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            
            for (let i = 0; i < territories.length; i++) {
                const territory = territories[i];
                if (territory.ownerId !== null && territory.armySize > 0) {
                    // FOG OF WAR: Check if this is a mysterious enemy territory
                    const isEnemyMystery = territory.ownerId !== this.humanPlayer?.id && !territory.neighbors.some(neighborId => {
                        const neighbor = this.gameMap.territories[neighborId];
                        return neighbor && neighbor.ownerId === this.humanPlayer?.id;
                    });
                    
                    // Skip army numbers for mysterious enemy territories
                    // if (isEnemyMystery) continue; // SHOW ALL FLEET COUNTS
                    
                    // Use cached player lookup
                    let owner = playersLookup[territory.ownerId];
                    if (!owner) {
                        owner = this.players[territory.ownerId];
                        if (owner) playersLookup[territory.ownerId] = owner;
                    }
                    
                    if (owner) {
                        let armyText = territory.armySize.toString();
                        
                        // Add black dot indicator for reinforcing stars
                        if (this.supplySystem?.isSupplySource(territory.id)) {
                            armyText = `● ${armyText}`;
                        }
                        
                        // Debug logging for specific territories
                        if (territory.id === 79) {
                            console.log(`Star 79 tactical view: supplySystem exists: ${!!this.supplySystem}, isSupplySource: ${this.supplySystem?.isSupplySource(territory.id)}, text: "${armyText}"`);
                        }
                        
                        // High-contrast text with thick outline
                        this.ctx.strokeStyle = '#ffffff';
                        this.ctx.lineWidth = 3;
                        this.ctx.strokeText(armyText, territory.x, territory.y + 5);
                        
                        // Main black text
                        this.ctx.fillStyle = '#000000';
                        this.ctx.fillText(armyText, territory.x, territory.y + 5);
                    }
                }
            }
        }
        
        this.ctx.restore();
    }
    
    render() {
        const startTime = performance.now();
        
        // Clear canvas with dark space background
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render background galaxy image with parallax via UIManager (before camera transform)
        if (this.uiManager) {
            this.uiManager.renderBackgroundImage(this.ctx, this.camera);
        }
        
        // Render parallax starfield with movement via AnimationSystem (before camera transform)
        if (this.animationSystem) {
            this.animationSystem.renderStaticBackground(this.ctx);
        }
        
        // Apply camera transformations for background elements
        this.ctx.save();
        this.camera.applyTransform(this.ctx);
        
        // Render nebulas with proper depth
        this.renderNebulas();
        
        this.ctx.restore();
        
        // Apply camera transformations
        this.ctx.save();
        this.camera.applyTransform(this.ctx);
        
        // Update performance tracking
        this.updateVisibleTerritories();
        
        // Render connections between territories
        this.renderConnections();
        
        // Render supply routes
        this.renderSupplyRoutes();
        
        // Render territories with fleet counts
        this.renderTerritories();
        
        // Render probes (disabled - no active probes)
        // this.renderProbes();
        
        // AnimationSystem rendering is now handled in renderShipAnimations() using working coordinate system
        
        // Render legacy ship animations (for backwards compatibility)
        this.renderShipAnimations();
        
        // Render long-range attacks
        this.renderLongRangeAttacks();
        
        // Proportional drag interface handled by InputHandler
        
        // Selection is handled by Territory render method itself
        
        this.ctx.restore();
        
        // Floating discovery texts disabled - using top-center UI notifications instead
        // this.renderFloatingDiscoveryTexts();
        
        // Render UI overlay
        this.renderUI();
        
        // Update and render performance overlay
        if (this.performanceOverlay) {
            this.performanceOverlay.update();
            this.performanceOverlay.render();
        }
        
        // Update performance stats
        if (this.performanceManager) {
            this.performanceManager.frameMetrics.renderTime = performance.now() - startTime;
        }
        this.performanceStats.renderTime = performance.now() - startTime;
    }
    
    // Removed duplicate renderFloatingDiscoveryTexts method (consolidated with earlier version)
    
    renderUI() {
        if (this.ui) {
            const inputState = this.inputHandler ? this.inputHandler.getInputState() : {};
            
            this.ui.render(this.ctx, {
                gameState: this.gameState,
                gameTimer: this.gameTimer,
                players: this.players,
                humanPlayer: this.humanPlayer,
                selectedTerritory: inputState.selectedTerritory,
                hoveredTerritory: this.inputHandler ? this.inputHandler.hoveredTerritory : null,
                mousePos: this.inputHandler ? this.inputHandler.mousePos : { x: 0, y: 0 },
                fps: this.fps,
                currentPlayers: this.currentPlayers,
                maxPlayers: this.maxPlayers,
                touchDebugInfo: this.touchDebugInfo,
                showTouchDebug: this.showTouchDebug,
                leaderboardMinimized: this.leaderboardMinimized,
                minimapMinimized: this.minimapMinimized,
                camera: this.camera,
                showPerformancePanel: this.showPerformancePanel,
                frameTime: this.performanceStats.frameTime,
                renderTime: this.performanceStats.renderTime,
                updateTime: this.performanceStats.updateTime,
                territoryCount: Object.keys(this.gameMap.territories).length,
                visibleTerritories: this.performanceStats.visibleTerritories,
                // probeCount: this.probes.length, // Probe count disabled (no active probes)
                notifications: this.notifications,
                playerDiscoveries: this.playerDiscoveries,
                // recentProbeResults: this.recentProbeResults, // Probe results disabled
                discoveryLog: this.discoveryLog,
                showBonusPanel: this.showBonusPanel,
                inputState: inputState,
                messageText: this.messageText,
                messageTimer: this.messageTimer,
                combatSystem: this.combatSystem,
                supplySystem: this.supplySystem,
                territories: this.gameMap.territories
            });
        }
        
        // Render UI components via UIManager (notifications, messages)
        if (this.uiManager) {
            this.uiManager.renderNotifications(this.ctx);
            this.uiManager.renderMessage(this.ctx);
        }
        
        // Render top discovery bar
        if (this.discoverySystem) {
            this.discoverySystem.renderTopDiscoveryBar(this.ctx);
        }
    }
    
    // Input handling methods - REMOVED: Mouse handlers moved to InputHandler.js to prevent conflicts
    // All mouse input now processed through InputHandler.js and the finite state machine
    
    updateHoverState(mousePos) {
        const worldPos = this.camera.screenToWorld(mousePos.x, mousePos.y);
        const territory = this.findTerritoryAt(worldPos.x, worldPos.y);
        
        this.hoveredTerritory = territory;
        
        // Determine cursor mode based on selection and hover target
        if (this.selectedTerritory && this.selectedTerritory.ownerId === this.humanPlayer?.id && territory) {
            if (territory.ownerId === this.humanPlayer?.id && territory.id !== this.selectedTerritory.id) {
                this.cursorMode = 'transfer';
            } else if (territory.ownerId !== this.humanPlayer?.id && territory.ownerId) { // Simplified null check
                this.cursorMode = 'attack';
            } else if (territory.isColonizable) {
                this.cursorMode = 'probe';
            } else {
                this.cursorMode = 'default';
            }
        } else {
            this.cursorMode = 'default';
        }
        
        // Update canvas cursor
        this.updateCanvasCursor();
    }
    
    updateCanvasCursor() {
        if (!this.canvas) return;
        
        switch (this.cursorMode) {
            case 'attack':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'transfer':
                this.canvas.style.cursor = 'move';
                break;
            case 'probe':
                this.canvas.style.cursor = 'help';
                break;
            default:
                this.canvas.style.cursor = 'default';
                break;
        }
    }
    
    // Enhanced context action with modifier key support
    handleContextActionWithModifiers(targetTerritory) {
        if (!this.selectedTerritory || !targetTerritory) return;
        
        // Determine fleet percentage based on modifier keys
        let fleetPercentage = 0.5; // Default 50%
        
        if (this.modifierKeys.shift) {
            fleetPercentage = 1.0; // Send all available (leave 1)
        } else if (this.modifierKeys.ctrl) {
            fleetPercentage = 0.25; // Send 25% - conservative probe
        }
        
        this.executeFleetCommand(this.selectedTerritory, targetTerritory, fleetPercentage);
    }
    
    // Legacy context action for compatibility
    handleContextAction(targetTerritory) {
        if (!this.selectedTerritory || this.selectedTerritory.ownerId !== this.humanPlayer?.id || !targetTerritory) {
            return;
        }
        
        const fromTerritory = this.selectedTerritory;
        
        // Validate warp lane connectivity (except for colonizable planets)
        if (!targetTerritory.isColonizable && !fromTerritory.neighbors.includes(targetTerritory.id)) {
            console.log(`Cannot perform action: No warp lane from ${fromTerritory.id} to ${targetTerritory.id}`);
            return;
        }
        
        // Determine action based on target
        if (targetTerritory.ownerId === this.humanPlayer?.id && targetTerritory.id !== fromTerritory.id) {
            // Right-click on friendly territory - transfer
            this.transferArmies(fromTerritory, targetTerritory);
        } else if (targetTerritory.ownerId !== this.humanPlayer?.id && targetTerritory.ownerId) { // Simplified null check
            // Right-click on enemy territory - attack
            this.attackTerritory(fromTerritory, targetTerritory);
        } else if (targetTerritory.isColonizable) {
            // Right-click on colonizable territory - launch probe
            this.launchProbe(fromTerritory, targetTerritory);
        }
        
        // Visual feedback - flash the target territory
        targetTerritory.lastActionFlash = Date.now();
    }
    
    // Wheel handling moved to InputHandler
    
    handleUIClick(screenX, screenY) {
        // Handle UI element clicks (moved from old handleTerritorySelection)
        
        // Check for "PLAY AGAIN" button when human player is eliminated
        const humanPlayer = this.humanPlayer;
        if (humanPlayer && humanPlayer.territories.length === 0) {
            const buttonWidth = 200;
            const buttonHeight = 60;
            const buttonX = this.canvas.width / 2 - buttonWidth / 2;
            const buttonY = this.canvas.height / 2 + 50;
            
            if (screenX >= buttonX && screenX <= buttonX + buttonWidth &&
                screenY >= buttonY && screenY <= buttonY + buttonHeight) {
                this.restartGame();
                return true;
            }
        }
        
        // Check for restart button on game over screen (mobile-friendly)
        if (this.gameState === 'ended' && this.ui && this.ui.restartButton) {
            const button = this.ui.restartButton;
            
            if (screenX >= button.x && screenX <= button.x + button.width &&
                screenY >= button.y && screenY <= button.y + button.height) {
                this.restartGame();
                return true;
            }
        }
        
        // Check for leaderboard click (screen coordinates, not world coordinates)
        const leaderboardX = this.canvas.width - 220;
        const leaderboardY = 60;
        const leaderboardWidth = 200;
        const leaderboardHeight = this.leaderboardMinimized ? 30 : 200;
        
        if (screenX >= leaderboardX && screenX <= leaderboardX + leaderboardWidth &&
            screenY >= leaderboardY && screenY <= leaderboardY + leaderboardHeight) {
            this.leaderboardMinimized = !this.leaderboardMinimized;
            console.log('Leaderboard toggled:', this.leaderboardMinimized ? 'minimized' : 'maximized');
            return true;
        }
        
        // Check for minimap click - fix coordinate calculation
        const minimapSize = 150;
        const minimapX = this.canvas.width - minimapSize - 20;
        const minimapY = this.canvas.height - minimapSize - 20;
        const minimapHeight = this.minimapMinimized ? 30 : minimapSize;
        const minimapClickY = this.minimapMinimized ? (minimapY + minimapSize - 30) : minimapY;
        
        if (screenX >= minimapX && screenX <= minimapX + minimapSize &&
            screenY >= minimapClickY && screenY <= minimapClickY + minimapHeight) {
            this.minimapMinimized = !this.minimapMinimized;
            console.log('Minimap toggled:', this.minimapMinimized ? 'minimized' : 'maximized');
            return true;
        }
        
        // Zoom controls removed - using mousewheel only
        
        return false; // No UI element was clicked
    }
    
    launchProbe(fromTerritory, toTerritory) {
        const probeCost = 10;
        
        if (fromTerritory.armySize < probeCost) {
            console.log('Not enough fleet power to launch probe! Need 10 fleet power.');
            return false;
        }
        
        if (!toTerritory.isColonizable) {
            console.log('Target territory is not colonizable!');
            return false;
        }
        
        // Create probe with gameMap and game references for nebula detection and discovery bonuses
        const probe = new Probe(
            this.nextProbeId++,
            fromTerritory,
            toTerritory,
            this.humanPlayer.id,
            this.humanPlayer.color,
            this.config.gameSpeed,
            this.gameMap,
            this
        );
        
        this.probes.push(probe);
        fromTerritory.armySize -= probeCost;
        
        // Trigger visual feedback
        fromTerritory.triggerProbeFlash();
        
        // Emit probe launched event
        gameEvents.emit(GAME_EVENTS.PROBE_LAUNCHED, {
            probe: {
                id: probe.id,
                fromTerritoryId: fromTerritory.id,
                toTerritoryId: toTerritory.id
            },
            player: {
                id: this.humanPlayer.id,
                name: this.humanPlayer.name
            }
        }, EVENT_PRIORITY.MEDIUM);
        
        console.log(`Probe launched from territory ${fromTerritory.id} to colonizable planet ${toTerritory.id}`);
        return true;
    }
    
    launchAIProbe(fromTerritory, toTerritory, player) {
        const probeCost = 10;
        
        if (fromTerritory.armySize < probeCost) {
            return;
        }
        
        // Create AI probe with gameMap and game references for nebula detection
        const probe = new Probe(
            this.nextProbeId++,
            fromTerritory,
            toTerritory,
            player.id,
            player.color,
            this.config.gameSpeed,
            this.gameMap,
            this
        );
        
        this.probes.push(probe);
        fromTerritory.armySize -= probeCost;
        
        // Trigger visual feedback
        fromTerritory.triggerProbeFlash();
        

    }
    
    transferFleet(fromTerritory, toTerritory) {
        // Create ship animation for transfer
        this.createShipAnimation(fromTerritory, toTerritory, false);
        
        // Delegate to centralized CombatSystem
        const success = this.combatSystem.transferArmies(fromTerritory, toTerritory);
        
        if (!success) {
            console.log('Transfer failed - not enough armies or invalid target');
        }
    }
    
    // Enhanced fleet transfer with specific amount
    transferFleetWithAmount(fromTerritory, toTerritory, amount) {
        // Create ship animation for transfer
        this.createShipAnimation(fromTerritory, toTerritory, false);
        
        // Delegate to centralized CombatSystem with specific amount
        const success = this.combatSystem.transferArmies(fromTerritory, toTerritory, amount);
        
        if (!success) {
            console.log('Transfer failed - not enough armies or invalid target');
        }
    }
    
    // Supply route system - delegate to SupplySystem module
    async createSupplyRoute(fromTerritory, toTerritory) {
        try {
            const result = await this.supplySystem.createSupplyRoute(fromTerritory, toTerritory);
            if (result) {
                console.log(`Supply route created: ${fromTerritory.id} → ${toTerritory.id}`);
            }
            return result;
        } catch (error) {
            console.error('Failed to create supply route:', error);
            return false;
        }
    }
    
    findPathBetweenTerritories(start, end) {
        // BFS to find shortest path through owned territories
        const queue = [[start]];
        const visited = new Set([start.id]);
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (current.id === end.id) {
                return path;
            }
            
            // Check all neighbors
            current.neighbors.forEach(neighborId => {
                const neighbor = this.gameMap.territories[neighborId];
                
                if (neighbor && 
                    !visited.has(neighbor.id) && 
                    neighbor.ownerId === this.humanPlayer?.id) {
                    
                    visited.add(neighbor.id);
                    queue.push([...path, neighbor]);
                }
            });
        }
        
        return null; // No path found
    }
    
    validateSupplyRoutes() {
        // Check all supply routes for broken connections
        const routesToRemove = [];
        
        this.supplyRoutes.forEach((route, fromId) => {
            const fromTerritory = this.gameMap.territories[fromId];
            const toTerritory = this.gameMap.territories[route.targetId];
            
            // Check if territories still exist and are owned by player
            if (!fromTerritory || !toTerritory || 
                fromTerritory.ownerId !== this.humanPlayer?.id || 
                toTerritory.ownerId !== this.humanPlayer?.id) {
                routesToRemove.push(fromId);
                return;
            }
            
            // Revalidate path every few seconds
            const now = Date.now();
            if (now - route.lastValidation > 5000) {
                const newPath = this.findPathBetweenTerritories(fromTerritory, toTerritory);
                
                if (!newPath) {
                    routesToRemove.push(fromId);
                    console.log(`Supply route broken: ${fromId} → ${route.targetId}`);
                } else {
                    // Update path and delay if it changed
                    const delayPerHop = 2000;
                    const newDelay = (newPath.length - 2) * delayPerHop;
                    
                    route.path = newPath;
                    route.delay = newDelay;
                    route.lastValidation = now;
                }
            }
        });
        
        // Remove broken routes
        routesToRemove.forEach(id => {
            this.supplyRoutes.delete(id);
        });
    }
    
    processSupplyRoutes() {
        // Handle automatic ship sending along supply routes
        this.supplyRoutes.forEach((route, fromId) => {
            const fromTerritory = this.gameMap.territories[fromId];
            const toTerritory = this.gameMap.territories[route.targetId];
            
            if (fromTerritory && toTerritory && fromTerritory.armySize > 2) {
                // Send new ships when they're generated (but not too frequently)
                const now = Date.now();
                if (!route.lastShipment || now - route.lastShipment > 3000) {
                    const shipsToSend = Math.floor(fromTerritory.armySize / 3); // Send 1/3 of armies
                    
                    if (shipsToSend > 0) {
                        fromTerritory.armySize -= shipsToSend;
                        route.lastShipment = now;
                        
                        // Create delayed transfer with route visualization
                        this.createDelayedSupplyTransfer(fromTerritory, toTerritory, shipsToSend, route.delay);
                    }
                }
            }
        });
    }
    
    createDelayedSupplyTransfer(fromTerritory, toTerritory, shipCount, delay) {
        // Find the supply route to get the path
        const route = this.supplyRoutes.get(fromTerritory.id);
        if (route && route.path && route.path.length > 1) {
            // Create multi-hop ship animation following the path
            this.createSupplyRouteAnimation(route.path, this.humanPlayer.color);
        } else {
            // Fallback to direct animation
            this.createShipAnimation(fromTerritory, toTerritory, false);
        }
        
        // Apply transfer after delay
        setTimeout(() => {
            if (toTerritory.ownerId === this.humanPlayer?.id) {
                toTerritory.armySize += shipCount;
                console.log(`Supply route delivered ${shipCount} ships to territory ${toTerritory.id}`);
            }
        }, delay);
    }
    
    findTerritoryAt(x, y) {
        // Viewport culling optimization: only check visible territories for hover detection
        if (this.visibleTerritories && this.visibleTerritories.size > 0) {
            for (const territoryId of this.visibleTerritories) {
                const territory = this.gameMap.territories[territoryId];
                if (!territory) continue;
                
                const distance = Math.sqrt((x - territory.x) ** 2 + (y - territory.y) ** 2);
                if (distance <= territory.radius) {
                    return territory;
                }
            }
            return null;
        }
        
        // Fallback to spatial indexing if visibility culling not available
        return this.gameMap.findTerritoryAt(x, y);
    }
    
    // Core fleet command execution with percentage control
    executeFleetCommand(fromTerritory, toTerritory, fleetPercentage, commandType = 'auto', path = null) {
        if (!fromTerritory || !toTerritory || fromTerritory.ownerId !== this.humanPlayer?.id) {
            return;
        }
        
        // Calculate ships to send - hardcoded 50% for new system
        const availableShips = Math.max(0, fromTerritory.armySize - 1);
        const shipsToSend = Math.max(1, Math.floor(availableShips * 0.5));
        
        // Visual feedback - show number flying off
        this.showFleetCommandFeedback(fromTerritory, shipsToSend, 0.5);
        
        // Handle different command types
        switch (commandType) {
            case 'multi-hop-transfer':
                if (path && path.length > 1) {
                    this.executeMultiHopTransfer(fromTerritory, toTerritory, shipsToSend, path);
                    console.log(`Multi-hop transfer: ${shipsToSend} ships from ${fromTerritory.id} to ${toTerritory.id} via path: ${path.join(' -> ')}`);
                } else {
                    console.error('Multi-hop transfer requires valid path');
                }
                break;
                
            case 'multi-hop-attack':
                if (path && path.length > 1) {
                    this.executeMultiHopAttack(fromTerritory, toTerritory, shipsToSend, path);
                    console.log(`Multi-hop attack: ${shipsToSend} ships from ${fromTerritory.id} to ${toTerritory.id} via path: ${path.join(' -> ')}`);
                } else {
                    console.error('Multi-hop attack requires valid path');
                }
                break;
                
            case 'transfer':
                if (toTerritory.ownerId === this.humanPlayer?.id) {
                    this.combatSystem.transferArmies(fromTerritory, toTerritory);
                    this.createShipAnimation(fromTerritory, toTerritory, false, shipsToSend);
                    console.log(`Direct transfer: ${shipsToSend} ships from ${fromTerritory.id} to ${toTerritory.id}`);
                }
                break;
                
            case 'attack':
                if (toTerritory.ownerId !== this.humanPlayer?.id) { // Simplified condition (isColonizable check redundant in attack context)
                    this.combatSystem.attackTerritory(fromTerritory, toTerritory);
                    this.createShipAnimation(fromTerritory, toTerritory, true, shipsToSend);
                    console.log(`Attack: ${shipsToSend} ships from ${fromTerritory.id} to ${toTerritory.id}`);
                }
                break;
                
            case 'auto':
            default:
                // Legacy auto-detection mode
                if (toTerritory.ownerId === this.humanPlayer?.id) {
                    this.combatSystem.transferArmies(fromTerritory, toTerritory);
                    this.createShipAnimation(fromTerritory, toTerritory, false, shipsToSend);
                } else if (toTerritory.isColonizable) {
                    this.launchProbe(fromTerritory, toTerritory);
                } else {
                    this.combatSystem.attackTerritory(fromTerritory, toTerritory);
                    this.createShipAnimation(fromTerritory, toTerritory, true, shipsToSend);
                }
                break;
        }
    }

    // Wrapper method for compatibility with InputStateMachine calls
    async issueFleetCommand(fromTerritory, toTerritory, fleetPercentage, isAttack = false) {
        console.log(`🚀 issueFleetCommand called: ${fromTerritory.id} -> ${toTerritory.id}, attack=${isAttack}`);
        
        // Check if territories are directly connected by warp lanes
        const isDirectlyConnected = fromTerritory.neighbors && fromTerritory.neighbors.includes(toTerritory.id);
        
        if (isDirectlyConnected) {
            // Direct connection - use simple command
            const commandType = isAttack ? 'attack' : 'transfer';
            console.log(`🛣️ Direct connection: using ${commandType}`);
            this.executeFleetCommand(fromTerritory, toTerritory, fleetPercentage, commandType);
        } else {
            // Not directly connected - find path through warp lanes
            if (isAttack) {
                // For attacks, find path through any territory to get to target
                const attackPath = await this.pathfindingService.findAttackPath(
                    fromTerritory.id, 
                    toTerritory.id, 
                    this.gameMap, 
                    this.humanPlayer.id
                );
                
                if (attackPath && attackPath.length > 1) {
                    console.log(`🛣️ Multi-hop attack path: ${attackPath.join(' -> ')}`);
                    this.executeFleetCommand(fromTerritory, toTerritory, fleetPercentage, 'multi-hop-attack', attackPath);
                } else {
                    // No path found - use long-range attack as fallback
                    console.log(`🛣️ No warp lane path found, using long-range attack`);
                    this.executeFleetCommand(fromTerritory, toTerritory, fleetPercentage, 'attack');
                }
            } else {
                // For transfers, find path through friendly territories only
                const transferPath = await this.pathfindingService.findShortestPath(
                    fromTerritory.id, 
                    toTerritory.id, 
                    this.gameMap, 
                    this.humanPlayer.id
                );
                
                if (transferPath && transferPath.length > 1) {
                    console.log(`🛣️ Multi-hop transfer path: ${transferPath.join(' -> ')}`);
                    this.executeFleetCommand(fromTerritory, toTerritory, fleetPercentage, 'multi-hop-transfer', transferPath);
                } else {
                    console.log(`🛣️ No friendly path found for transfer ${fromTerritory.id} -> ${toTerritory.id}`);
                    // No path means territories aren't connected through friendly space
                    return;
                }
            }
        }
    }
    
    executeMultiHopTransfer(fromTerritory, toTerritory, shipsToSend, path) {
        // Validate path
        if (!path || path.length < 2) {
            console.error('Invalid path for multi-hop transfer');
            return;
        }
        
        // Execute transfer on source territory
        fromTerritory.armySize -= shipsToSend;
        
        // Create multi-hop animation following the path
        this.createSupplyRouteAnimation(path.map(id => this.gameMap.territories[id]), this.humanPlayer.color);
        
        // Calculate delivery delay based on path length (0.8 seconds per hop to match animation)
        const deliveryDelay = (path.length - 1) * 800;
        
        // Schedule delivery to destination
        setTimeout(() => {
            if (toTerritory.ownerId === this.humanPlayer?.id) {
                toTerritory.armySize += shipsToSend;
                
                // Add visual feedback
                toTerritory.floatingText = {
                    text: `+${shipsToSend}`,
                    startTime: Date.now(),
                    duration: 2000,
                    startY: toTerritory.y
                };
                
                console.log(`Multi-hop transfer completed: ${shipsToSend} ships delivered to territory ${toTerritory.id}`);
            }
        }, deliveryDelay);
    }
    
    executeMultiHopAttack(fromTerritory, toTerritory, shipsToSend, path) {
        // Validate path
        if (!path || path.length < 2) {
            console.error('Invalid path for multi-hop attack');
            return;
        }
        
        console.log(`🎯 MULTI-HOP ATTACK: Starting ${shipsToSend} ships from ${fromTerritory.id} to ${toTerritory.id} via path: ${path.join(' -> ')}`);
        
        // Execute attack on source territory (remove ships immediately)
        fromTerritory.armySize -= shipsToSend;
        
        // Process the path segment by segment, stopping at first hostile territory
        this.processSegmentedAttack(fromTerritory, path, shipsToSend, 0);
    }
    
    processSegmentedAttack(originTerritory, path, shipsToSend, segmentIndex) {
        // Check if we've reached the end of the path
        if (segmentIndex >= path.length - 1) {
            console.log(`🎯 SEGMENTED ATTACK: Reached end of path at segment ${segmentIndex}`);
            return;
        }
        
        const currentTerritoryId = path[segmentIndex];
        const nextTerritoryId = path[segmentIndex + 1];
        const currentTerritory = this.gameMap.territories[currentTerritoryId];
        const nextTerritory = this.gameMap.territories[nextTerritoryId];
        
        console.log(`🎯 SEGMENTED ATTACK: Processing segment ${segmentIndex}: ${currentTerritoryId} -> ${nextTerritoryId}`);
        console.log(`🎯 SEGMENTED ATTACK: Current territory owner: ${currentTerritory.ownerId}, Next territory owner: ${nextTerritory.ownerId}, Human player: ${this.humanPlayer?.id}`);
        
        // Create animation for this segment
        this.createShipAnimation(currentTerritory, nextTerritory, true, shipsToSend);
        
        // Calculate travel time for this segment (800ms per hop)
        const segmentTravelTime = 800;
        
        // Schedule arrival at next territory
        setTimeout(() => {
            // Check if the next territory is hostile (enemy or neutral)
            const isHostile = nextTerritory.ownerId !== this.humanPlayer?.id;
            
            if (isHostile) {
                console.log(`🎯 HOSTILE ENCOUNTER: Fleet encounters hostile territory ${nextTerritoryId} (owner: ${nextTerritory.ownerId})`);
                
                // Create a temporary attacking territory for the combat
                const tempAttackingTerritory = {
                    id: originTerritory.id,
                    ownerId: this.humanPlayer?.id,
                    armySize: shipsToSend + 1, // +1 so the attack system can deduct armies
                    x: currentTerritory.x,
                    y: currentTerritory.y,
                    neighbors: [nextTerritory.id] // Temporary connection for attack validation
                };
                
                // Trigger combat flash effects
                nextTerritory.triggerCombatFlash();
                
                // Execute the attack using combat system
                const result = this.combatSystem.attackTerritory(tempAttackingTerritory, nextTerritory);
                console.log(`🎯 HOSTILE COMBAT QUEUED: ${shipsToSend} ships attacking territory ${nextTerritory.id}`);
                
                if (!result.success) {
                    console.log(`🛡️ Hostile encounter attack failed to queue: ${result.reason}`);
                }
                
                // Combat initiated - stop the multi-hop attack here
                return;
            } else {
                console.log(`🎯 FRIENDLY PASSAGE: Fleet passes through friendly territory ${nextTerritoryId}`);
                
                // Territory is friendly, continue to next segment
                this.processSegmentedAttack(originTerritory, path, shipsToSend, segmentIndex + 1);
            }
        }, segmentTravelTime);
    }
    
    // Visual feedback for fleet commands
    showFleetCommandFeedback(territory, shipsToSend, percentage) {
        // Flash the territory briefly
        territory.lastCombatFlash = Date.now();
        
        // Show floating text with ship count
        const floatingText = {
            x: territory.x + (Math.random() - 0.5) * 40,
            y: territory.y - 20,
            text: `-${shipsToSend}`,
            color: percentage >= 0.8 ? '#ff4444' : percentage >= 0.5 ? '#ffaa00' : '#44ff44',
            startTime: Date.now(),
            duration: 1500
        };
        
        if (!this.floatingTexts) this.floatingTexts = [];
        this.floatingTexts.push(floatingText);
    }
    
    attackTerritory(attackingTerritory, defendingTerritory) {
        // Trigger combat flash on both territories
        attackingTerritory.triggerCombatFlash();
        defendingTerritory.triggerCombatFlash();
        
        // Create ship animation for attack
        this.createShipAnimation(attackingTerritory, defendingTerritory, true);
        
        // Delegate to centralized CombatSystem
        const result = this.combatSystem.attackTerritory(attackingTerritory, defendingTerritory);
        
        if (result.success) {
            console.log(`Territory captured! Attack: ${result.attackPower.toFixed(1)} vs Defense: ${result.defensePower.toFixed(1)}`);
            
            if (result.throneCapture) {
                console.log('👑 THRONE STAR CAPTURED!');
            }
            
            if (result.gameEnded) {
                this.endGame();
            }
        } else {
            if (result.reason) {
                console.log(`Attack failed: ${result.reason}`);
            } else {
                console.log(`Attack failed! Attack: ${result.attackPower.toFixed(1)} vs Defense: ${result.defensePower.toFixed(1)}`);
            }
        }
        
        // Update player stats
        this.players.forEach(player => player.updateStats());
    }
    
    // Enhanced attack method with custom army amount
    attackTerritoryWithAmount(attackingTerritory, defendingTerritory, attackingArmies) {
        // Trigger combat flash on both territories
        attackingTerritory.triggerCombatFlash();
        defendingTerritory.triggerCombatFlash();
        
        // Create ship animation for attack
        this.createShipAnimation(attackingTerritory, defendingTerritory, true);
        
        // Delegate to centralized CombatSystem with specific army count
        const result = this.combatSystem.attackTerritory(attackingTerritory, defendingTerritory, attackingArmies);
        
        if (result.success) {
            console.log(`Territory captured with custom attack! Attack: ${result.attackPower.toFixed(1)} vs Defense: ${result.defensePower.toFixed(1)}`);
            
            if (result.throneCapture) {
                console.log('👑 THRONE STAR CAPTURED!');
            }
            
            if (result.gameEnded) {
                this.endGame();
            }
        } else {
            if (result.reason) {
                console.log(`Custom attack failed: ${result.reason}`);
            } else {
                console.log(`Custom attack failed! Attack: ${result.attackPower.toFixed(1)} vs Defense: ${result.defensePower.toFixed(1)}`);
            }
        }
        
        // Update player stats
        this.players.forEach(player => player.updateStats());
    }
    
    // Touch event handlers for mobile
    handleTouchStart(e) {
        e.preventDefault();
        
        this.touchStartTime = Date.now();
        const rect = this.canvas.getBoundingClientRect();
        
        this.touchDebugInfo = `TouchStart: ${e.touches.length} touches\nTime: ${new Date().toLocaleTimeString()}`;
        
        if (e.touches.length === 1) {
            // Single touch - prepare for selection or pan
            const touch = e.touches[0];
            this.mousePos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            this.lastMousePos = { ...this.mousePos };
            this.isDragging = false;
            this.isMultiTouch = false;
            
            // Setup long press detection
            this.longPressStartPos = { ...this.mousePos };
            const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
            this.longPressTarget = this.findTerritoryAt(worldPos.x, worldPos.y);
            
            // Clear any existing long press timer
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
            }
            
            // Start long press timer
            this.longPressTimer = setTimeout(() => {
                this.handleLongPress();
            }, this.longPressThreshold);
            
            this.touchDebugInfo += `\nSingle: ${Math.round(this.mousePos.x)}, ${Math.round(this.mousePos.y)}`;
            
        } else if (e.touches.length === 2) {
            // Two touches - enhanced pinch zoom and pan
            this.isMultiTouch = true;
            this.isDragging = true;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            // Store initial touch positions for pan/zoom
            this.touchStartDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            this.pinchCenter = {
                x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
                y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
            };
            
            this.lastMousePos = { ...this.pinchCenter };
            this.initialZoom = this.camera.zoom; // Store initial zoom for relative scaling
            this.lastPinchDistance = this.touchStartDistance; // Track for smooth updates
            
            this.touchDebugInfo += `\nPinch Start: dist ${Math.round(this.touchStartDistance)} zoom ${(this.initialZoom * 100).toFixed(0)}%`;
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        
        this.touchDebugInfo = `TouchMove: ${e.touches.length} touches\nTime: ${new Date().toLocaleTimeString()}`;
        
        if (e.touches.length === 1) {
            // Single touch drag - pan
            const touch = e.touches[0];
            const currentPos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            
            this.touchDebugInfo += `\nSingle: ${Math.round(currentPos.x)}, ${Math.round(currentPos.y)}`;
            
            if (this.lastMousePos) {
                const deltaX = currentPos.x - this.lastMousePos.x;
                const deltaY = currentPos.y - this.lastMousePos.y;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                // Start dragging if moved more than 10 pixels
                if (!this.isDragging && distance > 10) {
                    this.isDragging = true;
                    this.touchDebugInfo += `\nStarted Pan`;
                    
                    // Cancel long press if we start dragging
                    if (this.longPressTimer) {
                        clearTimeout(this.longPressTimer);
                        this.longPressTimer = null;
                    }
                }
                
                if (this.isDragging && !this.isMultiTouch) {
                    this.camera.pan(-deltaX, -deltaY);
                    this.touchDebugInfo += `\nPan: ${Math.round(deltaX)}, ${Math.round(deltaY)}`;
                }
            }
            
            this.lastMousePos = currentPos;
            
        } else if (e.touches.length === 2) {
            // Two touches - pinch zoom and pan
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            // Calculate current distance for zoom
            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            // Enhanced pinch-to-zoom with much higher sensitivity
            if (this.lastPinchDistance && Math.abs(currentDistance - this.lastPinchDistance) > 2) {
                // Use incremental scaling with higher sensitivity
                const distanceRatio = currentDistance / this.lastPinchDistance;
                
                // Apply incremental zoom change with dramatic sensitivity
                const zoomMultiplier = 1 + (distanceRatio - 1) * 1.5; // Dramatic scaling for responsive zoom
                const newZoom = Math.max(0.5, Math.min(3.0, this.camera.zoom * zoomMultiplier));
                
                // Calculate zoom center between the two fingers
                const centerX = ((touch1.clientX + touch2.clientX) / 2) - rect.left;
                const centerY = ((touch1.clientY + touch2.clientY) / 2) - rect.top;
                
                // Apply zoom smoothly to the pinch center
                this.camera.zoomTo(newZoom, centerX, centerY);
                this.lastPinchDistance = currentDistance;
                this.lastZoomTime = Date.now();
                
                this.touchDebugInfo += `\nPinch Zoom: ${(newZoom * 100).toFixed(0)}% (dist: ${Math.round(currentDistance)})`;
            }
            
            // Enhanced two-finger pan with smoother movement
            const currentCenter = {
                x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
                y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
            };
            
            if (this.lastMousePos && Date.now() - this.lastZoomTime > 50) {
                const deltaX = currentCenter.x - this.lastMousePos.x;
                const deltaY = currentCenter.y - this.lastMousePos.y;
                
                // Smoother pan threshold for better control
                if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                    this.camera.pan(-deltaX * 0.8, -deltaY * 0.8); // Damped panning
                    this.touchDebugInfo += `\nTwo-finger pan: ${Math.round(deltaX)}, ${Math.round(deltaY)}`;
                }
            }
            
            this.lastMousePos = currentCenter;
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        const touchDuration = Date.now() - this.touchStartTime;
        console.log('Touch end:', e.touches.length, 'remaining touches, duration:', touchDuration);
        
        if (e.touches.length === 0) {
            // All fingers lifted
            if (!this.isDragging && touchDuration < 500 && this.mousePos) {
                // Quick tap - handle territory selection
                const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
                this.handleTerritorySelection(worldPos);
                console.log('Territory selection at:', worldPos);
            }
            
            this.isDragging = false;
            this.isMultiTouch = false;
            this.touchStartDistance = null;
            this.lastPinchDistance = null;
            this.lastMousePos = null;
            this.pinchCenter = null;
            this.lastZoomTime = 0;
            this.initialZoom = 1.0;
            
            // Cancel long press timer
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            
        } else if (e.touches.length === 1) {
            // One finger lifted during multi-touch - continue with single touch
            this.isMultiTouch = false;
            this.touchStartDistance = null;
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastMousePos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }
    }
    
    // Keyboard handling is now done by InputHandler module
    
    handleDoubleClick(targetTerritory) {
        // Double-click detected - create supply route between owned territories
        if (!this.selectedTerritory || !targetTerritory) {
            return;
        }
        
        const fromTerritory = this.selectedTerritory;
        const toTerritory = targetTerritory;
        
        // Both territories must be owned by human player
        if (fromTerritory.ownerId !== this.humanPlayer?.id || toTerritory.ownerId !== this.humanPlayer?.id) {
            return;
        }
        
        // Must be different territories
        if (fromTerritory.id === toTerritory.id) {
            return;
        }
        
        // Check if connected by owned territories
        const path = this.findPathBetweenTerritories(fromTerritory, toTerritory);
        if (path && path.length > 0) {
            this.createSupplyRoute(fromTerritory, toTerritory);
            console.log(`Double-click: Supply route created from ${fromTerritory.id} to ${toTerritory.id}`);
        } else {
            console.log('Double-click: Territories not connected by owned star lanes for supply route');
        }
    }
    
    restartGame() {
        // Reset game state
        this.gameState = 'lobby';
        this.gameTimer = 10 * 60 * 1000;
        this.selectedTerritory = null;
        
        // Clear players
        this.players = [];
        this.humanPlayer = null;
        
        // Regenerate map and restart
        this.gameMap = new GameMap(2000, 1500, this.config); // Pass config to maintain connection distances
        this.startGame();
    }
    
    /**
     * Validates throne star assignments and fixes double throne star bugs
     */
    validateThroneStars() {
        console.log('🔍 THRONE VALIDATION: Starting validation...');
        
        // Count throne stars per player
        const playerThroneCount = new Map();
        
        for (const player of this.players) {
            playerThroneCount.set(player.id, 0);
        }
        
        // Count throne stars and log what we find
        const allThrones = [];
        for (const territory of Object.values(this.gameMap.territories)) {
            if (territory.isThronestar) {
                allThrones.push({id: territory.id, owner: territory.ownerId});
                if (territory.ownerId !== null) {
                    const currentCount = playerThroneCount.get(territory.ownerId) || 0;
                    playerThroneCount.set(territory.ownerId, currentCount + 1);
                }
            }
        }
        
        console.log(`🔍 THRONE VALIDATION: Found ${allThrones.length} throne stars:`, allThrones);
        console.log(`🔍 THRONE VALIDATION: Player throne counts:`, Array.from(playerThroneCount.entries()));
        
        // Fix players with multiple throne stars
        let fixed = false;
        for (const [playerId, throneCount] of playerThroneCount.entries()) {
            if (throneCount > 1) {
                const player = this.players.find(p => p.id === playerId);
                console.log(`🔧 FIXING: Player ${player ? player.name : playerId} (ID: ${playerId}) has ${throneCount} throne stars - removing extras`);
                
                // Find all throne stars for this player
                const playerThrones = [];
                for (const territory of Object.values(this.gameMap.territories)) {
                    if (territory.isThronestar && territory.ownerId === playerId) {
                        playerThrones.push(territory);
                    }
                }
                
                console.log(`🔧 Found throne territories for player ${playerId}:`, playerThrones.map(t => t.id));
                
                // Keep the first throne star, remove the rest
                for (let i = 1; i < playerThrones.length; i++) {
                    playerThrones[i].isThronestar = false;
                    console.log(`🔧 Removed throne star flag from territory ${playerThrones[i].id}`);
                    fixed = true;
                }
            }
        }
        
        if (!fixed) {
            console.log('🔍 THRONE VALIDATION: No fixes needed, all players have single throne stars');
        }
    }
}
