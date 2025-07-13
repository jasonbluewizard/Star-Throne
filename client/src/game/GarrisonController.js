export default class GarrisonController {
    constructor(game) {
        this.game = game;
        this.minGarrison = 1;
        this.maxGarrison = 20;
        this.attackTargets = new Set();
        this.timer = 0;
        this.updateInterval = 1000; // ms
    }

    showControls() {
        this.hideControls();
        const container = document.createElement('div');
        container.id = 'garrison-controls';
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '10px',
            left: '220px',
            background: 'rgba(0,0,0,0.9)',
            padding: '10px',
            borderRadius: '8px',
            color: 'white',
            zIndex: 10000,
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
        });

        const minLabel = document.createElement('div');
        minLabel.textContent = `Min Garrison: ${this.minGarrison}`;
        container.appendChild(minLabel);

        const minSlider = document.createElement('input');
        minSlider.type = 'range';
        minSlider.min = '0';
        minSlider.max = '50';
        minSlider.value = String(this.minGarrison);
        minSlider.style.width = '200px';
        container.appendChild(minSlider);

        const maxLabel = document.createElement('div');
        maxLabel.textContent = `Max Garrison: ${this.maxGarrison}`;
        maxLabel.style.marginTop = '10px';
        container.appendChild(maxLabel);

        const maxSlider = document.createElement('input');
        maxSlider.type = 'range';
        maxSlider.min = '1';
        maxSlider.max = '100';
        maxSlider.value = String(this.maxGarrison);
        maxSlider.style.width = '200px';
        container.appendChild(maxSlider);

        minSlider.addEventListener('input', () => {
            this.minGarrison = parseInt(minSlider.value, 10);
            minLabel.textContent = `Min Garrison: ${this.minGarrison}`;
        });
        maxSlider.addEventListener('input', () => {
            this.maxGarrison = parseInt(maxSlider.value, 10);
            maxLabel.textContent = `Max Garrison: ${this.maxGarrison}`;
        });

        document.body.appendChild(container);
        this.controlsEl = container;
    }

    hideControls() {
        const el = document.getElementById('garrison-controls');
        if (el) el.remove();
    }

    toggleAttackTarget(id) {
        if (this.attackTargets.has(id)) {
            this.attackTargets.delete(id);
        } else {
            this.attackTargets.add(id);
        }
    }

    isAttackTarget(id) {
        return this.attackTargets.has(id);
    }

    update(deltaTime) {
        this.timer += deltaTime;
        if (this.timer < this.updateInterval) return;
        this.timer = 0;

        const player = this.game.humanPlayer;
        if (!player) return;
        const map = this.game.gameMap;

        for (const tid of player.territories) {
            const terr = map.territories[tid];
            if (!terr) continue;

            // Attempt attacks first
            for (const nid of terr.neighbors) {
                if (!this.attackTargets.has(nid)) continue;
                const target = map.territories[nid];
                if (!target || target.ownerId === player.id) continue;
                const required = target.armySize + this.minGarrison;
                if (terr.armySize - required >= this.minGarrison) {
                    this.game.combatSystem.attackTerritory(terr, target, required);
                    if (this.game.createShipAnimation) {
                        this.game.createShipAnimation(terr, target, true, required);
                    }
                    break; // one action per update from this territory
                }
            }

            // Redistribute surplus
            if (terr.armySize > this.maxGarrison) {
                const friends = terr.neighbors
                    .map(nid => map.territories[nid])
                    .filter(t => t && t.ownerId === player.id);
                if (friends.length > 0) {
                    friends.sort((a,b) => a.armySize - b.armySize);
                    const dest = friends[0];
                    const send = terr.armySize - this.maxGarrison;
                    this.game.combatSystem.transferArmies(terr, dest, send);
                    if (this.game.createShipAnimation) {
                        this.game.createShipAnimation(terr, dest, false, send);
                    }
                }
            }
        }
    }
}