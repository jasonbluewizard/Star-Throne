export class GameUI {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;
        
        // UI state
        this.showLeaderboard = true;
        this.showMinimap = false;
        this.showStats = true;
        this.showHelp = false;
        
        // Animation
        this.animationPhase = 0;
        
        // Colors with better contrast
        this.bgColor = 'rgba(0, 0, 0, 0.85)';
        this.textColor = '#ffffff';
        this.accentColor = '#00ddff';
        this.warningColor = '#ff4444';
        this.successColor = '#44ff44';
        this.shadowColor = 'rgba(0, 0, 0, 0.8)';
        
        // Tech level tooltip system
        this.techLevelAreas = {};
        this.hoveredTechType = null;
        
        // FSM preview system
        this.previewArrow = null; // { source, target, type }
        this.supplyModeActive = false;
    }

    // Helper function to render text with shadow for better readability
    renderTextWithShadow(ctx, text, x, y, fillColor = this.textColor, shadowOffset = 2) {
        // Draw shadow
        ctx.fillStyle = this.shadowColor;
        ctx.fillText(text, x + shadowOffset, y + shadowOffset);
        
        // Draw main text
        ctx.fillStyle = fillColor;
        ctx.fillText(text, x, y);
    }
    
    // Method for FSM to update UI state
    setInputState(state, data = {}) {
        this.inputState = state;
        this.inputStateData = data;
        
        // Update cursor based on FSM state
        if (this.canvas) {
            const cursorModes = {
                'Default': 'default',
                'TerritorySelected': 'pointer',
                'ProbeTargeting': 'crosshair',
                'EnemySelected': 'help'
            };
            this.canvas.style.cursor = cursorModes[state] || 'default';
        }
    }
    
    // FSM UI Methods for new tap-based control system
    showPreviewArrow(source, target, type) {
        this.previewArrow = { source, target, type };
    }
    
    hidePreviewArrow() {
        this.previewArrow = null;
    }
    
    enterSupplyMode() {
        this.supplyModeActive = true;
    }
    
    exitSupplyMode() {
        this.supplyModeActive = false;
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
        ctx.fillText('Star Throne', this.canvas.width / 2, this.canvas.height / 2 - 100);
        
        ctx.font = '24px Arial';
        ctx.fillText('Massive Multiplayer Strategy Game', this.canvas.width / 2, this.canvas.height / 2 - 50);
        
        ctx.font = '18px Arial';
        ctx.fillText('Click anywhere to start', this.canvas.width / 2, this.canvas.height / 2 + 50);
        
        // Animated dots
        const dots = '...'.substring(0, Math.floor(this.animationPhase * 3) % 4);
        ctx.fillText(`Loading${dots}`, this.canvas.width / 2, this.canvas.height / 2 + 100);
    }
    
    renderGameUI(ctx, gameData) {
        // Render preview arrow if active
        if (this.previewArrow) {
            // Call async renderPreviewArrow but don't wait for it
            this.renderPreviewArrow(ctx, gameData).catch(error => {
                console.error('Error rendering preview arrow:', error);
                // Fallback to straight arrow on error
                this.drawStraightArrow(ctx, this.previewArrow.source, this.previewArrow.target, '#ff4444', this.previewArrow.type);
            });
        }
        
        // Supply mode indicator
        if (this.supplyModeActive) {
            this.renderSupplyModeIndicator(ctx);
        }
        
        // Top bar with timer and game info
        this.renderTopBar(ctx, gameData);
        
        // Leaderboard
        if (this.showLeaderboard) {
            this.renderLeaderboard(ctx, gameData);
        }
        
        // All UI panels removed for minimal clean interface
        
        // Minimap (minimizable)
        if (this.showMinimap) {
            this.renderMinimap(ctx, gameData);
        }
        
        // Discovery panel showing empire bonuses
        this.renderDiscoveryPanel(ctx, gameData);
        
        // Performance panel (togglable with P key)
        this.renderPerformanceInfo(ctx, gameData);
        
        // Zoom controls removed - using mousewheel only
        
        // Check for tech level hover if mouse position is available
        if (gameData.mousePos) {
            this.checkTechLevelHover(gameData.mousePos.x, gameData.mousePos.y);
        }
        
        // Tooltip for hovered territory
        this.renderTooltip(ctx, gameData);
        
        // Tech level tooltip (render after main tooltip)
        if (gameData.mousePos) {
            this.renderTechTooltip(ctx, gameData.mousePos.x, gameData.mousePos.y);
        }
        
        // Render notifications
        this.renderNotifications(ctx, gameData);
        
        // Floating discovery announcements at top center
        this.renderFloatingAnnouncements(ctx, gameData);
        
        // Game over screen for human player
        const humanPlayer = gameData.humanPlayer;
        if (humanPlayer && humanPlayer.territories.length === 0) {
            this.renderGameOverScreen(ctx, gameData);
        }
    }
    
    renderEndGameUI(ctx, gameData) {
        // Full opaque overlay for maximum readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Game Over title with dramatic shadow effect
        ctx.font = 'bold 64px Arial';
        ctx.textAlign = 'center';
        
        // Title shadow
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fillText('Game Over!', this.canvas.width / 2 + 4, this.canvas.height / 2 - 146);
        
        // Main title
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2 - 150);
        
        // Final leaderboard
        this.renderFinalLeaderboard(ctx, gameData);
        
        // Larger, more prominent restart button
        const buttonWidth = 280;
        const buttonHeight = 60;
        const buttonX = this.canvas.width / 2 - buttonWidth / 2;
        const buttonY = this.canvas.height - 120;
        
        // Button shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(buttonX + 4, buttonY + 4, buttonWidth, buttonHeight);
        
        // Restart button background
        ctx.fillStyle = '#00ddff';
        ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Button border with glow effect
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Inner glow
        ctx.strokeStyle = '#00ddff';
        ctx.lineWidth = 1;
        ctx.strokeRect(buttonX + 2, buttonY + 2, buttonWidth - 4, buttonHeight - 4);
        
        // Button text with shadow
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        
        // Text shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText('PLAY AGAIN', this.canvas.width / 2 + 2, buttonY + 40);
        
        // Main text
        ctx.fillStyle = '#000000';
        ctx.fillText('PLAY AGAIN', this.canvas.width / 2, buttonY + 38);
        
        // Store button area for touch detection
        this.restartButton = {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight
        };
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
        ctx.fillText('Star Throne', 20, 45);
        
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
        
        if (gameData.leaderboardMinimized) {
            // Minimized leaderboard - just show title bar
            ctx.fillStyle = this.bgColor;
            ctx.fillRect(startX, startY, width, 35);
            
            ctx.fillStyle = this.accentColor;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Leaderboard (tap to expand)', startX + width / 2, startY + 22);
            
            // Add minimize indicator
            ctx.fillStyle = this.textColor;
            ctx.font = '16px Arial';
            ctx.textAlign = 'right';
            ctx.fillText('▼', startX + width - 10, startY + 22);
            return;
        }
        
        // Sort players by territories controlled (stars)
        const sortedPlayers = gameData.players
            .filter(p => !p.isEliminated)
            .sort((a, b) => {
                const aCount = a.territories ? a.territories.length : 0;
                const bCount = b.territories ? b.territories.length : 0;
                return bCount - aCount;
            })
            .slice(0, 10); // Top 10
            
        // Removed debug logging (dead code cleanup)
        
        const height = 40 + sortedPlayers.length * itemHeight;
        
        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(startX, startY, width, height);
        
        // Title with minimize indicator
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        this.renderTextWithShadow(ctx, 'Leaderboard', startX + width / 2, startY + 20, this.accentColor);
        
        // Add minimize indicator
        ctx.font = '16px Arial';
        ctx.textAlign = 'right';
        this.renderTextWithShadow(ctx, '▲', startX + width - 10, startY + 20, this.textColor);
        
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
            
            // Territory count with safety check
            ctx.fillStyle = this.textColor;
            ctx.textAlign = 'right';
            const territoryCount = player.territories ? player.territories.length : 0;
            ctx.fillText(territoryCount.toString(), startX + width - 10, y);
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
        const height = 140;
        
        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(startX, startY, width, height);
        
        // Title
        ctx.fillStyle = this.accentColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Controls', startX + 10, startY + 18);
        
        // Help text - mobile-friendly
        ctx.fillStyle = this.textColor;
        ctx.font = '12px Arial';
        const helpLines = [
            'Tap: Select/Attack',
            'Drag: Pan camera',
            'Pinch: Zoom in/out',
            'Two finger: Pan & zoom',
            'ESC: Deselect',
            'R: Restart (when ended)'
        ];
        
        helpLines.forEach((line, index) => {
            ctx.fillText(line, startX + 10, startY + 35 + index * 15);
        });
    }
    
    renderPerformanceInfo(ctx, gameData) {
        // Show detailed performance panel if enabled
        if (gameData.showPerformancePanel) {
            const x = this.canvas.width - 250;
            const y = 50;
            const width = 240;
            const height = 160;
            
            // Background with transparency
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(x - 10, y - 10, width, height);
            
            // Border
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 10, y - 10, width, height);
            
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            
            // Performance metrics with color coding
            const fps = gameData.fps || 0;
            const fpsColor = fps > 50 ? '#00ff00' : fps > 30 ? '#ffff00' : '#ff0000';
            this.renderTextWithShadow(ctx, `FPS: ${fps}`, x, y, fpsColor);
            
            this.renderTextWithShadow(ctx, `Frame: ${(gameData.frameTime || 0).toFixed(1)}ms`, x, y + 20, this.textColor);
            this.renderTextWithShadow(ctx, `Render: ${(gameData.renderTime || 0).toFixed(1)}ms`, x, y + 40, this.textColor);
            this.renderTextWithShadow(ctx, `Update: ${(gameData.updateTime || 0).toFixed(1)}ms`, x, y + 60, this.textColor);
            
            // Game-specific metrics
            this.renderTextWithShadow(ctx, `Territories: ${gameData.territoryCount || 0}`, x, y + 80, this.textColor);
            this.renderTextWithShadow(ctx, `Rendered: ${gameData.visibleTerritories || 0}`, x, y + 100, this.textColor);
            this.renderTextWithShadow(ctx, `Probes: ${gameData.probeCount || 0}`, x, y + 120, this.textColor);
            
            // Toggle hint
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            this.renderTextWithShadow(ctx, 'Press P to toggle', x + width - 15, y + height - 15, '#888888');
        } else {
            // Simple FPS counter
            ctx.fillStyle = this.textColor;
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`FPS: ${gameData.fps}`, this.canvas.width - 20, this.canvas.height - 10);
        }
        
        // Removed mobile touch debug display (unused UI feature)
    }
    
    // Removed probe notification UI (unused UI feature)
    
    renderDiscoveryPanel(ctx, gameData) {
        // Only show human player's discoveries
        if (!gameData.playerDiscoveries || !gameData.humanPlayer) {
            console.log('🔍 DEBUG: No playerDiscoveries or humanPlayer', {
                playerDiscoveries: !!gameData.playerDiscoveries,
                humanPlayer: !!gameData.humanPlayer
            });
            return;
        }
        
        const discoveries = gameData.playerDiscoveries.get(gameData.humanPlayer.id);
        if (!discoveries) {
            console.log('🔍 DEBUG: No discoveries for human player', {
                humanPlayerId: gameData.humanPlayer.id,
                playerDiscoveriesKeys: Array.from(gameData.playerDiscoveries.keys())
            });
            return;
        }
        
        console.log('🔍 DEBUG: Human player discoveries found:', discoveries);
        
        // Count active discoveries (with safety checks)
        let discoveryCount = 0;
        if (discoveries && discoveries.precursorWeapons > 0) discoveryCount++;
        if (discoveries && discoveries.precursorDrive > 0) discoveryCount++;
        if (discoveries && discoveries.precursorShield > 0) discoveryCount++;
        if (discoveries && discoveries.precursorNanotech > 0) discoveryCount++;
        if (discoveries && discoveries.ancientRuins > 0) discoveryCount++;
        if (discoveries && discoveries.friendlyAliens > 0) discoveryCount++;
        if (discoveries && discoveries.richMinerals > 0) discoveryCount++;
        
        // Always show panel if player has any discoveries
        if (discoveryCount === 0) {
            // Show empty panel if human player has made any probe attempts
            const humanPlayer = gameData.humanPlayer;
            if (!humanPlayer || humanPlayer.territories.length === 0) return;
        }
        
        const x = 20;
        const width = 320; // Wider for two columns
        const lineHeight = 20;
        const padding = 10;
        const titleHeight = 25;
        const techHeight = 70; // Space for tech levels in two columns
        const height = titleHeight + techHeight + padding * 2;
        const y = this.canvas.height - height - 20; // Bottom left positioning
        
        // Background with transparency
        ctx.fillStyle = 'rgba(0, 20, 40, 0.9)';
        ctx.fillRect(x, y, width, height);
        
        // Border with discovery theme color
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Main title
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        this.renderTextWithShadow(ctx, '⚔️ Tech Levels', x + padding, y + 22, '#FFD700');
        
        let currentY = y + 45; // Start showing tech levels
        
        // Show tech levels for human player in two columns
        const humanPlayer = gameData.humanPlayer;
        if (humanPlayer && humanPlayer.tech) {
            ctx.font = 'bold 13px Arial';
            const leftCol = x + padding;
            const rightCol = x + padding + 140;
            
            // Left column - Attack and Defense
            this.renderTextWithShadow(ctx, `⚔️ Attack: ${humanPlayer.tech.attack}/5`, leftCol, currentY, '#FF6B6B');
            this.renderTextWithShadow(ctx, `🛡️ Defense: ${humanPlayer.tech.defense}/5`, leftCol, currentY + 20, '#4CAF50');
            
            // Right column - Engines and Production
            this.renderTextWithShadow(ctx, `🚀 Engines: ${humanPlayer.tech.engines}/5`, rightCol, currentY, '#2196F3');
            this.renderTextWithShadow(ctx, `🏭 Production: ${humanPlayer.tech.production}/5`, rightCol, currentY + 20, '#FF9800');
            
            // Store tech level positions for tooltip detection (inside scope where leftCol/rightCol are defined)
            // Adjust Y coordinates to match text baseline positioning (text is rendered at bottom of area)
            this.techLevelAreas = {
                attack: { x: leftCol, y: currentY - 15, width: 120, height: 18, tech: humanPlayer.tech.attack },
                defense: { x: leftCol, y: currentY + 5, width: 120, height: 18, tech: humanPlayer.tech.defense },
                engines: { x: rightCol, y: currentY - 15, width: 120, height: 18, tech: humanPlayer.tech.engines },
                production: { x: rightCol, y: currentY + 5, width: 120, height: 18, tech: humanPlayer.tech.production }
            };
            
            currentY += 50; // Move past tech levels
        }
    }
    
    // Check if mouse is hovering over tech level areas
    checkTechLevelHover(mouseX, mouseY) {
        this.hoveredTechType = null;
        
        for (const [techType, area] of Object.entries(this.techLevelAreas)) {
            if (mouseX >= area.x && mouseX <= area.x + area.width &&
                mouseY >= area.y && mouseY <= area.y + area.height) {
                this.hoveredTechType = techType;
                break;
            }
        }
    }
    
    // Render tech level tooltip
    renderTechTooltip(ctx, mouseX, mouseY) {
        if (!this.hoveredTechType || !this.techLevelAreas[this.hoveredTechType]) return;
        
        const area = this.techLevelAreas[this.hoveredTechType];
        const techLevel = area.tech;
        
        let tooltipText = '';
        switch (this.hoveredTechType) {
            case 'attack':
                tooltipText = `+${techLevel * 5}% attack damage`;
                break;
            case 'defense':
                tooltipText = `+${techLevel * 5}% defense strength`;
                break;
            case 'engines':
                tooltipText = `+${techLevel * 10}% fleet speed`;
                break;
            case 'production':
                tooltipText = `+${techLevel * 10}% army generation`;
                break;
        }
        
        if (tooltipText) {
            // Position tooltip near mouse
            const tooltipX = mouseX + 15;
            const tooltipY = mouseY - 25;
            const padding = 8;
            
            // Measure text
            ctx.font = '12px Arial';
            const textWidth = ctx.measureText(tooltipText).width;
            const tooltipWidth = textWidth + padding * 2;
            const tooltipHeight = 20;
            
            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
            
            // Border
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 1;
            ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
            
            // Text
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'left';
            ctx.fillText(tooltipText, tooltipX + padding, tooltipY + 14);
        }
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : {r: 255, g: 255, b: 255};
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
    
    renderFloatingAnnouncements(ctx, gameData) {
        if (!gameData.discoveryLog || !gameData.humanPlayer) return;
        
        const now = Date.now();
        const humanPlayerId = gameData.humanPlayer.id;
        const announcements = gameData.discoveryLog.filter(entry => {
            const age = (now - entry.timestamp) / 1000;
            return age <= 3 && entry.playerId === humanPlayerId; // Only show human player discoveries for 3 seconds
        });
        
        // Show only the most recent announcement at top center
        if (announcements.length === 0) return;
        
        const latestAnnouncement = announcements.sort((a, b) => b.timestamp - a.timestamp)[0];
        const age = (now - latestAnnouncement.timestamp) / 1000;
        const fadeProgress = age / 3; // Fade over 3 seconds
        const opacity = Math.max(0, 1 - fadeProgress);
        
        // Get discovery info
        const icon = this.getDiscoveryIcon(latestAnnouncement.discovery.effect);
        const color = this.getDiscoveryColor(latestAnnouncement.discovery.effect);
        
        // Apply opacity
        const rgb = this.hexToRgb(color);
        const fadeColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
        
        // Top center positioning
        const width = 400;
        const height = 50;
        const x = (this.canvas.width - width) / 2;
        const y = 20;
        
        // Background with transparency
        ctx.fillStyle = `rgba(0, 0, 0, ${0.9 * opacity})`;
        ctx.fillRect(x, y, width, height);
        
        // Border with discovery color
        ctx.strokeStyle = fadeColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Discovery text
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        const text = `${icon} ${latestAnnouncement.discovery.name}`;
        this.renderTextWithShadow(ctx, text, x + width/2, y + height/2 + 5, fadeColor);
    }
    
    renderMinimap(ctx, gameData) {
        const size = 150;
        const startX = this.canvas.width - size - 20;
        const startY = this.canvas.height - size - 20;
        
        if (gameData.minimapMinimized) {
            // Minimized minimap - just show title bar
            ctx.fillStyle = this.bgColor;
            ctx.fillRect(startX, startY + size - 30, size, 30);
            
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            this.renderTextWithShadow(ctx, 'Map (tap to expand)', startX + size / 2, startY + size - 12, this.accentColor);
            
            // Add expand indicator
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            this.renderTextWithShadow(ctx, '▲', startX + size - 10, startY + size - 12, this.textColor);
            return;
        }
        
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
        
        // Minimap title with minimize indicator
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        this.renderTextWithShadow(ctx, 'Map', startX + size / 2, startY - 5, this.textColor);
        
        // Add minimize indicator
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        this.renderTextWithShadow(ctx, '▼', startX + size - 5, startY - 5, this.textColor);
    }
    
    renderTooltip(ctx, gameData) {
        // Don't show tooltips during preview mode (when attack arrow is active)
        if (this.previewArrow) {
            return;
        }
        
        if (!gameData.hoveredTerritory || !gameData.mousePos) {
            return;
        }
        

        
        const territory = gameData.hoveredTerritory;
        const mouseX = gameData.mousePos.x;
        const mouseY = gameData.mousePos.y;
        
        // Get territory information
        let ownerName = 'Neutral';
        let territoryColor = '#666666';
        
        if (territory.ownerId !== null && gameData.players[territory.ownerId]) {
            const owner = gameData.players[territory.ownerId];
            ownerName = owner.name;
            territoryColor = owner.color;
        }
        
        // Prepare tooltip text
        let tooltipLines = [];
        if (territory.isColonizable) {
            tooltipLines.push(`Unexplored System`);
            
            // Only show "Click to probe" if player has a valid selected territory that can reach it
            const canProbe = gameData.selectedTerritory && 
                            gameData.selectedTerritory.ownerId === gameData.humanPlayer?.id &&
                            gameData.selectedTerritory.armySize >= 10; // Need 10 fleets for probe
            
            if (canProbe) {
                tooltipLines.push(`Click to probe (10 fleets)`);
            } else if (gameData.selectedTerritory && gameData.selectedTerritory.ownerId === gameData.humanPlayer?.id) {
                tooltipLines.push(`Need 10 fleets to probe`);
            } else {
                tooltipLines.push(`Select owned territory first`);
            }
        } else {
            // FOG OF WAR: Check if this is a mysterious territory
            const humanPlayerId = gameData.humanPlayer?.id;
            const isNeutralMystery = territory.ownerId === null && !territory.neighbors.some(neighborId => {
                const neighbor = gameData.territories?.[neighborId];
                return neighbor && neighbor.ownerId === humanPlayerId;
            });
            
            const isEnemyMystery = territory.ownerId !== null && territory.ownerId !== humanPlayerId && !territory.neighbors.some(neighborId => {
                const neighbor = gameData.territories?.[neighborId];
                return neighbor && neighbor.ownerId === humanPlayerId;
            });
            
            const isMysteriousTerritory = isNeutralMystery || isEnemyMystery;
            
            // NEBULA FOG OF WAR: Check if territory is inside a nebula (applies to ALL territories)
            const isInNebula = gameData?.gameMap?.isInNebula?.(territory.x, territory.y, 15) || false;
            const isPlayerOwned = territory.ownerId === humanPlayerId;
            const isNeutral = territory.ownerId === null;
            
            // Removed debug nebula logging (dead code cleanup)
            
            if (isMysteriousTerritory && territory.ownerId !== null) {
                // Mysterious enemy territory - only show player name
                tooltipLines.push(`${ownerName}`);
                // Apply nebula fog even to mysterious territories
                if (isInNebula) {
                    tooltipLines.push(`Unknown forces (nebula)`);
                } else {
                    tooltipLines.push(`Unknown forces`);
                }
            } else if (isNeutralMystery) {
                // Mysterious neutral territory - show as unexplored
                tooltipLines.push(`Unexplored System`);
                // Apply nebula fog even to mysterious territories
                if (isInNebula) {
                    tooltipLines.push(`Unknown garrison (nebula)`);
                } else {
                    tooltipLines.push(`Unknown garrison`);
                }
            } else {
                // Visible territory - show owner name first
                tooltipLines.push(`${ownerName}`);
                
                // NEBULA FOG OF WAR: Apply to ALL visible territories (suppress fleet count)
                if (isInNebula) {
                    console.log(`🌫️ NEBULA TOOLTIP: Territory ${territory.id} in nebula - hiding fleet count (neutral: ${isNeutral})`);
                    if (isNeutral) {
                        // Neutral territory in nebula - show question marks
                        tooltipLines.push(`??? Fleets (nebula)`);
                    } else {
                        // Enemy territory in nebula - hide fleet count
                        tooltipLines.push(`Unknown forces (nebula)`);
                    }
                } else {
                    // Show full fleet information only for player territories OR non-nebula territories
                    // Calculate generation rate including supply bonuses
                    let generationRate = 0;
                    let fleetDisplay = `${territory.armySize} Fleets`;
                    
                    if (territory.ownerId !== null) {
                        // Check if this territory is a supply route source (redirects armies elsewhere)
                        const isSupplySource = gameData.supplySystem && gameData.supplySystem.supplyRoutes && 
                            gameData.supplySystem.supplyRoutes.some(route => route.from === territory.id);
                        
                        if (isSupplySource) {
                            // Supply source territories redirect all armies, so they show +0/s generation
                            generationRate = 0;
                        } else {
                            // Calculate effective generation rate including tech bonuses
                            let effectiveGenerationRate = territory.armyGenerationRate || 3000;
                            
                            // Apply production tech bonus: +10% per production tech level
                            const territoryOwner = gameData.players.find(p => p.id === territory.ownerId);
                            if (territoryOwner && territoryOwner.tech && territoryOwner.tech.production > 0) {
                                effectiveGenerationRate /= (1 + territoryOwner.tech.production * 0.1);
                            }
                            
                            // Apply planet-specific bonuses
                            if (territory.discoveryBonus === 'factory') {
                                effectiveGenerationRate *= 0.5; // 200% speed (half the time)
                            } else if (territory.discoveryBonus === 'minerals') {
                                effectiveGenerationRate *= 0.67; // 150% speed
                            } else if (territory.discoveryBonus === 'void_storm') {
                                effectiveGenerationRate *= 1.33; // 75% speed
                            }
                            
                            generationRate = 1000 / effectiveGenerationRate;
                            
                            // Add supply route bonuses for destinations
                            if (gameData.supplySystem && gameData.supplySystem.supplyRoutes) {
                                const incomingRoutes = gameData.supplySystem.supplyRoutes.filter(route => route.to === territory.id);
                                generationRate += incomingRoutes.length * (1000 / 3000); // Each supply route adds base rate
                            }
                        }
                        
                        // Format generation rate with proper precision
                        if (generationRate > 0) {
                            const rateText = generationRate >= 1 ? 
                                `+${generationRate.toFixed(1)}/s` : 
                                `+${generationRate.toFixed(2)}/s`;
                            fleetDisplay += ` (${rateText})`;
                        }
                    }
                    
                    tooltipLines.push(fleetDisplay);
                }
                
                if (territory.isThronestar) {
                    tooltipLines.push(`👑 Throne Star`);
                }
                
                // Show supply route information if this territory is supplying another
                if (gameData.supplySystem && gameData.supplySystem.supplyRoutes) {
                    const outgoingRoutes = gameData.supplySystem.supplyRoutes.filter(route => route.from === territory.id);
                    if (outgoingRoutes.length > 0) {
                        outgoingRoutes.forEach(route => {
                            const targetTerritory = gameData.territories[route.to];
                            if (targetTerritory) {
                                tooltipLines.push(`Reinforcing star ${route.to}`);
                            }
                        });
                    }
                }
            }
            
            // Show battle odds if player has selected territory and this is an enemy
            if (gameData.selectedTerritory && 
                gameData.selectedTerritory.ownerId === gameData.humanPlayer?.id &&
                territory.ownerId !== gameData.humanPlayer?.id &&
                territory.ownerId !== null) {
                

                
                // Check if territories are connected by star lane
                const isAdjacent = gameData.selectedTerritory.neighbors && 
                                 gameData.selectedTerritory.neighbors.includes(territory.id);
                

                
                if (isAdjacent && gameData.combatSystem) {
                    const attacker = gameData.humanPlayer;
                    const defender = gameData.players[territory.ownerId];
                    

                    
                    if (attacker && defender) {
                        const winChance = gameData.combatSystem.calculateBattleOdds(attacker, defender);

                        tooltipLines.push(`Battle Odds: ${winChance}% win`);
                    }
                }
            }
        }
        
        // Tooltip dimensions
        const padding = 8;
        const lineHeight = 16;
        const fontSize = 12;
        ctx.font = `${fontSize}px Arial`;
        
        const maxWidth = Math.max(...tooltipLines.map(line => ctx.measureText(line).width));
        const tooltipWidth = maxWidth + padding * 2;
        const tooltipHeight = tooltipLines.length * lineHeight + padding * 2;
        
        // Position tooltip near mouse but keep it on screen
        let tooltipX = mouseX + 15;
        let tooltipY = mouseY - tooltipHeight - 10;
        
        if (tooltipX + tooltipWidth > this.canvas.width) {
            tooltipX = mouseX - tooltipWidth - 15;
        }
        if (tooltipY < 0) {
            tooltipY = mouseY + 15;
        }
        
        // Draw tooltip background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw tooltip border
        ctx.strokeStyle = territoryColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw tooltip text
        ctx.fillStyle = '#ffffff';
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'left';
        
        tooltipLines.forEach((line, index) => {
            ctx.fillText(
                line,
                tooltipX + padding,
                tooltipY + padding + (index + 1) * lineHeight - 4
            );
        });
    }
    
    renderZoomControls(ctx, gameData) {
        const buttonSize = 50;
        const margin = 20;
        const spacing = 5;
        
        // Position in bottom left
        const zoomInX = margin;
        const zoomInY = this.canvas.height - margin - buttonSize;
        const zoomOutX = margin;
        const zoomOutY = this.canvas.height - margin - (buttonSize * 2) - spacing;
        
        // Current zoom percentage
        const zoomPercent = Math.round(gameData.camera?.zoom * 100) || 40;
        
        // Zoom Out button (-)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(zoomOutX, zoomOutY, buttonSize, buttonSize);
        ctx.strokeStyle = this.accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(zoomOutX, zoomOutY, buttonSize, buttonSize);
        
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        this.renderTextWithShadow(ctx, '-', zoomOutX + buttonSize/2, zoomOutY + buttonSize/2 + 8, '#ffffff');
        
        // Zoom In button (+)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(zoomInX, zoomInY, buttonSize, buttonSize);
        ctx.strokeStyle = this.accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(zoomInX, zoomInY, buttonSize, buttonSize);
        
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        this.renderTextWithShadow(ctx, '+', zoomInX + buttonSize/2, zoomInY + buttonSize/2 + 8, '#ffffff');
        
        // Zoom level display
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        this.renderTextWithShadow(ctx, `${zoomPercent}%`, zoomOutX + buttonSize/2, zoomOutY - 8, this.textColor);
    }
    
    renderGameOverScreen(ctx, gameData) {
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Game Over title
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        this.renderTextWithShadow(ctx, 'GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 100, '#ff4444');
        
        // Subtitle
        ctx.font = '24px Arial';
        this.renderTextWithShadow(ctx, 'All your territories have been conquered!', this.canvas.width / 2, this.canvas.height / 2 - 50, this.textColor);
        
        // Spectator message
        ctx.font = '18px Arial';
        this.renderTextWithShadow(ctx, 'You can continue watching the game...', this.canvas.width / 2, this.canvas.height / 2, this.textColor);
        
        // Play Again button
        const buttonWidth = 200;
        const buttonHeight = 60;
        const buttonX = this.canvas.width / 2 - buttonWidth / 2;
        const buttonY = this.canvas.height / 2 + 50;
        
        // Button background
        ctx.fillStyle = this.accentColor;
        ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Button border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Button text
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        this.renderTextWithShadow(ctx, 'PLAY AGAIN', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2 + 7, '#ffffff');
    }
    
    renderFinalLeaderboard(ctx, gameData) {
        const startX = this.canvas.width / 2 - 250;
        const startY = this.canvas.height / 2 - 50;
        const width = 500;
        const itemHeight = 35;
        
        // Sort all players by territories controlled and show only top 10 for better readability
        const sortedPlayers = [...gameData.players]
            .sort((a, b) => b.territories.length - a.territories.length)
            .slice(0, 10);
        const height = 80 + sortedPlayers.length * itemHeight;
        
        // Background with shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(startX + 4, startY + 4, width, height);
        
        // Main background
        ctx.fillStyle = 'rgba(0, 20, 40, 0.95)';
        ctx.fillRect(startX, startY, width, height);
        
        // Border
        ctx.strokeStyle = '#00ddff';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, width, height);
        
        // Title with shadow
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        
        // Title shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText('Final Results', startX + width / 2 + 2, startY + 42);
        
        // Main title
        ctx.fillStyle = '#00ddff';
        ctx.fillText('Final Results', startX + width / 2, startY + 40);
        
        // Player entries
        sortedPlayers.forEach((player, index) => {
            const y = startY + 80 + index * itemHeight;
            const isHuman = player === gameData.humanPlayer;
            const isWinner = index === 0 && !player.isEliminated;
            
            // Background for winner or human player
            if (isWinner) {
                ctx.fillStyle = 'rgba(68, 255, 68, 0.15)';
                ctx.fillRect(startX + 5, y - 22, width - 10, itemHeight - 2);
            } else if (isHuman) {
                ctx.fillStyle = 'rgba(0, 221, 255, 0.1)';
                ctx.fillRect(startX + 5, y - 22, width - 10, itemHeight - 2);
            }
            
            // Rank with shadow
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'left';
            
            // Rank shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillText(`${index + 1}.`, startX + 22, y + 2);
            
            // Main rank
            ctx.fillStyle = isWinner ? '#44ff44' : '#ffffff';
            ctx.fillText(`${index + 1}.`, startX + 20, y);
            
            // Player color indicator (larger)
            ctx.fillStyle = player.color;
            ctx.fillRect(startX + 60, y - 12, 20, 20);
            
            // Player name with shadow
            ctx.font = isHuman ? 'bold 18px Arial' : '18px Arial';
            
            // Name shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillText(player.name, startX + 92, y + 2);
            
            // Main name
            ctx.fillStyle = isHuman ? '#00ddff' : (isWinner ? '#44ff44' : '#ffffff');
            ctx.fillText(player.name, startX + 90, y);
            
            // Stats with shadow
            ctx.font = '16px Arial';
            ctx.textAlign = 'right';
            
            // Stats shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillText(`${player.territories.length} territories`, startX + width - 102, y - 3);
            ctx.fillText(`${player.score} points`, startX + width - 102, y + 15);
            
            // Main stats
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${player.territories.length} territories`, startX + width - 100, y - 5);
            ctx.fillText(`${player.score} points`, startX + width - 100, y + 13);
            
            // Status
            if (player.isEliminated) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillText('Eliminated', startX + width - 22, y + 2);
                ctx.fillStyle = '#ff4444';
                ctx.fillText('Eliminated', startX + width - 20, y);
            } else if (isWinner) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillText('Winner!', startX + width - 22, y + 2);
                ctx.fillStyle = '#44ff44';
                ctx.fillText('Winner!', startX + width - 20, y);
            }
        });
    }
    
    // Render notification messages for discoveries
    renderNotifications(ctx, gameData) {
        if (!gameData.notifications || gameData.notifications.length === 0) return;
        
        const notifications = gameData.notifications;
        const startY = 150; // Start below top UI elements
        const lineHeight = 40;
        const padding = 15;
        const maxWidth = 400;
        
        notifications.forEach((notification, index) => {
            const y = startY + index * lineHeight;
            const x = this.canvas.width - maxWidth - 20; // Right side of screen
            
            // Background with fade
            ctx.globalAlpha = notification.opacity;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(x - padding, y - 25, maxWidth + padding * 2, 35);
            
            // Border based on notification type
            ctx.strokeStyle = notification.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x - padding, y - 25, maxWidth + padding * 2, 35);
            
            // Text
            ctx.fillStyle = notification.color;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(notification.text, x, y);
            
            ctx.globalAlpha = 1.0; // Reset opacity
        });
    }

    // Render preview arrow for FSM confirmation mode
    async renderPreviewArrow(ctx, gameData) {
        if (!this.previewArrow || !this.camera) return;
        
        const { source, target, type } = this.previewArrow;
        
        ctx.save();
        
        // Set color based on action type
        const colors = {
            'attack': '#ff4444',
            'reinforce': '#44ff44',
            'probe': '#ffff44'
        };
        const color = colors[type] || '#ffffff';
        
        // Configure line style
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.lineDashOffset = -this.animationPhase * 20; // Animate dash pattern
        
        // For attack arrows, try to route through warp lanes
        if (type === 'attack' && gameData.game?.pathfindingService) {
            // Check if we have a cached attack path for this preview
            if (!this.cachedAttackPath || 
                this.cachedAttackPath.sourceId !== source.id || 
                this.cachedAttackPath.targetId !== target.id) {
                
                // Find attack path through warp lanes
                console.log(`🎯 Finding attack path from ${source.id} to ${target.id}`);
                
                try {
                    const path = await gameData.game.pathfindingService.findAttackPath(
                        source.id, 
                        target.id, 
                        gameData.gameMap, 
                        gameData.humanPlayer?.id
                    );
                    
                    this.cachedAttackPath = {
                        sourceId: source.id,
                        targetId: target.id,
                        path: path
                    };
                } catch (error) {
                    console.error('Error finding attack path:', error);
                    this.cachedAttackPath = { sourceId: source.id, targetId: target.id, path: null };
                }
            }
            
            // Draw the attack path
            if (this.cachedAttackPath.path && this.cachedAttackPath.path.length > 2) {
                // Multi-hop attack - draw path through warp lanes
                this.drawPathThroughWarpLanes(ctx, this.cachedAttackPath.path, gameData.gameMap, color);
            } else {
                // Direct attack or long-range attack - draw straight line
                this.drawStraightArrow(ctx, source, target, color, type);
            }
        } else {
            // Non-attack arrows or no pathfinding service - draw straight line
            this.drawStraightArrow(ctx, source, target, color, type);
        }
        
        ctx.restore();
    }
    
    drawPathThroughWarpLanes(ctx, path, gameMap, color) {
        if (!path || path.length < 2) return;
        
        ctx.beginPath();
        
        // Draw path through each waypoint
        for (let i = 0; i < path.length - 1; i++) {
            const currentTerritory = gameMap.territories[path[i]];
            const nextTerritory = gameMap.territories[path[i + 1]];
            
            if (currentTerritory && nextTerritory) {
                const currentScreen = this.camera.worldToScreen(currentTerritory.x, currentTerritory.y);
                const nextScreen = this.camera.worldToScreen(nextTerritory.x, nextTerritory.y);
                
                if (i === 0) {
                    ctx.moveTo(currentScreen.x, currentScreen.y);
                }
                ctx.lineTo(nextScreen.x, nextScreen.y);
            }
        }
        
        ctx.stroke();
        
        // Draw arrow head at final destination
        const finalTerritory = gameMap.territories[path[path.length - 1]];
        const secondToLastTerritory = gameMap.territories[path[path.length - 2]];
        
        if (finalTerritory && secondToLastTerritory) {
            const finalScreen = this.camera.worldToScreen(finalTerritory.x, finalTerritory.y);
            const secondToLastScreen = this.camera.worldToScreen(secondToLastTerritory.x, secondToLastTerritory.y);
            
            const angle = Math.atan2(finalScreen.y - secondToLastScreen.y, finalScreen.x - secondToLastScreen.x);
            this.drawArrowHead(ctx, finalScreen, angle, color);
            
            // Draw action type text at midpoint of path
            const midIndex = Math.floor(path.length / 2);
            const midTerritory = gameMap.territories[path[midIndex]];
            if (midTerritory) {
                const midScreen = this.camera.worldToScreen(midTerritory.x, midTerritory.y);
                this.drawActionText(ctx, midScreen.x, midScreen.y, 'ATTACK', color);
            }
        }
    }
    
    drawStraightArrow(ctx, source, target, color, type) {
        // Convert world coordinates to screen coordinates
        const sourceScreen = this.camera.worldToScreen(source.x, source.y);
        const targetScreen = this.camera.worldToScreen(target.x, target.y);
        
        // Draw straight line
        ctx.beginPath();
        ctx.moveTo(sourceScreen.x, sourceScreen.y);
        ctx.lineTo(targetScreen.x, targetScreen.y);
        ctx.stroke();
        
        // Draw arrow head
        const angle = Math.atan2(targetScreen.y - sourceScreen.y, targetScreen.x - sourceScreen.x);
        this.drawArrowHead(ctx, targetScreen, angle, color);
        
        // Draw action type text
        const midX = (sourceScreen.x + targetScreen.x) / 2;
        const midY = (sourceScreen.y + targetScreen.y) / 2;
        this.drawActionText(ctx, midX, midY, type.toUpperCase(), color);
    }
    
    drawArrowHead(ctx, position, angle, color) {
        const arrowLength = 20;
        const arrowAngle = Math.PI / 6;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(position.x, position.y);
        ctx.lineTo(
            position.x - arrowLength * Math.cos(angle - arrowAngle),
            position.y - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
            position.x - arrowLength * Math.cos(angle + arrowAngle),
            position.y - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fill();
    }
    
    drawActionText(ctx, x, y, text, color) {
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x - 30, y - 10, 60, 20);
        
        ctx.fillStyle = color;
        ctx.fillText(text, x, y + 5);
    }
    
    // Render supply mode indicator
    renderSupplyModeIndicator(ctx) {
        ctx.save();
        
        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw supply mode text in top center
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        
        // Animated background
        const pulseAlpha = 0.7 + 0.3 * Math.sin(this.animationPhase * 3);
        ctx.fillStyle = `rgba(0, 255, 255, ${pulseAlpha})`;
        ctx.fillRect(this.canvas.width / 2 - 100, 20, 200, 40);
        
        // Text
        ctx.fillStyle = '#000000';
        ctx.fillText('SUPPLY MODE', this.canvas.width / 2, 45);
        
        ctx.font = '14px Arial';
        ctx.fillText('CLICK TARGET STAR TO REINFORCE', this.canvas.width / 2, 75);
        
        ctx.restore();
    }
}
