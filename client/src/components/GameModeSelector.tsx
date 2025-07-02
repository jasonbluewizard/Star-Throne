import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { socketClient } from '../lib/socketClient';
import { GameConfigScreen, GameConfig } from './GameConfigScreen';

interface GameModeSelectorProps {
  onModeSelected: (mode: 'single' | 'multiplayer', data?: any) => void;
}

export function GameModeSelector({ onModeSelected }: GameModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<'single' | 'multiplayer' | null>(null);
  const [showConfigScreen, setShowConfigScreen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [aiCount, setAiCount] = useState(90);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleSinglePlayer = () => {
    // Use default name if none set
    if (!playerName.trim()) {
      setPlayerName('Player');
    }
    
    setSelectedMode('single');
    setShowConfigScreen(true);
  };

  const handleConfigStart = (config: GameConfig) => {
    onModeSelected('single', { 
      playerName: config.playerName, 
      aiCount: config.aiPlayerCount,
      mapSize: config.mapSize,
      gameSpeed: config.gameSpeed,
      layout: config.layout
    });
  };

  const handleConfigBack = () => {
    setShowConfigScreen(false);
    setSelectedMode(null);
  };

  const handleMultiplayerConnect = () => {
    // Prompt for player name if not set
    let name = playerName.trim();
    if (!name) {
      const promptResult = prompt('Enter your player name:') || '';
      if (!promptResult.trim()) {
        setError('Player name is required for multiplayer');
        return;
      }
      name = promptResult.trim();
      setPlayerName(name);
    }

    setIsConnecting(true);
    setError('');

    // Set up socket event handlers
    socketClient.onConnected(() => {
      console.log('Connected to multiplayer server');
    });

    socketClient.onError((error: any) => {
      setError(error.message);
      setIsConnecting(false);
    });

    socketClient.onRoomCreated((room: any) => {
      onModeSelected('multiplayer', { room, playerName: playerName.trim() });
    });

    socketClient.onRoomJoined((room: any) => {
      onModeSelected('multiplayer', { room, playerName: playerName.trim() });
    });

    // Connect to server
    socketClient.connect();
  };

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    socketClient.createRoom(roomName.trim(), playerName.trim(), maxPlayers, aiCount);
  };

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    socketClient.joinRoom(roomId.trim().toUpperCase(), playerName.trim());
  };

  if (selectedMode === 'multiplayer' && !isConnecting) {
    return (
      <div className="min-h-screen bg-gray-900 p-4 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto py-8 space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Star Throne</h1>
            <p className="text-gray-400">Multiplayer Game Lobby</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Room */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Create New Game</CardTitle>
                <CardDescription className="text-gray-400">
                  Start a new multiplayer game room
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="roomName" className="text-white">Room Name</Label>
                  <Input
                    id="roomName"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter room name"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="maxPlayers" className="text-white">Max Players</Label>
                    <Input
                      id="maxPlayers"
                      type="number"
                      min="2"
                      max="20"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 10)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="aiCount" className="text-white">AI Players</Label>
                    <Input
                      id="aiCount"
                      type="number"
                      min="0"
                      max="100"
                      value={aiCount}
                      onChange={(e) => setAiCount(parseInt(e.target.value) || 90)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
                <Button onClick={handleCreateRoom} className="w-full">
                  Create Room
                </Button>
              </CardContent>
            </Card>

            {/* Join Room */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Join Existing Game</CardTitle>
                <CardDescription className="text-gray-400">
                  Enter a room ID to join a game
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="roomId" className="text-white">Room ID</Label>
                  <Input
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    placeholder="Enter 6-digit room ID"
                    maxLength={6}
                    className="bg-gray-700 border-gray-600 text-white font-mono"
                  />
                </div>
                <Button onClick={handleJoinRoom} className="w-full" variant="outline">
                  Join Room
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button 
              onClick={() => setSelectedMode(null)} 
              variant="ghost" 
              className="text-gray-400 hover:text-white"
            >
              ← Back to Mode Selection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show configuration screen for single player
  if (showConfigScreen) {
    return (
      <GameConfigScreen 
        onStartGame={handleConfigStart}
        onBack={handleConfigBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 overflow-y-auto">
      <div className="w-full max-w-md mx-auto py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Star Throne</h1>
          <p className="text-gray-400">Choose your game mode</p>
        </div>

        {error && (
          <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {/* Single Player */}
          <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center justify-between text-lg">
                Single Player
                <Badge variant="secondary" className="text-xs">Instant Play</Badge>
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                Play against 19 AI opponents in a private game
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={handleSinglePlayer} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 text-base border-0" 
                disabled={isConnecting}
              >
                Start Single Player Game
              </Button>
            </CardContent>
          </Card>

          {/* Multiplayer */}
          <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center justify-between text-lg">
                Multiplayer
                <Badge variant="outline" className="text-xs">Up to 100 Players</Badge>
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                Join or create online games with other players
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => {
                  setSelectedMode('multiplayer');
                  handleMultiplayerConnect();
                }} 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 text-base border-0" 
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Enter Multiplayer Lobby'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-xs text-gray-500 space-y-1">
          <p>Single player mode preserves all current gameplay features</p>
          <p>Multiplayer adds real-time competitive play</p>
        </div>
      </div>
    </div>
  );
}