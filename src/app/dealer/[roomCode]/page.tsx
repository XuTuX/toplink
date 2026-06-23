'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGameStore } from '@/lib/store/gameStore';
import { getCurrentPlayer, computeTopView, getMaxHeight, PlayerId } from '@/lib/rules';
import BoardIsometric from '@/components/BoardIsometric';
import { Shield, RotateCcw, AlertOctagon, ListTodo, Eye, Activity, Play, Users, XCircle } from 'lucide-react';
import { useSocket } from '@/components/SocketProvider';

export default function DealerRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = (params?.roomCode as string)?.toUpperCase() || '';
  const { socket, isConnected, error } = useSocket();
  const [rejoined, setRejoined] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    status,
    players,
    board,
    moves,
    round,
    turnIndexInRound,
    endPending,
  } = useGameStore();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const sessionStr = sessionStorage.getItem('hostSession');
    if (!sessionStr) {
      setAuthError('호스트 인증 정보가 없습니다. 새로 방을 만들어주세요.');
      setTimeout(() => router.push('/dealer'), 2000);
      return;
    }

    try {
      const session = JSON.parse(sessionStr);
      if (session.roomCode !== roomCode) {
        setAuthError('방 코드가 일치하지 않습니다.');
        setTimeout(() => router.push('/dealer'), 2000);
        return;
      }

      socket.emit('host_rejoin', session.roomCode, session.hostSecret);

      const onRejoined = () => {
        setRejoined(true);
      };

      const onError = (msg: string) => {
        setAuthError(msg);
        setTimeout(() => router.push('/dealer'), 2000);
      };

      socket.on('host_rejoined', onRejoined);
      socket.on('error_message', onError);

      return () => {
        socket.off('host_rejoined', onRejoined);
        socket.off('error_message', onError);
      };
    } catch (e) {
      setAuthError('잘못된 세션 정보입니다.');
      setTimeout(() => router.push('/dealer'), 2000);
    }
  }, [socket, isConnected, roomCode, router]);

  const topView = computeTopView(board);
  const activePlayerId = players.length > 0 ? getCurrentPlayer(useGameStore.getState()) : null;
  const activePlayer = players.find((p) => p.id === activePlayerId);
  const maxZ = getMaxHeight(board);

  const handleStartGame = () => {
    if (socket && roomCode) {
      socket.emit('host_start_game', roomCode);
    }
  };

  const handleForceSkip = () => {
    if (socket && roomCode) {
      socket.emit('host_force_skip', roomCode);
    }
  };

  const handleForceEnd = () => {
    if (socket && roomCode) {
      socket.emit('host_force_end', roomCode);
    }
  };

  const handleResetGame = () => {
    if (socket && roomCode) {
      socket.emit('host_reset_game', roomCode);
    }
  };

  const handleKickPlayer = (playerId: PlayerId) => {
    if (socket && roomCode) {
      socket.emit('host_kick_player', roomCode, playerId);
    }
  };

  // Loading/Auth Error State
  if (authError || !rejoined || status === 'setup') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 font-sans p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 text-center space-y-8 shadow-2xl">
          <div className="mx-auto w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 mb-4">
            <Shield className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">호스트 대시보드</h1>
            <p className="text-sm text-zinc-400">방을 관리하고 대기하세요.</p>
          </div>

          {authError ? (
            <div className="p-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-bold animate-pulse">
              {authError}
            </div>
          ) : !isConnected || !rejoined ? (
            <div className="p-4 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-bold animate-pulse">
              호스트 세션 복구 중...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-zinc-950 rounded-2xl border border-zinc-800">
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2">방 코드</p>
                <p className="text-5xl font-black text-white tracking-widest font-mono">{roomCode}</p>
              </div>

              <div className="text-left space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4" /> 참여한 플레이어
                  </span>
                  <span className="text-xs font-black">{players.length}/4</span>
                </div>

                <div className="space-y-2">
                  {players.length === 0 ? (
                    <div className="text-center py-4 text-zinc-600 text-xs font-bold uppercase tracking-widest">
                      플레이어들의 입장을 기다리는 중...
                    </div>
                  ) : (
                    players.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: p.color }} />
                          <span className="text-sm font-bold text-zinc-200">{p.name}</span>
                        </div>
                        <button
                          onClick={() => handleKickPlayer(p.id)}
                          className="text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={handleStartGame}
                disabled={players.length === 0}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl text-lg font-black transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:shadow-none active:scale-95 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" /> 게임 시작
              </button>
            </div>
          )}
          {error && !authError && (
            <div className="mt-4 p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Game State
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-sans pb-12 relative overflow-hidden selection:bg-zinc-800 selection:text-white">
      <div className="absolute top-[-10%] right-[10%] h-[400px] w-[600px] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[5%] h-[350px] w-[500px] rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none" />

      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-black text-lg text-zinc-50 tracking-tight">호스트 콘솔</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">방:</span>
                <span className="text-[10px] text-emerald-400 font-black tracking-widest font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">{roomCode}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetGame}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/20 text-zinc-500 hover:text-red-400 rounded-xl transition-all cursor-pointer"
              title="Reset Session State"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full relative z-10">
        
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl backdrop-blur-xl shadow-xl">
            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" /> 세션 상태
            </h2>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 shadow-inner">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">상태</span>
                <span className={`text-xs font-black capitalize ${
                  status === 'playing' ? 'text-blue-400' :
                  status === 'end_pending' ? 'text-amber-500 animate-pulse' :
                  status === 'ended' ? 'text-purple-400' : 'text-zinc-400'
                }`}>
                  {status.replace('_', ' ')}
                </span>
              </div>
              <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 shadow-inner">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">라운드</span>
                <span className="text-xs font-black text-zinc-100 font-mono">#{round}</span>
              </div>
              <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 shadow-inner">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">최고 높이</span>
                <span className="text-xs font-black text-zinc-100 font-mono">{maxZ} / 5</span>
              </div>
              <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 shadow-inner">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">총 이동 횟수</span>
                <span className="text-xs font-black text-zinc-100 font-mono">{moves.length}</span>
              </div>
            </div>

            {endPending && (
              <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
                <AlertOctagon className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-extrabold text-amber-500 block">매치 종료 대기 중</span>
                  <span className="text-[10px] text-zinc-500 block mt-1 font-medium">
                    이번 라운드가 끝나면 게임이 종료됩니다.
                  </span>
                </div>
              </div>
            )}
          </div>

          {status !== 'ended' && (
            <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl backdrop-blur-xl shadow-xl space-y-4">
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">현재 플레이어 정보</h2>

              <div className="flex items-center gap-3 p-3.5 bg-zinc-950/40 border border-zinc-900 rounded-2xl">
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md"
                  style={{ backgroundColor: activePlayer?.color }}
                />
                <div>
                  <span className="text-xs font-black text-zinc-100">{activePlayer?.name}</span>
                  <span className="text-[9px] text-zinc-500 block mt-0.5 font-bold uppercase tracking-wider">
                    자리 {activePlayerId} • 순서: {turnIndexInRound + 1}/{players.length}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleForceSkip}
                  className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-white text-zinc-400 rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-sm"
                >
                  현재 턴 강제 스킵
                </button>
                <button
                  onClick={handleForceEnd}
                  className="w-full py-3 bg-rose-500/10 border border-rose-500/15 hover:bg-rose-500/20 hover:border-rose-500/25 rounded-2xl text-xs font-extrabold transition-all text-rose-400 cursor-pointer"
                >
                  스테이지 강제 종료 및 점수 계산
                </button>
              </div>
            </div>
          )}

          {/* Replay Log */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col max-h-[300px]">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <ListTodo className="h-4.5 w-4.5 text-zinc-500" />
              <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">행동 로그</h2>
            </div>
            
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
              {moves.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-xs font-bold uppercase tracking-wider">
                  기록된 행동이 없습니다.
                </div>
              ) : (
                [...moves].reverse().map((move) => {
                  const p = players.find((pl) => pl.id === move.playerId);
                  return (
                    <div key={move.id} className="p-3.5 bg-zinc-950/40 border border-zinc-900 rounded-2xl text-xs flex justify-between items-start gap-2 shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ backgroundColor: p?.color }} />
                          <span className="font-extrabold text-zinc-200 text-xs">{p?.name || move.playerId}</span>
                        </div>
                        <span className="text-[9.5px] text-zinc-500 block font-mono mt-1">
                          라운드 {move.round} · 슬롯 {move.turnIndex + 1}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {move.cells.map((c, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[8.5px] text-zinc-400">
                              {c.x},{c.y},{c.z}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        {move.valid ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-black text-[9px] uppercase tracking-wider">유효</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md font-black text-[9px] uppercase tracking-wider" title={move.invalidReason}>스킵</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-zinc-900/20 p-8 rounded-[36px] border border-zinc-900 backdrop-blur-xl flex flex-col items-center shadow-2xl relative overflow-hidden">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 relative z-10">
              3D 세션 보드
            </h3>
            <div className="relative z-10 w-full max-w-lg">
              <BoardIsometric board={board} players={players} />
            </div>
          </div>

          <div className="p-8 bg-zinc-900/40 border border-zinc-900 rounded-[36px] backdrop-blur-xl shadow-2xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2 w-full">
              <Eye className="h-4.5 w-4.5 text-indigo-400" /> 실시간 탑 뷰 영토 점유율
            </h3>

            <div className="flex flex-col md:flex-row items-center gap-10 justify-around">
              <div className="grid grid-cols-5 gap-2 w-64 h-64 bg-zinc-950 p-4 rounded-[24px] border border-zinc-900 shadow-inner">
                {topView.map((col, x) =>
                  col.map((cell, y) => {
                    const pColor = cell.playerId ? players.find((p) => p.id === cell.playerId)?.color : null;
                    return (
                      <div
                        key={`${x}-${y}`}
                        className="rounded-xl aspect-square border border-white/5 flex items-center justify-center font-black text-xs text-white shadow-sm"
                        style={{ backgroundColor: pColor || '#141416', boxShadow: cell.playerId ? 'inset 0 0 8px rgba(255,255,255,0.25)' : 'none' }}
                      >
                        {cell.playerId ? cell.playerId : ''}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-4 w-full max-w-xs text-left">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">그리드 비율</span>
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
                          <span className="font-mono text-zinc-400 font-bold">{cellCount} 칸 ({percent}%)</span>
                        </div>
                        <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                          <div className="h-full rounded-full transition-all duration-500 shadow-inner" style={{ backgroundColor: p.color, width: `${percent}%` }} />
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
