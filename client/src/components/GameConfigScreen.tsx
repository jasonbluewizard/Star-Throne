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
  warpLaneDensity: number;
  connectionRange: number;
  nebulaCount: number;
  probeSpeed: number;
  nebulaSlowdown: boolean;
  supplyRoutes: boolean;
  probeColonization: boolean;
}

export function GameConfigScreen({ onStartGame, onBack }: GameConfigScreenProps) {
  const [mapSize, setMapSize] = useState([80]); // Default 80 territories for less crowding
  const [aiPlayerCount, setAiPlayerCount] = useState([19]); // Default 19 AI players
  const [playerName, setPlayerName] = useState('Player');
  const [gameSpeed, setGameSpeed] = useState([1.0]); // Default normal speed
  const [layout, setLayout] = useState('organic'); // Default organic layout
  
  // Advanced map controls
  const [warpLaneDensity, setWarpLaneDensity] = useState(80); // Default 80% density
  const [connectionRange, setConnectionRange] = useState(140); // Default 140px range
  const [nebulaCount, setNebulaCount] = useState(10); // Default 10 nebulas
  const [probeSpeed, setProbeSpeed] = useState(100); // Default 100% speed
  
  // Special features
  const [nebulaSlowdown, setNebulaSlowdown] = useState(true);
  const [supplyRoutes, setSupplyRoutes] = useState(true);
  const [probeColonization, setProbeColonization] = useState(true);



  const handleStartGame = () => {
    onStartGame({
      mapSize: mapSize[0],
      aiPlayerCount: aiPlayerCount[0],
      playerName: playerName,
      gameSpeed: gameSpeed[0],
      layout: layout,
      warpLaneDensity: warpLaneDensity,
      connectionRange: connectionRange,
      nebulaCount: nebulaCount,
      probeSpeed: probeSpeed,
      nebulaSlowdown: nebulaSlowdown,
      supplyRoutes: supplyRoutes,
      probeColonization: probeColonization
    });
  };

  const getMapDescription = (size: number) => {
    if (size <= 50) return 'Small - Quick skirmishes';
    if (size <= 80) return 'Medium - Balanced exploration';
    if (size <= 120) return 'Large - Epic campaigns';
    if (size <= 200) return 'Massive - Ultimate challenge';
    return 'Galactic - Vast empires';
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
              max={300}
              min={30}
              step={10}
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



          {/* Advanced Settings */}
          <div className="space-y-4 pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-white">Advanced Settings</h3>
            
            {/* AI Difficulty */}
            <div className="space-y-2">
              <Label className="text-white">AI Intelligence Level</Label>
              <Select defaultValue="normal">
                <SelectTrigger className="bg-gray-700 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="easy">Easy - Passive expansion</SelectItem>
                  <SelectItem value="normal">Normal - Balanced strategy</SelectItem>
                  <SelectItem value="hard">Hard - Aggressive conquest</SelectItem>
                  <SelectItem value="expert">Expert - Advanced tactics</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Victory Conditions */}
            <div className="space-y-2">
              <Label className="text-white">Victory Condition</Label>
              <Select defaultValue="throne">
                <SelectTrigger className="bg-gray-700 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="throne">Throne Star Conquest</SelectItem>
                  <SelectItem value="territory">Territory Control (75%)</SelectItem>
                  <SelectItem value="elimination">Total Elimination</SelectItem>
                  <SelectItem value="economic">Economic Domination</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warp Lane Density */}
            <div className="space-y-2">
              <Label htmlFor="warpLaneDensity" className="text-white">
                Warp Lane Density: {warpLaneDensity}% 
                <span className="text-gray-400 ml-2">
                  ({warpLaneDensity < 60 ? 'Sparse' : warpLaneDensity < 80 ? 'Normal' : warpLaneDensity < 100 ? 'Dense' : 'Maximum'})
                </span>
              </Label>
              <Slider
                id="warpLaneDensity"
                min={30}
                max={120}
                step={10}
                value={[warpLaneDensity]}
                onValueChange={(value) => setWarpLaneDensity(value[0])}
                className="w-full"
              />
            </div>

            {/* Connection Range */}
            <div className="space-y-2">
              <Label htmlFor="connectionRange" className="text-white">
                Connection Range: {connectionRange}px
                <span className="text-gray-400 ml-2">
                  ({connectionRange < 120 ? 'Short' : connectionRange < 160 ? 'Normal' : 'Long'} range links)
                </span>
              </Label>
              <Slider
                id="connectionRange"
                min={80}
                max={200}
                step={20}
                value={[connectionRange]}
                onValueChange={(value) => setConnectionRange(value[0])}
                className="w-full"
              />
            </div>

            {/* Nebula Count */}
            <div className="space-y-2">
              <Label htmlFor="nebulaCount" className="text-white">
                Nebula Fields: {nebulaCount}
                <span className="text-gray-400 ml-2">
                  ({nebulaCount === 0 ? 'None' : nebulaCount < 8 ? 'Few' : nebulaCount < 15 ? 'Normal' : 'Many'})
                </span>
              </Label>
              <Slider
                id="nebulaCount"
                min={0}
                max={20}
                step={1}
                value={[nebulaCount]}
                onValueChange={(value) => setNebulaCount(value[0])}
                className="w-full"
              />
            </div>

            {/* Probe Speed */}
            <div className="space-y-2">
              <Label htmlFor="probeSpeed" className="text-white">
                Probe Speed: {probeSpeed}%
                <span className="text-gray-400 ml-2">
                  ({probeSpeed < 80 ? 'Slow' : probeSpeed < 120 ? 'Normal' : 'Fast'} exploration)
                </span>
              </Label>
              <Slider
                id="probeSpeed"
                min={50}
                max={200}
                step={25}
                value={[probeSpeed]}
                onValueChange={(value) => setProbeSpeed(value[0])}
                className="w-full"
              />
            </div>

            {/* Special Features */}
            <div className="space-y-2">
              <Label className="text-white">Special Features</Label>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={nebulaSlowdown}
                    onChange={(e) => setNebulaSlowdown(e.target.checked)}
                    className="rounded" 
                  />
                  <span className="text-sm text-gray-300">Nebula Slowdown</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={supplyRoutes}
                    onChange={(e) => setSupplyRoutes(e.target.checked)}
                    className="rounded" 
                  />
                  <span className="text-sm text-gray-300">Supply Routes</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={probeColonization}
                    onChange={(e) => setProbeColonization(e.target.checked)}
                    className="rounded" 
                  />
                  <span className="text-sm text-gray-300">Probe Colonization</span>
                </label>
              </div>
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
    </div>
  );
}