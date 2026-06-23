'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { getCurrentPlayer, getCurrentTurnOrder, computeTopView, getMaxHeight } from '@/lib/rules';
import { useRouter } from 'next/navigation';
import BoardIsometric from '@/components/BoardIsometric';
import { Shield, RotateCcw, AlertOctagon, ListTodo, Eye, Sparkles, HelpCircle, Activity } from 'lucide-react';

export default function DealerPage() {
  const router = useRouter();
  const {
    status,
    players,
    board,
    moves,
    round,
    turnIndexInRound,
    endPending,
    endTriggeredByMoveId,
    endTriggeredAtRound,
    forceSkipTurn,
    forceEndStage,
    resetGame,
  } = useGameStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const topView = mounted ? computeTopView(board) : [];
  const activePlayerId = mounted ? getCurrentPlayer(useGameStore.getState()) : null;
  const activePlayer = players.find((p) => p.id === activePlayerId);
  const turnOrder = mounted ? getCurrentTurnOrder(useGameStore.getState()) : [];
  const maxZ = mounted ? getMaxHeight(board) : 0;

  useEffect(() => {
    if (mounted && status === 'ended') {
      router.push('/result');
    }
  }, [status, mounted, router]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-indigo-500 border-zinc-800"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-sans pb-12 relative overflow-hidden selection:bg-zinc-800 selection:text-white">
      {/* Background glowing decorations */}
      <div className="absolute top-[-10%] right-[10%] h-[400px] w-[600px] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[5%] h-[350px] w-[500px] rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-black text-lg text-zinc-50 tracking-tight">Dealer Console</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Referee Operations Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/')}
              className="py-2 px-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Session Setup
            </button>
            <button
              onClick={resetGame}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/20 text-zinc-500 hover:text-red-400 rounded-xl transition-all cursor-pointer"
              title="Reset Session State"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-6 mt-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full relative z-10">
        
        {/* Left Column: Stats, Action Controls & Logging */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Session Overview metrics */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl backdrop-blur-xl shadow-xl">
            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              Session Status
            </h2>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 shadow-inner">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">State</span>
                <span className={`text-xs font-black capitalize ${
                  status === 'playing' ? 'text-blue-400' :
                  status === 'end_pending' ? 'text-amber-500 animate-pulse' :
                  status === 'ended' ? 'text-purple-400' : 'text-zinc-400'
                }`}>
                  {status.replace('_', ' ')}
                </span>
              </div>
              <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 shadow-inner">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Round</span>
                <span className="text-xs font-black text-zinc-100 font-mono">#{round}</span>
              </div>
              <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 shadow-inner">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Peak Height</span>
                <span className="text-xs font-black text-zinc-100 font-mono">{maxZ} / 5</span>
              </div>
              <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 shadow-inner">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Total Moves</span>
                <span className="text-xs font-black text-zinc-100 font-mono">{moves.length}</span>
              </div>
            </div>

            {endPending && (
              <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
                <AlertOctagon className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-extrabold text-amber-500 block">End Match Condition Triggered</span>
                  <span className="text-[10px] text-zinc-500 block mt-1 leading-relaxed font-medium">
                    Triggered at Round {endTriggeredAtRound} by player{' '}
                    <strong className="text-zinc-300">{moves.find((m) => m.id === endTriggeredByMoveId)?.playerId}</strong>.
                    The game will conclude when this round finishes.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Current Turn & Referee Overrides */}
          {status !== 'ended' && (
            <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl backdrop-blur-xl shadow-xl space-y-4">
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Active Player Details
              </h2>

              <div className="flex items-center gap-3 p-3.5 bg-zinc-950/40 border border-zinc-900 rounded-2xl">
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md shadow-black/50"
                  style={{ backgroundColor: activePlayer?.color }}
                />
                <div>
                  <span className="text-xs font-black text-zinc-100">{activePlayer?.name}</span>
                  <span className="text-[9px] text-zinc-500 block mt-0.5 font-bold uppercase tracking-wider">
                    Seat {activePlayerId} • Sequence: {turnIndexInRound + 1}/4
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={forceSkipTurn}
                  className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-white text-zinc-400 rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-sm"
                >
                  Force Skip Current Turn (Skipped)
                </button>
                <button
                  onClick={forceEndStage}
                  className="w-full py-3 bg-rose-500/10 border border-rose-500/15 hover:bg-rose-500/20 hover:border-rose-500/25 rounded-2xl text-xs font-extrabold transition-all text-rose-400 cursor-pointer"
                >
                  Force Terminate Stage & Score
                </button>
              </div>
            </div>
          )}

          {/* Replay History Log */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col max-h-[300px]">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <ListTodo className="h-4.5 w-4.5 text-zinc-500" />
              <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Replay Log</h2>
            </div>
            
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
              {moves.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-xs font-bold uppercase tracking-wider">
                  No moves logged.
                </div>
              ) : (
                [...moves].reverse().map((move) => {
                  const p = players.find((pl) => pl.id === move.playerId);
                  return (
                    <div
                      key={move.id}
                      className="p-3.5 bg-zinc-950/40 border border-zinc-900 rounded-2xl text-xs flex justify-between items-start gap-2 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full border border-white/10"
                            style={{ backgroundColor: p?.color }}
                          />
                          <span className="font-extrabold text-zinc-200 text-xs">{p?.name || move.playerId}</span>
                        </div>
                        <span className="text-[9.5px] text-zinc-500 block font-mono">
                          Rd {move.round} • Slot {move.turnIndex + 1} • ({move.origin.x},{move.origin.y},{move.origin.z})
                        </span>
                      </div>

                      <div>
                        {move.valid ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-black text-[9px] uppercase tracking-wider">
                            Valid
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md font-black text-[9px] uppercase tracking-wider cursor-help"
                            title={move.invalidReason}
                          >
                            Skip
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: 3D Grid Board & Live Top-View Coverage Matrix */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 3D Isometric View */}
          <div className="bg-zinc-900/20 p-8 rounded-[36px] border border-zinc-900 backdrop-blur-xl flex flex-col items-center shadow-2xl relative overflow-hidden">
            <div 
              className="absolute inset-0 bg-radial from-transparent via-transparent to-transparent opacity-30 pointer-events-none"
              style={{
                background: `radial-gradient(circle at center, rgba(59, 130, 246, 0.05) 0%, transparent 70%)`
              }}
            />
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 relative z-10">
              3D Session Board
            </h3>
            <div className="relative z-10 w-full max-w-lg">
              <BoardIsometric
                board={board}
                players={players}
              />
            </div>
          </div>

          {/* Territory & Top View Matrix */}
          <div className="p-8 bg-zinc-900/40 border border-zinc-900 rounded-[36px] backdrop-blur-xl shadow-2xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2 w-full">
              <Eye className="h-4.5 w-4.5 text-indigo-400" />
              Live Top-View Territory Coverage
            </h3>

            <div className="flex flex-col md:flex-row items-center gap-10 justify-around">
              {/* Visual 5x5 Flat Matrix */}
              <div className="grid grid-cols-5 gap-2 w-64 h-64 bg-zinc-950 p-4 rounded-[24px] border border-zinc-900 shadow-inner">
                {topView.map((col, x) =>
                  col.map((cell, y) => {
                    const pColor = cell.playerId ? players.find((p) => p.id === cell.playerId)?.color : null;
                    return (
                      <div
                        key={`${x}-${y}`}
                        className="rounded-xl aspect-square border border-white/5 flex items-center justify-center font-black text-xs text-white shadow-sm"
                        style={{
                          backgroundColor: pColor || '#141416',
                          boxShadow: cell.playerId ? 'inset 0 0 8px rgba(255,255,255,0.25)' : 'none',
                        }}
                      >
                        {cell.playerId ? cell.playerId : ''}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Progress bars representing percent grid coverage */}
              <div className="space-y-4 w-full max-w-xs text-left">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                  Grid Percentage
                </span>
                
                <div className="space-y-3.5">
                  {players.map((p) => {
                    const cellCount = topView.flat().filter((cell) => cell.playerId === p.id).length;
                    const percent = Math.round((cellCount / 25) * 100);
                    return (
                      <div key={p.id} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm border border-white/10" style={{ backgroundColor: p.color }} />
                            <span className="font-extrabold text-zinc-300 text-xs">{p.name}</span>
                          </div>
                          <span className="font-mono text-zinc-400 font-bold">
                            {cellCount} cells ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                          <div
                            className="h-full rounded-full transition-all duration-500 shadow-inner"
                            style={{
                              backgroundColor: p.color,
                              width: `${percent}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
