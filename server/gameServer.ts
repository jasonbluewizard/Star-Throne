import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { GameEngine } from './GameEngine.js';
import { PlayerState, GameConfig, ClientCommand, CommandType, GameStateUpdate, CombatResult, CommandError } from '../common/types/index.js';
import { GAME_CONSTANTS } from '../common/gameConstants.js';

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
          gameEngine: null,
          gameLoop: null,
          isStarted: false,
          maxPlayers: 1,
          aiPlayerCount: data.aiCount,
          gameMode: 'single',
          lastUpdate: Date.now(),
          tickRate: 20
        };

        this.rooms.set(roomId, room);
        this.joinRoom(socket, roomId, data.playerName);
        this.startGame(roomId);
        
        socket.emit('single-player-started', { roomId, room: this.getRoomInfo(room) });
      });

      // Handle secure player commands (server-authoritative)
      socket.on('player-command', (command: ClientCommand) => {
        const roomId = this.playerToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room || !room.isStarted || !room.gameEngine) return;

        // Execute command through authoritative game engine
        const result = room.gameEngine.executeCommand(socket.id, command);
        
        if (result) {
          if ('command' in result) {
            // Command error
            socket.emit('command-error', result as CommandError);
          } else {
            // Combat result - broadcast to all players
            this.io.to(roomId).emit('combat-result', result as CombatResult);
          }
        }
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

  private startGame(roomId: string, mapSize: number = 200, gameSpeed: number = 1.0) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.isStarted = true;
    
    // Initialize server-authoritative game engine with game speed
    room.gameEngine = new GameEngine({ mapSize, tickRate: room.tickRate, gameSpeed });
    
    // Add all players to the game engine
    Array.from(room.players.values()).forEach(player => {
      room.gameEngine!.addPlayer(player.id, player.name, player.color, player.type);
    });
    
    // Add AI players
    for (let i = 0; i < room.aiPlayerCount; i++) {
      const aiId = `ai_${i}`;
      const aiName = this.generateAIName(i);
      const aiColor = this.generatePlayerColor(room.players.size + i);
      room.gameEngine!.addPlayer(aiId, aiName, aiColor, 'ai');
    }
    
    // Start the game
    room.gameEngine.startGame();
    
    // Start the server game loop
    this.startGameLoop(roomId);

    // Send initial game state to all players
    const gameState = room.gameEngine.getGameState();
    this.io.to(roomId).emit('game-started', { 
      gameState,
      players: Object.values(gameState.players)
    });

    console.log(`Server-authoritative game started in room ${roomId} with ${room.players.size} human players and ${room.aiPlayerCount} AI players`);
  }

  private startGameLoop(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameEngine) return;

    const tickInterval = 1000 / room.tickRate; // Convert to milliseconds
    let lastUpdate = Date.now();

    room.gameLoop = setInterval(() => {
      const now = Date.now();
      const deltaTime = now - lastUpdate;
      lastUpdate = now;

      // Update game engine
      room.gameEngine!.update(deltaTime);

      // Broadcast state updates to all players
      const gameState = room.gameEngine!.getGameState();
      this.broadcastGameStateUpdate(roomId, gameState);

      // Check if game ended
      if (gameState.gamePhase === 'ended') {
        this.endGame(roomId);
      }
    }, tickInterval);
  }

  private broadcastGameStateUpdate(roomId: string, gameState: any) {
    const update: GameStateUpdate = {
      type: 'DELTA_STATE',
      gameState,
      timestamp: Date.now()
    };
    
    this.io.to(roomId).emit('game-state-update', update);
  }

  private endGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameLoop) return;

    clearInterval(room.gameLoop);
    room.gameLoop = null;
    
    console.log(`Game ended in room ${roomId}`);
  }

  private generateAIName(index: number): string {
    const firstNames = [
      'Alex', 'Blake', 'Casey', 'Dana', 'Emma', 'Felix', 'Grace', 'Hunter', 'Iris', 'Jack',
      'Kai', 'Luna', 'Max', 'Nova', 'Owen', 'Piper', 'Quinn', 'Riley', 'Sage', 'Tyler'
    ];
    
    const clanNames = [
      'StarForge', 'VoidHunters', 'NebulaRise', 'CosmicFury', 'SolarFlare', 'DarkMatter',
      'GalaxyCorp', 'NovaStrike', 'CelestialWar', 'SpaceRaiders', 'StellarWolves', 'OrbitClan'
    ];
    
    const firstName = firstNames[index % firstNames.length];
    const clanName = clanNames[Math.floor(index / firstNames.length) % clanNames.length];
    
    return `[${clanName}] ${firstName}`;
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
    return Math.random().toString(GAME_CONSTANTS.ROOM_ID_GENERATION_RADIX).substring(
        GAME_CONSTANTS.ROOM_ID_GENERATION_SUBSTRING_START, 
        GAME_CONSTANTS.ROOM_ID_GENERATION_SUBSTRING_END
    ).toUpperCase();
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