import { GameMap } from './GameMap.js';
import { Player } from './Player.js';
import { GameUI } from './GameUI.js';
import { Camera } from './Camera.js';

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
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.gameMap = new GameMap(2000, 1500); // Large map
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        this.ui = new GameUI(this.canvas, this.camera);
        
        this.startGame();
        this.gameLoop();
    }
    
    setupCanvas() {
        // Create canvas element
        const canvasElement = document.createElement('canvas');
        canvasElement.id = 'gameCanvas';
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
        
        // Replace the root div content
        const root = document.getElementById('root');
        root.innerHTML = '';
        root.appendChild(canvasElement);
        
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        
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
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
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
        const colors = [
            '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff',
            '#ff8844', '#88ff44', '#4488ff', '#ff4488', '#88ff88', '#8844ff',
            '#ffaa44', '#aaff44', '#44aaff', '#ff44aa', '#aaff88', '#aa44ff',
            '#ff6644', '#66ff44', '#4466ff', '#ff4466', '#66ff88', '#6644ff'
        ];
        
        // Create human player
        this.humanPlayer = new Player(0, 'You', colors[0], 'human');
        this.players.push(this.humanPlayer);
        
        // Create AI players
        for (let i = 1; i < numPlayers && i < this.maxPlayers; i++) {
            const color = colors[i % colors.length];
            const adjustedColor = this.adjustColorBrightness(color, Math.random() * 0.4 - 0.2);
            this.players.push(new Player(i, `Player ${i}`, adjustedColor, 'ai'));
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
        const territoryIds = Object.keys(this.gameMap.territories);
        const shuffledIds = this.shuffleArray([...territoryIds]);
        
        // Give each player 1-3 starting territories
        let territoryIndex = 0;
        for (const player of this.players) {
            const startingTerritories = Math.floor(Math.random() * 3) + 1;
            
            for (let i = 0; i < startingTerritories && territoryIndex < shuffledIds.length; i++) {
                const territoryId = shuffledIds[territoryIndex];
                const territory = this.gameMap.territories[territoryId];
                
                if (territory && !territory.ownerId) {
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
        // Clear canvas
        this.ctx.fillStyle = '#001122';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context for camera transform
        this.ctx.save();
        
        // Apply camera transformation
        this.camera.applyTransform(this.ctx);
        
        // Render game world
        this.renderTerritories();
        this.renderConnections();
        this.renderArmies();
        
        // Restore context
        this.ctx.restore();
        
        // Render UI (not affected by camera)
        this.renderUI();
    }
    
    renderTerritories() {
        const viewBounds = this.camera.getViewBounds();
        
        Object.values(this.gameMap.territories).forEach(territory => {
            // Frustum culling - only render visible territories
            if (territory.x + territory.radius < viewBounds.left ||
                territory.x - territory.radius > viewBounds.right ||
                territory.y + territory.radius < viewBounds.top ||
                territory.y - territory.radius > viewBounds.bottom) {
                return;
            }
            
            territory.render(this.ctx, this.players, this.selectedTerritory);
        });
    }
    
    renderConnections() {
        const viewBounds = this.camera.getViewBounds();
        
        this.ctx.strokeStyle = '#334455';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.3;
        
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
                    // Render army count
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.font = '14px Arial';
                    this.ctx.textAlign = 'center';
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
                maxPlayers: this.maxPlayers
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
        
        // Convert screen coordinates to world coordinates
        const worldPos = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        
        if (e.button === 0) { // Left click
            this.handleTerritorySelection(worldPos);
        } else if (e.button === 2) { // Right click
            this.isDragging = true;
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        if (this.isDragging) {
            const deltaX = this.mousePos.x - this.lastMousePos.x;
            const deltaY = this.mousePos.y - this.lastMousePos.y;
            
            this.camera.pan(-deltaX, -deltaY);
        }
        
        this.lastMousePos = { ...this.mousePos };
    }
    
    handleMouseUp(e) {
        if (e.button === 2) { // Right click
            this.isDragging = false;
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.camera.zoom(zoomFactor, mouseX, mouseY);
    }
    
    handleTerritorySelection(worldPos) {
        if (this.gameState !== 'playing') return;
        
        // Find clicked territory
        const clickedTerritory = this.findTerritoryAt(worldPos.x, worldPos.y);
        
        if (!clickedTerritory) {
            this.selectedTerritory = null;
            return;
        }
        
        // If clicking on own territory, select it
        if (clickedTerritory.ownerId === this.humanPlayer.id) {
            this.selectedTerritory = clickedTerritory;
            return;
        }
        
        // If we have a selected territory and clicking on a neighbor, attack
        if (this.selectedTerritory && 
            this.selectedTerritory.ownerId === this.humanPlayer.id &&
            this.selectedTerritory.neighbors.includes(clickedTerritory.id)) {
            
            this.attackTerritory(this.selectedTerritory, clickedTerritory);
        }
        
        this.selectedTerritory = clickedTerritory;
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
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0
            });
            this.handleMouseDown(mouseEvent);
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseMove(mouseEvent);
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {
            button: 0
        });
        this.handleMouseUp(mouseEvent);
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
