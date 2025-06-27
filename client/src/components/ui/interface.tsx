import { useGame } from "@/lib/stores/useGame";
import { useAudio } from "@/lib/stores/useAudio";
import { Button } from "./button";
import { VolumeX, Volume2 } from "lucide-react";

export function Interface() {
  const phase = useGame((state) => state.phase);
  const { isMuted, toggleMute } = useAudio();

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Mobile-optimized control panel */}
      <div className="absolute top-2 right-2 flex gap-2 pointer-events-auto">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMute}
          className="bg-black/70 border-gray-600 hover:bg-gray-800 touch-manipulation min-h-[44px] min-w-[44px]"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile instructions overlay */}
      <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-3 rounded pointer-events-none max-w-[220px] md:hidden">
        <div className="text-cyan-300 font-bold mb-1">YOU ARE CYAN</div>
        <div>1. Tap your territory (cyan glow)</div>
        <div>2. Tap neighbor to attack</div>
        <div>Drag: Pan • Pinch: Zoom</div>
        <div className="text-gray-400 text-[10px] mt-1">Press 'D' for debug</div>
      </div>

      {/* Desktop instructions */}
      <div className="hidden md:block absolute bottom-4 left-4 bg-black/80 text-white text-sm p-4 rounded pointer-events-none max-w-[280px]">
        <div className="font-semibold mb-2 text-cyan-300">YOU ARE THE CYAN PLAYER</div>
        <div className="mb-2">How to Attack:</div>
        <div>1. Click your territory (cyan glow)</div>
        <div>2. Click neighboring enemy territory</div>
        <div className="mt-2 text-gray-300">
          <div>Mouse drag: Pan camera</div>
          <div>Mouse wheel: Zoom</div>
          <div>R: Restart (when game ends)</div>
        </div>
        <div className="text-gray-400 text-xs mt-2">Press 'D' to toggle debug info</div>
      </div>
    </div>
  );
}
