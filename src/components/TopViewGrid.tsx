'use client';

import { BOARD_CELL_COUNT, BOARD_SIZE, Player, TopViewCell } from '@/lib/rules';

interface TopViewGridProps {
  topView: TopViewCell[][];
  players: Player[];
  showRatios?: boolean;
  className?: string;
}

export default function TopViewGrid({
  topView,
  players,
  showRatios = true,
  className = '',
}: TopViewGridProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-6 gap-2 w-full max-w-xs aspect-square mx-auto bg-zinc-950 p-3 rounded-2xl border border-zinc-900 shadow-inner">
        {Array.from({ length: BOARD_SIZE }, (_, y) =>
          Array.from({ length: BOARD_SIZE }, (_, x) => {
            const cell = topView[x]?.[y];
            const player = cell?.playerId ? players.find((p) => p.id === cell.playerId) : null;

            return (
              <div
                key={`${x}-${y}`}
                className="rounded-lg aspect-square border border-white/5 flex items-center justify-center font-black text-[10px] text-white shadow-sm"
                style={{
                  backgroundColor: player?.color || '#f3f4f6',
                  boxShadow: cell?.playerId ? 'inset 0 0 0 1px rgba(17,24,39,0.08)' : 'none',
                }}
              >
                {cell?.playerId ?? ''}
              </div>
            );
          })
        )}
      </div>

      {showRatios && (
        <div className="space-y-2 border-t border-zinc-800 pt-3">
          {players.map((player) => {
            const cellCount = topView.flat().filter((cell) => cell.playerId === player.id).length;
            const percent = Math.round((cellCount / BOARD_CELL_COUNT) * 100);

            return (
              <div key={player.id} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full border border-white/10 shrink-0"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="font-extrabold text-zinc-300 truncate">{player.name}</span>
                </div>
                <span className="font-mono text-zinc-400 font-bold shrink-0">{cellCount} 칸 ({percent}%)</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
