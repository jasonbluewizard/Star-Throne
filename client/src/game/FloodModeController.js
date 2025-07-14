export default class FloodModeController {
    constructor(game) {
        this.game = game;
        this.activePlayers = new Set();
        this.aggression = {}; // playerId -> aggression level
        this.noGoZones = {}; // playerId -> Set(territoryId) - territories marked as no-go
        this.timer = 0;
        this.checkInterval = 1000; // ms
    }

    isActive(player) {
        if (!player) return false;
        return this.activePlayers.has(player.id);
    }

    togglePlayer(player, enable) {
        if (!player) return;
        const id = player.id;
        if (enable === undefined) enable = !this.activePlayers.has(id);
        if (enable) {
            this.activePlayers.add(id);
            if (!this.aggression[id]) this.aggression[id] = 5;
            if (!this.noGoZones[id]) this.noGoZones[id] = new Set();
            if (player.type === 'human') this.showSlider(player);
            this.game.showMessage(`Flood Mode ON (${player.name})`, 3000);
        } else {
            this.activePlayers.delete(id);
            if (player.type === 'human') this.hideSlider();
            this.game.showMessage(`Flood Mode OFF (${player.name})`, 3000);
        }
    }

    // Add AI flood mode property and toggle method
    get aiFloodModeEnabled() {
        return this._aiFloodModeEnabled || false;
    }

    toggleAIFloodMode() {
        this._aiFloodModeEnabled = !this._aiFloodModeEnabled;
        
        if (!this.game.players) return;
        
        const aiPlayers = this.game.players.filter(p => p.type === 'ai' && !p.isEliminated);
        
        if (this._aiFloodModeEnabled) {
            // Enable flood mode for all AI players
            aiPlayers.forEach(player => {
                this.activePlayers.add(player.id);
                if (!this.aggression[player.id]) this.aggression[player.id] = 5;
                if (!this.noGoZones[player.id]) this.noGoZones[player.id] = new Set();
            });
            
            if (aiPlayers.length > 0) {
                this.game.showMessage(`AI Flood Mode ENABLED for ${aiPlayers.length} AI players`, 5000);
            }
        } else {
            // Disable flood mode for all AI players
            aiPlayers.forEach(player => {
                this.activePlayers.delete(player.id);
            });
            
            if (aiPlayers.length > 0) {
                this.game.showMessage(`AI Flood Mode DISABLED for ${aiPlayers.length} AI players`, 5000);
            }
        }
        
        console.log(`AI Flood Mode ${this._aiFloodModeEnabled ? 'ENABLED' : 'DISABLED'} for ${aiPlayers.length} AI players`);
    }

    showSlider(player) {
        console.log('🎛️ showSlider called for player:', player?.name, 'ID:', player?.id);
        
        // Remove any existing slider first
        this.hideSlider();
        
        // Create container for flood mode controls
        const container = document.createElement('div');
        container.id = 'flood-controls';
        container.style.position = 'fixed';
        container.style.bottom = '10px';
        container.style.left = '10px';
        container.style.zIndex = '10000';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        container.style.padding = '15px';
        container.style.borderRadius = '8px';
        container.style.border = '2px solid #44ff44';
        container.style.color = 'white';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.fontSize = '14px';
        container.style.fontWeight = 'bold';
        container.style.minWidth = '200px';
        
        // Create title
        const title = document.createElement('div');
        title.textContent = '🌊 FLOOD MODE ACTIVE';
        title.style.marginBottom = '10px';
        title.style.textAlign = 'center';
        title.style.color = '#44ff44';
        container.appendChild(title);
        
        // Create aggression label and value
        const aggressionRow = document.createElement('div');
        aggressionRow.style.marginBottom = '8px';
        
        const label = document.createElement('span');
        label.textContent = 'Aggression: ';
        aggressionRow.appendChild(label);
        
        const valueDisplay = document.createElement('span');
        valueDisplay.id = 'flood-value';
        valueDisplay.textContent = this.aggression[player.id] || 5;
        valueDisplay.style.color = '#ffff44';
        valueDisplay.style.fontWeight = 'bold';
        aggressionRow.appendChild(valueDisplay);
        
        container.appendChild(aggressionRow);
        
        // Create slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '10';
        slider.value = this.aggression[player.id] || 5;
        slider.id = 'flood-slider';
        slider.style.width = '100%';
        slider.style.marginBottom = '10px';
        container.appendChild(slider);
        
        // Create instructions
        const instructions = document.createElement('div');
        instructions.style.fontSize = '11px';
        instructions.style.color = '#cccccc';
        instructions.style.textAlign = 'center';
        instructions.innerHTML = 'Press F to toggle<br/>Click enemy stars to mark NO GO';
        container.appendChild(instructions);
        
        document.body.appendChild(container);
        
        slider.addEventListener('input', () => {
            const newValue = parseInt(slider.value, 10);
            this.setAggression(player, newValue);
            valueDisplay.textContent = newValue;
        });
        
        console.log('✅ Flood mode slider created and appended to document.body');
        console.log('📱 Container element:', container);
        console.log('🎛️ Slider element:', slider);
    }

    hideSlider() {
        const container = document.getElementById('flood-controls');
        if (container) {
            container.remove();
            console.log('Flood mode slider hidden and removed');
        }
    }

    setAggression(player, value) {
        if (!player) return;
        const id = player.id;
        value = Math.max(1, Math.min(10, value));
        this.aggression[id] = value;
        const slider = document.getElementById('flood-slider');
        if (slider && slider.value != value && player.type === 'human') {
            slider.value = String(value);
        }
    }

    toggleNoGoZone(player, territoryId) {
        const id = player.id;
        if (!this.noGoZones[id]) this.noGoZones[id] = new Set();
        
        if (this.noGoZones[id].has(territoryId)) {
            this.noGoZones[id].delete(territoryId);
        } else {
            this.noGoZones[id].add(territoryId);
        }
    }

    isNoGoZone(player, territoryId) {
        const id = player.id;
        return this.noGoZones[id] && this.noGoZones[id].has(territoryId);
    }

    onTerritoryCaptured(oldOwnerId, newOwnerId, territoryId) {
        // Remove no-go zone marking if territory changes hands
        if (oldOwnerId != null && this.noGoZones[oldOwnerId]) {
            this.noGoZones[oldOwnerId].delete(territoryId);
        }
        if (newOwnerId != null && this.noGoZones[newOwnerId]) {
            this.noGoZones[newOwnerId].delete(territoryId);
        }
    }

    update(deltaTime) {
        this.timer += deltaTime;
        if (this.timer < this.checkInterval) return;
        this.timer = 0;
        for (const id of this.activePlayers) {
            const player = this.game.players[id];
            if (!player || player.isEliminated) continue;
            const aggression = this.aggression[id] || 5;
            for (const tid of player.territories) {
                const t = this.game.gameMap.territories[tid];
                if (!t) continue;
                
                // Use range-based pathfinding instead of neighbors
                if (!this.game.rangePathfindingManager) continue;
                
                const reachableTerritories = this.game.rangePathfindingManager.getReachableTerritories(player.id, t.id);
                
                for (const nid of reachableTerritories) {
                    const n = this.game.gameMap.territories[nid];
                    if (!n || n.ownerId === id) continue;
                    
                    // Skip territories marked as no-go zones
                    if (this.isNoGoZone(player, nid)) continue;
                    
                    // Use current army size (which may have been reduced by previous attacks)
                    const currentArmies = t.armySize;
                    const required = n.armySize + 2 * aggression;
                    
                    // Must have at least required armies AND leave at least 1 army behind
                    if (currentArmies >= required && currentArmies > 1) {
                        const maxSend = currentArmies - 1; // Always leave 1 army
                        const send = Math.min(n.armySize + aggression, maxSend);
                        
                        // Double-check bounds to prevent negative armies
                        if (send > 0 && send < currentArmies && (currentArmies - send) >= 1) {
                            const originalArmies = t.armySize;
                            t.armySize = Math.max(1, t.armySize - send); // Ensure minimum 1 army remains
                            
                            // Verify we didn't go negative
                            if (t.armySize <= 0) {
                                console.error(`❌ FLOOD MODE ERROR: Territory ${t.id} would have ${t.armySize} armies after sending ${send}. Resetting to 1.`);
                                t.armySize = 1;
                                continue; // Skip this attack
                            }
                            
                            // Get path for multi-hop movement
                            const path = this.game.rangePathfindingManager.findRangePath(player.id, t.id, nid);
                            if (path && path.length > 0) {
                                if (this.game.createShipAnimation)
                                    this.game.createShipAnimation(t, n, true, send);
                                this.game.combatSystem.attackTerritory(t, n, send);
                                
                                console.log(`🤖 FLOOD: Territory ${t.id} sent ${send} armies to ${n.id} (${originalArmies} → ${t.armySize})`);
                            }
                        }
                    }
                }
            }
        }
    }
}