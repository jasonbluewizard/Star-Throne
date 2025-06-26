export class GameUI {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;
        
        // UI state
        this.showLeaderboard = true;
        this.showMinimap = true;
        this.showStats = true;
        this.showHelp = false;
        
        // Animation
        this.animationPhase = 0;
        
        // Colors
        this.bgColor = 'rgba(0, 0, 0, 0.7)';
        this.textColor = '#ffffff';
        this.accentColor = '#00aaff';
        this.warningColor = '#ff4444';
        this.successColor = '#44ff44';
    }
    
    render(ctx, gameData) {
        this.animationPhase += 0.02;
        
        // Render different UI elements based on game state
        switch (gameData.gameState) {
            case 'lobby':
                this.renderLobbyUI(ctx, gameData);
                break;
            case 'playing':
                this.renderGameUI(ctx, gameData);
                break;
            case 'ended':
                this.renderEndGameUI(ctx, gameData);
                break;
        }
    }
    
    renderLobbyUI(ctx, gameData) {
        // Title screen
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.fillStyle = this.textColor;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Territorial Conquest', this.canvas.width / 2, this.canvas.height / 2 - 100);
        
        ctx.font = '24px Arial';
        ctx.fillText('Massive Multiplayer Strategy Game', this.canvas.width / 2, this.canvas.height / 2 - 50);
        
        ctx.font = '18px Arial';
        ctx.fillText('Click anywhere to start', this.canvas.width / 2, this.canvas.height / 2 + 50);
        
        // Animated dots
        const dots = '...'.substring(0, Math.floor(this.animationPhase * 3) % 4);
        ctx.fillText(`Loading${dots}`, this.canvas.width / 2, this.canvas.height / 2 + 100);
    }
    
    renderGameUI(ctx, gameData) {
        // Top bar with timer and game info
        this.renderTopBar(ctx, gameData);
        
        // Leaderboard
        if (this.showLeaderboard) {
            this.renderLeaderboard(ctx, gameData);
        }
        
        // Selected territory info
        if (gameData.selectedTerritory) {
            this.renderTerritoryInfo(ctx, gameData);
        }
        
        // Human player stats
        if (gameData.humanPlayer && !gameData.humanPlayer.isEliminated) {
            this.renderPlayerStats(ctx, gameData);
        } else if (gameData.humanPlayer && gameData.humanPlayer.isEliminated) {
            this.renderSpectatorMessage(ctx);
        }
        
        // Help panel
        this.renderHelpPanel(ctx);
        
        // Performance info
        this.renderPerformanceInfo(ctx, gameData);
        
        // Minimap
        if (this.showMinimap) {
            this.renderMinimap(ctx, gameData);
        }
    }
    
    renderEndGameUI(ctx, gameData) {
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Game Over title
        ctx.fillStyle = this.textColor;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2 - 150);
        
        // Final leaderboard
        this.renderFinalLeaderboard(ctx, gameData);
        
        // Restart instruction
        ctx.font = '18px Arial';
        ctx.fillText('Press R to restart', this.canvas.width / 2, this.canvas.height - 50);
    }
    
    renderTopBar(ctx, gameData) {
        const barHeight = 60;
        
        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, this.canvas.width, barHeight);
        
        // Timer
        const timeLeft = Math.max(0, gameData.gameTimer);
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        ctx.fillStyle = timeLeft < 60000 ? this.warningColor : this.textColor;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(timeString, this.canvas.width / 2, 35);
        
        // Player count
        ctx.fillStyle = this.textColor;
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Players: ${gameData.currentPlayers}/${gameData.maxPlayers}`, 20, 25);
        
        // Game title
        ctx.textAlign = 'left';
        ctx.fillText('Territorial Conquest', 20, 45);
        
        // Camera info
        ctx.textAlign = 'right';
        const zoom = (this.camera.zoom * 100).toFixed(0);
        ctx.fillText(`Zoom: ${zoom}%`, this.canvas.width - 20, 25);
    }
    
    renderLeaderboard(ctx, gameData) {
        const startX = this.canvas.width - 250;
        const startY = 80;
        const width = 230;
        const itemHeight = 25;
        
        // Sort players by score
        const sortedPlayers = gameData.players
            .filter(p => !p.isEliminated)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // Top 10
        
        const height = 40 + sortedPlayers.length * itemHeight;
        
        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(startX, startY, width, height);
        
        // Title
        ctx.fillStyle = this.accentColor;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Leaderboard', startX + width / 2, startY + 20);
        
        // Player entries
        sortedPlayers.forEach((player, index) => {
            const y = startY + 40 + index * itemHeight;
            const isHuman = player === gameData.humanPlayer;
            
            // Rank
            ctx.fillStyle = this.textColor;
            ctx.font = isHuman ? 'bold 14px Arial' : '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${index + 1}.`, startX + 10, y);
            
            // Player color indicator
            ctx.fillStyle = player.color;
            ctx.fillRect(startX + 35, y - 8, 12, 12);
            
            // Player name
            ctx.fillStyle = isHuman ? this.accentColor : this.textColor;
            ctx.textAlign = 'left';
            const name = player.name.length > 10 ? player.name.substring(0, 10) + '...' : player.name;
            ctx.fillText(name, startX + 55, y);
            
            // Territory count
            ctx.fillStyle = this.textColor;
            ctx.textAlign = 'right';
            ctx.fillText(player.territories.length.toString(), startX + width - 10, y);
        });
        
        // Eliminated count
        const eliminatedCount = gameData.players.filter(p => p.isEliminated).length;
        if (eliminatedCount > 0) {
            ctx.fillStyle = this.textColor;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${eliminatedCount} eliminated`, startX + width / 2, startY + height + 15);
        }
    }
    
    renderTerritoryInfo(ctx, gameData) {
        const territory = gameData.selectedTerritory;
        const startX = 20;
        const startY = this.canvas.height - 150;
        const width = 200;
        const height = 120;
        
        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(startX, startY, width, height);
        
        // Title
        ctx.fillStyle = this.accentColor;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Territory ${territory.id}`, startX + 10, startY + 20);
        
        // Owner info
        if (territory.ownerId !== null) {
            const owner = gameData.players[territory.ownerId];
            if (owner) {
                ctx.fillStyle = owner.color;
                ctx.fillRect(startX + 10, startY + 30, 12, 12);
                
                ctx.fillStyle = this.textColor;
                ctx.font = '14px Arial';
                ctx.fillText(`Owner: ${owner.name}`, startX + 30, startY + 40);
            }
        } else {
            ctx.fillStyle = this.textColor;
            ctx.font = '14px Arial';
            ctx.fillText('Neutral Territory', startX + 10, startY + 40);
        }
        
        // Army count
        ctx.fillText(`Armies: ${territory.armySize}`, startX + 10, startY + 60);
        
        // Neighbors
        ctx.font = '12px Arial';
        ctx.fillText(`Neighbors: ${territory.neighbors.length}`, startX + 10, startY + 80);
        
        // Action hint
        if (territory.ownerId === gameData.humanPlayer.id) {
            ctx.fillStyle = this.successColor;
            ctx.fillText('Click neighbor to attack', startX + 10, startY + 100);
        } else if (gameData.selectedTerritory && 
                   gameData.selectedTerritory.ownerId === gameData.humanPlayer.id &&
                   gameData.selectedTerritory.neighbors.includes(territory.id)) {
            ctx.fillStyle = this.warningColor;
            ctx.fillText('Click to attack', startX + 10, startY + 100);
        }
    }
    
    renderPlayerStats(ctx, gameData) {
        const player = gameData.humanPlayer;
        const startX = 250;
        const startY = this.canvas.height - 100;
        const width = 200;
        const height = 80;
        
        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(startX, startY, width, height);
        
        // Player name
        ctx.fillStyle = this.accentColor;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(player.name, startX + 10, startY + 20);
        
        // Stats
        ctx.fillStyle = this.textColor;
        ctx.font = '14px Arial';
        ctx.fillText(`Territories: ${player.territories.length}`, startX + 10, startY + 40);
        ctx.fillText(`Total Armies: ${player.totalArmies}`, startX + 10, startY + 55);
        ctx.fillText(`Score: ${player.score}`, startX + 10, startY + 70);
    }
    
    renderSpectatorMessage(ctx) {
        const startX = this.canvas.width / 2 - 150;
        const startY = 100;
        const width = 300;
        const height = 60;
        
        // Background
        ctx.fillStyle = 'rgba(255, 68, 68, 0.9)';
        ctx.fillRect(startX, startY, width, height);
        
        // Message
        ctx.fillStyle = this.textColor;
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('You have been eliminated!', startX + width / 2, startY + 25);
        
        ctx.font = '14px Arial';
        ctx.fillText('Spectator Mode', startX + width / 2, startY + 45);
    }
    
    renderHelpPanel(ctx) {
        const startX = 20;
        const startY = 80;
        const width = 200;
        const height = 120;
        
        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(startX, startY, width, height);
        
        // Title
        ctx.fillStyle = this.accentColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Controls', startX + 10, startY + 18);
        
        // Help text
        ctx.fillStyle = this.textColor;
        ctx.font = '12px Arial';
        const helpLines = [
            'Left Click: Select/Attack',
            'Right Click + Drag: Pan',
            'Mouse Wheel: Zoom',
            'ESC: Deselect',
            'R: Restart (when ended)'
        ];
        
        helpLines.forEach((line, index) => {
            ctx.fillText(line, startX + 10, startY + 35 + index * 15);
        });
    }
    
    renderPerformanceInfo(ctx, gameData) {
        ctx.fillStyle = this.textColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`FPS: ${gameData.fps}`, this.canvas.width - 20, this.canvas.height - 10);
    }
    
    renderMinimap(ctx, gameData) {
        const size = 150;
        const startX = this.canvas.width - size - 20;
        const startY = this.canvas.height - size - 20;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(startX, startY, size, size);
        
        // Border
        ctx.strokeStyle = this.accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, size, size);
        
        // Calculate scale
        const mapWidth = 2000; // From GameMap
        const mapHeight = 1500;
        const scaleX = size / mapWidth;
        const scaleY = size / mapHeight;
        
        // Draw territories on minimap
        Object.values(gameData.players).forEach(player => {
            if (player.isEliminated) return;
            
            ctx.fillStyle = player.color;
            player.territories.forEach(territoryId => {
                const territory = gameData.selectedTerritory ? 
                    (gameData.selectedTerritory.id === territoryId ? gameData.selectedTerritory : null) : null;
                // This is a simplified version - in real implementation we'd access territories from gameMap
                
                if (territory) {
                    const x = startX + territory.x * scaleX;
                    const y = startY + territory.y * scaleY;
                    const radius = Math.max(1, territory.radius * scaleX * 0.5);
                    
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        });
        
        // Draw camera viewport
        if (this.camera) {
            const viewBounds = this.camera.getViewBounds();
            const viewX = startX + viewBounds.left * scaleX;
            const viewY = startY + viewBounds.top * scaleY;
            const viewWidth = (viewBounds.right - viewBounds.left) * scaleX;
            const viewHeight = (viewBounds.bottom - viewBounds.top) * scaleY;
            
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(viewX, viewY, viewWidth, viewHeight);
        }
        
        // Minimap title
        ctx.fillStyle = this.textColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Map', startX + size / 2, startY - 5);
    }
    
    renderFinalLeaderboard(ctx, gameData) {
        const startX = this.canvas.width / 2 - 200;
        const startY = this.canvas.height / 2 - 50;
        const width = 400;
        const itemHeight = 30;
        
        // Sort all players by score
        const sortedPlayers = [...gameData.players].sort((a, b) => b.score - a.score);
        const height = 60 + sortedPlayers.length * itemHeight;
        
        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(startX, startY, width, height);
        
        // Title
        ctx.fillStyle = this.accentColor;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Final Results', startX + width / 2, startY + 30);
        
        // Player entries
        sortedPlayers.forEach((player, index) => {
            const y = startY + 60 + index * itemHeight;
            const isHuman = player === gameData.humanPlayer;
            const isWinner = index === 0 && !player.isEliminated;
            
            // Background for winner
            if (isWinner) {
                ctx.fillStyle = 'rgba(68, 255, 68, 0.2)';
                ctx.fillRect(startX + 5, y - 20, width - 10, itemHeight - 5);
            }
            
            // Rank
            ctx.fillStyle = isWinner ? this.successColor : this.textColor;
            ctx.font = isHuman ? 'bold 16px Arial' : '16px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${index + 1}.`, startX + 20, y);
            
            // Player color
            ctx.fillStyle = player.color;
            ctx.fillRect(startX + 50, y - 10, 15, 15);
            
            // Player name
            ctx.fillStyle = isHuman ? this.accentColor : (isWinner ? this.successColor : this.textColor);
            ctx.fillText(player.name, startX + 75, y);
            
            // Stats
            ctx.fillStyle = this.textColor;
            ctx.font = '14px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`${player.territories.length} territories`, startX + width - 120, y - 5);
            ctx.fillText(`${player.score} points`, startX + width - 120, y + 10);
            
            // Status
            if (player.isEliminated) {
                ctx.fillStyle = this.warningColor;
                ctx.fillText('Eliminated', startX + width - 20, y);
            } else if (isWinner) {
                ctx.fillStyle = this.successColor;
                ctx.fillText('Winner!', startX + width - 20, y);
            }
        });
    }
}
