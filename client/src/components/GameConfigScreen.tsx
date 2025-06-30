import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './ui/dialog';

interface GameConfigScreenProps {
  onStartGame: (config: GameConfig) => void;
  onBack: () => void;
}

export interface GameConfig {
  mapSize: number;
  aiPlayerCount: number;
  playerName: string;
  gameSpeed: number;
  layout: string;
  layoutOptions?: {
    type: string;
    planetSpacing: number;
    clusterCount: number;
    starlaneDensity: number;
  };
}

export function GameConfigScreen({ onStartGame, onBack }: GameConfigScreenProps) {
  const [mapSize, setMapSize] = useState([200]); // Default 200 territories
  const [aiPlayerCount, setAiPlayerCount] = useState([19]); // Default 19 AI players
  const [playerName, setPlayerName] = useState('Player');
  const [gameSpeed, setGameSpeed] = useState([1.0]); // Default normal speed
  const [layout, setLayout] = useState('organic'); // Default organic layout

  // Advanced Settings State
  const [mapLayout, setMapLayout] = useState('organic');
  const [planetSpacing, setPlanetSpacing] = useState([100]);
  const [clusterCount, setClusterCount] = useState([4]);
  const [starlaneDensity, setStarlaneDensity] = useState([3]);

  const handleStartGame = () => {
    onStartGame({
      mapSize: mapSize[0],
      aiPlayerCount: aiPlayerCount[0],
      playerName: playerName,
      gameSpeed: gameSpeed[0],
      layout: layout,
      layoutOptions: {
        type: mapLayout,
        planetSpacing: planetSpacing[0],
        clusterCount: clusterCount[0],
        starlaneDensity: starlaneDensity[0]
      }
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

  const getSpeedDescription = (speed: number) => {
    if (speed <= 0.1) return 'Ultra Slow - Epic strategic campaigns';
    if (speed <= 0.5) return 'Slow - Deep strategic thinking';
    if (speed <= 1.0) return 'Normal - Balanced gameplay';
    if (speed <= 2.0) return 'Fast - Quick action';
    return 'Blitz - Lightning fast';
  };

  const formatSpeedValue = (speed: number) => {
    if (speed >= 1.0) return `${speed}x`;
    return `${Math.round(speed * 100)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4 overflow-y-auto">
      <div className="w-full max-w-md mx-auto py-8">
        <Card className="w-full bg-gray-800/90 backdrop-blur-sm border-gray-700">
          <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Star Throne - Single Player
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

          {/* Game Speed */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-white">Game Speed</Label>
              <span className="text-cyan-400 font-mono">{formatSpeedValue(gameSpeed[0])}</span>
            </div>
            <Slider
              value={gameSpeed}
              onValueChange={setGameSpeed}
              max={2.0}
              min={0.01}
              step={0.01}
              className="w-full"
            />
            <p className="text-sm text-gray-400">{getSpeedDescription(gameSpeed[0])}</p>
          </div>

          {/* Galaxy Layout */}
          <div className="space-y-3">
            <Label className="text-white">Galaxy Layout</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'organic', label: 'Organic', desc: 'Natural scattered distribution' },
                { value: 'clusters', label: 'Clusters', desc: 'Grouped stellar regions' },
                { value: 'spiral', label: 'Spiral', desc: 'Galactic arm formation' },
                { value: 'core', label: 'Core', desc: 'Dense center with shells' },
                { value: 'ring', label: 'Rings', desc: 'Concentric stellar rings' },
                { value: 'binary', label: 'Binary', desc: 'Two major systems' }
              ].map((layoutOption) => (
                <button
                  key={layoutOption.value}
                  onClick={() => setLayout(layoutOption.value)}
                  className={`p-3 rounded border text-left transition-colors ${
                    layout === layoutOption.value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{layoutOption.label}</div>
                  <div className="text-xs opacity-80">{layoutOption.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Settings Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                Advanced Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">Advanced Map Generation</DialogTitle>
                <DialogDescription className="text-gray-300">
                  Fine-tune the galaxy to your liking.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="map-layout" className="text-right text-white">Layout</Label>
                  <Select value={mapLayout} onValueChange={setMapLayout}>
                    <SelectTrigger className="col-span-3 bg-gray-700 border-gray-600">
                      <SelectValue placeholder="Select layout" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      <SelectItem value="Clustered">Clustered</SelectItem>
                      <SelectItem value="Spiral">Spiral</SelectItem>
                      <SelectItem value="Random">Random (Legacy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="planet-spacing" className="text-right text-white">Spacing</Label>
                  <Slider 
                    id="planet-spacing" 
                    value={planetSpacing} 
                    onValueChange={setPlanetSpacing} 
                    min={50} 
                    max={200} 
                    step={10} 
                    className="col-span-3" 
                  />
                </div>
                {mapLayout === 'Clustered' && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="cluster-count" className="text-right text-white">Clusters</Label>
                    <Slider 
                      id="cluster-count" 
                      value={clusterCount} 
                      onValueChange={setClusterCount} 
                      min={2} 
                      max={10} 
                      step={1} 
                      className="col-span-3" 
                    />
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="starlane-density" className="text-right text-white">Starlanes</Label>
                  <Slider 
                    id="starlane-density" 
                    value={starlaneDensity} 
                    onValueChange={setStarlaneDensity} 
                    min={1} 
                    max={5} 
                    step={1} 
                    className="col-span-3" 
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" className="bg-blue-600 hover:bg-blue-700">Done</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
    </div>
  );
}