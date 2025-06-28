import { CommandType, ClientCommand, AttackTerritoryCommand, TransferArmiesCommand, LaunchProbeCommand, CreateSupplyRouteCommand } from '../../../common/types/index.js';
import { socketClient } from './socketClient';

export class GameCommands {
  static attackTerritory(fromTerritoryId: number, toTerritoryId: number): void {
    const command: ClientCommand = {
      type: CommandType.ATTACK_TERRITORY,
      payload: { fromTerritoryId, toTerritoryId } as AttackTerritoryCommand,
      timestamp: Date.now()
    };
    
    this.sendCommand(command);
  }

  static transferArmies(fromTerritoryId: number, toTerritoryId: number): void {
    const command: ClientCommand = {
      type: CommandType.TRANSFER_ARMIES,
      payload: { fromTerritoryId, toTerritoryId } as TransferArmiesCommand,
      timestamp: Date.now()
    };
    
    this.sendCommand(command);
  }

  static launchProbe(fromTerritoryId: number, toTerritoryId: number): void {
    const command: ClientCommand = {
      type: CommandType.LAUNCH_PROBE,
      payload: { fromTerritoryId, toTerritoryId } as LaunchProbeCommand,
      timestamp: Date.now()
    };
    
    this.sendCommand(command);
  }

  static createSupplyRoute(fromTerritoryId: number, toTerritoryId: number): void {
    const command: ClientCommand = {
      type: CommandType.CREATE_SUPPLY_ROUTE,
      payload: { fromTerritoryId, toTerritoryId } as CreateSupplyRouteCommand,
      timestamp: Date.now()
    };
    
    this.sendCommand(command);
  }

  private static sendCommand(command: ClientCommand): void {
    if (socketClient.isSocketConnected()) {
      // Send through secure multiplayer channel
      socketClient.sendPlayerCommand(command);
    } else {
      // For single-player mode, we'll need to integrate with the local game
      console.warn('Command sent in single-player mode:', command);
      // This will be handled by the local game engine for single-player
      (window as any).game?.handleServerCommand?.(command);
    }
  }

  // Rate limiting to prevent command spam
  private static lastCommandTime = 0;
  private static commandCooldown = 100; // 100ms between commands

  static canSendCommand(): boolean {
    const now = Date.now();
    if (now - this.lastCommandTime < this.commandCooldown) {
      return false;
    }
    this.lastCommandTime = now;
    return true;
  }
}