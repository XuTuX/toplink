'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { Player, PlayerId } from '@/lib/rules';
import { useRouter } from 'next/navigation';
import { Play, RotateCcw, Shuffle, Users, ShieldAlert, ArrowRight, Layers, Crown } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const { status, players, baseTurnOrder, setupGame, resetGame } = useGameStore();

  const [mounted, setMounted] = useState(false);
  const [localPlayers, setLocalPlayers] = useState<Player[]>(players);
  const [localOrder, setLocalOrder] = useState<PlayerId[]>(baseTurnOrder);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setLocalPlayers(players);
    setLocalOrder(baseTurnOrder);
  }, [players, baseTurnOrder]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-indigo-500 border-zinc-800"></div>
      </div>
    );
  }

  const handlePlayerNameChange = (id: PlayerId, newName: string) => {
    setLocalPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
  };

  const handlePlayerColorChange = (id: PlayerId, newColor: string) => {
    setLocalPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, color: newColor } : p))
    );
  };

  const moveOrderUp = (index: number) => {
    if (index === 0) return;
    const nextOrder = [...localOrder];
    const temp = nextOrder[index];
    nextOrder[index] = nextOrder[index - 1];
    nextOrder[index - 1] = temp;
    setLocalOrder(nextOrder);
  };

  const moveOrderDown = (index: number) => {
    if (index === localOrder.length - 1) return;
    const nextOrder = [...localOrder];
    const temp = nextOrder[index];
    nextOrder[index] = nextOrder[index + 1];
    nextOrder[index + 1] = temp;
    setLocalOrder(nextOrder);
  };

  const shuffleOrder = () => {
    const shuffled = [...localOrder].sort(() => Math.random() - 0.5);
    setLocalOrder(shuffled);
  };

  const handleStart = () => {
    setupGame(localPlayers, localOrder);
    router.push('/dealer');
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-sans pb-16 relative overflow-hidden selection:bg-indigo-600 selection:text-white">
      {/* Premium glowing background elements */}
      <div className="absolute top-[-10%] left-[15%] h-[500px] w-[700px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[5%] right-[10%] h-[400px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] h-[300px] w-[500px] rounded-full bg-purple-600/5 blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto px-6 mt-16 sm:mt-24 z-10 relative">
        
        {/* Header Title Section */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 rounded-full border border-indigo-500/20 mb-5">
            <Layers className="w-3.5 h-3.5" />
            3D Block Strategy Board Game
          </div>
          <h1 className="text-5xl sm:text-6xl font-black mt-2 tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
            TOP LINK
          </h1>
          <p className="text-zinc-400 mt-4 text-sm sm:text-base max-w-lg mx-auto leading-relaxed font-medium">
            Deploy L-blocks, outmaneuver opponents, and establish territory control on a 5×5 isometric board.
          </p>
        </div>

        {/* Game in Progress Notification */}
        {status !== 'setup' && (
          <div className="mb-10 p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-5 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="font-extrabold text-amber-500 tracking-tight text-sm sm:text-base">Active Session Detected</h3>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed font-medium">
                  A game session is currently active. You can resume the current match or reset to start fresh.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => router.push('/dealer')}
                className="flex-1 md:flex-none py-3 px-5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black rounded-2xl text-xs sm:text-sm tracking-tight transition-all duration-200 shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                Resume Match
              </button>
              <button
                onClick={resetGame}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 hover:text-red-400 text-zinc-400 rounded-2xl border border-zinc-800 transition-all cursor-pointer"
                title="Reset Game State"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {status === 'setup' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
            {/* Left: Players Configuration */}
            <div className="md:col-span-8 flex">
              <div className="w-full p-8 bg-zinc-900/30 border border-zinc-900 rounded-[32px] backdrop-blur-xl shadow-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                      <Users className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-black text-zinc-50 tracking-tight">Configure Players</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {localPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="p-5 bg-zinc-950/40 border border-zinc-900 rounded-2xl space-y-4 hover:border-zinc-800 transition-all shadow-inner"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">
                            Player {player.id}
                          </span>
                          <input
                            type="color"
                            value={player.color}
                            onChange={(e) => handlePlayerColorChange(player.id, e.target.value)}
                            className="h-8 w-8 rounded-lg cursor-pointer border-0 bg-transparent"
                            title={`Select color for ${player.id}`}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold block">Alias</label>
                          <input
                            type="text"
                            value={player.name}
                            onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                            className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                            placeholder="Player Name"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Turn Order & Start Button */}
            <div className="md:col-span-4 flex">
              <div className="w-full p-8 bg-zinc-900/30 border border-zinc-900 rounded-[32px] backdrop-blur-xl shadow-2xl flex flex-col justify-between gap-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-zinc-50 tracking-tight flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-500" />
                      Sequence
                    </h2>
                    <button
                      onClick={shuffleOrder}
                      className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-zinc-200 transition-all border border-transparent hover:border-zinc-800 cursor-pointer"
                      title="Shuffle Turn Order"
                    >
                      <Shuffle className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {localOrder.map((pid, idx) => {
                      const player = localPlayers.find((p) => p.id === pid);
                      if (!player) return null;
                      return (
                        <div
                          key={pid}
                          className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-zinc-900 rounded-2xl hover:border-zinc-850 transition-all shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md"
                              style={{ backgroundColor: player.color }}
                            />
                            <span className="text-xs font-bold text-zinc-200">
                              {player.name || player.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-lg border border-zinc-850">
                            <button
                              disabled={idx === 0}
                              onClick={() => moveOrderUp(idx)}
                              className="w-5 h-5 flex items-center justify-center text-[9px] hover:bg-zinc-850 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                              ▲
                            </button>
                            <button
                              disabled={idx === localOrder.length - 1}
                              onClick={() => moveOrderDown(idx)}
                              className="w-5 h-5 flex items-center justify-center text-[9px] hover:bg-zinc-850 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleStart}
                  className="w-full py-4.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700 text-white font-black rounded-2xl tracking-wide transition-all shadow-lg shadow-indigo-500/20 group cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="h-4.5 w-4.5 fill-white" />
                  Launch Game
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Roles Quick Link Console at bottom */}
        <div className="mt-14 space-y-4">
          <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest block text-center">
            Active Consoles & Player Seats
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-4 bg-zinc-900/20 border border-zinc-900/80 rounded-2xl text-center backdrop-blur-md hover:border-zinc-800 transition-all flex flex-col justify-center">
              <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest block">Referee</span>
              <a href="/dealer" className="text-xs font-black text-indigo-400 hover:text-indigo-300 block mt-1.5 transition-colors">
                Dealer Console
              </a>
            </div>
            {['P1', 'P2', 'P3', 'P4'].map((pid) => {
              const player = players.find((p) => p.id === pid);
              return (
                <div key={pid} className="p-4 bg-zinc-900/20 border border-zinc-900/80 rounded-2xl text-center backdrop-blur-md hover:border-zinc-850 transition-all flex flex-col justify-center">
                  <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest block">Seat {pid}</span>
                  <a
                    href={`/player/${pid}`}
                    className="text-xs font-black hover:opacity-80 block mt-1.5 transition-opacity"
                    style={{ color: player?.color }}
                  >
                    {player?.name || pid}
                  </a>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
