import React, { useEffect, useRef } from 'react';

function App() {
  const gameRef = useRef<any>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      
      // Dynamically import and initialize the game
      const initGame = async () => {
        try {
          const { default: TerritorialConquest } = await import('./game/TerritorialConquest.js');
          gameRef.current = new TerritorialConquest();
          console.log('Territorial Conquest game initialized');
        } catch (error) {
          console.error('Failed to initialize game:', error);
        }
      };
      
      initGame();
    }

    return () => {
      if (gameRef.current) {
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="app" id="root">
      {/* Game canvas will be inserted here by TerritorialConquest */}
    </div>
  );
}

export default App;
