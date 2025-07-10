import { io, Socket } from 'socket.io-client';

interface GameAction {
  action: string;
  payload: any;
}

interface RoomInfo {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  aiPlayerCount: number;
  isStarted: boolean;
  gameMode: 'single' | 'multiplayer';
  players: PlayerInfo[];
}

interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  type: 'human' | 'ai';
  territoriesOwned: number;
  totalArmies: number;
  isEliminated: boolean;
}

export class SocketClient {
  private socket: Socket | null = null;
  private currentRoom: string | null = null;
  private isConnected = false;

  // Event callbacks
  private onConnectedCallback?: () => void;
  private onDisconnectedCallback?: () => void;
  private onRoomCreatedCallback?: (room: RoomInfo) => void;
  private onRoomJoinedCallback?: (room: RoomInfo) => void;
  private onGameStartedCallback?: (gameData: any) => void;
  private onGameUpdateCallback?: (update: any) => void;
  private onPlayerJoinedCallback?: (player: PlayerInfo) => void;
  private onPlayerLeftCallback?: (playerId: string) => void;
  private onErrorCallback?: (error: { message: string }) => void;

  connect() {
    if (this.isConnected) return;

    // Check if we're in single-player mode by checking the URL or window flag
    if (window.location.search.includes('auto=single') || (window as any).singlePlayerMode) {
      console.log('Single-player mode detected, skipping WebSocket connection');
      return;
    }

    // Use dynamic connection based on environment
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'ws://localhost:5000' 
      : `ws://${window.location.host}`;
      
    this.socket = io(socketUrl, {
      transports: ['websocket'],
      upgrade: false
    });

    this.socket.on('connect', () => {
      console.log('Connected to game server');
      this.isConnected = true;
      this.onConnectedCallback?.();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from game server');
      this.isConnected = false;
      this.currentRoom = null;
      this.onDisconnectedCallback?.();
    });

    this.socket.on('room-created', (data: { roomId: string, room: RoomInfo }) => {
      this.currentRoom = data.roomId;
      this.onRoomCreatedCallback?.(data.room);
    });

    this.socket.on('room-joined', (data: { room: RoomInfo }) => {
      this.onRoomJoinedCallback?.(data.room);
    });

    this.socket.on('single-player-started', (data: { roomId: string, room: RoomInfo }) => {
      this.currentRoom = data.roomId;
      this.onGameStartedCallback?.(data);
    });

    this.socket.on('game-started', (data: { gameState: any, players: PlayerInfo[] }) => {
      this.onGameStartedCallback?.(data);
    });

    this.socket.on('game-update', (update: any) => {
      this.onGameUpdateCallback?.(update);
    });

    this.socket.on('game-state-update', (update: any) => {
      this.onGameUpdateCallback?.(update);
    });

    this.socket.on('combat-result', (result: any) => {
      console.log('Combat result:', result);
      this.onGameUpdateCallback?.(result);
    });

    this.socket.on('command-error', (error: any) => {
      console.error('Command error:', error);
      this.onErrorCallback?.(error);
    });

    this.socket.on('player-joined', (data: { player: PlayerInfo }) => {
      this.onPlayerJoinedCallback?.(data.player);
    });

    this.socket.on('player-left', (data: { playerId: string }) => {
      this.onPlayerLeftCallback?.(data.playerId);
    });

    this.socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
      this.onErrorCallback?.(error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRoom = null;
    }
  }

  // Game room actions
  createRoom(roomName: string, playerName: string, maxPlayers: number = 10, aiCount: number = 90) {
    if (!this.socket) return;
    this.socket.emit('create-room', { roomName, playerName, maxPlayers, aiCount });
  }

  joinRoom(roomId: string, playerName: string) {
    if (!this.socket) return;
    this.socket.emit('join-room', { roomId, playerName });
  }

  startSinglePlayer(playerName: string, aiCount: number = 19) {
    if (!this.socket) return;
    this.socket.emit('start-single-player', { playerName, aiCount });
  }

  setPlayerReady() {
    if (!this.socket) return;
    this.socket.emit('player-ready');
  }

  // Secure command protocol (server-authoritative)
  sendPlayerCommand(command: any) {
    if (!this.socket || !this.currentRoom) return;
    this.socket.emit('player-command', command);
  }

  // Legacy game actions (for backward compatibility)
  sendGameAction(action: string, payload: any) {
    if (!this.socket || !this.currentRoom) return;
    this.socket.emit('game-action', { action, payload });
  }

  selectTerritory(territoryId: number) {
    this.sendGameAction('select-territory', { territoryId });
  }

  launchProbe(fromTerritory: number, toTerritory: number) {
    this.sendGameAction('launch-probe', { fromTerritory, toTerritory });
  }

  attackTerritory(attackingTerritory: number, defendingTerritory: number) {
    this.sendGameAction('attack-territory', { attackingTerritory, defendingTerritory });
  }

  transferFleet(fromTerritory: number, toTerritory: number) {
    this.sendGameAction('transfer-fleet', { fromTerritory, toTerritory });
  }

  // Event listeners
  onConnected(callback: () => void) {
    this.onConnectedCallback = callback;
  }

  onDisconnected(callback: () => void) {
    this.onDisconnectedCallback = callback;
  }

  onRoomCreated(callback: (room: RoomInfo) => void) {
    this.onRoomCreatedCallback = callback;
  }

  onRoomJoined(callback: (room: RoomInfo) => void) {
    this.onRoomJoinedCallback = callback;
  }

  onGameStarted(callback: (gameData: any) => void) {
    this.onGameStartedCallback = callback;
  }

  onGameUpdate(callback: (update: any) => void) {
    this.onGameUpdateCallback = callback;
  }

  onPlayerJoined(callback: (player: PlayerInfo) => void) {
    this.onPlayerJoinedCallback = callback;
  }

  onPlayerLeft(callback: (playerId: string) => void) {
    this.onPlayerLeftCallback = callback;
  }

  onError(callback: (error: { message: string }) => void) {
    this.onErrorCallback = callback;
  }

  // Utility methods
  getCurrentRoom() {
    return this.currentRoom;
  }

  isSocketConnected() {
    return this.isConnected;
  }
}

// Singleton instance
export const socketClient = new SocketClient();