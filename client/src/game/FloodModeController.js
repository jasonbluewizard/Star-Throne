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
        if (document.getElementById('flood-slider')) return;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '10';
        slider.value = this.aggression[player.id] || 5;
        slider.id = 'flood-slider';
        slider.style.position = 'fixed';
        slider.style.bottom = '10px';
        slider.style.left = '10px';
        slider.style.zIndex = 10;
        document.body.appendChild(slider);
        slider.addEventListener('input', () => {
            this.setAggression(player, parseInt(slider.value, 10));
        });
    }

    hideSlider() {
        const el = document.getElementById('flood-slider');
        if (el) el.remove();
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