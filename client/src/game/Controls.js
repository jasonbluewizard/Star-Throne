/**
 * Controls.js - Enhanced player control module
 * 
 * Handles advanced player controls including the new attack system
 * where right-clicking on enemy stars sends 10% of ships (rounded up)
 * with visible ships zipping along warp lanes.
 */

export default class Controls {
  constructor(game) {
    this.game = game;
    
    // Attack settings
    this.defaultAttackPercentage = 0.10; // 10% of ships
    
    console.log('Controls module initialized');
  }

  /**
   * Execute attack command when right-clicking on enemy territory
   * Sends 10% of ships (rounded up) from selected territory to target
   */
  executeAttack(fromTerritory, toTerritory) {
    // Validation checks
    if (!this.canAttack(fromTerritory, toTerritory)) {
      return false;
    }

    // Calculate attack fleet size (10% rounded up)
    const totalShips = fromTerritory.armySize;
    const attackFleet = Math.max(1, Math.ceil(totalShips * this.defaultAttackPercentage));
    
    // Ensure we don't send all ships (leave at least 1)
    const maxAttackFleet = Math.max(0, totalShips - 1);
    const finalAttackFleet = Math.min(attackFleet, maxAttackFleet);
    
    if (finalAttackFleet <= 0) {
      console.log(`Attack blocked: ${fromTerritory.id} needs to keep at least 1 ship`);
      return false;
    }

    console.log(`Attack initiated: ${fromTerritory.id} sending ${finalAttackFleet} ships (${Math.round(this.defaultAttackPercentage * 100)}%) to ${toTerritory.id}`);

    // Visual feedback - flash the source territory
    this.addAttackFlash(fromTerritory, finalAttackFleet);

    // Create ship animation along warp lane
    this.createAttackAnimation(fromTerritory, toTerritory, finalAttackFleet);

    // Deduct ships immediately from source
    fromTerritory.armySize -= finalAttackFleet;

    // Schedule the actual attack resolution after animation completes
    setTimeout(() => {
      this.resolveAttack(fromTerritory, toTerritory, finalAttackFleet);
    }, this.getAnimationDuration(fromTerritory, toTerritory));

    return true;
  }

  /**
   * Execute reinforcement command when right-clicking on friendly territory
   * Sends 10% of ships (rounded up) from selected territory to target
   */
  executeReinforcement(fromTerritory, toTerritory) {
    // Validation checks
    if (!this.canReinforce(fromTerritory, toTerritory)) {
      return false;
    }

    // Calculate reinforcement fleet size (10% rounded up)
    const totalShips = fromTerritory.armySize;
    const reinforcementFleet = Math.max(1, Math.ceil(totalShips * this.defaultAttackPercentage));
    
    // Ensure we don't send all ships (leave at least 1)
    const maxReinforcementFleet = Math.max(0, totalShips - 1);
    const finalReinforcementFleet = Math.min(reinforcementFleet, maxReinforcementFleet);
    
    if (finalReinforcementFleet <= 0) {
      console.log(`Reinforcement blocked: ${fromTerritory.id} needs to keep at least 1 ship`);
      return false;
    }

    console.log(`Reinforcement initiated: ${fromTerritory.id} sending ${finalReinforcementFleet} ships (${Math.round(this.defaultAttackPercentage * 100)}%) to ${toTerritory.id}`);

    // Visual feedback - flash the source territory
    this.addReinforcementFlash(fromTerritory, finalReinforcementFleet);

    // Create ship animation along warp lane
    this.createReinforcementAnimation(fromTerritory, toTerritory, finalReinforcementFleet);

    // Deduct ships immediately from source
    fromTerritory.armySize -= finalReinforcementFleet;

    // Schedule the actual reinforcement after animation completes
    setTimeout(() => {
      this.resolveReinforcement(fromTerritory, toTerritory, finalReinforcementFleet);
    }, this.getAnimationDuration(fromTerritory, toTerritory));

    return true;
  }

  /**
   * Check if reinforcement is valid
   */
  canReinforce(fromTerritory, toTerritory) {
    if (!fromTerritory || !toTerritory) {
      console.log('Reinforcement blocked: Missing territory');
      return false;
    }

    // Must own both territories
    if (fromTerritory.ownerId !== this.game.humanPlayer?.id) {
      console.log('Reinforcement blocked: Don\'t own source territory');
      return false;
    }

    if (toTerritory.ownerId !== this.game.humanPlayer?.id) {
      console.log('Reinforcement blocked: Don\'t own target territory');
      return false;
    }

    // Cannot reinforce self
    if (fromTerritory.id === toTerritory.id) {
      console.log('Reinforcement blocked: Cannot reinforce same territory');
      return false;
    }

    // Must have enough ships to reinforce
    if (fromTerritory.armySize <= 1) {
      console.log('Reinforcement blocked: Need more than 1 ship to reinforce');
      return false;
    }

    // Must be connected via warp lanes
    if (!this.areConnected(fromTerritory, toTerritory)) {
      console.log('Reinforcement blocked: Territories not connected');
      return false;
    }

    return true;
  }

  /**
   * Check if attack is valid
   */
  canAttack(fromTerritory, toTerritory) {
    if (!fromTerritory || !toTerritory) {
      console.log('Attack blocked: Missing territory');
      return false;
    }

    // Must own the source territory
    if (fromTerritory.ownerId !== this.game.humanPlayer?.id) {
      console.log('Attack blocked: Don\'t own source territory');
      return false;
    }

    // Target must be enemy or neutral (not owned by player)
    if (toTerritory.ownerId === this.game.humanPlayer?.id) {
      console.log('Attack blocked: Cannot attack own territory');
      return false;
    }

    // Cannot attack colonizable planets (use probes instead)
    if (toTerritory.isColonizable) {
      console.log('Attack blocked: Use probes for colonizable planets');
      return false;
    }

    // Must have enough ships to attack
    if (fromTerritory.armySize <= 1) {
      console.log('Attack blocked: Need more than 1 ship to attack');
      return false;
    }

    // Must be connected via warp lanes or adjacent
    if (!this.areConnected(fromTerritory, toTerritory)) {
      console.log('Attack blocked: Territories not connected');
      return false;
    }

    return true;
  }

  /**
   * Check if territories are connected via warp lanes
   */
  areConnected(territory1, territory2) {
    return territory1.neighbors && territory1.neighbors.includes(territory2.id);
  }

  /**
   * Add visual flash effect to attacking territory
   */
  addAttackFlash(territory, fleetSize) {
    // Set flash properties
    territory.attackFlash = 800; // Flash duration in ms
    territory.flashColor = '#ff4444'; // Red attack color

    // Add floating text showing ships being sent
    if (this.game.floatingTexts) {
      this.game.floatingTexts.push({
        x: territory.x + Math.random() * 40 - 20,
        y: territory.y - 25,
        text: `-${fleetSize}`,
        color: '#ff4444',
        timer: 2000,
        duration: 2000,
        opacity: 1
      });
    }

    console.log(`Attack flash added to territory ${territory.id}: sending ${fleetSize} ships`);
  }

  /**
   * Create ship animation along warp lane
   */
  createAttackAnimation(fromTerritory, toTerritory, fleetSize) {
    if (!this.game.animationSystem) {
      console.log('Warning: No animation system available');
      return;
    }

    // Create ship animation with player color
    this.game.animationSystem.createShipAnimation(
      fromTerritory, 
      toTerritory, 
      fleetSize, 
      '#ff4444' // Red color for attacks
    );

    console.log(`Attack animation created: ${fleetSize} ships from ${fromTerritory.id} to ${toTerritory.id}`);
  }

  /**
   * Add visual flash effect to reinforcing territory
   */
  addReinforcementFlash(territory, fleetSize) {
    // Set flash properties
    territory.reinforcementFlash = 800; // Flash duration in ms
    territory.flashColor = '#44ff44'; // Green reinforcement color

    // Add floating text showing ships being sent
    if (this.game.floatingTexts) {
      this.game.floatingTexts.push({
        x: territory.x + Math.random() * 40 - 20,
        y: territory.y - 25,
        text: `-${fleetSize}`,
        color: '#44ff44',
        timer: 2000,
        duration: 2000,
        opacity: 1
      });
    }

    console.log(`Reinforcement flash added to territory ${territory.id}: sending ${fleetSize} ships`);
  }

  /**
   * Create ship animation for reinforcements along warp lane
   */
  createReinforcementAnimation(fromTerritory, toTerritory, fleetSize) {
    if (!this.game.animationSystem) {
      console.log('Warning: No animation system available');
      return;
    }

    // Create ship animation with green color for reinforcements
    this.game.animationSystem.createShipAnimation(
      fromTerritory, 
      toTerritory, 
      fleetSize, 
      '#44ff44' // Green color for reinforcements
    );

    console.log(`Reinforcement animation created: ${fleetSize} ships from ${fromTerritory.id} to ${toTerritory.id}`);
  }

  /**
   * Resolve reinforcement after animation completes
   */
  resolveReinforcement(fromTerritory, toTerritory, reinforcementFleet) {
    // Simply add ships to target territory
    toTerritory.armySize += reinforcementFleet;
    
    console.log(`Reinforcement resolved: ${reinforcementFleet} ships added to territory ${toTerritory.id}, total now: ${toTerritory.armySize}`);
    
    // Add visual feedback
    this.addReinforcementArrivedFlash(toTerritory, reinforcementFleet);
  }

  /**
   * Add flash effect when reinforcements arrive
   */
  addReinforcementArrivedFlash(territory, fleetSize) {
    territory.reinforcementArrivedFlash = 600; // Flash duration
    territory.flashColor = '#88ff88'; // Light green arrival flash
    
    // Add floating text showing ships received
    if (this.game.floatingTexts) {
      this.game.floatingTexts.push({
        x: territory.x + Math.random() * 40 - 20,
        y: territory.y - 25,
        text: `+${fleetSize}`,
        color: '#44ff44',
        timer: 2000,
        duration: 2000,
        opacity: 1
      });
    }
  }

  /**
   * Calculate animation duration based on distance
   */
  getAnimationDuration(fromTerritory, toTerritory) {
    const distance = Math.sqrt(
      Math.pow(toTerritory.x - fromTerritory.x, 2) + 
      Math.pow(toTerritory.y - fromTerritory.y, 2)
    );
    
    // Base duration of 1000ms, adjusted by distance
    const baseDuration = 1000;
    const distanceFactor = Math.min(2.0, distance / 200); // Scale factor
    
    return Math.round(baseDuration * distanceFactor);
  }

  /**
   * Resolve the actual combat after animation completes
   */
  resolveAttack(fromTerritory, toTerritory, attackingFleet) {
    if (!this.game.combatSystem) {
      console.log('Warning: No combat system available, using basic resolution');
      this.basicCombatResolution(fromTerritory, toTerritory, attackingFleet);
      return;
    }

    // Use the game's combat system
    this.game.combatSystem.processAttack(
      fromTerritory, 
      toTerritory, 
      attackingFleet, 
      this.game.players, 
      this.game.floatingTexts
    );

    console.log(`Combat resolved: ${attackingFleet} ships attacked ${toTerritory.id}`);
  }

  /**
   * Basic combat resolution fallback
   */
  basicCombatResolution(fromTerritory, toTerritory, attackingFleet) {
    const defenderBonus = 1.1; // 10% defensive bonus
    const attackerStrength = attackingFleet;
    const defenderStrength = toTerritory.armySize * defenderBonus;

    console.log(`Basic combat: ${attackerStrength} attackers vs ${defenderStrength} defenders`);

    if (attackerStrength > defenderStrength) {
      // Attacker wins
      const remainingAttackers = Math.floor(attackerStrength - defenderStrength);
      const previousOwner = toTerritory.ownerId;
      
      toTerritory.ownerId = fromTerritory.ownerId;
      toTerritory.armySize = Math.max(1, remainingAttackers);

      console.log(`Victory! Territory ${toTerritory.id} captured with ${toTerritory.armySize} ships remaining`);

      // Check for throne star capture
      if (toTerritory.isThroneStar) {
        console.log(`👑 THRONE STAR CAPTURED! Territory ${toTerritory.id}`);
        this.handleThroneCapture(toTerritory, previousOwner);
      }
    } else {
      // Defender wins
      const remainingDefenders = Math.floor(defenderStrength - attackerStrength);
      toTerritory.armySize = Math.max(1, remainingDefenders);
      
      console.log(`Defense successful! Territory ${toTerritory.id} has ${toTerritory.armySize} ships remaining`);
    }

    // Add combat flash effect
    this.addCombatFlash(toTerritory);
  }

  /**
   * Handle throne star capture
   */
  handleThroneCapture(throneTerritory, previousOwner) {
    if (!this.game.combatSystem?.handleThroneCapture) {
      console.log('Warning: No throne capture handler available');
      return;
    }

    const defeatedPlayer = this.game.players.find(p => p.id === previousOwner);
    const conqueror = this.game.players.find(p => p.id === throneTerritory.owner);

    if (defeatedPlayer && conqueror) {
      this.game.combatSystem.handleThroneCapture(defeatedPlayer, conqueror);
    }
  }

  /**
   * Add combat flash effect to target territory
   */
  addCombatFlash(territory) {
    territory.combatFlash = 1000; // Flash duration
    territory.flashColor = '#ffff44'; // Yellow combat flash
  }

  /**
   * Update method called each frame
   */
  update(deltaTime) {
    // Update territory flash effects
    if (this.game.gameMap && this.game.gameMap.territories) {
      // territories is an object, not an array - iterate over values
      for (const territory of Object.values(this.game.gameMap.territories)) {
        if (territory.attackFlash > 0) {
          territory.attackFlash -= deltaTime;
        }
        if (territory.combatFlash > 0) {
          territory.combatFlash -= deltaTime;
        }
        if (territory.reinforcementFlash > 0) {
          territory.reinforcementFlash -= deltaTime;
        }
        if (territory.reinforcementArrivedFlash > 0) {
          territory.reinforcementArrivedFlash -= deltaTime;
        }
      }
    }
  }

  /**
   * Get attack preview info for UI
   */
  getAttackPreview(fromTerritory, toTerritory) {
    if (!this.canAttack(fromTerritory, toTerritory)) {
      return null;
    }

    const totalShips = fromTerritory.armySize;
    const attackFleet = Math.max(1, Math.ceil(totalShips * this.defaultAttackPercentage));
    const finalAttackFleet = Math.min(attackFleet, Math.max(0, totalShips - 1));

    return {
      fleetSize: finalAttackFleet,
      percentage: Math.round((finalAttackFleet / totalShips) * 100),
      remaining: totalShips - finalAttackFleet,
      canAttack: finalAttackFleet > 0
    };
  }

  /**
   * Set custom attack percentage (for future enhancements)
   */
  setAttackPercentage(percentage) {
    this.defaultAttackPercentage = Math.max(0.01, Math.min(0.99, percentage));
    console.log(`Attack percentage set to ${Math.round(this.defaultAttackPercentage * 100)}%`);
  }
}