import { GameMap } from './GameMap.js';
import { Player } from './Player.js';
import { GameUI } from './GameUI.js';
import { Camera } from './Camera.js';
import { Probe } from './Probe.js';

export default class TerritorialConquest {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameMap = null;
        this.players = [];
        this.humanPlayer = null;
        this.camera = null;
        this.ui = null;
        
        // Game state
        this.gameState = 'lobby'; // lobby, playing, ended
        this.gameTimer = 10 * 60 * 1000; // 10 minutes
        this.maxPlayers = 100;
        this.currentPlayers = 0;
        
        // Input handling
        this.mousePos = { x: 0, y: 0 };
        this.selectedTerritory = null;
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        
        // Performance
        this.lastFrameTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        // Ship movement animations
        this.shipAnimations = [];
        this.leaderboardMinimized = false;
        this.minimapMinimized = true; // Default minimap to off
        
        // Probe system
        this.probes = [];
        this.nextProbeId = 0;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.gameMap = new GameMap(2000, 1500); // Large map
        this.gameMap.game = this; // Reference for AI animations
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        
        // Center camera on map and set appropriate zoom
        this.camera.centerOn(1000, 750); // Center of 2000x1500 map
        this.camera.targetZoom = 0.4; // Zoom out to see more territories
        this.camera.zoom = 0.4;
        
        this.ui = new GameUI(this.canvas, this.camera);
        
        this.startGame();
        this.gameLoop();
    }
    
    // Create ship movement animation
    createShipAnimation(fromTerritory, toTerritory, isAttack = false) {
        const player = this.players[fromTerritory.ownerId];
        const playerColor = player ? player.color : '#ffffff';
        
        this.shipAnimations.push({
            fromX: fromTerritory.x,
            fromY: fromTerritory.y,
            toX: toTerritory.x,
            toY: toTerritory.y,
            progress: 0,
            duration: 1000, // 1 second
            startTime: Date.now(),
            isAttack: isAttack,
            playerColor: playerColor,
            id: Math.random()
        });
    }
    
    // Update ship animations
    updateShipAnimations(deltaTime) {
        const currentTime = Date.now();
        this.shipAnimations = this.shipAnimations.filter(animation => {
            animation.progress = (currentTime - animation.startTime) / animation.duration;
            return animation.progress < 1;
        });
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
        
        // Set ownership and initial army strength
        planet.ownerId = player.id;
        planet.armySize = 10; // Probes colonize with strength 10
        
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
        
        console.log(`Planet ${planet.id} colonized! Revealed ${planet.neighbors.length} connections.`);
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
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
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
        
        // Additional touch state tracking
        this.touchStartTime = 0;
        this.touchStartDistance = null;
        this.isMultiTouch = false;
        this.touchDebugInfo = '';
        this.showTouchDebug = true; // Turn on debug to help with mobile zoom
        this.leaderboardMinimized = false;
        
        // Keyboard events
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    startGame() {
        console.log('Starting Territorial Conquest game...');
        
        // Generate territories
        this.gameMap.generateTerritories(150); // 150 territories for large-scale gameplay
        
        // Create players (1 human + up to 99 AI)
        this.createPlayers(20); // Start with 20 players for testing
        
        // Distribute initial territories
        this.distributeStartingTerritories();
        
        // Center camera on human player's starting territory
        if (this.humanPlayer && this.humanPlayer.territories.length > 0) {
            const startTerritory = this.gameMap.territories[this.humanPlayer.territories[0]];
            this.camera.centerOn(startTerritory.x, startTerritory.y);
        }
        
        this.gameState = 'playing';
        console.log(`Game started with ${this.players.length} players and ${Object.keys(this.gameMap.territories).length} territories`);
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
        
        // Create AI players with unique colors (no brightness adjustment to avoid duplicates)
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
            this.players.push(new Player(i, `AI Player ${i}`, playerColor, 'ai'));
        }
        
        this.currentPlayers = this.players.length;
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
        // Filter out colonizable planets from starting territory distribution
        const availableTerritoryIds = Object.keys(this.gameMap.territories).filter(id => {
            const territory = this.gameMap.territories[id];
            return !territory.isColonizable;
        });
        
        const shuffledIds = this.shuffleArray([...availableTerritoryIds]);
        
        console.log(`Available territories for distribution: ${availableTerritoryIds.length} (excluding colonizable planets)`);
        
        // Give each player starting territories
        let territoryIndex = 0;
        for (const player of this.players) {
            // Human player gets only 1 territory, AI players get 1-3
            const startingTerritories = player.type === 'human' ? 1 : Math.floor(Math.random() * 3) + 1;
            
            for (let i = 0; i < startingTerritories && territoryIndex < shuffledIds.length; i++) {
                const territoryId = shuffledIds[territoryIndex];
                const territory = this.gameMap.territories[territoryId];
                
                if (territory && !territory.ownerId && !territory.isColonizable) {
                    territory.ownerId = player.id;
                    territory.armySize = Math.floor(Math.random() * 20) + 10;
                    player.territories.push(parseInt(territoryId));
                    player.totalArmies += territory.armySize;
                    territoryIndex++;
                }
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
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Update FPS counter
        this.updateFPS(currentTime);
        
        if (this.gameState === 'playing') {
            this.update(deltaTime);
        }
        
        this.render();
        
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
        // Update game timer
        this.gameTimer -= deltaTime;
        
        if (this.gameTimer <= 0) {
            this.endGame();
            return;
        }
        
        // Update players (AI logic, army generation)
        this.players.forEach(player => {
            if (!player.isEliminated) {
                player.update(deltaTime, this.gameMap);
            }
        });
        
        // Update ship animations
        this.updateShipAnimations(deltaTime);
        
        // Update probes
        this.updateProbes(deltaTime);
        
        // Check for player elimination
        this.checkPlayerElimination();
        
        // Check win conditions
        this.checkWinConditions();
        
        // Update camera
        this.camera.update(deltaTime);
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
        
        // Clear canvas with space background
        this.ctx.fillStyle = '#001122';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context for camera transform
        this.ctx.save();
        
        // Apply camera transformation
        this.camera.applyTransform(this.ctx);
        
        // Render game world
        this.renderTerritories();
        this.renderConnections();
        this.renderShipAnimations();
        this.renderProbes();
        this.renderArmies();
        
        // Restore context
        this.ctx.restore();
        
        // Render UI (not affected by camera)
        this.renderUI();
    }
    
    renderTerritories() {
        const viewBounds = this.camera.getViewBounds();
        let visibleCount = 0;
        
        Object.values(this.gameMap.territories).forEach(territory => {
            // Frustum culling - only render visible territories
            if (territory.x + territory.radius < viewBounds.left ||
                territory.x - territory.radius > viewBounds.right ||
                territory.y + territory.radius < viewBounds.top ||
                territory.y - territory.radius > viewBounds.bottom) {
                return;
            }
            
            visibleCount++;
            territory.render(this.ctx, this.players, this.selectedTerritory);
        });
        
        // Removed debug logging for cleaner console output
    }
    
    renderConnections() {
        const viewBounds = this.camera.getViewBounds();
        
        this.ctx.lineWidth = 4; // Thicker lines for better visibility
        this.ctx.globalAlpha = 0.7;
        
        Object.values(this.gameMap.territories).forEach(territory => {
            // Skip if territory is outside view
            if (territory.x + territory.radius < viewBounds.left ||
                territory.x - territory.radius > viewBounds.right ||
                territory.y + territory.radius < viewBounds.top ||
                territory.y - territory.radius > viewBounds.bottom) {
                return;
            }
            
            territory.neighbors.forEach(neighborId => {
                const neighbor = this.gameMap.territories[neighborId];
                if (neighbor && neighborId > territory.id) { // Draw each connection only once
                    
                    // Skip connections to/from colonizable planets
                    if (territory.isColonizable || neighbor.isColonizable) {
                        return;
                    }
                    
                    // Check if both territories have the same owner
                    if (territory.ownerId !== null && 
                        neighbor.ownerId !== null && 
                        territory.ownerId === neighbor.ownerId) {
                        // Same owner - use the player's color
                        const owner = this.players[territory.ownerId];
                        this.ctx.strokeStyle = owner ? owner.color : '#666677';
                    } else {
                        // Different owners or one is neutral - use default gray
                        this.ctx.strokeStyle = '#666677';
                    }
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(territory.x, territory.y);
                    this.ctx.lineTo(neighbor.x, neighbor.y);
                    this.ctx.stroke();
                }
            });
        });
        
        this.ctx.globalAlpha = 1;
    }
    
    renderArmies() {
        Object.values(this.gameMap.territories).forEach(territory => {
            if (territory.ownerId !== null && territory.armySize > 0) {
                const owner = this.players[territory.ownerId];
                if (owner) {
                    // Render army count with shadow for better readability
                    this.ctx.font = 'bold 14px Arial';
                    this.ctx.textAlign = 'center';
                    
                    // Draw shadow
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    this.ctx.fillText(
                        territory.armySize.toString(),
                        territory.x + 1,
                        territory.y + 6
                    );
                    
                    // Draw main text
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.fillText(
                        territory.armySize.toString(),
                        territory.x,
                        territory.y + 5
                    );
                }
            }
        });
    }
    
    renderUI() {
        if (this.ui) {
            this.ui.render(this.ctx, {
                gameState: this.gameState,
                gameTimer: this.gameTimer,
                players: this.players,
                humanPlayer: this.humanPlayer,
                selectedTerritory: this.selectedTerritory,
                fps: this.fps,
                currentPlayers: this.currentPlayers,
                maxPlayers: this.maxPlayers,
                touchDebugInfo: this.touchDebugInfo,
                showTouchDebug: this.showTouchDebug,
                leaderboardMinimized: this.leaderboardMinimized,
                minimapMinimized: this.minimapMinimized,
                camera: this.camera
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
        
        if (e.button === 2) { // Right click starts immediate drag
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
            
            if (dragDistance > 8) {
                this.isDragging = true;
            }
        }
        
        // Pan camera if dragging
        if (this.isDragging && this.mousePos) {
            const deltaX = newMousePos.x - this.mousePos.x;
            const deltaY = newMousePos.y - this.mousePos.y;
            
            // Apply camera panning scaled by zoom level
            this.camera.pan(-deltaX / this.camera.zoom, -deltaY / this.camera.zoom);
        }
        
        this.mousePos = newMousePos;
    }
    
    handleMouseUp(e) {
        // Check if this was a quick click (not a drag)
        const clickDuration = Date.now() - (this.dragStartTime || 0);
        const wasQuickClick = clickDuration < 300 && !this.isDragging;
        
        if (e.button === 0 && (wasQuickClick || !this.isDragging)) {
            // Left click - handle territory selection
            const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
            this.handleTerritorySelection(worldPos);
        }
        
        // Reset drag state
        this.isDragging = false;
        this.dragStartPos = null;
        this.dragStartTime = null;
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        if (!this.camera) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        
        // Use the camera's zoomTo method directly to avoid naming conflict
        const newZoom = Math.max(0.1, Math.min(3.0, this.camera.targetZoom * zoomFactor));
        this.camera.zoomTo(newZoom, mouseX, mouseY);
        
        console.log('Mouse wheel zoom:', Math.round(this.camera.targetZoom * 100) + '%');
    }
    
    handleTerritorySelection(worldPos) {
        // Check for restart button on game over screen (mobile-friendly)
        if (this.gameState === 'ended' && this.ui && this.ui.restartButton) {
            const button = this.ui.restartButton;
            const screenPos = this.camera.worldToScreen(worldPos.x, worldPos.y);
            
            if (screenPos.x >= button.x && screenPos.x <= button.x + button.width &&
                screenPos.y >= button.y && screenPos.y <= button.y + button.height) {
                this.restartGame();
                return;
            }
        }
        
        // Check for leaderboard click (screen coordinates, not world coordinates)
        const screenPos = this.camera.worldToScreen(worldPos.x, worldPos.y);
        const leaderboardX = this.canvas.width - 220;
        const leaderboardY = 60;
        const leaderboardWidth = 200;
        const leaderboardHeight = this.leaderboardMinimized ? 30 : 200;
        
        if (screenPos.x >= leaderboardX && screenPos.x <= leaderboardX + leaderboardWidth &&
            screenPos.y >= leaderboardY && screenPos.y <= leaderboardY + leaderboardHeight) {
            this.leaderboardMinimized = !this.leaderboardMinimized;
            console.log('Leaderboard toggled:', this.leaderboardMinimized ? 'minimized' : 'maximized');
            return;
        }
        
        // Check for minimap click
        const minimapSize = 150;
        const minimapX = this.canvas.width - minimapSize - 20;
        const minimapY = this.canvas.height - minimapSize - 20;
        const minimapHeight = this.minimapMinimized ? 30 : minimapSize;
        
        if (screenPos.x >= minimapX && screenPos.x <= minimapX + minimapSize &&
            screenPos.y >= minimapY && screenPos.y <= minimapY + minimapHeight) {
            this.minimapMinimized = !this.minimapMinimized;
            console.log('Minimap toggled:', this.minimapMinimized ? 'minimized' : 'maximized');
            return;
        }
        
        // Check for zoom controls click
        const buttonSize = 50;
        const margin = 20;
        const spacing = 5;
        const zoomInX = margin;
        const zoomInY = this.canvas.height - margin - buttonSize;
        const zoomOutX = margin;
        const zoomOutY = this.canvas.height - margin - (buttonSize * 2) - spacing;
        
        // Zoom In button
        if (screenPos.x >= zoomInX && screenPos.x <= zoomInX + buttonSize &&
            screenPos.y >= zoomInY && screenPos.y <= zoomInY + buttonSize) {
            this.camera.targetZoom = Math.min(this.camera.maxZoom, this.camera.targetZoom * 1.2);
            console.log('Zoom In - new zoom:', (this.camera.targetZoom * 100).toFixed(0) + '%');
            return;
        }
        
        // Zoom Out button
        if (screenPos.x >= zoomOutX && screenPos.x <= zoomOutX + buttonSize &&
            screenPos.y >= zoomOutY && screenPos.y <= zoomOutY + buttonSize) {
            this.camera.targetZoom = Math.max(this.camera.minZoom, this.camera.targetZoom / 1.2);
            console.log('Zoom Out - new zoom:', (this.camera.targetZoom * 100).toFixed(0) + '%');
            return;
        }
        
        if (this.gameState !== 'playing') return;
        
        // Find clicked territory
        const clickedTerritory = this.findTerritoryAt(worldPos.x, worldPos.y);
        
        if (!clickedTerritory) {
            this.selectedTerritory = null;
            return;
        }
        
        // If clicking on own territory
        if (clickedTerritory.ownerId === this.humanPlayer.id) {
            // If we already have a territory selected and clicking another owned territory
            if (this.selectedTerritory && 
                this.selectedTerritory.ownerId === this.humanPlayer.id &&
                this.selectedTerritory.id !== clickedTerritory.id &&
                this.selectedTerritory.neighbors.includes(clickedTerritory.id)) {
                
                // Transfer half the fleet from selected to clicked territory
                this.transferFleet(this.selectedTerritory, clickedTerritory);
                this.selectedTerritory = null;
                return;
            }
            
            this.selectedTerritory = clickedTerritory;
            return;
        }
        
        // If clicking on a colonizable planet, launch a probe
        if (clickedTerritory.isColonizable && this.selectedTerritory && 
            this.selectedTerritory.ownerId === this.humanPlayer.id) {
            
            this.launchProbe(this.selectedTerritory, clickedTerritory);
            this.selectedTerritory = null;
            return;
        }
        
        // If we have a selected territory and clicking on a neighbor, attack (but not colonizable planets)
        if (this.selectedTerritory && 
            this.selectedTerritory.ownerId === this.humanPlayer.id &&
            this.selectedTerritory.neighbors.includes(clickedTerritory.id) &&
            !clickedTerritory.isColonizable) {
            
            this.attackTerritory(this.selectedTerritory, clickedTerritory);
        }
        
        this.selectedTerritory = clickedTerritory;
    }
    
    launchProbe(fromTerritory, toTerritory) {
        const probeCost = 10;
        
        if (fromTerritory.armySize < probeCost) {
            console.log('Not enough fleet power to launch probe! Need 10 fleet power.');
            return;
        }
        
        // Create probe
        const probe = new Probe(
            this.nextProbeId++,
            fromTerritory,
            toTerritory,
            this.humanPlayer.id,
            this.humanPlayer.color
        );
        
        this.probes.push(probe);
        fromTerritory.armySize -= probeCost;
        
        console.log(`Probe launched from territory ${fromTerritory.id} to colonizable planet ${toTerritory.id}`);
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
    
    findTerritoryAt(x, y) {
        for (const territory of Object.values(this.gameMap.territories)) {
            const distance = Math.sqrt((x - territory.x) ** 2 + (y - territory.y) ** 2);
            if (distance <= territory.radius) {
                return territory;
            }
        }
        return null;
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
        
        // Simple battle calculation
        const attackPower = attackingArmies * (0.8 + Math.random() * 0.4); // Random factor
        const defensePower = defendingArmies * (1.0 + Math.random() * 0.2); // Defender advantage
        
        if (attackPower > defensePower) {
            // Attack successful
            const oldOwnerId = defendingTerritory.ownerId;
            const survivingArmies = Math.max(1, attackingArmies - defendingArmies);
            
            // Transfer territory
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
            
            this.touchDebugInfo += `\nSingle: ${Math.round(this.mousePos.x)}, ${Math.round(this.mousePos.y)}`;
            
        } else if (e.touches.length === 2) {
            // Two touches - prepare for pinch zoom and pan
            this.isMultiTouch = true;
            this.isDragging = true;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            // Store initial touch positions for pan/zoom
            this.touchStartDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            this.lastMousePos = {
                x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
                y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
            };
            
            this.touchDebugInfo += `\nPinch: dist ${Math.round(this.touchStartDistance)}`;
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
            
            if (this.touchStartDistance && Math.abs(currentDistance - this.touchStartDistance) > 5) {
                // More sensitive zoom with smaller threshold
                const rawZoomFactor = currentDistance / this.touchStartDistance;
                // Smooth the zoom factor to prevent jarring movements
                const zoomFactor = 1 + (rawZoomFactor - 1) * 0.5;
                const centerX = ((touch1.clientX + touch2.clientX) / 2) - rect.left;
                const centerY = ((touch1.clientY + touch2.clientY) / 2) - rect.top;
                
                this.camera.zoom(zoomFactor, centerX, centerY);
                this.touchStartDistance = currentDistance;
                
                this.touchDebugInfo += `\nZoom: ${zoomFactor.toFixed(2)} (${this.camera.zoom.toFixed(2)})`;
            }
            
            // Pan based on center point movement
            const currentCenter = {
                x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
                y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
            };
            
            if (this.lastMousePos) {
                const deltaX = currentCenter.x - this.lastMousePos.x;
                const deltaY = currentCenter.y - this.lastMousePos.y;
                if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
                    this.camera.pan(-deltaX, -deltaY);
                    console.log('Two finger pan:', deltaX, deltaY);
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
            this.lastMousePos = null;
            
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
    
    handleKeyDown(e) {
        switch (e.key) {
            case 'Escape':
                this.selectedTerritory = null;
                break;
            case 'r':
            case 'R':
                if (this.gameState === 'ended') {
                    this.restartGame();
                }
                break;
            case 'd':
            case 'D':
                this.showTouchDebug = !this.showTouchDebug;
                break;
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
