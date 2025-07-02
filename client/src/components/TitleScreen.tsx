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
      {/* Star tunnel background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(120)].map((_, i) => {
          const speed = Math.random() * 3 + 2; // 2-5 second duration
          const size = Math.random() * 1.5 + 0.5; // 0.5-2px
          const delay = Math.random() * 5; // 0-5s delay
          
          // Create radial positions around center
          const angle = (Math.random() * Math.PI * 2);
          const startRadius = Math.random() * 20 + 5; // 5-25% from center
          const startX = 50 + Math.cos(angle) * startRadius;
          const startY = 50 + Math.sin(angle) * startRadius;
          
          // Calculate end position (far off screen in same direction)
          const endRadius = 200; // Much farther out
          const endX = 50 + Math.cos(angle) * endRadius;
          const endY = 50 + Math.sin(angle) * endRadius;
          
          return (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${startX}%`,
                top: `${startY}%`,
                width: `${size}px`,
                height: `${size}px`,
                animation: `starTunnelSimple-${i} ${speed}s linear ${delay}s infinite, starTwinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
                opacity: Math.random() * 0.7 + 0.3,
                transform: 'translate(-50%, -50%)',
              }}
            />
          );
        })}
        
        <style>{`
          ${[...Array(120)].map((_, i) => {
            const angle = (Math.random() * Math.PI * 2);
            const startRadius = Math.random() * 20 + 5;
            const startX = 50 + Math.cos(angle) * startRadius;
            const startY = 50 + Math.sin(angle) * startRadius;
            const endRadius = 200;
            const endX = 50 + Math.cos(angle) * endRadius;
            const endY = 50 + Math.sin(angle) * endRadius;
            
            return `
              @keyframes starTunnelSimple-${i} {
                0% {
                  left: ${startX}%;
                  top: ${startY}%;
                  transform: translate(-50%, -50%) scale(0.1);
                  opacity: 0;
                }
                5% {
                  opacity: 1;
                }
                95% {
                  opacity: 1;
                }
                100% {
                  left: ${endX}%;
                  top: ${endY}%;
                  transform: translate(-50%, -50%) scale(3);
                  opacity: 0;
                }
              }
            `;
          }).join('')}
        `}</style>
      </div>

      {/* Main content container */}
      <div 
        className="relative z-10 flex flex-col items-center justify-center min-h-screen"
        style={{ perspective: '1000px' }}
      >
        {/* Badge - zooms up from the void */}
        <div 
          className="relative z-10 mb-8 transition-all duration-2000 ease-out"
          style={{
            animation: 'zoomFromVoid 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards, gentleFloatAndPulse 6s ease-in-out 3s infinite',
          }}
        >
          <img
            src="/star-throne-badge.png"
            alt="Star Throne Badge"
            className="w-80 h-80 object-contain drop-shadow-2xl"
            style={{
              filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))',
            }}
          />
        </div>

        {/* Wordmark - falls down from above */}
        <div 
          className="absolute z-20"
          style={{
            animation: 'fallFromAbove 2.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.8s forwards, gentleDrift 6s ease-in-out 4s infinite',
            transformStyle: 'preserve-3d',
            opacity: 0,
            transform: 'translateY(-200px) translateZ(100px) scale(8)',
          }}
        >
          <img
            src="/star-throne-wordmark.png"
            alt="Star Throne"
            className="w-96 h-auto object-contain drop-shadow-2xl"
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