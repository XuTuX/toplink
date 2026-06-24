'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { PlayerId } from '@/lib/rules';
import { useRouter } from 'next/navigation';
import { Trophy, RefreshCcw, Award, LayoutGrid, ScrollText } from 'lucide-react';
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

  if (status !== 'ended' || !result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6 relative overflow-hidden">
        <div className="p-8 bg-zinc-900/40 border border-zinc-900 rounded-3xl text-center space-y-5 max-w-sm shadow-lg z-10 relative">
          <h3 className="font-black text-zinc-100 text-lg tracking-tight">종료된 세션을 찾을 수 없습니다</h3>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium">
            최종 순위를 계산하고 보려면 먼저 게임 세션을 완료해야 합니다.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-sm font-extrabold transition-all mt-4"
          >
            로비로 돌아가기
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
      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-5.5 w-5.5 text-amber-500" />
            <h1 className="font-black text-lg text-zinc-50 tracking-tight">게임 결과</h1>
          </div>

          <button
            onClick={handleRestart}
            className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            새 게임 시작하기
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 w-full relative z-10">
        
        {/* Left Column: Winners presentation and Rankings */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Victory Card */}
          <div className="p-8 bg-zinc-900/40 border border-zinc-900 rounded-[32px] text-center relative overflow-hidden shadow-lg">
            <div className="inline-flex p-4 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl mb-5">
              <Award className="h-9 w-9" />
            </div>

            <h2 className="text-3xl font-black tracking-tight text-zinc-50">
              {winners.length > 1 ? "무승부!" : '승리!'}
            </h2>
            
            <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed font-semibold">
              {winners.length > 1
                ? `플레이어 ${winners.map((w) => w.name).join(', ')}님이 동률로 공동 1위를 차지했습니다!`
                : `${winners[0]?.name}님이 보드를 장악했습니다!`
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
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-[32px] shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-[10px] text-zinc-500 uppercase tracking-widest">
                최종 순위표
              </h3>
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">
                행에 마우스를 올리면 가장 큰 영역이 강조됩니다
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
                          ? 'border-indigo-300 bg-indigo-50 shadow-sm'
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
                            최대 영역: {res.largestConnectionSize} 칸 • 점수: {res.score}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div className="text-[9.5px] text-zinc-500 space-y-0.5 font-medium hidden sm:block">
                          <div>그리드 점유율: <strong>{res.topViewCellCount}</strong></div>
                          <div>높이 점수: <strong>{res.heightScore}</strong></div>
                        </div>
                        <div className="text-lg font-black text-zinc-200">
                          {res.score} <span className="text-[10px] text-zinc-500 font-bold">점</span>
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
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-[32px] shadow-lg flex flex-col items-center">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2 w-full">
              <LayoutGrid className="h-4.5 w-4.5 text-indigo-600" />
              최종 영토 탑 뷰 그리드
            </h3>

            <div className="grid grid-cols-6 gap-2.5 w-80 h-80 bg-zinc-950 p-4 rounded-[24px] border border-zinc-900 shadow-inner">
              {result.topView.map((col, x) =>
                col.map((cell, y) => {
                  const pColor = cell.playerId ? players.find((p) => p.id === cell.playerId)?.color : null;
                  const highlighted = isCellHighlighted(x, y, cell.playerId);

                  return (
                    <div
                      key={`${x}-${y}`}
                      className="rounded-xl aspect-square border border-white/5 flex items-center justify-center font-black text-xs text-white transition-all duration-300 shadow-sm"
                      style={{
                        backgroundColor: pColor || '#f3f4f6',
                        opacity: highlighted ? 1 : 0.25,
                        boxShadow: cell.playerId && highlighted ? 'inset 0 0 0 1px rgba(17,24,39,0.08)' : 'none',
                        borderWidth: cell.playerId && highlighted && highlightedPlayer ? '2px' : '1px',
                        borderColor: cell.playerId && highlighted && highlightedPlayer ? '#4f46e5' : '#e5e7eb',
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
                다음 플레이어의 연결 영역 강조 중:{' '}
                <span className="font-bold" style={{ color: players.find((p) => p.id === highlightedPlayer)?.color }}>
                  {players.find((p) => p.id === highlightedPlayer)?.name}
                </span>
              </p>
            ) : (
              <p className="text-[10px] text-zinc-500 mt-4 text-center font-medium">
                플레이어의 영토를 보려면 위 플레이어 이름에 마우스를 올리세요.
              </p>
            )}
          </div>

          {/* Full Game Replay Log */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-[32px] shadow-lg flex flex-col max-h-[250px]">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-4 flex items-center gap-2">
              <ScrollText className="w-4.5 h-4.5 text-zinc-500" />
              게임 리플레이 기록 ({moves.length} 이동)
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
                        위치 ({move.origin.x},{move.origin.y},{move.origin.z})
                      </span>
                    </div>

                    <div>
                      {move.valid ? (
                        <span className="text-emerald-400 font-bold">유효</span>
                      ) : (
                        <span className="text-rose-400 font-bold cursor-help" title={move.invalidReason}>
                          스킵
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
