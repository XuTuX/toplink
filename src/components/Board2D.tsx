'use client';

import React from 'react';
import { PlacedCell, Coord, Player } from '@/lib/rules';

interface Board2DProps {
  board: PlacedCell[];
  players: Player[];
  previewCells?: Coord[];
  isPreviewValid?: boolean;
  activeLayer?: number;
  setActiveLayer?: (z: number) => void;
  onCellClick?: (x: number, y: number, z: number) => void;
}

export default function Board2D({
  board,
  players,
  previewCells = [],
  isPreviewValid = true,
  activeLayer = 0,
  setActiveLayer,
  onCellClick,
}: Board2DProps) {
  const maxZ = Math.max(5, ...board.map((c) => c.z));
  const layers = Array.from({ length: maxZ + 1 }, (_, i) => i);

  // Helper to find placed cell at coordinate
  const getPlacedCell = (x: number, y: number, z: number) => {
    return board.find((c) => c.x === x && c.y === y && c.z === z);
  };

  // Helper to check if coordinate is in preview
  const getPreviewCell = (x: number, y: number, z: number) => {
    return previewCells.find((c) => c.x === x && c.y === y && c.z === z);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Layer Tabs */}
      {setActiveLayer && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 border-b border-zinc-800">
          <span className="text-xs font-bold text-zinc-500 uppercase mr-2 shrink-0">Layers:</span>
          {layers.map((z) => {
            const cellsInLayer = board.filter((c) => c.z === z).length;
            const isPreviewInLayer = previewCells.some((c) => c.z === z);
            
            return (
              <button
                key={z}
                onClick={() => setActiveLayer(z)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  activeLayer === z
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white text-zinc-500 hover:text-zinc-200 border border-zinc-850'
                }`}
              >
                Z={z}
                {cellsInLayer > 0 && (
                  <span className="ml-1 px-1 bg-gray-100 text-zinc-400 rounded text-[10px]">
                    {cellsInLayer}
                  </span>
                )}
                {isPreviewInLayer && (
                  <span className="ml-1 w-1.5 h-1.5 bg-amber-500 rounded-full inline-block" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 5x5 Grid for Selected Layer */}
      <div className="flex flex-col items-center">
        <div className="bg-white p-4 rounded-2xl border border-zinc-850 max-w-full overflow-auto shadow-sm">
          <div className="text-center mb-2">
            <span className="text-xs font-bold text-zinc-400">
              Layer Z={activeLayer} View
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 w-72 h-72 sm:w-80 sm:h-80 select-none">
            {Array.from({ length: 5 }).map((_, yInv) => {
              // Y points from top-to-bottom on screen, coordinate is 0..4
              const y = yInv;
              return Array.from({ length: 5 }).map((_, x) => {
                const cell = getPlacedCell(x, y, activeLayer);
                const preview = getPreviewCell(x, y, activeLayer);
                const player = cell ? players.find((p) => p.id === cell.playerId) : null;

                let cellColorStyle = {};
                let displayChar = '';
                let cellClass = 'bg-gray-50 border-zinc-850 hover:bg-indigo-50 cursor-pointer';

                if (cell && player) {
                  cellColorStyle = { backgroundColor: player.color };
                  displayChar = player.id;
                  cellClass = 'border-white/10 shadow-lg text-white font-black text-xs flex items-center justify-center';
                } else if (preview) {
                  cellClass = `flex items-center justify-center font-bold text-xs border-2 border-dashed ${
                    isPreviewValid ? 'border-emerald-500/80 bg-emerald-500/20 text-emerald-300' : 'border-rose-500/80 bg-rose-500/20 text-rose-300'
                  }`;
                  displayChar = 'P';
                }

                return (
                  <button
                    key={`${x}-${y}`}
                    onClick={() => onCellClick?.(x, y, activeLayer)}
                    style={cellColorStyle}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${cellClass}`}
                    title={`Cell (${x}, ${y}, ${activeLayer})`}
                  >
                    <span className="text-[10px] opacity-40 font-mono select-none pointer-events-none">
                      {x},{y}
                    </span>
                    {displayChar && (
                      <span className="text-sm font-black mt-0.5 select-none pointer-events-none">
                        {displayChar}
                      </span>
                    )}
                  </button>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
