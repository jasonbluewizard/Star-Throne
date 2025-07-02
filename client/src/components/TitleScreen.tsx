import React, { useState, useEffect } from 'react';

interface TitleScreenProps {
  onEnterGame: () => void;
}

const TitleScreen: React.FC<TitleScreenProps> = ({ onEnterGame }) => {
  const [showClickPrompt, setShowClickPrompt] = useState(false);

  useEffect(() => {
    // Show click prompt after animations complete
    const timer = setTimeout(() => {
      setShowClickPrompt(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Animated starfield background */}
      <div className="absolute inset-0">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 2 + 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main content container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
        {/* Badge - appears first, stays centered */}
        <div className="relative z-10 mb-8 animate-bounce">
          <img
            src="/star-throne-badge.png"
            alt="Star Throne Badge"
            className="w-80 h-80 object-contain drop-shadow-2xl transition-transform duration-1000 ease-out animate-pulse"
            style={{
              filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))',
            }}
          />
        </div>

        {/* Wordmark - zooms in dramatically over badge */}
        <div className="absolute z-20 -translate-y-32 animate-pulse">
          <img
            src="/star-throne-wordmark.png"
            alt="Star Throne"
            className="w-96 h-auto object-contain drop-shadow-2xl transition-all duration-2000 ease-out"
            style={{
              filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.8))',
            }}
          />
        </div>

        {/* Click to Begin prompt */}
        {showClickPrompt && (
          <div
            className="absolute bottom-32 cursor-pointer group animate-pulse"
            onClick={onEnterGame}
          >
            <div
              className="text-white text-2xl font-bold tracking-wider text-center hover:scale-105 transition-transform duration-300"
              style={{
                textShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
              }}
            >
              CLICK TO BEGIN
            </div>
            
            <div className="text-blue-300 text-sm text-center mt-2 tracking-wide animate-pulse">
              Enter the galaxy
            </div>

            {/* Animated border */}
            <div className="absolute inset-0 border-2 border-blue-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
                 style={{ padding: '1rem', margin: '-1rem' }} />
          </div>
        )}

        {/* Subtle version indicator */}
        <div className="absolute bottom-8 right-8 text-gray-400 text-sm opacity-60">
          v1.0 • RTS Edition
        </div>
      </div>

      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500 rounded-full opacity-10 blur-3xl animate-pulse"
          style={{ animationDuration: '6s', animationDelay: '2s' }}
        />
      </div>


    </div>
  );
};

export default TitleScreen;