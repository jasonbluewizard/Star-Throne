import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { GameEngine } from './GameEngine.js';
import { PlayerState, GameConfig, ClientCommand, CommandType, GameStateUpdate, CombatResult, CommandError } from '../common/types/index.js';

interface Player {
  id: string;
  name: string;
  color: string;
  type: 'human' | 'ai';
  socketId?: string;
  territories: number[];
  armyGenRate: number;
  totalArmies: number;
  territoriesOwned: number;
  isEliminated: boolean;
}

interface GameRoom {
  id: string;
  name: string;
  players: Map<string, Player>;
  gameEngine: GameEngine | null;
  gameLoop: NodeJS.Timeout | null;
  isStarted: boolean;
  maxPlayers: number;
  aiPlayerCount: number;
  gameMode: 'single' | 'multiplayer';
  lastUpdate: number;
  tickRate: number;
}

export class GameServer {
  private io: SocketServer;
  private rooms: Map<string, GameRoom> = new Map();
  private playerToRoom: Map<string, string> = new Map();

  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Handle creating a new game room
      socket.on('create-room', (data: { roomName: string, playerName: string, maxPlayers: number, aiCount: number }) => {
        const roomId = this.generateRoomId();
        const room: GameRoom = {
          id: roomId,
          name: data.roomName,
          players: new Map(),
          gameEngine: null,
          gameLoop: null,
          isStarted: false,
          maxPlayers: data.maxPlayers,
          aiPlayerCount: data.aiCount,
          gameMode: 'multiplayer',
          lastUpdate: Date.now(),
          tickRate: 20
        };

        this.rooms.set(roomId, room);
        this.joinRoom(socket, roomId, data.playerName);
        
        socket.emit('room-created', { roomId, room: this.getRoomInfo(room) });
      });

      // Handle joining existing room
      socket.on('join-room', (data: { roomId: string, playerName: string }) => {
        const room = this.rooms.get(data.roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (room.players.size >= room.maxPlayers) {
          socket.emit('error', { message: 'Room is full' });
          return;
        }

        if (room.isStarted) {
          socket.emit('error', { message: 'Game already started' });
          return;
        }

        this.joinRoom(socket, data.roomId, data.playerName);
        socket.emit('room-joined', { room: this.getRoomInfo(room) });
      });

      // Handle starting single-player game
      socket.on('start-single-player', (data: { playerName: string, aiCount: number }) => {
        const roomId = this.generateRoomId();
        const room: GameRoom = {
          id: roomId,
          name: 'Single Player Game',
          players: new Map(),
          gameState: null,
          isStarted: false,
          maxPlayers: 1,
          aiPlayerCount: data.aiCount,
          gameMode: 'single',
          lastUpdate: Date.now()
        };

        this.rooms.set(roomId, room);
        this.joinRoom(socket, roomId, data.playerName);
        this.startGame(roomId);
        
        socket.emit('single-player-started', { roomId, room: this.getRoomInfo(room) });
      });

      // Handle game actions
      socket.on('game-action', (data: { action: string, payload: any }) => {
        const roomId = this.playerToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room || !room.isStarted) return;

        this.handleGameAction(socket, room, data.action, data.payload);
      });

      // Handle player ready
      socket.on('player-ready', () => {
        const roomId = this.playerToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        // In multiplayer, check if all players are ready
        if (room.gameMode === 'multiplayer') {
          const allReady = Array.from(room.players.values())
            .filter(p => p.type === 'human')
            .every(p => p.socketId === socket.id); // Simplified ready check

          if (allReady && room.players.size > 0) {
            this.startGame(roomId);
          }
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        this.handleDisconnect(socket);
      });
    });
  }

  private joinRoom(socket: any, roomId: string, playerName: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player: Player = {
      id: socket.id,
      name: playerName,
      color: this.generatePlayerColor(room.players.size),
      type: 'human',
      socketId: socket.id,
      territories: [],
      armyGenRate: 1,
      totalArmies: 0,
      territoriesOwned: 0,
      isEliminated: false
    };

    room.players.set(socket.id, player);
    this.playerToRoom.set(socket.id, roomId);
    
    socket.join(roomId);
    
    // Notify other players in the room
    socket.to(roomId).emit('player-joined', { player: this.getPlayerInfo(player) });
  }

  private startGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.isStarted = true;
    
    // Initialize game state (this would connect to your existing game logic)
    room.gameState = {
      phase: 'playing',
      territories: [],
      gameMap: null,
      tick: 0
    };

    // Notify all players in the room
    this.io.to(roomId).emit('game-started', { 
      gameState: room.gameState,
      players: Array.from(room.players.values()).map(p => this.getPlayerInfo(p))
    });

    console.log(`Game started in room ${roomId} with ${room.players.size} human players and ${room.aiPlayerCount} AI players`);
  }

  private handleGameAction(socket: any, room: GameRoom, action: string, payload: any) {
    const player = room.players.get(socket.id);
    if (!player) return;

    // Validate and process game actions
    switch (action) {
      case 'select-territory':
        // Handle territory selection
        this.broadcastGameUpdate(room.id, {
          type: 'territory-selected',
          playerId: player.id,
          territoryId: payload.territoryId
        });
        break;

      case 'launch-probe':
        // Handle probe launch
        this.broadcastGameUpdate(room.id, {
          type: 'probe-launched',
          playerId: player.id,
          fromTerritory: payload.fromTerritory,
          toTerritory: payload.toTerritory
        });
        break;

      case 'attack-territory':
        // Handle territory attack
        this.broadcastGameUpdate(room.id, {
          type: 'territory-attacked',
          playerId: player.id,
          attackingTerritory: payload.attackingTerritory,
          defendingTerritory: payload.defendingTerritory
        });
        break;

      case 'transfer-fleet':
        // Handle fleet transfer
        this.broadcastGameUpdate(room.id, {
          type: 'fleet-transferred',
          playerId: player.id,
          fromTerritory: payload.fromTerritory,
          toTerritory: payload.toTerritory
        });
        break;
    }
  }

  private broadcastGameUpdate(roomId: string, update: any) {
    this.io.to(roomId).emit('game-update', update);
  }

  private handleDisconnect(socket: any) {
    const roomId = this.playerToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players.delete(socket.id);
    this.playerToRoom.delete(socket.id);

    // Notify other players
    socket.to(roomId).emit('player-left', { playerId: socket.id });

    // Clean up empty rooms
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} deleted - no players remaining`);
    }
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private generatePlayerColor(index: number): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[index % colors.length];
  }

  private getRoomInfo(room: GameRoom) {
    return {
      id: room.id,
      name: room.name,
      playerCount: room.players.size,
      maxPlayers: room.maxPlayers,
      aiPlayerCount: room.aiPlayerCount,
      isStarted: room.isStarted,
      gameMode: room.gameMode,
      players: Array.from(room.players.values()).map(p => this.getPlayerInfo(p))
    };
  }

  private getPlayerInfo(player: Player) {
    return {
      id: player.id,
      name: player.name,
      color: player.color,
      type: player.type,
      territoriesOwned: player.territoriesOwned,
      totalArmies: player.totalArmies,
      isEliminated: player.isEliminated
    };
  }

  // Get room list for lobby
  public getRoomsList() {
    return Array.from(this.rooms.values())
      .filter(room => !room.isStarted && room.gameMode === 'multiplayer')
      .map(room => this.getRoomInfo(room));
  }
}