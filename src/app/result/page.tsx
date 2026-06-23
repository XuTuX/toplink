'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { PlayerId } from '@/lib/rules';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { Trophy, RefreshCcw, Award, Sparkles, LayoutGrid, ScrollText } from 'lucide-react';
import { useSocket } from '@/components/SocketProvider';

export default function ResultPage() {
  const router = useRouter();
  const { socket } = useSocket();
  const {
    id,
    status,
    players,
    result,
    moves,
  } = useGameStore();

  const [highlightedPlayer, setHighlightedPlayer] = useState<PlayerId | null>(null);

  useEffect(() => {
    if (status === 'ended' && result?.winnerIds && result.winnerIds.length > 0) {
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval: ReturnType<typeof setInterval> = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
      }, 250);

      return () => clearInterval(interval);
    }
  }, [status, result]);

  if (status !== 'ended' || !result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="p-8 bg-zinc-900/40 border border-zinc-900 rounded-3xl text-center space-y-5 max-w-sm backdrop-blur-xl shadow-2xl z-10 relative">
          <h3 className="font-black text-zinc-100 text-lg tracking-tight">No Finished Session Found</h3>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium">
            You must complete a game session first to calculate and view the final standings.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-sm font-extrabold transition-all mt-4"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  const handleRestart = () => {
    socket?.emit('host_reset_game', id);
    router.push('/');
  };

  const winners = players.filter((p) => result.winnerIds.includes(p.id));

  const isCellHighlighted = (x: number, y: number, playerId: PlayerId | null) => {
    if (!highlightedPlayer) return true;
    if (playerId !== highlightedPlayer) return false;

    const playerResult = result.playerResults.find((r) => r.playerId === highlightedPlayer);
    if (!playerResult) return false;

    return playerResult.largestConnectionCells.some((c) => c.x === x && c.y === y);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-sans pb-16 relative overflow-hidden selection:bg-zinc-850 selection:text-white">
      {/* Glow backgrounds */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[350px] w-[600px] rounded-full bg-purple-600/10 blur-[130px] pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-5.5 w-5.5 text-amber-500" />
            <h1 className="font-black text-lg text-zinc-50 tracking-tight">Game Results</h1>
          </div>

          <button
            onClick={handleRestart}
            className="py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-purple-500/25 cursor-pointer"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Restart New Game
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 w-full relative z-10">
        
        {/* Left Column: Winners presentation and Rankings */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Victory Card */}
          <div className="p-8 bg-zinc-900/40 border border-zinc-900 rounded-[32px] text-center relative overflow-hidden backdrop-blur-xl shadow-2xl">
            <div className="absolute top-0 right-0 p-4 text-amber-500/5">
              <Sparkles className="h-36 w-36 rotate-12" />
            </div>

            <div className="inline-flex p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl mb-5 shadow-inner animate-pulse">
              <Award className="h-9 w-9" />
            </div>

            <h2 className="text-3xl font-black tracking-tight text-zinc-50">
              {winners.length > 1 ? "Draw / Tie Match!" : 'Match Victory!'}
            </h2>
            
            <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed font-semibold">
              {winners.length > 1
                ? `Players ${winners.map((w) => w.name).join(' & ')} tied for 1st place after tiebreakers!`
                : `${winners[0]?.name} dominated the board grid!`
              }
            </p>

            <div className="flex justify-center gap-3 mt-6">
              {winners.map((w) => (
                <div
                  key={w.id}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold border shadow-sm"
                  style={{
                    backgroundColor: `${w.color}15`,
                    borderColor: `${w.color}40`,
                    color: w.color,
                  }}
                >
                  {w.name}
                </div>
              ))}
            </div>
          </div>

          {/* Standings List */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-[32px] backdrop-blur-xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-[10px] text-zinc-500 uppercase tracking-widest">
                Final Leaderboard
              </h3>
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">
                Hover row to highlight largest area
              </span>
            </div>

            <div className="space-y-3">
              {result.playerResults
                .sort((a, b) => a.rank - b.rank)
                .map((res) => {
                  const p = players.find((pl) => pl.id === res.playerId);
                  if (!p) return null;
                  const isHighlighted = highlightedPlayer === res.playerId;

                  return (
                    <div
                      key={res.playerId}
                      onMouseEnter={() => setHighlightedPlayer(res.playerId)}
                      onMouseLeave={() => setHighlightedPlayer(null)}
                      className={`p-4 bg-zinc-950/40 border rounded-2xl transition-all duration-300 flex items-center justify-between gap-4 shadow-sm ${
                        isHighlighted
                          ? 'border-purple-500 bg-purple-500/5 shadow-md'
                          : 'border-zinc-900 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shadow-sm ${
                          res.rank === 1 ? 'bg-amber-500 text-zinc-950' :
                          res.rank === 2 ? 'bg-zinc-300 text-zinc-950' :
                          res.rank === 3 ? 'bg-amber-700 text-zinc-100' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>
                          #{res.rank}
                        </div>

                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ backgroundColor: p.color }} />
                            <span className="font-extrabold text-zinc-200 text-xs sm:text-sm">{p.name}</span>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-bold block mt-0.5 uppercase tracking-wider">
                            Max Zone: {res.largestConnectionSize} cells • Score: {res.score}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div className="text-[9.5px] text-zinc-500 space-y-0.5 font-medium hidden sm:block">
                          <div>Grid Coverage: <strong>{res.topViewCellCount}</strong></div>
                          <div>Elevation Score: <strong>{res.heightScore}</strong></div>
                        </div>
                        <div className="text-lg font-black text-zinc-200">
                          {res.score} <span className="text-[10px] text-zinc-500 font-bold">pts</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Column: Top View Matrix and Full Game Replay Log */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Top-View Matrix */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-[32px] backdrop-blur-xl shadow-2xl flex flex-col items-center">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2 w-full">
              <LayoutGrid className="h-4.5 w-4.5 text-purple-400" />
              Final Territory Top-View Grid
            </h3>

            <div className="grid grid-cols-5 gap-2.5 w-64 h-64 bg-zinc-950 p-4 rounded-[24px] border border-zinc-900 shadow-inner">
              {result.topView.map((col, x) =>
                col.map((cell, y) => {
                  const pColor = cell.playerId ? players.find((p) => p.id === cell.playerId)?.color : null;
                  const highlighted = isCellHighlighted(x, y, cell.playerId);

                  return (
                    <div
                      key={`${x}-${y}`}
                      className="rounded-xl aspect-square border border-white/5 flex items-center justify-center font-black text-xs text-white transition-all duration-300 shadow-sm"
                      style={{
                        backgroundColor: pColor || '#141416',
                        opacity: highlighted ? 1 : 0.25,
                        boxShadow: cell.playerId && highlighted ? `0 0 12px ${pColor}40, inset 0 0 6px rgba(255,255,255,0.25)` : 'none',
                        borderWidth: cell.playerId && highlighted && highlightedPlayer ? '2px' : '1px',
                        borderColor: cell.playerId && highlighted && highlightedPlayer ? '#ffffff80' : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {cell.playerId ? cell.playerId : ''}
                    </div>
                  );
                })
              )}
            </div>

            {highlightedPlayer ? (
              <p className="text-[10px] text-zinc-400 mt-4 text-center font-semibold">
                Highlighting connection of{' '}
                <span className="font-bold" style={{ color: players.find((p) => p.id === highlightedPlayer)?.color }}>
                  {players.find((p) => p.id === highlightedPlayer)?.name}
                </span>
              </p>
            ) : (
              <p className="text-[10px] text-zinc-500 mt-4 text-center font-medium">
                Hover over player&apos;s name above to see their territory.
              </p>
            )}
          </div>

          {/* Full Game Replay Log */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-[32px] backdrop-blur-xl shadow-2xl flex flex-col max-h-[250px]">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-4 flex items-center gap-2">
              <ScrollText className="w-4.5 h-4.5 text-zinc-500" />
              Game Replay History ({moves.length} moves)
            </span>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1 custom-scrollbar">
              {moves.map((move, idx) => {
                const p = players.find((pl) => pl.id === move.playerId);
                return (
                  <div
                    key={move.id}
                    className="p-3 bg-zinc-950/40 border border-zinc-905 rounded-xl text-[10.5px] flex justify-between items-center"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 font-bold font-mono">#{idx + 1}</span>
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm border border-white/10" style={{ backgroundColor: p?.color }} />
                      <span className="font-extrabold text-zinc-300">{p?.name || move.playerId}</span>
                      <span className="text-zinc-500 font-medium">
                        at ({move.origin.x},{move.origin.y},{move.origin.z})
                      </span>
                    </div>

                    <div>
                      {move.valid ? (
                        <span className="text-emerald-400 font-bold">Valid</span>
                      ) : (
                        <span className="text-rose-400 font-bold cursor-help" title={move.invalidReason}>
                          Skip
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
