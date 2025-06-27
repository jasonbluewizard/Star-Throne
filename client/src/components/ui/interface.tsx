import { Button } from "./button";
import { ZoomIn, ZoomOut } from "lucide-react";

export function Interface() {

  return (
    <div className="absolute inset-0 pointer-events-none z-10">


      {/* Mobile zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto md:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
            if (canvas && (window as any).game) {
              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              (window as any).game.camera.zoom(1.2, centerX, centerY);
            }
          }}
          className="bg-black/70 border-gray-600 hover:bg-gray-800 touch-manipulation min-h-[48px] min-w-[48px]"
        >
          <ZoomIn className="h-6 w-6" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
            if (canvas && (window as any).game) {
              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              (window as any).game.camera.zoom(0.8, centerX, centerY);
            }
          }}
          className="bg-black/70 border-gray-600 hover:bg-gray-800 touch-manipulation min-h-[48px] min-w-[48px]"
        >
          <ZoomOut className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile instructions overlay */}
      <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-3 rounded pointer-events-none max-w-[220px] md:hidden">
        <div className="text-cyan-300 font-bold mb-1">YOU ARE CYAN</div>
        <div>Attack: Tap cyan → enemy neighbor</div>
        <div>Transfer: Tap cyan → cyan neighbor</div>
        <div>Tap leaderboard to min/max</div>
        <div>Drag: Pan • Use zoom buttons →</div>
      </div>

      {/* Desktop instructions */}
      <div className="hidden md:block absolute bottom-4 left-4 bg-black/80 text-white text-sm p-4 rounded pointer-events-none max-w-[300px]">
        <div className="font-semibold mb-2 text-cyan-300">YOU ARE THE CYAN PLAYER</div>
        <div className="mb-2">Actions:</div>
        <div>Attack: Click cyan territory → enemy neighbor</div>
        <div>Transfer fleet: Click cyan → cyan neighbor</div>
        <div>Toggle leaderboard: Click leaderboard area</div>
        <div className="mt-2 text-gray-300">
          <div>Mouse drag: Pan camera</div>
          <div>Mouse wheel: Zoom</div>
          <div>R: Restart (when game ends)</div>
        </div>
      </div>
    </div>
  );
}
