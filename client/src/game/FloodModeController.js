export default class FloodModeController {
    constructor(game) {
        this.game = game;
        this.activePlayers = new Set();
        this.aggression = {}; // playerId -> aggression level
        this.closedGates = {}; // playerId -> {fromId: Set(neighborId)}
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
            if (!this.closedGates[id]) this.closedGates[id] = {};
            if (player.type === 'human') this.showSlider(player);
            this.game.addNotification(`Flood Mode ON (${player.name})`, '#44ff44');
        } else {
            this.activePlayers.delete(id);
            if (player.type === 'human') this.hideSlider();
            this.game.addNotification(`Flood Mode OFF (${player.name})`, '#ff4444');
        }
    }

    showSlider(player) {
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
        instructions.innerHTML = 'Press F to toggle<br/>Use G to control gates';
        container.appendChild(instructions);
        
        document.body.appendChild(container);
        
        slider.addEventListener('input', () => {
            const newValue = parseInt(slider.value, 10);
            this.setAggression(player, newValue);
            valueDisplay.textContent = newValue;
        });
        
        console.log('Flood mode slider created and shown');
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

    toggleGate(player, fromId, toId) {
        const id = player.id;
        if (!this.closedGates[id]) this.closedGates[id] = {};
        const gates = this.closedGates[id];
        if (!gates[fromId]) gates[fromId] = new Set();
        if (gates[fromId].has(toId)) {
            gates[fromId].delete(toId);
        } else {
            gates[fromId].add(toId);
        }
    }

    isGateClosed(player, fromId, toId) {
        const id = player.id;
        return this.closedGates[id] && this.closedGates[id][fromId] && this.closedGates[id][fromId].has(toId);
    }

    onTerritoryCaptured(oldOwnerId, newOwnerId, territoryId) {
        if (oldOwnerId != null && this.closedGates[oldOwnerId]) {
            delete this.closedGates[oldOwnerId][territoryId];
            // remove references pointing to this territory
            for (const from in this.closedGates[oldOwnerId]) {
                this.closedGates[oldOwnerId][from].delete(territoryId);
            }
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
                let ships = t.armySize;
                for (const nid of t.neighbors) {
                    const n = this.game.gameMap.territories[nid];
                    if (!n || n.ownerId === id) continue;
                    if (this.isGateClosed(player, tid, nid)) continue;
                    const required = n.armySize + 2 * aggression;
                    if (ships >= required) {
                        const send = n.armySize + aggression;
                        t.armySize -= send;
                        ships -= send;
                        if (this.game.createShipAnimation)
                            this.game.createShipAnimation(t, n, true, send);
                        this.game.combatSystem.attackTerritory(t, n, send);
                    }
                }
            }
        }
    }
}