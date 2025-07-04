import React, { useState, useEffect, useRef } from 'react';

interface TitleScreenProps {
  onEnterGame: () => void;
}

interface TunnelStar {
  x: number;
  y: number;
  z: number;
  size: number;
  brightness: number;
  speed: number;
}

const TitleScreen: React.FC<TitleScreenProps> = ({ onEnterGame }) => {
  const [showClickPrompt, setShowClickPrompt] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<TunnelStar[]>([]);
  const animationRef = useRef<number>();

  // Initialize tunnel stars
  useEffect(() => {
    const stars: TunnelStar[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 1000,
        size: Math.random() * 3 + 1,
        brightness: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 2 + 1
      });
    }
    starsRef.current = stars;
  }, []);

  // Animate tunnel effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      starsRef.current.forEach((star) => {
        // Move star forward
        star.z -= star.speed;

        // Reset star if it goes behind viewer
        if (star.z <= 0) {
          star.x = (Math.random() - 0.5) * 2000;
          star.y = (Math.random() - 0.5) * 2000;
          star.z = 1000;
        }

        // Project 3D position to 2D screen
        const scale = 200 / star.z;
        const x2d = centerX + star.x * scale;
        const y2d = centerY + star.y * scale;

        // Calculate star size based on distance (closer = bigger)
        const size = star.size * scale * 2;
        const opacity = star.brightness * Math.min(1, scale * 2);

        // Only draw if star is on screen
        if (x2d >= -size && x2d <= canvas.width + size && 
            y2d >= -size && y2d <= canvas.height + size) {
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(x2d, y2d, Math.max(0.5, size), 0, Math.PI * 2);
          ctx.fill();

          // Add trail effect for fast-moving stars
          if (scale > 0.5) {
            const prevScale = 200 / (star.z + star.speed);
            const prevX = centerX + star.x * prevScale;
            const prevY = centerY + star.y * prevScale;
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
            ctx.lineWidth = Math.max(0.5, size * 0.5);
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(x2d, y2d);
            ctx.stroke();
          }
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Show click prompt after animations complete
    const timer = setTimeout(() => {
      setShowClickPrompt(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* 3D Tunnel starfield canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 1 }}
      />

      {/* Main content container */}
      <div 
        className="relative flex flex-col items-center justify-center min-h-screen"
        style={{ perspective: '1000px', zIndex: 10 }}
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