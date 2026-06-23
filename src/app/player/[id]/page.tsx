'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store/gameStore';
import { PlayerId, validatePlacement, getCurrentPlayer, getCurrentTurnOrder } from '@/lib/rules';
import BoardIsometric from '@/components/BoardIsometric';
import { RotateCw, ArrowLeft, Send, HelpCircle, User, Gamepad2, Keyboard, Sparkles } from 'lucide-react';

export default function PlayerPage() {
  const router = useRouter();
  const params = useParams();
  const playerId = params.id as PlayerId;

  const {
    status,
    players,
    board,
    moves,
    placeBlock,
  } = useGameStore();

  const [mounted, setMounted] = useState(false);

  // Selected coordinate and rotation state
  const [originX, setOriginX] = useState(0);
  const [originY, setOriginY] = useState(0);
  const [rotationIndex, setRotationIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch player details
  const player = players.find((p) => p.id === playerId);

  // Determine current turn status
  const activePlayerId = mounted ? getCurrentPlayer(useGameStore.getState()) : null;
  const isMyTurn = activePlayerId === playerId;
  const currentTurnOrder = mounted ? getCurrentTurnOrder(useGameStore.getState()) : [];

  // Compute block placement validation (without showing red alerts, but to extract preview cells & landing Z)
  const validation = mounted
    ? validatePlacement(
        useGameStore.getState(),
        playerId,
        { x: originX, y: originY },
        rotationIndex
      )
    : { valid: false, cells: [] as any[], reason: '', landingZ: 0 };

  // Handle Board Cell Click in 3D view
  const handleCellClick = (x: number, y: number) => {
    if (status === 'ended' || !isMyTurn) return;
    setOriginX(x);
    setOriginY(y);

    // Auto-select first valid rotation at clicked cell
    const currentVal = validatePlacement(useGameStore.getState(), playerId, { x, y }, rotationIndex);
    if (currentVal.valid) return;

    for (let r = 0; r < 12; r++) {
      const rot = (rotationIndex + r) % 12;
      const val = validatePlacement(useGameStore.getState(), playerId, { x, y }, rot);
      if (val.valid) {
        setRotationIndex(rot);
        break;
      }
    }
  };

  // Rotation cycle
  const handleRotate = () => {
    if (status === 'ended' || !isMyTurn) return;

    let found = false;
    for (let i = 1; i <= 12; i++) {
      const nextRot = (rotationIndex + i) % 12;
      const val = validatePlacement(useGameStore.getState(), playerId, { x: originX, y: originY }, nextRot);
      if (val.valid) {
        setRotationIndex(nextRot);
        found = true;
        break;
      }
    }

    if (!found) {
      setRotationIndex((prev) => (prev + 1) % 12);
    }
  };

  // Confirm Move handler
  const handleConfirmMove = () => {
    if (status === 'ended' || !isMyTurn) return;
    placeBlock(playerId, { x: originX, y: originY, z: validation.landingZ ?? 0 }, rotationIndex);
  };

  // Listen for keyboard shortcuts (R/Space to rotate, Enter to place)
  useEffect(() => {
    if (!mounted || !isMyTurn || status === 'ended') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when typing in inputs (if any)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === ' ' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleRotate();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        placeBlock(playerId, { x: originX, y: originY, z: validation.landingZ ?? 0 }, rotationIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, isMyTurn, status, originX, originY, rotationIndex, validation.landingZ, playerId, placeBlock, handleRotate]);

  if (!mounted || !player) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-blue-500 border-zinc-700"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden pb-12 selection:bg-zinc-800 selection:text-white">
      {/* Background decoration glows */}
      <div
        className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[150px] opacity-20 pointer-events-none transition-all duration-1000 animate-pulse"
        style={{ backgroundColor: player.color }}
      />
      <div
        className="absolute bottom-[-10%] left-[-10%] h-[400px] w-[400px] rounded-full blur-[130px] opacity-10 pointer-events-none"
        style={{ backgroundColor: player.color }}
      />

      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-zinc-200 transition-all border border-transparent hover:border-zinc-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md shadow-black/50"
                style={{ backgroundColor: player.color }}
              />
              <span className="font-black text-xl tracking-tight text-zinc-50">{player.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 rounded-xl border border-zinc-800 shadow-inner">
            <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">Role:</span>
            <span className="text-[10px] font-extrabold" style={{ color: player.color }}>Player {playerId}</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto px-4 mt-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 w-full">
        
        {/* Left: Stats & Placement parameters */}
        <div className="lg:col-span-4 space-y-6">
          {/* Turn status Card */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-zinc-400" />
                Game Status
              </h2>

              {status === 'ended' ? (
                <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-center space-y-4">
                  <div>
                    <span className="font-extrabold text-purple-400 text-sm block">Stage Finished!</span>
                    <span className="text-xs text-zinc-500 mt-1 block">The dealer is calculating final scores.</span>
                  </div>
                  <button
                    onClick={() => router.push('/result')}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all text-xs cursor-pointer shadow-lg shadow-purple-500/20"
                  >
                    View Results
                  </button>
                </div>
              ) : isMyTurn ? (
                <div className="space-y-4">
                  <div 
                    className="p-4 rounded-2xl flex items-center gap-3 border shadow-md transition-all duration-300"
                    style={{ 
                      backgroundColor: `${player.color}12`,
                      borderColor: `${player.color}30` 
                    }}
                  >
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: player.color }} />
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: player.color }} />
                    </div>
                    <span className="font-extrabold text-sm tracking-tight" style={{ color: player.color }}>YOUR TURN</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Click coordinates on the board to select where to drop your L-block.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-950/60 border border-zinc-900 rounded-2xl flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-zinc-700 animate-pulse" />
                    <span className="font-bold text-zinc-500 text-sm">WAITING FOR OTHERS</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Active Player:{' '}
                    <span className="font-extrabold text-zinc-200">
                      {players.find((p) => p.id === activePlayerId)?.name || activePlayerId}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Turn order tracker */}
            <div className="mt-6 border-t border-zinc-900/60 pt-4">
              <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-3">
                Round Player Sequence
              </span>
              <div className="flex gap-2">
                {currentTurnOrder.map((pid) => {
                  const p = players.find((pl) => pl.id === pid);
                  const isCurrent = activePlayerId === pid;
                  return (
                    <div
                      key={pid}
                      className="flex-1 p-2 rounded-xl text-center border text-[10px] font-black transition-all duration-300"
                      style={{
                        backgroundColor: isCurrent ? `${p?.color}15` : 'rgba(10, 10, 10, 0.4)',
                        borderColor: isCurrent ? p?.color : 'rgba(24, 24, 27, 0.5)',
                        color: isCurrent ? p?.color : 'rgba(113, 113, 122, 0.6)',
                        boxShadow: isCurrent ? `0 0 12px ${p?.color}20` : 'none'
                      }}
                    >
                      {p?.name.split(' ')[0] || pid}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Placement Settings HUD */}
          {status !== 'ended' && isMyTurn && (
            <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl backdrop-blur-xl shadow-xl space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-400" />
                Placement Details
              </h2>
              
              {/* Coordinates Display */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Target X</span>
                  <span className="text-lg font-black text-zinc-200 font-mono">{originX}</span>
                </div>
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Target Y</span>
                  <span className="text-lg font-black text-zinc-200 font-mono">{originY}</span>
                </div>
              </div>

              {/* Landing Height Z Info */}
              <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Projected Height</span>
                  <span className="text-xs text-zinc-400 mt-1 block">Drops automatically</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono" style={{ color: player.color }}>
                    Z = {validation.landingZ ?? 0}
                  </span>
                </div>
              </div>

              {/* Interactive Controls */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleRotate}
                  className="w-full py-3.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-all font-bold text-xs flex items-center justify-center gap-2.5 cursor-pointer text-zinc-300 hover:text-white"
                >
                  <RotateCw className="h-4 w-4 text-zinc-500" />
                  Rotate Block
                  <kbd className="px-1.5 py-0.5 text-[9px] bg-zinc-900 text-zinc-400 rounded-md border border-zinc-800">R / Space</kbd>
                </button>

                <button
                  onClick={handleConfirmMove}
                  className="w-full py-4.5 rounded-2xl font-black text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer text-white"
                  style={{
                    backgroundColor: player.color,
                    boxShadow: `0 8px 24px -6px ${player.color}60`,
                  }}
                >
                  <Send className="h-4 w-4" />
                  Confirm Placement
                  <kbd className="px-1.5 py-0.5 text-[9px] bg-white/20 text-white/90 rounded-md">Enter</kbd>
                </button>
              </div>
            </div>
          )}

          {/* Quick Help Card */}
          <div className="p-5 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl backdrop-blur-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-zinc-500" />
              Keyboard Shortcuts
            </h3>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex justify-between items-center">
                <span>Rotate Block</span>
                <kbd className="px-1.5 py-0.5 text-[9px] bg-zinc-950 rounded border border-zinc-850">R / Space</kbd>
              </li>
              <li className="flex justify-between items-center">
                <span>Confirm Move</span>
                <kbd className="px-1.5 py-0.5 text-[9px] bg-zinc-950 rounded border border-zinc-850">Enter</kbd>
              </li>
            </ul>
          </div>
        </div>

        {/* Right: Board view */}
        <div className="lg:col-span-8 flex flex-col justify-center items-center">
          <div 
            className="w-full bg-zinc-900/20 p-8 rounded-[36px] border border-zinc-900 backdrop-blur-xl flex flex-col items-center relative overflow-hidden"
            style={{
              boxShadow: isMyTurn ? `0 0 80px -20px ${player.color}15` : 'none',
              transition: 'box-shadow 0.5s ease',
            }}
          >
            {/* Soft inner glow behind board */}
            <div 
              className="absolute inset-0 bg-radial from-transparent via-transparent to-transparent opacity-30 pointer-events-none"
              style={{
                background: `radial-gradient(circle at center, ${player.color}10 0%, transparent 70%)`
              }}
            />

            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 relative z-10">
              3D Interactive Grid
            </h3>

            <div className="relative z-10 w-full max-w-lg">
              <BoardIsometric
                board={board}
                players={players}
                previewCells={isMyTurn ? validation.cells : []}
                previewColor={player.color}
                onCellClick={(x, y) => handleCellClick(x, y)}
              />
            </div>
            
            <span className="text-[10px] text-zinc-500 mt-4 text-center block relative z-10">
              Select any column directly by clicking on the grid.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
