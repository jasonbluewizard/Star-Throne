/**
 * Fleet.js - Advanced Fleet Control System
 * 
 * Handles sophisticated movement UX with visual ship transfers along warp lanes:
 * - LMB on system: select it
 * - LMB/RMB on blank space: deselect
 * - LMB on friendly system when selected: switch selection
 * - RMB on connected friendly system: send 50% ships with visual movement
 */

export class Fleet {
    constructor(game) {
        this.game = game;
        this.selectedTerritory = null;
        this.transferAnimations = [];
        
        // Fleet transfer settings
        this.transferPercentage = 0.50; // 50% of ships
        
        console.log('Fleet control system initialized');
    }
    
    /**
     * Handle mouse click events for fleet selection and commands
     */
    handleClick(mousePos, isRightClick = false) {
        const worldPos = this.game.camera.screenToWorld(mousePos.x, mousePos.y);
        const clickedTerritory = this.findTerritoryAtPosition(worldPos);
        
        if (clickedTerritory) {
            return this.handleTerritoryClick(clickedTerritory, isRightClick);
        } else {
            return this.handleBlankSpaceClick();
        }
    }
    
    /**
     * Handle clicks on territories
     */
    handleTerritoryClick(territory, isRightClick) {
        const humanPlayer = this.game.players.find(p => p.type === 'human');
        if (!humanPlayer) return false;
        
        const isPlayerTerritory = territory.ownerId === humanPlayer.id;
        
        console.log(`Fleet: Territory click - ID: ${territory.id}, isRightClick: ${isRightClick}, isPlayerTerritory: ${isPlayerTerritory}, selectedTerritory: ${this.selectedTerritory?.id || 'none'}`);
        console.log(`Fleet: Territory owner: ${territory.ownerId}, isColonizable: ${territory.isColonizable}`);
        console.log(`Fleet: Selected territory armies: ${this.selectedTerritory?.armySize || this.selectedTerritory?.armies || 'N/A'}`);
        
        if (isRightClick && this.selectedTerritory && isPlayerTerritory) {
            // RMB on friendly system while having selection - attempt fleet transfer
            console.log(`Fleet: *** FRIENDLY TRANSFER ATTEMPT ***`);
            console.log(`Fleet: From ${this.selectedTerritory.id} to ${territory.id}`);
            const result = this.attemptFleetTransfer(this.selectedTerritory, territory);
            console.log(`Fleet: Transfer attempt result: ${result}`);
            return result;
        } else if (isRightClick && this.selectedTerritory && !isPlayerTerritory) {
            // RMB on non-player territory - check if colonizable or enemy
            if (territory.isColonizable) {
                // Colonizable planet - launch probe
                console.log(`Fleet: Launching probe from ${this.selectedTerritory.id} to colonizable planet ${territory.id}`);
                return this.launchProbeAttack(this.selectedTerritory, territory);
            } else if (territory.ownerId !== null) {
                // Enemy territory - check if connected by warp lane for attack
                if (this.areConnectedByWarpLane(this.selectedTerritory, territory)) {
                    console.log(`Fleet: Attacking enemy territory ${territory.id} from ${this.selectedTerritory.id}`);
                    return this.launchAttack(this.selectedTerritory, territory);
                } else {
                    console.log(`Fleet: Cannot attack territory ${territory.id} - not connected by warp lane`);
                    return true; // Return true to prevent FSM fallback
                }
            }
        } else if (!isRightClick) {
            // LMB on any system - handle selection
            return this.handleSelection(territory, isPlayerTerritory);
        }
        
        return false;
    }
    
    /**
     * Handle clicks on blank space
     */
    handleBlankSpaceClick() {
        if (this.selectedTerritory) {
            console.log(`Fleet: Deselecting territory ${this.selectedTerritory.id}`);
            this.selectedTerritory = null;
            
            // Sync with main game's InputStateMachine selection
            if (this.game.inputHandler && this.game.inputHandler.inputFSM) {
                this.game.inputHandler.inputFSM.selectedTerritory = null;
            }
            
            return true; // Event handled
        }
        return false;
    }
    
    /**
     * Handle territory selection logic
     */
    handleSelection(territory, isPlayerTerritory) {
        if (isPlayerTerritory) {
            if (this.selectedTerritory && this.selectedTerritory.id === territory.id) {
                // Clicking same territory - keep it selected
                console.log(`Fleet: Territory ${territory.id} remains selected`);
            } else {
                // Select new friendly territory
                this.selectedTerritory = territory;
                
                // Sync with main game's InputStateMachine selection
                if (this.game.inputHandler && this.game.inputHandler.inputFSM) {
                    this.game.inputHandler.inputFSM.selectedTerritory = territory;
                }
                
                console.log(`Fleet: Territory ${territory.id} selected (${territory.armySize} ships)`);
            }
            return true;
        } else {
            // Clicked on enemy territory - could trigger attack if we have selection
            if (this.selectedTerritory) {
                console.log(`Fleet: Clicked enemy territory ${territory.id} while ${this.selectedTerritory.id} selected`);
                // This could be handled by combat system
            }
            return false;
        }
    }
    
    /**
     * Launch probe attack on enemy/colonizable territory
     */
    launchProbeAttack(fromTerritory, toTerritory) {
        const humanPlayer = this.game.players.find(p => p.type === 'human');
        if (!humanPlayer) return false;

        // Check if fromTerritory has enough ships (need at least 10 for probe)
        if (fromTerritory.armies < 10) {
            console.log(`Fleet: Not enough armies for probe (${fromTerritory.armies} < 10)`);
            return false;
        }

        console.log(`Fleet: Launching probe from territory ${fromTerritory.id} to ${toTerritory.id}`);
        
        // Use the game's existing probe launch system (expects territory objects, not IDs)
        if (this.game.launchProbe) {
            try {
                this.game.launchProbe(fromTerritory, toTerritory);
                console.log(`Fleet: Probe launched successfully`);
                return true;
            } catch (error) {
                console.log(`Fleet: Probe launch failed:`, error);
                return false;
            }
        }
        
        return false;
    }

    /**
     * Launch attack on enemy territory
     */
    launchAttack(fromTerritory, toTerritory) {
        const humanPlayer = this.game.players.find(p => p.type === 'human');
        if (!humanPlayer) {
            console.log('Fleet: No human player found for attack');
            return false;
        }

        // Check armySize property (used by Territory class)
        const armyCount = fromTerritory.armySize || fromTerritory.armies || 0;
        
        // Must have at least 2 ships (1 must stay)
        if (armyCount < 2) {
            console.log(`Fleet: Not enough ships for attack (${armyCount} < 2)`);
            return false;
        }

        // Send 50% of available fleet
        const shipsToSend = Math.floor(armyCount * 0.5);
        
        console.log(`Fleet: Attacking territory ${toTerritory.id} from ${fromTerritory.id} with ${shipsToSend} ships`);
        console.log(`Fleet: Source army count: ${armyCount}, target owner: ${toTerritory.ownerId}`);
        
        // Create attack animation (red color for attacks)
        this.createAttackAnimation(fromTerritory, toTerritory, shipsToSend);
        
        // Deduct ships from source (use correct property)
        if (fromTerritory.armySize !== undefined) {
            fromTerritory.armySize -= shipsToSend;
        } else if (fromTerritory.armies !== undefined) {
            fromTerritory.armies -= shipsToSend;
        }
        
        // Use the game's existing attack system
        if (this.game.attackTerritory) {
            // Schedule attack resolution using game's combat system
            setTimeout(() => {
                this.game.attackTerritory(humanPlayer.id, fromTerritory.id, toTerritory.id);
                console.log(`${shipsToSend} ships attacked territory ${toTerritory.id}`);
            }, 800); // Match animation duration
        } else {
            console.log('Fleet: Game attack method not available');
        }
        
        return true;
    }

    /**
     * Transfer ships using shortest path routing for distant territories
     */
    transferWithPathfinding(fromTerritory, toTerritory) {
        const humanPlayer = this.game.players.find(p => p.type === 'human');
        if (!humanPlayer) {
            console.log('Fleet: No human player found');
            return false;
        }

        // Find shortest path between territories
        const path = this.findShortestPath(fromTerritory.id, toTerritory.id);
        
        if (!path || path.length < 2) {
            console.log('Fleet: No valid path found between territories');
            console.log(`Fleet: Pathfinding failed - territories not connected through player empire`);
            return true; // Return true to prevent FSM fallback and camera interference
        }

        // Check correct army property
        const armyCount = fromTerritory.armySize || fromTerritory.armies || 0;
        
        // Must have at least 2 ships (1 must stay)
        if (armyCount < 2) {
            console.log(`Fleet: Not enough ships for transfer (${armyCount} < 2)`);
            return true; // Return true to prevent camera issues
        }

        // Send 50% of available fleet
        const shipsToSend = Math.floor(armyCount * 0.5);
        
        console.log(`Fleet: Multi-hop transfer from ${fromTerritory.id} to ${toTerritory.id} via path:`, path);
        console.log(`Fleet: Sending ${shipsToSend} ships along ${path.length - 1} hops`);
        
        // Create multi-hop animation
        this.createMultiHopAnimation(path, shipsToSend);
        
        // Deduct ships from source (use correct property)
        if (fromTerritory.armySize !== undefined) {
            fromTerritory.armySize -= shipsToSend;
        } else if (fromTerritory.armies !== undefined) {
            fromTerritory.armies -= shipsToSend;
        }
        
        // Schedule final delivery
        const totalTime = (path.length - 1) * 800; // 800ms per hop
        setTimeout(() => {
            const finalArmyCount = toTerritory.armySize || toTerritory.armies || 0;
            
            if (toTerritory.armySize !== undefined) {
                toTerritory.armySize += shipsToSend;
            } else if (toTerritory.armies !== undefined) {
                toTerritory.armies += shipsToSend;
            }
            
            console.log(`${shipsToSend} ships arrived at territory ${toTerritory.id} via multi-hop (total: ${finalArmyCount + shipsToSend})`);
        }, totalTime);
        
        return true; // Always return true to prevent camera interference
    }

    /**
     * Attempt to transfer fleet between friendly territories
     */
    attemptFleetTransfer(fromTerritory, toTerritory) {
        console.log(`Fleet: Attempting transfer from ${fromTerritory.id} to ${toTerritory.id}`);
        
        // Check if territories are directly connected
        if (this.areConnectedByWarpLane(fromTerritory, toTerritory)) {
            // Direct transfer for adjacent territories
            console.log(`Fleet: Using direct transfer (1 hop)`);
            return this.directFleetTransfer(fromTerritory, toTerritory);
        } else {
            // Use pathfinding for multi-hop transfers
            console.log(`Fleet: Using pathfinding for multi-hop transfer`);
            const result = this.transferWithPathfinding(fromTerritory, toTerritory);
            console.log(`Fleet: Multi-hop transfer result: ${result}`);
            return result;
        }
    }

    /**
     * Direct transfer between adjacent territories
     */
    directFleetTransfer(fromTerritory, toTerritory) {
        
        // Calculate transfer fleet size (50%)
        const totalShips = fromTerritory.armySize;
        const transferFleet = Math.floor(totalShips * this.transferPercentage);
        
        // Ensure we don't send all ships (leave at least 1)
        const maxTransferFleet = Math.max(0, totalShips - 1);
        const finalTransferFleet = Math.min(transferFleet, maxTransferFleet);
        
        if (finalTransferFleet <= 0) {
            console.log(`Fleet transfer blocked: ${fromTerritory.id} needs to keep at least 1 ship`);
            return false;
        }
        
        console.log(`Fleet transfer initiated: ${fromTerritory.id} sending ${finalTransferFleet} ships (50%) to ${toTerritory.id}`);
        
        // Execute the transfer
        this.executeFleetTransfer(fromTerritory, toTerritory, finalTransferFleet);
        
        return true;
    }
    
    /**
     * Execute fleet transfer with visual animation
     */
    executeFleetTransfer(fromTerritory, toTerritory, fleetSize) {
        // Deduct ships immediately from source
        fromTerritory.armySize -= fleetSize;
        
        // Visual feedback - flash the source territory
        this.addTransferFlash(fromTerritory, fleetSize);
        
        // Create ship animation along warp lane
        try {
            this.createTransferAnimation(fromTerritory, toTerritory, fleetSize);
        } catch (error) {
            console.error('Fleet: Error creating transfer animation:', error);
        }
        
        console.log(`${fleetSize} ships departed from territory ${fromTerritory.id} to ${toTerritory.id}`);
    }
    
    /**
     * Create visual ship animation along warp lane
     */
    createTransferAnimation(fromTerritory, toTerritory, fleetSize) {
        console.log(`Fleet: createTransferAnimation called for ${fleetSize} ships from ${fromTerritory.id} to ${toTerritory.id}`);
        const humanPlayer = this.game.players.find(p => p.type === 'human');
        const shipColor = humanPlayer ? humanPlayer.color : '#00FFFF';
        console.log(`Fleet: Found human player color: ${shipColor}`);
        
        const animation = {
            id: Date.now() + Math.random(),
            fromTerritory,
            toTerritory,
            fleetSize,
            startTime: Date.now(),
            duration: 800, // Fast 800ms travel time for zippy feel
            progress: 0,
            color: shipColor,
            type: 'transfer'
        };
        
        this.transferAnimations.push(animation);
        console.log(`Fleet: Created animation ${animation.id}, total animations: ${this.transferAnimations.length}`);
        
        // Schedule arrival
        setTimeout(() => {
            this.completeFleetTransfer(toTerritory, fleetSize);
            this.removeAnimation(animation.id);
        }, animation.duration);
    }
    
    /**
     * Complete fleet transfer when ships arrive
     */
    completeFleetTransfer(toTerritory, fleetSize) {
        toTerritory.armySize += fleetSize;
        console.log(`${fleetSize} ships arrived at territory ${toTerritory.id} (total: ${toTerritory.armySize})`);
        
        // Visual feedback for arrival
        this.addArrivalFlash(toTerritory);
    }
    
    /**
     * Add visual flash effect for ship departure
     */
    addTransferFlash(territory, fleetSize) {
        if (this.game.addFloatingText) {
            this.game.addFloatingText(territory.x, territory.y - 20, `-${fleetSize}`, '#FFFF00', 1500);
        }
        
        // Add flash effect
        territory.flashColor = '#FFFF00';
        territory.flashDuration = 500;
        territory.flashStartTime = Date.now();
    }
    
    /**
     * Add visual flash effect for ship arrival
     */
    addArrivalFlash(territory) {
        territory.flashColor = '#00FF00';
        territory.flashDuration = 300;
        territory.flashStartTime = Date.now();
    }
    
    /**
     * Check if two territories are connected by a warp lane
     */
    areConnectedByWarpLane(territory1, territory2) {
        // Check both neighbors array and connections array for compatibility
        const isConnected = (territory1.neighbors && territory1.neighbors.includes(territory2.id)) ||
                           (territory1.connections && territory1.connections.includes(territory2.id));
        
        console.log(`Fleet: Connection check between ${territory1.id} and ${territory2.id}: ${isConnected}`);
        console.log(`Fleet: Territory ${territory1.id} neighbors:`, territory1.neighbors);
        console.log(`Fleet: Territory ${territory1.id} connections:`, territory1.connections);
        
        return isConnected;
    }
    
    /**
     * Find territory at given world position
     */
    findTerritoryAtPosition(worldPos) {
        // Use the existing findTerritoryAt method from GameMap for consistency
        return this.game.gameMap.findTerritoryAt(worldPos.x, worldPos.y);
    }

    /**
     * Find shortest path between two territories using BFS
     */
    findShortestPath(fromId, toId) {
        const humanPlayer = this.game.players.find(p => p.type === 'human');
        if (!humanPlayer) return null;

        // BFS to find shortest path through player-owned territories
        const queue = [[fromId]];
        const visited = new Set([fromId]);

        while (queue.length > 0) {
            const path = queue.shift();
            const currentId = path[path.length - 1];

            // Found destination
            if (currentId === toId) {
                return path;
            }

            // Get current territory
            const currentTerritory = this.game.territories.find(t => t.id === currentId);
            if (!currentTerritory) continue;

            // Explore connected territories - check both neighbors and connections arrays
            const connections = currentTerritory.neighbors || currentTerritory.connections || [];
            
            for (let connectedId of connections) {
                if (visited.has(connectedId)) continue;

                const connectedTerritory = this.game.territories.find(t => t.id === connectedId);
                if (!connectedTerritory) continue;

                // Only traverse through player-owned territories (except destination)
                if (connectedId !== toId && connectedTerritory.ownerId !== humanPlayer.id) {
                    continue;
                }

                visited.add(connectedId);
                queue.push([...path, connectedId]);
            }
        }

        return null; // No path found
    }

    /**
     * Create attack animation with red ships
     */
    createAttackAnimation(fromTerritory, toTerritory, fleetSize) {
        const animation = {
            id: Date.now() + Math.random(),
            fromTerritory,
            toTerritory,
            fleetSize,
            progress: 0,
            startTime: Date.now(),
            duration: 800,
            color: '#ff4444', // Red for attacks
            type: 'attack'
        };

        this.transferAnimations.push(animation);
        console.log(`Fleet: Created attack animation ${animation.id}, total animations: ${this.transferAnimations.length}`);
    }

    /**
     * Create multi-hop animation chain
     */
    createMultiHopAnimation(path, fleetSize) {
        const humanPlayer = this.game.players.find(p => p.type === 'human');
        const playerColor = humanPlayer ? humanPlayer.color : '#00ffff';

        for (let i = 0; i < path.length - 1; i++) {
            const fromId = path[i];
            const toId = path[i + 1];

            const fromTerritory = this.game.territories.find(t => t.id === fromId);
            const toTerritory = this.game.territories.find(t => t.id === toId);

            if (fromTerritory && toTerritory) {
                const animation = {
                    id: Date.now() + Math.random() + i,
                    fromTerritory,
                    toTerritory,
                    fleetSize,
                    progress: 0,
                    startTime: Date.now() + (i * 800), // Stagger each hop
                    duration: 800,
                    color: playerColor,
                    type: 'multi-hop',
                    hopIndex: i
                };

                this.transferAnimations.push(animation);
            }
        }

        console.log(`Fleet: Created ${path.length - 1} hop animations for multi-hop transfer`);
    }
    
    /**
     * Update transfer animations
     */
    update(deltaTime) {
        const currentTime = Date.now();
        
        for (let animation of this.transferAnimations) {
            const elapsed = currentTime - animation.startTime;
            animation.progress = Math.min(elapsed / animation.duration, 1.0);
        }
        
        // Remove completed animations
        this.transferAnimations = this.transferAnimations.filter(
            anim => anim.progress < 1.0
        );
    }
    
    /**
     * Render transfer animations
     */
    render(ctx) {
        console.log(`Fleet: Rendering ${this.transferAnimations.length} animations`);
        for (let animation of this.transferAnimations) {
            this.renderTransferAnimation(ctx, animation);
        }
        
        // Render selection indicator
        if (this.selectedTerritory) {
            this.renderSelectionIndicator(ctx, this.selectedTerritory);
        }
    }
    
    /**
     * Render individual transfer animation
     */
    renderTransferAnimation(ctx, animation) {
        const { fromTerritory, toTerritory, progress, color, fleetSize } = animation;
        
        // Calculate current position along the path
        const startX = fromTerritory.x;
        const startY = fromTerritory.y;
        const endX = toTerritory.x;
        const endY = toTerritory.y;
        
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;
        
        // Draw ship sprite/icon
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        
        // Ship represented as a larger, more visible triangle with glow effect
        const size = 6;
        
        // Add glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        // Calculate direction for proper triangle orientation
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);
        
        // Oriented triangle pointing in direction of travel
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        ctx.moveTo(currentX + cos * size, currentY + sin * size);
        ctx.lineTo(currentX - cos * size - sin * size, currentY - sin * size + cos * size);
        ctx.lineTo(currentX - cos * size + sin * size, currentY - sin * size - cos * size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Remove shadow for text
        ctx.shadowBlur = 0;
        
        // Draw fleet size indicator with better visibility
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(fleetSize.toString(), currentX, currentY - size - 8);
        ctx.fillText(fleetSize.toString(), currentX, currentY - size - 8);
        
        ctx.restore();
    }
    
    /**
     * Render selection indicator around selected territory
     */
    renderSelectionIndicator(ctx, territory) {
        ctx.save();
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        
        // Animated dashed circle
        const time = Date.now() / 200;
        ctx.lineDashOffset = time % 10;
        
        ctx.beginPath();
        ctx.arc(territory.x, territory.y, territory.radius + 8, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.restore();
    }
    
    /**
     * Remove animation by ID
     */
    removeAnimation(animationId) {
        this.transferAnimations = this.transferAnimations.filter(
            anim => anim.id !== animationId
        );
    }
    
    /**
     * Get currently selected territory
     */
    getSelectedTerritory() {
        return this.selectedTerritory;
    }
    
    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedTerritory = null;
    }
}