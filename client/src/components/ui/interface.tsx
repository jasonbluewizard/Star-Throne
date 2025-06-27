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


    </div>
  );
}
