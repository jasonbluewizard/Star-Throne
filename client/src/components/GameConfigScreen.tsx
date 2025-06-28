import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Slider } from './ui/slider';

interface GameConfigScreenProps {
  onStartGame: (config: GameConfig) => void;
  onBack: () => void;
}

export interface GameConfig {
  mapSize: number;
  aiPlayerCount: number;
  playerName: string;
}

export function GameConfigScreen({ onStartGame, onBack }: GameConfigScreenProps) {
  const [mapSize, setMapSize] = useState([200]); // Default 200 territories
  const [aiPlayerCount, setAiPlayerCount] = useState([19]); // Default 19 AI players
  const [playerName, setPlayerName] = useState('Player');

  const handleStartGame = () => {
    onStartGame({
      mapSize: mapSize[0],
      aiPlayerCount: aiPlayerCount[0],
      playerName: playerName
    });
  };

  const getMapDescription = (size: number) => {
    if (size <= 100) return 'Small - Quick battles';
    if (size <= 200) return 'Medium - Balanced gameplay';
    if (size <= 300) return 'Large - Epic conquests';
    return 'Massive - Ultimate challenge';
  };

  const getAIDescription = (count: number) => {
    if (count <= 10) return 'Few - Casual experience';
    if (count <= 25) return 'Normal - Standard challenge';
    if (count <= 50) return 'Many - Intense competition';
    return 'Maximum - Chaos mode';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800/90 backdrop-blur-sm border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Configure Single Player
          </CardTitle>
          <CardDescription className="text-gray-300">
            Customize your galactic conquest experience
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Player Name */}
          <div className="space-y-2">
            <Label htmlFor="playerName" className="text-white">Player Name</Label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          {/* Map Size */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-white">Map Size</Label>
              <span className="text-cyan-400 font-mono">{mapSize[0]} territories</span>
            </div>
            <Slider
              value={mapSize}
              onValueChange={setMapSize}
              max={400}
              min={50}
              step={25}
              className="w-full"
            />
            <p className="text-sm text-gray-400">{getMapDescription(mapSize[0])}</p>
          </div>

          {/* AI Player Count */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-white">AI Players</Label>
              <span className="text-cyan-400 font-mono">{aiPlayerCount[0]} opponents</span>
            </div>
            <Slider
              value={aiPlayerCount}
              onValueChange={setAiPlayerCount}
              max={99}
              min={5}
              step={1}
              className="w-full"
            />
            <p className="text-sm text-gray-400">{getAIDescription(aiPlayerCount[0])}</p>
          </div>

          {/* Game Info */}
          <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
            <h4 className="text-white font-semibold">Game Preview</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <p>• {mapSize[0]} star systems to conquer</p>
              <p>• {aiPlayerCount[0]} AI opponents with unique strategies</p>
              <p>• Probe-based colonization system</p>
              <p>• Supply route management</p>
              <p>• Real-time strategic combat</p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Back
          </Button>
          <Button
            onClick={handleStartGame}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!playerName.trim()}
          >
            Start Game
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}