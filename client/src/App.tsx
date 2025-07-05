import React, { useEffect, useRef, useState } from 'react';
import { GameModeSelector } from './components/GameModeSelector';
import TitleScreen from './components/TitleScreen';

type GameMode = 'single' | 'multiplayer' | null;

interface GameData {
  playerName: string;
  aiCount?: number;
  mapSize?: number;
  gameSpeed?: number;
  layout?: string;
  room?: any;
}

function App() {
  const gameRef = useRef<any>(null);
  const mountedRef = useRef(false);
  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);

  const initSinglePlayerGame = async (data: GameData) => {
    try {
      const { default: StarThrone } = await import('./game/StarThrone.js');
      
      // Add mode flag to prevent WebSocket connection attempts
      const gameConfig = {
        ...data,
        mode: 'single-player',
        disableWebSocket: true
      };
      
      gameRef.current = new StarThrone(gameConfig);
      // Make game globally accessible for mobile zoom buttons
      (window as any).game = gameRef.current;
      // Initialize the game
      gameRef.current.init();
      console.log('Single-player Star Throne game initialized with config:', gameConfig);
    } catch (error) {
      console.error('Failed to initialize single-player game:', error);
      console.error('Error details:', error.message, error.stack);
    }
  };

  const initMultiplayerGame = async (data: GameData) => {
    try {
      // For now, we'll use the same game engine but prepare for multiplayer integration
      const { default: StarThrone } = await import('./game/StarThrone.js');
      gameRef.current = new StarThrone(data);
      // Make game globally accessible for mobile zoom buttons
      (window as any).game = gameRef.current;
      // Initialize the game
      gameRef.current.init();
      console.log('Multiplayer-ready Star Throne game initialized');
      console.log('Room data:', data.room);
    } catch (error) {
      console.error('Failed to initialize multiplayer game:', error);
    }
  };

  const handleModeSelected = (mode: GameMode, data?: GameData) => {
    setGameMode(mode);
    setGameData(data || null);
    
    // Add game-active class to body when game starts
    document.body.classList.add('game-active');
    
    if (mode === 'single' && data) {
      initSinglePlayerGame(data);
    } else if (mode === 'multiplayer' && data) {
      initMultiplayerGame(data);
    }
  };

  // Auto-start single player if no mode selector is needed (for development)
  useEffect(() => {
    // Check if we should auto-start in single player mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auto') === 'single' && !mountedRef.current) {
      mountedRef.current = true;
      handleModeSelected('single', { playerName: 'Player', aiCount: 19, layout: 'organic' });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current = null;
      }
      // Remove game-active class when component unmounts
      document.body.classList.remove('game-active');
    };
  }, []);

  // Remove game-active class when showing mode selector
  useEffect(() => {
    if (!gameMode) {
      document.body.classList.remove('game-active');
    }
  }, [gameMode]);

  // Show title screen first
  if (showTitleScreen) {
    return <TitleScreen onEnterGame={() => setShowTitleScreen(false)} />;
  }

  // Show game mode selector if no mode is selected
  if (!gameMode) {
    return <GameModeSelector onModeSelected={handleModeSelected} />;
  }

  return (
    <div className="app" id="root">
      {/* Game canvas will be inserted here by TerritorialConquest */}
      {gameMode === 'multiplayer' && gameData?.room && (
        <div className="fixed top-4 left-4 bg-black/80 text-white p-2 rounded text-sm z-50">
          Room: {gameData.room.id} | Players: {gameData.room.playerCount}/{gameData.room.maxPlayers}
        </div>
      )}
    </div>
  );
}

export default App;
