import { GameMap } from './GameMap.js';
import { Player } from './Player.js';
import { GameUI } from './GameUI.js';
import { Camera } from './Camera.js';
import { Probe } from './Probe.js';
import { InputHandler } from './InputHandler.js';
import { Renderer } from './Renderer.js';
import { CombatSystem } from './CombatSystem.js';
import { SupplySystem } from './SupplySystem.js';
import { GAME_CONSTANTS } from '../../../common/gameConstants.ts';

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
        
        // Discovery system for planet colonization - per player tracking
        this.playerDiscoveries = new Map(); // Map of playerId -> discoveries
        
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
        
        this.init();
        this.loadBackgroundImage();
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
    
    // Process discovery when a planet is successfully colonized
    processDiscovery(territory, discovery, playerId) {
        const player = this.players[playerId];
        if (!player) return;
        
        // Get player's discoveries
        const playerDiscoveries = this.playerDiscoveries.get(playerId);
        if (!playerDiscoveries) return;
        
        // Add to discovery log
        this.discoveryLog.push({
            timestamp: Date.now(),
            territoryId: territory.id,
            playerId: playerId,
            discovery: discovery,
            playerName: player.name
        });
        
        console.log(`🔍 Discovery on planet ${territory.id}: ${discovery.name} - ${discovery.description}`);
        
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
        
        // Apply discovery effects
        switch (discovery.effect) {
            case 'probe_lost':
                // Probe is destroyed, planet remains unexplored
                territory.isColonizable = true;
                territory.ownerId = null;
                territory.armySize = territory.hiddenArmySize || Math.floor(Math.random() * 50) + 1;
                
                // Add explosion animation for the territory
                territory.explosionTime = Date.now();
                territory.explosionDuration = 1500; // 1.5 second explosion
                
                console.log(`💀 Probe lost to hostile aliens! Planet ${territory.id} remains unexplored.`);
                return false; // Colonization failed
                
            case 'extra_fleet':
                // Friendly aliens boost fleet strength
                territory.armySize += discovery.bonus;
                const friendlyMessage = `👽 Friendly aliens provide ${discovery.bonus} fleet strength!`;
                console.log(friendlyMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(friendlyMessage, '#44ff44');
                }
                break;
                
            case 'attack_bonus':
                // Empire-wide attack bonus
                playerDiscoveries.precursorWeapons++;
                const weaponMessage = `⚔️ Precursor Weapons Level ${playerDiscoveries.precursorWeapons}! Empire attack increased by 10%`;
                console.log(weaponMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(weaponMessage, '#ff6600');
                }
                break;
                
            case 'speed_bonus':
                // Empire-wide speed bonus
                playerDiscoveries.precursorDrive++;
                const driveMessage = `🚀 Precursor Drive Level ${playerDiscoveries.precursorDrive}! Empire speed increased by 20%`;
                console.log(driveMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(driveMessage, '#00ddff');
                }
                break;
                
            case 'defense_bonus':
                // Empire-wide defense bonus
                playerDiscoveries.precursorShield++;
                const shieldMessage = `🛡️ Precursor Shield Level ${playerDiscoveries.precursorShield}! Empire defense increased by 10%`;
                console.log(shieldMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(shieldMessage, '#0088ff');
                }
                break;
                
            case 'factory_planet':
                // Planet gets double generation rate
                playerDiscoveries.factoryPlanets.add(territory.id);
                territory.discoveryBonus = 'factory';
                territory.hasFactory = true; // Add factory icon
                const factoryMessage = `🏭 Precursor Factory discovered! Planet ${territory.id} has 200% generation rate`;
                console.log(factoryMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(factoryMessage, '#ff8800');
                }
                break;
                
            case 'generation_bonus':
                // Empire-wide generation bonus
                playerDiscoveries.precursorNanotech++;
                const nanotechMessage = `🔬 Precursor Nanotech Level ${playerDiscoveries.precursorNanotech}! Empire generation increased by 10%`;
                console.log(nanotechMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(nanotechMessage, '#aa00ff');
                }
                break;
                
            case 'mineral_planet':
                // Planet gets +50% generation
                territory.discoveryBonus = 'minerals';
                const mineralMessage = `💎 Rich minerals found! Planet ${territory.id} has 150% generation rate`;
                console.log(mineralMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(mineralMessage, '#ffdd00');
                }
                break;
                
            case 'reduced_generation':
                // Planet gets reduced generation
                territory.discoveryBonus = 'void_storm';
                const stormMessage = `⚡ Void storm remnants! Planet ${territory.id} has 75% generation rate`;
                console.log(stormMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(stormMessage, '#ff4444');
                }
                break;
                
            case 'cosmetic':
                // Ancient ruins - cosmetic only
                territory.discoveryBonus = 'ruins';
                const ruinsMessage = `🏛️ Ancient ruins discovered on planet ${territory.id}`;
                console.log(ruinsMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(ruinsMessage, '#888888');
                }
                break;
                
            default:
                // No special effect
                const standardMessage = `🌍 Standard planet colonized: ${territory.id}`;
                console.log(standardMessage);
                if (playerId === this.humanPlayer?.id) {
                    this.addNotification(standardMessage, '#aaaaaa');
                }
                break;
        }
        
        return true; // Colonization successful
    }
    
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
        
        console.log(`Probe colonizing planet ${planet.id} for player ${player.name}`);
        
        // Trigger discovery event before colonization
        const discovery = this.selectRandomDiscovery();
        const colonizationSuccessful = this.processDiscovery(planet, discovery, player.id);
        
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
    }
    
    // Render probes
    renderProbes() {
        this.probes.forEach(probe => {
            probe.render(this.ctx);
        });
    }
    
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
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
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
        
        // Initialize parallax starfield after map is generated
        this.initializeStarfield();
        
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
            const aiName = this.generateAIName(i - 1);
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
            factoryPlanets: new Set() // Planets with 200% generation
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
        
        // Optimized AI updates with staggered processing
        const playersPerFrame = Math.max(1, Math.ceil(this.players.length / 4)); // Update 1/4 of players per frame
        const startIndex = (this.frameCount % 4) * playersPerFrame;
        const endIndex = Math.min(startIndex + playersPerFrame, this.players.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const player = this.players[i];
            if (player && !player.isEliminated) {
                player.update(deltaTime, this.gameMap, this.config.gameSpeed, this);
            }
        }
        
        // Update ship animations and probes with normal delta time (speed applied internally)
        this.updateShipAnimations(deltaTime);
        this.updateProbes(deltaTime);
        
        // Update notifications and messages
        this.updateNotifications();
        this.updateMessage(deltaTime);
        
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
        } else {
            console.log('Game Over! It\'s a draw.');
        }
        
        // TODO: Show game over screen with final leaderboard
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
        
        // Render parallax starfield behind everything
        this.renderParallaxStarfield();
        
        // Render game world with optimizations
        this.renderNebulas();
        this.renderTerritories();
        this.renderConnections();
        this.renderSupplyRoutes();
        this.renderDragPreview();
        this.renderProportionalDragUI();
        this.renderTransferPreview();
        this.renderShipAnimations();
        this.renderProbes();
        this.renderArmies();
        this.renderFloatingTexts();
        
        // Restore context
        this.ctx.restore();
        
        // Render UI (not affected by camera)
        this.renderUI();
        
        // Track performance
        this.performanceStats.renderTime = performance.now() - renderStart;
    }
    
    updateVisibleTerritories() {
        // Optimized visibility culling with cached bounds
        if (Date.now() - this.lastVisibilityUpdate < GAME_CONSTANTS.VISIBLE_TERRITORIES_UPDATE_INTERVAL_MS) return;
        this.lastVisibilityUpdate = Date.now();
        
        const bounds = this.camera.getViewBounds();
        const margin = GAME_CONSTANTS.TERRITORY_VISIBILITY_PADDING;
        
        this.visibleTerritories = [];
        const territories = Object.values(this.gameMap.territories);
        
        for (let i = 0; i < territories.length; i++) {
            const territory = territories[i];
            if (territory.x + territory.radius >= bounds.left - margin &&
                territory.x - territory.radius <= bounds.right + margin &&
                territory.y + territory.radius >= bounds.top - margin &&
                territory.y - territory.radius <= bounds.bottom + margin) {
                this.visibleTerritories.push(territory);
            }
        }
        
        this.performanceStats.visibleTerritories = this.visibleTerritories.length;
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
        this.visibleTerritories.forEach(territory => {
            territory.render(this.ctx, this.players, selectedTerritory, {
                humanPlayer: this.humanPlayer,
                homeSystemFlashStart: this.homeSystemFlashStart,
                homeSystemFlashDuration: this.homeSystemFlashDuration
            }, this.hoveredTerritory);
        });
    }
    
    renderConnections() {
        this.ctx.lineWidth = 4;
        this.ctx.globalAlpha = 0.7;
        
        // Cache connections to avoid duplicate rendering
        const drawnConnections = new Set();
        
        this.visibleTerritories.forEach(territory => {
            territory.neighbors.forEach(neighborId => {
                const neighbor = this.gameMap.territories[neighborId];
                if (!neighbor) return;
                
                // Create unique connection ID (smaller ID first)
                const connectionId = territory.id < neighborId 
                    ? `${territory.id}-${neighborId}` 
                    : `${neighborId}-${territory.id}`;
                
                if (drawnConnections.has(connectionId)) return;
                drawnConnections.add(connectionId);
                
                // Skip connections to/from colonizable planets
                if (territory.isColonizable || neighbor.isColonizable) {
                    return;
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
        // Render active supply routes with animated arrows
        this.supplyRoutes.forEach((route, fromId) => {
            const fromTerritory = this.gameMap.territories[fromId];
            const toTerritory = this.gameMap.territories[route.targetId];
            
            if (fromTerritory && toTerritory && route.path && route.path.length > 1) {
                this.ctx.save();
                
                // Draw route path with animated dashes - color based on activity
                const routeActive = fromTerritory.armySize > 10; // Route is active if source has armies
                if (routeActive) {
                    this.ctx.strokeStyle = '#00ffff'; // Bright cyan for active routes
                    this.ctx.globalAlpha = 0.9;
                } else {
                    this.ctx.strokeStyle = '#006666'; // Dimmed cyan for inactive routes
                    this.ctx.globalAlpha = 0.5;
                }
                this.ctx.lineWidth = 3;
                
                // Calculate direction-based animation offset
                const fromPos = route.path[0];
                const toPos = route.path[route.path.length - 1];
                const direction = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
                
                // Animate dashes flowing in the direction of ship movement
                const animationOffset = (Date.now() * 0.02) % 20;
                this.ctx.setLineDash([8, 12]);
                this.ctx.lineDashOffset = -animationOffset;
                
                // Draw path segments
                for (let i = 0; i < route.path.length - 1; i++) {
                    const current = route.path[i];
                    const next = route.path[i + 1];
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(current.x, current.y);
                    this.ctx.lineTo(next.x, next.y);
                    this.ctx.stroke();
                }
                
                // Remove arrow graphics - just show the animated path
                
                this.ctx.restore();
            }
        });
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
        
        this.ctx.save();
        
        const territories = this.visibleTerritories || Object.values(this.gameMap.territories);
        const playersLookup = {}; // Cache player lookups
        
        // Strategic View (zoomed out) - Show simplified information
        if (zoomLevel === 'strategic') {
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            
            for (let i = 0; i < territories.length; i++) {
                const territory = territories[i];
                if (territory.ownerId !== null) {
                    // Use cached player lookup
                    let owner = playersLookup[territory.ownerId];
                    if (!owner) {
                        owner = this.players[territory.ownerId];
                        if (owner) playersLookup[territory.ownerId] = owner;
                    }
                    
                    if (owner && territory.armySize >= 10) { // Only show significant fleets
                        const armyText = territory.armySize >= 100 ? `${Math.floor(territory.armySize / 10)}0+` : territory.armySize.toString();
                        
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
                    // Use cached player lookup
                    let owner = playersLookup[territory.ownerId];
                    if (!owner) {
                        owner = this.players[territory.ownerId];
                        if (owner) playersLookup[territory.ownerId] = owner;
                    }
                    
                    if (owner) {
                        const armyText = territory.armySize.toString();
                        
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
                    // Use cached player lookup
                    let owner = playersLookup[territory.ownerId];
                    if (!owner) {
                        owner = this.players[territory.ownerId];
                        if (owner) playersLookup[territory.ownerId] = owner;
                    }
                    
                    if (owner) {
                        const armyText = territory.armySize.toString();
                        
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
        
        // Render background image with parallax if loaded
        if (this.backgroundLoaded && this.backgroundImage) {
            this.renderBackgroundImage();
        } else {
            // Clear canvas with dark space background color
            this.ctx.fillStyle = '#0a0a1a';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Apply camera transformations
        this.ctx.save();
        this.camera.applyTransform(this.ctx);
        
        // Render parallax starfield
        this.renderParallaxStarfield();
        
        // Render game background elements
        this.renderNebulas();
        
        // Update performance tracking
        this.updateVisibleTerritories();
        
        // Render connections between territories
        this.renderConnections();
        
        // Render supply routes
        this.renderSupplyRoutes();
        
        // Render territories with fleet counts
        this.renderTerritories();
        
        // Render probes
        this.renderProbes();
        
        // Render ship animations
        this.renderShipAnimations();
        
        // Proportional drag interface handled by InputHandler
        
        // Selection is handled by Territory render method itself
        
        this.ctx.restore();
        
        // Render UI overlay
        this.renderUI();
        
        // Update performance stats
        this.performanceStats.renderTime = performance.now() - startTime;
    }
    
    renderUI() {
        if (this.ui) {
            const inputState = this.inputHandler ? this.inputHandler.getInputState() : {};
            
            this.ui.render(this.ctx, {
                gameState: this.gameState,
                gameTimer: this.gameTimer,
                players: this.players,
                humanPlayer: this.humanPlayer,
                selectedTerritory: inputState.selectedTerritory,
                hoveredTerritory: this.hoveredTerritory,
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
                probeCount: this.probes.length,
                notifications: this.notifications,
                playerDiscoveries: this.playerDiscoveries,
                recentProbeResults: this.recentProbeResults,
                showBonusPanel: this.showBonusPanel,
                inputState: inputState,
                messageText: this.messageText,
                messageTimer: this.messageTimer
            });
        }
    }
    
    // Input handling methods
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        this.lastMousePos = { ...this.mousePos };
        this.dragStartPos = { ...this.mousePos };
        this.dragStartTime = Date.now();
        this.isDragging = false;
        this.isDraggingForSupplyRoute = false;
        this.isProportionalDrag = false;
        
        // Check if starting drag on an owned territory
        const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const startTerritory = this.findTerritoryAt(worldPos.x, worldPos.y);
        
        // Handle double-click detection for supply routes
        const now = Date.now();
        if (this.lastClickTime && now - this.lastClickTime < 300 && e.button === 0) {
            // Double click detected - try to create supply route
            if (startTerritory) {
                this.handleDoubleClick(startTerritory);
                this.lastClickTime = null; // Reset double-click tracking
                return; // Don't process as regular click
            }
        }
        this.lastClickTime = now;
        
        // Territory selection for left clicks
        if (e.button === 0 && startTerritory) {
            this.selectedTerritory = startTerritory;
            console.log(`Selected territory ${startTerritory.id} (Owner: ${startTerritory.ownerId})`);
        }
        
        if (startTerritory && startTerritory.ownerId === this.humanPlayer?.id) {
            this.dragStart = startTerritory;
            
            // Only setup proportional drag on left click with armies (but don't activate until intentional drag)
            if (e.button === 0 && startTerritory.armySize > 1) {
                // Store potential for proportional drag, but don't activate until significant movement
                this.proportionalDragStart = {
                    territory: startTerritory,
                    screenPos: { ...this.mousePos },
                    worldPos: { x: startTerritory.x, y: startTerritory.y }
                };
            }
        } else {
            this.dragStart = null;
            this.proportionalDragStart = null; // Clear if not on owned territory
        }
        
        if (e.button === 2) { // Right click starts immediate action
            this.isDragging = true;
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const newMousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Check if we should start dragging (left click held and moved)
        if (this.dragStartPos && !this.isDragging && e.buttons === 1) {
            const dragDistance = Math.sqrt(
                (newMousePos.x - this.dragStartPos.x) ** 2 + 
                (newMousePos.y - this.dragStartPos.y) ** 2
            );
            
            if (dragDistance > 15) { // Increased threshold to prevent accidental activation
                // Only start proportional drag if dragging for more than 300ms (intentional drag)
                const dragTime = Date.now() - this.dragStartTime;
                if (this.proportionalDragStart && dragTime > 300) {
                    this.isProportionalDrag = true;
                    console.log('Started proportional fleet drag');
                } else {
                    // Regular camera drag
                    this.isDragging = true;
                }
            }
        }
        
        // Handle proportional drag for fleet commands
        if (this.isProportionalDrag && this.proportionalDragStart) {
            const dragDistance = Math.sqrt(
                (newMousePos.x - this.proportionalDragStart.screenPos.x) ** 2 + 
                (newMousePos.y - this.proportionalDragStart.screenPos.y) ** 2
            );
            
            // Calculate percentage based on drag distance (0-100 pixels = 0-100%)
            this.fleetPercentage = Math.min(1.0, Math.max(0.1, dragDistance / 100));
        }
        
        // Pan camera if dragging (but not if creating supply route)
        if (this.isDragging && this.mousePos && !this.isDraggingForSupplyRoute) {
            const deltaX = newMousePos.x - this.mousePos.x;
            const deltaY = newMousePos.y - this.mousePos.y;
            
            // Apply camera panning scaled by zoom level
            this.camera.pan(-deltaX / this.camera.zoom, -deltaY / this.camera.zoom);
        }
        
        // Update hover state and cursor mode
        if (!this.isDragging && !this.isDraggingForSupplyRoute) {
            this.updateHoverState(newMousePos);
        }
        
        this.mousePos = newMousePos;
    }
    
    handleMouseUp(e) {
        // Check if this was a quick click (not a drag)
        const clickDuration = Date.now() - (this.dragStartTime || 0);
        const wasQuickClick = clickDuration < 300 && !this.isDragging && !this.isDraggingForSupplyRoute;
        
        const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const targetTerritory = this.findTerritoryAt(worldPos.x, worldPos.y);
        
        // Handle proportional fleet command
        if (this.isProportionalDrag && this.proportionalDragStart && targetTerritory) {
            this.executeFleetCommand(this.proportionalDragStart.territory, targetTerritory, this.fleetPercentage);
        }
        // Handle supply route creation
        else if (this.isDraggingForSupplyRoute && this.dragStart) {
            if (targetTerritory && targetTerritory.ownerId === this.humanPlayer?.id && targetTerritory.id !== this.dragStart.id) {
                this.createSupplyRoute(this.dragStart, targetTerritory);
            }
        }
        else if (e.button === 0 && (wasQuickClick || !this.isDragging)) {
            // Check UI elements first
            if (this.handleUIClick(this.mousePos.x, this.mousePos.y)) {
                return; // UI handled the click
            }
            
            // Skip game logic if not in playing state
            if (this.gameState !== 'playing') return;
            
            // Left click - use FSM for input handling
            if (this.inputFSM) {
                this.inputFSM.handleInput('leftClick', {
                    territory: targetTerritory,
                    worldPos: worldPos,
                    screenPos: this.mousePos
                });
            }
        }
        else if (e.button === 2 && wasQuickClick) {
            // Right click - use FSM for input handling
            if (this.inputFSM) {
                this.inputFSM.handleInput('rightClick', {
                    territory: targetTerritory,
                    worldPos: worldPos,
                    screenPos: this.mousePos
                });
            }
        }
        
        // Reset drag state
        this.isDragging = false;
        this.isDraggingForSupplyRoute = false;
        this.isProportionalDrag = false;
        this.proportionalDragStart = null;
        this.fleetPercentage = 0.5; // Reset to default
        this.dragStartPos = null;
        this.dragStartTime = null;
        this.dragStart = null;
        this.dragEnd = null;
    }
    
    updateHoverState(mousePos) {
        const worldPos = this.camera.screenToWorld(mousePos.x, mousePos.y);
        const territory = this.findTerritoryAt(worldPos.x, worldPos.y);
        
        this.hoveredTerritory = territory;
        
        // Determine cursor mode based on selection and hover target
        if (this.selectedTerritory && this.selectedTerritory.ownerId === this.humanPlayer?.id && territory) {
            if (territory.ownerId === this.humanPlayer?.id && territory.id !== this.selectedTerritory.id) {
                this.cursorMode = 'transfer';
            } else if (territory.ownerId !== this.humanPlayer?.id && territory.ownerId !== null) {
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
        } else if (targetTerritory.ownerId !== this.humanPlayer?.id && targetTerritory.ownerId !== null) {
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
            return;
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
        
        console.log(`Probe launched from territory ${fromTerritory.id} to colonizable planet ${toTerritory.id}`);
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
        
        console.log(`AI ${player.name} launched probe from territory ${fromTerritory.id} to colonizable planet ${toTerritory.id}`);
    }
    
    transferFleet(fromTerritory, toTerritory) {
        if (fromTerritory.armySize <= 1) {
            console.log('Not enough armies to transfer!');
            return;
        }
        
        // Create ship animation for transfer
        this.createShipAnimation(fromTerritory, toTerritory, false);
        
        // Transfer half the armies, leaving at least 1
        const transferAmount = Math.floor(fromTerritory.armySize / 2);
        fromTerritory.armySize -= transferAmount;
        toTerritory.armySize += transferAmount;
        
        console.log(`Transferred ${transferAmount} armies from territory ${fromTerritory.id} to ${toTerritory.id}`);
    }
    
    // Enhanced fleet transfer with specific amount
    transferFleetWithAmount(fromTerritory, toTerritory, amount) {
        if (fromTerritory.armySize <= 1) {
            console.log('Not enough armies to transfer!');
            return;
        }
        
        // Ensure we don't transfer more than available (minus 1 to keep)
        const maxTransfer = fromTerritory.armySize - 1;
        const actualTransfer = Math.min(amount, maxTransfer);
        
        if (actualTransfer <= 0) {
            console.log('No armies available to transfer!');
            return;
        }
        
        // Create ship animation for transfer
        this.createShipAnimation(fromTerritory, toTerritory, false);
        
        // Execute transfer
        fromTerritory.armySize -= actualTransfer;
        toTerritory.armySize += actualTransfer;
        
        console.log(`Transferred ${actualTransfer} armies from territory ${fromTerritory.id} to ${toTerritory.id}`);
    }
    
    // Supply route system
    createSupplyRoute(fromTerritory, toTerritory) {
        // Find path between territories through owned network
        const path = this.findPathBetweenTerritories(fromTerritory, toTerritory);
        
        if (path && path.length > 1) {
            const delayPerHop = 2000; // 2 seconds per intervening planet
            const totalDelay = (path.length - 2) * delayPerHop; // Don't count start and end
            
            this.supplyRoutes.set(fromTerritory.id, {
                targetId: toTerritory.id,
                path: path,
                delay: totalDelay,
                lastValidation: Date.now()
            });
            
            console.log(`Supply route created: ${fromTerritory.id} → ${toTerritory.id} (${path.length - 1} hops, ${totalDelay}ms delay)`);
            console.log('Path:', path.map(t => t.id).join(' → '));
        } else {
            console.log('No valid path found between territories');
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
        for (const territory of Object.values(this.gameMap.territories)) {
            const distance = Math.sqrt((x - territory.x) ** 2 + (y - territory.y) ** 2);
            if (distance <= territory.radius) {
                return territory;
            }
        }
        return null;
    }
    
    // Core fleet command execution with percentage control
    executeFleetCommand(fromTerritory, toTerritory, fleetPercentage) {
        if (!fromTerritory || !toTerritory || fromTerritory.ownerId !== this.humanPlayer?.id) {
            return;
        }
        
        // Validate warp lane connectivity (except for colonizable planets which can be probed)
        if (!toTerritory.isColonizable && !fromTerritory.neighbors.includes(toTerritory.id)) {
            console.log(`Cannot send fleet: No warp lane from ${fromTerritory.id} to ${toTerritory.id}`);
            return;
        }
        
        // Calculate ships to send based on percentage
        const availableShips = Math.max(0, fromTerritory.armySize - 1); // Always leave at least 1
        const shipsToSend = Math.max(1, Math.floor(availableShips * fleetPercentage));
        
        // Visual feedback - show number flying off
        this.showFleetCommandFeedback(fromTerritory, shipsToSend, fleetPercentage);
        
        if (toTerritory.ownerId === this.humanPlayer?.id) {
            // Transfer to own territory with specific amount
            this.transferFleetWithAmount(fromTerritory, toTerritory, shipsToSend);
            console.log(`Fleet transfer: ${shipsToSend} ships (${Math.round(fleetPercentage * 100)}%) from ${fromTerritory.id} to ${toTerritory.id}`);
        } else if (toTerritory.isColonizable) {
            // Probe colonizable territory
            this.launchProbe(fromTerritory, toTerritory);
            console.log(`Probe launched from ${fromTerritory.id} to colonizable ${toTerritory.id}`);
        } else {
            // Attack enemy territory with specific amount
            this.attackTerritoryWithAmount(fromTerritory, toTerritory, shipsToSend);
            console.log(`Attack: ${shipsToSend} ships (${Math.round(fleetPercentage * 100)}%) from ${fromTerritory.id} to ${toTerritory.id}`);
        }
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
        if (attackingTerritory.armySize <= 1) {
            console.log('Not enough armies to attack!');
            return;
        }
        
        // Trigger combat flash on both territories
        attackingTerritory.triggerCombatFlash();
        defendingTerritory.triggerCombatFlash();
        
        // Create ship animation for attack
        this.createShipAnimation(attackingTerritory, defendingTerritory, true);
        
        // Use 75% of armies for attack
        const attackingArmies = Math.floor(attackingTerritory.armySize * 0.75);
        const defendingArmies = defendingTerritory.armySize;
        
        console.log(`Attack: ${attackingArmies} vs ${defendingArmies}`);
        
        // Battle calculation with discovery bonuses
        let attackMultiplier = 0.8 + Math.random() * 0.4; // Base random factor
        let defenseMultiplier = 1.0 + Math.random() * 0.2; // Base defender advantage
        
        // Apply Precursor Weapons bonus to attacker (human player only)
        if (attackingTerritory.ownerId === this.humanPlayer?.id && this.discoveries.precursorWeapons > 0) {
            attackMultiplier *= (1 + this.discoveries.precursorWeapons * 0.1);
            console.log(`⚔️ Precursor Weapons bonus applied! Attack power increased by ${this.discoveries.precursorWeapons * 10}%`);
        }
        
        // Apply Precursor Shield bonus to defender (human player only)
        if (defendingTerritory.ownerId === this.humanPlayer?.id && this.discoveries.precursorShield > 0) {
            defenseMultiplier *= (1 + this.discoveries.precursorShield * 0.1);
            console.log(`🛡️ Precursor Shield bonus applied! Defense power increased by ${this.discoveries.precursorShield * 10}%`);
        }
        
        const attackPower = attackingArmies * attackMultiplier;
        const defensePower = defendingArmies * defenseMultiplier;
        
        if (attackPower > defensePower) {
            // Attack successful
            const oldOwnerId = defendingTerritory.ownerId;
            const survivingArmies = Math.max(1, attackingArmies - defendingArmies);
            
            // Check if this is a throne star capture
            if (defendingTerritory.isThronestar && oldOwnerId !== null) {
                const oldOwner = this.players[oldOwnerId];
                if (oldOwner) {
                    // THRONE STAR CAPTURED! Transfer ALL remaining territories
                    console.log(`THRONE STAR CAPTURED! ${oldOwner.name}'s empire falls to ${this.humanPlayer.name}!`);
                    
                    // Transfer all territories from old owner to attacker
                    const territoriesToTransfer = [...oldOwner.territories];
                    territoriesToTransfer.forEach(territoryId => {
                        const territory = this.gameMap.territories[territoryId];
                        if (territory && territory.ownerId === oldOwnerId) {
                            territory.ownerId = this.humanPlayer.id;
                            this.humanPlayer.territories.push(territoryId);
                        }
                    });
                    
                    // Clear old owner's territories
                    oldOwner.territories = [];
                    oldOwner.isEliminated = true;
                }
                
                // Destroy the captured throne star (no empire should have multiple thrones)
                defendingTerritory.isThronestar = false;
                defendingTerritory.ownerId = this.humanPlayer.id;
                defendingTerritory.armySize = survivingArmies;
                attackingTerritory.armySize -= attackingArmies;
                
                console.log(`👑 Throne star destroyed after capture - no duplicate thrones allowed`);
            } else {
                // Normal territory capture
                defendingTerritory.ownerId = this.humanPlayer.id;
                defendingTerritory.armySize = survivingArmies;
                attackingTerritory.armySize -= attackingArmies;
                
                // Update player territories
                this.humanPlayer.territories.push(defendingTerritory.id);
                
                if (oldOwnerId !== null) {
                    const oldOwner = this.players[oldOwnerId];
                    if (oldOwner) {
                        const index = oldOwner.territories.indexOf(defendingTerritory.id);
                        if (index > -1) {
                            oldOwner.territories.splice(index, 1);
                        }
                    }
                }
            }
            
            console.log('Territory captured!');
        } else {
            // Attack failed
            const survivingDefenders = Math.max(1, defendingArmies - Math.floor(attackingArmies * 0.7));
            const survivingAttackers = Math.max(1, Math.floor(attackingArmies * 0.3));
            
            defendingTerritory.armySize = survivingDefenders;
            attackingTerritory.armySize = attackingTerritory.armySize - attackingArmies + survivingAttackers;
            
            console.log('Attack failed!');
        }
        
        // Update player stats
        this.players.forEach(player => player.updateStats());
    }
    
    // Enhanced attack method with custom army amount
    attackTerritoryWithAmount(attackingTerritory, defendingTerritory, attackingArmies) {
        if (attackingTerritory.armySize <= 1) {
            console.log('Not enough armies to attack!');
            return;
        }
        
        // Ensure we don't use more armies than available (minus 1 to keep)
        const maxAttack = attackingTerritory.armySize - 1;
        const actualAttack = Math.min(attackingArmies, maxAttack);
        
        if (actualAttack <= 0) {
            console.log('No armies available to attack!');
            return;
        }
        
        // Trigger combat flash on both territories
        attackingTerritory.triggerCombatFlash();
        defendingTerritory.triggerCombatFlash();
        
        // Create ship animation for attack
        this.createShipAnimation(attackingTerritory, defendingTerritory, true);
        
        const defendingArmies = defendingTerritory.armySize;
        
        console.log(`Custom Attack: ${actualAttack} vs ${defendingArmies}`);
        
        // Battle calculation with discovery bonuses
        let attackMultiplier = 0.8 + Math.random() * 0.4; // Base random factor
        let defenseMultiplier = 1.0 + Math.random() * 0.2; // Base defender advantage
        
        // Apply Precursor Weapons bonus to attacker (human player only)
        if (attackingTerritory.ownerId === this.humanPlayer?.id && this.discoveries.precursorWeapons > 0) {
            attackMultiplier *= (1 + this.discoveries.precursorWeapons * 0.1);
        }
        
        // Apply Precursor Shield bonus to defender (human player only)
        if (defendingTerritory.ownerId === this.humanPlayer?.id && this.discoveries.precursorShield > 0) {
            defenseMultiplier *= (1 + this.discoveries.precursorShield * 0.1);
        }
        
        const attackPower = actualAttack * attackMultiplier;
        const defensePower = defendingArmies * defenseMultiplier;
        
        if (attackPower > defensePower) {
            // Attack successful
            const oldOwnerId = defendingTerritory.ownerId;
            const survivingArmies = Math.max(1, actualAttack - defendingArmies);
            
            // Check if this is a throne star capture
            if (defendingTerritory.isThronestar && oldOwnerId !== null) {
                const oldOwner = this.players[oldOwnerId];
                if (oldOwner) {
                    console.log(`THRONE STAR CAPTURED! ${oldOwner.name}'s empire falls!`);
                    
                    // Transfer all territories from old owner to attacker
                    const territoriesToTransfer = [...oldOwner.territories];
                    territoriesToTransfer.forEach(territoryId => {
                        const territory = this.gameMap.territories[territoryId];
                        if (territory && territory.ownerId === oldOwnerId) {
                            territory.ownerId = this.humanPlayer.id;
                            this.humanPlayer.territories.push(territoryId);
                        }
                    });
                    
                    // Clear old owner's territories
                    oldOwner.territories = [];
                    oldOwner.isEliminated = true;
                }
                
                // Destroy the captured throne star
                defendingTerritory.isThronestar = false;
                defendingTerritory.ownerId = this.humanPlayer.id;
                defendingTerritory.armySize = survivingArmies;
                attackingTerritory.armySize -= actualAttack;
                
                console.log(`👑 Throne star destroyed after capture`);
            } else {
                // Normal territory capture
                defendingTerritory.ownerId = this.humanPlayer.id;
                defendingTerritory.armySize = survivingArmies;
                attackingTerritory.armySize -= actualAttack;
                
                // Update player territories
                this.humanPlayer.territories.push(defendingTerritory.id);
                
                if (oldOwnerId !== null) {
                    const oldOwner = this.players[oldOwnerId];
                    if (oldOwner) {
                        const index = oldOwner.territories.indexOf(defendingTerritory.id);
                        if (index > -1) {
                            oldOwner.territories.splice(index, 1);
                        }
                    }
                }
            }
            
            console.log('Territory captured with custom attack!');
        } else {
            // Attack failed
            const survivingDefenders = Math.max(1, defendingArmies - Math.floor(actualAttack * 0.7));
            const survivingAttackers = Math.max(1, Math.floor(actualAttack * 0.3));
            
            defendingTerritory.armySize = survivingDefenders;
            attackingTerritory.armySize = attackingTerritory.armySize - actualAttack + survivingAttackers;
            
            console.log('Custom attack failed!');
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
        this.gameMap = new GameMap(2000, 1500);
        this.startGame();
    }
}
