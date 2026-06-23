'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { getCurrentPlayer, validatePlacement, getColumnHeight, PlacedCell, GameState, PlayerId, Coord } from '@/lib/rules';
import { useSocket } from '@/components/SocketProvider';
import { User, Activity, AlertCircle, RotateCw, Send, Eye, RefreshCcw, Layers, ListTodo, X, ScrollText } from 'lucide-react';
import BoardIsometric from '@/components/BoardIsometric';

function translateReason(reason: string) {
  if (!reason) return '';
  if (reason.includes('overlaps with an existing cube')) return '이미 두어져 있는 공간을 건드렸습니다.';
  if (reason.includes('out of board boundaries')) return '보드 밖으로 벗어났습니다.';
  if (reason.includes('floating')) return '공중에 띄울 수 없습니다.';
  return '유효하지 않은 수입니다.';
}

export default function PlayerPage() {
  const { socket, isConnected, error } = useSocket();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);

  const [isShaking, setIsShaking] = useState(false);
  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  // General placement state
  const [originX, setOriginX] = useState(2);
  const [originY, setOriginY] = useState(2);
  const [rotationIndex, setRotationIndex] = useState(0);

  // Modes: 'action' (my actual turn) | 'predict' (guessing opponent placements)
  const [mode, setMode] = useState<'action' | 'predict'>('action');

  // Prediction state
  const [predictions, setPredictions] = useState<PlacedCell[]>([]);
  const [predictPlayerId, setPredictPlayerId] = useState<PlayerId | null>(null);
  const [predictShape, setPredictShape] = useState<'L-Block' | '1x1'>('1x1');
  const [manualZ, setManualZ] = useState<number | null>(null);

  // History state
  const [selectedHistoryMoveId, setSelectedHistoryMoveId] = useState<string | null>(null);
  const [lastProcessedMoveId, setLastProcessedMoveId] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const { status, players, round, board, moves } = useGameStore();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && roomCode.trim() && nickname.trim() && password.trim()) {
      socket.emit('player_join', roomCode.toUpperCase(), nickname.trim(), password.trim());
    }
  };

  useEffect(() => {
    if (!socket) return;

    const onPlayerJoined = (joinedPlayerId: PlayerId) => {
      setPlayerId(joinedPlayerId);
      setJoined(true);
    };

    socket.on('player_joined', onPlayerJoined);
    return () => {
      socket.off('player_joined', onPlayerJoined);
    };
  }, [socket]);

  // Watch for server-side move failures
  useEffect(() => {
    if (moves.length === 0 || !playerId) return;
    const latestMove = moves[moves.length - 1];
    
    if (latestMove.id !== lastProcessedMoveId) {
      setLastProcessedMoveId(latestMove.id);
      
      // If my move just failed on the server (e.g. hit an opponent's hidden block)
      if (latestMove.playerId === playerId && !latestMove.valid) {
        triggerShake();
      }
    }
  }, [moves, playerId, lastProcessedMoveId]);

  const activePlayerId = players.length > 0 ? getCurrentPlayer(useGameStore.getState()) : null;
  const isMyTurn = playerId === activePlayerId;
  const me = players.find(p => p.id === playerId);
  const opponents = players.filter((player) => player.id !== playerId);
  const activePredictionPlayerId = predictPlayerId ?? opponents[0]?.id ?? null;

  // The actual board the player sees: Only their blocks, plus any predictions
  const myBlocks = board.filter(b => b.playerId === playerId);

  // Create a synthetic game state to run validations against
  const syntheticGameState: GameState = {
    ...useGameStore.getState(),
    board: [...myBlocks, ...predictions]
  };

  const currentRotationIndex = (mode === 'predict' && predictShape === '1x1') ? -1 : rotationIndex;

  // Custom validation to support 1x1 block
  const computeValidation = () => {
    if (!playerId) return { valid: false, cells: [], reason: '', landingZ: 0 };

    if (mode === 'predict' && predictShape === '1x1') {
      if (!activePredictionPlayerId) return { valid: false, cells: [], reason: '', landingZ: 0 };
      const z = manualZ !== null
        ? manualZ
        : getColumnHeight(syntheticGameState.board, originX, originY);
      return {
        valid: true,
        cells: [{ x: originX, y: originY, z }],
        landingZ: z
      };
    }

    const targetPlayerId = mode === 'action' ? playerId : activePredictionPlayerId;
    if (!targetPlayerId) return { valid: false, cells: [], reason: '', landingZ: 0 };

    return validatePlacement(
      syntheticGameState,
      targetPlayerId,
      { x: originX, y: originY, z: manualZ !== null && mode === 'predict' ? manualZ : undefined },
      currentRotationIndex === -1 ? 0 : currentRotationIndex,
      mode === 'predict' ? { allowOverlap: true, allowFloating: true } : undefined
    );
  };

  const validation = computeValidation();

  // History Preview Validation
  const historyMove = useGameStore.getState().moves.find(m => m.id === selectedHistoryMoveId);
  let historyCells: Coord[] = [];
  if (historyMove && playerId) {
    const historyValidation = validatePlacement(
      syntheticGameState,
      playerId,
      historyMove.origin,
      historyMove.rotationIndex,
      { allowOverlap: true, allowFloating: true }
    );
    historyCells = historyValidation.cells;
  }

  const handleCellClick = (x: number, y: number) => {
    setSelectedHistoryMoveId(null); // Clear history selection on new interaction

    if (mode === 'action' && !isMyTurn) return;

    setOriginX(x);
    setOriginY(y);

    if (mode === 'predict' && predictShape === '1x1') return; // No auto-rotation for 1x1

    // Auto-select first valid rotation if current is invalid
    const targetPlayerId = mode === 'action' ? playerId : activePredictionPlayerId;
    if (targetPlayerId) {
      const predictionOptions = mode === 'predict' ? { allowOverlap: true, allowFloating: true } : undefined;
      const currentVal = validatePlacement(syntheticGameState, targetPlayerId, { x, y, z: manualZ !== null && mode === 'predict' ? manualZ : undefined }, rotationIndex, predictionOptions);
      if (!currentVal.valid) {
        let found = false;
        for (let r = 0; r < 12; r++) {
          const rot = (rotationIndex + r) % 12;
          const val = validatePlacement(syntheticGameState, targetPlayerId, { x, y }, rot, predictionOptions);
          if (val.valid) {
            setRotationIndex(rot);
            found = true;
            break;
          }
        }
        if (!found) {
          triggerShake();
        }
      }
    }
  };

  const handleRotate = () => {
    setSelectedHistoryMoveId(null); // Clear history selection
    if (mode === 'predict' && predictShape === '1x1') return;
    const targetPlayerId = mode === 'action' ? playerId : activePredictionPlayerId;
    if (targetPlayerId) {
      const predictionOptions = mode === 'predict' ? { allowOverlap: true, allowFloating: true } : undefined;
      let found = false;
      for (let i = 1; i <= 12; i++) {
        const nextRot = (rotationIndex + i) % 12;
        const val = validatePlacement(syntheticGameState, targetPlayerId, { x: originX, y: originY, z: manualZ !== null && mode === 'predict' ? manualZ : undefined }, nextRot, predictionOptions);
        if (val.valid) {
          setRotationIndex(nextRot);
          found = true;
          break;
        }
      }

      // If no valid rotation exists, just do standard rotation so they can at least see it
      if (!found) {
        setRotationIndex((prev) => (prev + 1) % 12);
      }
    } else {
      setRotationIndex((prev) => (prev + 1) % 12);
    }
  };

  const handleConfirmMove = () => {
    if (mode === 'predict') {
      if (validation.valid && activePredictionPlayerId) {
        // Place prediction block locally
        const predictionId = `prediction_${predictions.length}`;
        const newPredictionCells: PlacedCell[] = validation.cells.map(c => ({
          x: c.x,
          y: c.y,
          z: c.z,
          playerId: activePredictionPlayerId,
          blockId: predictionId,
          turnId: predictionId,
        }));
        setPredictions((current) => [...current, ...newPredictionCells]);
      }
    } else {
      // Action mode: emit to server
      if (socket && roomCode && isMyTurn && playerId && validation.valid) {
        socket.emit('player_move', roomCode, playerId, { x: originX, y: originY, z: validation.landingZ }, rotationIndex);
        // Reset mode just in case
        setMode('action');
      }
    }
  };

  const handleClearPredictions = () => {
    setPredictions([]);
  };

  if (!joined) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 p-6">
        <form onSubmit={handleJoin} className="w-full max-w-sm space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white">게임 참가</h1>
            <p className="text-zinc-500 mt-2">호스트가 제공한 방 코드를 입력하세요</p>
          </div>
          {!isConnected && (
            <div className="p-4 bg-amber-500/10 text-amber-500 rounded-xl text-center text-sm font-bold border border-amber-500/20">
              서버에 연결 중...
            </div>
          )}
          {error && (
            <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl text-center text-sm font-bold border border-rose-500/20">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">방 코드</label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                maxLength={4}
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-center text-2xl font-black text-white uppercase tracking-widest focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="이름"
                required
                maxLength={12}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-center text-xl font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">비밀번호 (재접속용)</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="****"
                required
                maxLength={20}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-center text-xl font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!isConnected || !roomCode || !nickname || !password}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-lg font-black transition-all active:scale-95"
          >
            방 참가하기
          </button>
        </form>
      </div>
    );
  }

  if (status === 'setup') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 p-6 text-center space-y-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-zinc-900 border-2 border-zinc-800 mx-auto" style={{ borderColor: me?.color }}>
          <User className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">환영합니다, {me?.name}!</h2>
          <p className="text-zinc-500 mt-2">호스트가 게임을 시작하기를 기다리는 중...</p>
        </div>
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-8"></div>
      </div>
    );
  }

  const activeColor = mode === 'action' ? me?.color : players.find(p => p.id === activePredictionPlayerId)?.color;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100 font-sans">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-8px); }
        }
        .animate-shake {
          animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
      <header className="px-6 py-4 bg-zinc-950/90 backdrop-blur border-b border-zinc-900 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2" style={{ borderColor: me?.color, backgroundColor: me?.color + '20' }} />
          <div>
            <div className="text-sm font-black text-white">{me?.name}</div>
            <div className="text-[10px] text-zinc-500 uppercase font-bold">플레이어 {me?.id}</div>
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          {mode === 'predict' && (
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
              예측 모드
            </span>
          )}
          <div className="text-[10px] text-zinc-500 uppercase font-bold">라운드 {round}</div>
          <button 
            onClick={() => setShowLogModal(true)}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <ScrollText className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4">

        {/* Mode Toggle & Turn Status */}
        <div className="w-full max-w-sm mb-4 space-y-3">
          <div className="flex bg-zinc-900 p-1 rounded-xl">
            <button
              onClick={() => setMode('action')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'action' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Activity className="w-4 h-4 inline-block mr-1.5" /> 행동
            </button>
            <button
              onClick={() => setMode('predict')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'predict' ? 'bg-purple-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Eye className="w-4 h-4 inline-block mr-1.5" /> 예측
            </button>
          </div>

          {mode === 'action' ? (
            <div className={`rounded-2xl p-4 transition-all border ${
              isMyTurn ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}>
              <div className="flex items-center justify-center gap-2 font-black text-sm uppercase tracking-widest">
                {isMyTurn ? (
                  <><Activity className="w-5 h-5 animate-pulse" /> 당신의 차례입니다</>
                ) : (
                  <><User className="w-5 h-5" /> 대기 중: {players.find(p => p.id === activePlayerId)?.name}</>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4 text-center space-y-3">
              <div className="text-xs text-purple-400 font-bold">예측할 상대를 선택하세요:</div>
              <div className="flex justify-center gap-3">
                {opponents.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPredictPlayerId(p.id)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${activePredictionPlayerId === p.id ? 'scale-125' : 'scale-100 opacity-50 hover:opacity-100'}`}
                    style={{ borderColor: p.color, backgroundColor: p.color + '40' }}
                  />
                ))}
              </div>
              <div className="flex justify-center gap-2 pt-2 border-t border-purple-500/20">
                <button
                  onClick={() => setPredictShape('1x1')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${predictShape === '1x1' ? 'bg-purple-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
                >
                  1x1 큐브
                </button>
                <button
                  onClick={() => setPredictShape('L-Block')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${predictShape === 'L-Block' ? 'bg-purple-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
                >
                  L-블록
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="w-full max-w-sm mb-4 p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* 3D Board Area */}
        <div className={`w-full max-w-sm bg-zinc-900/40 rounded-[32px] p-4 border flex flex-col items-center shadow-2xl mb-6 relative overflow-hidden transition-colors ${
          isShaking ? 'border-rose-500 bg-rose-500/5 animate-shake' : 'border-zinc-800'
        }`}>
          {mode === 'predict' && (
            <div className="absolute inset-0 bg-purple-500/5 pointer-events-none" />
          )}

          <BoardIsometric
            board={myBlocks} // Only show own blocks
            players={players}
            predictedCells={predictions.map(c => ({
              x: c.x, y: c.y, z: c.z, color: players.find(p => p.id === c.playerId)?.color || '#fff'
            }))}
            previewCells={selectedHistoryMoveId ? historyCells : (mode === 'action' ? isMyTurn : true) ? validation.cells : []}
            isPreviewValid={selectedHistoryMoveId ? historyMove?.valid : validation.valid}
            previewColor={selectedHistoryMoveId ? (historyMove?.valid ? '#22c55e' : '#ef4444') : (!validation.valid ? '#ef4444' : activeColor)}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Controls */}
        {(mode === 'action' ? isMyTurn : true) && (
          <div className="w-full max-w-sm space-y-3">
            {mode === 'predict' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-3 flex justify-between items-center text-sm">
                <span className="text-zinc-400 font-bold text-xs tracking-wider">
                  {String.fromCharCode(97 + originX)}{originY + 1} <span className="uppercase text-[10px] ml-1 opacity-50">Z:</span> {manualZ !== null ? manualZ : validation.landingZ ?? 0}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setManualZ(Math.max(0, (manualZ !== null ? manualZ : validation.landingZ ?? 0) - 1))} className="w-8 h-8 bg-zinc-800 rounded-lg text-white font-bold hover:bg-zinc-700">-</button>
                  <button onClick={() => setManualZ((manualZ !== null ? manualZ : validation.landingZ ?? 0) + 1)} className="w-8 h-8 bg-zinc-800 rounded-lg text-white font-bold hover:bg-zinc-700">+</button>
                  {manualZ !== null && (
                    <button onClick={() => setManualZ(null)} className="px-3 h-8 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg text-[10px] font-black uppercase hover:bg-purple-600/40">자동</button>
                  )}
                </div>
              </div>
            )}
            {mode === 'action' && (
              <div className={`rounded-2xl p-4 flex justify-between items-center text-sm transition-colors border ${
                !validation.valid ? 'bg-rose-500/10 border-rose-500/30' : 'bg-zinc-900/50 border-zinc-800'
              }`}>
                <span className="text-zinc-400 font-bold tracking-wider">
                  {String.fromCharCode(97 + originX)}{originY + 1} <span className="uppercase text-xs ml-1 opacity-50">Z:</span> {validation.landingZ ?? 0}
                </span>
                {!validation.valid && (
                  <span className={`text-xs font-bold ${isShaking ? 'text-rose-400' : 'text-rose-500'}`}>
                    {translateReason(validation.reason || '')}
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRotate}
                disabled={mode === 'predict' && predictShape === '1x1'}
                className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2"
              >
                <RotateCw className="w-5 h-5" /> 회전
              </button>
              <button
                onClick={() => {
                  if (validation.valid) {
                    handleConfirmMove();
                  } else {
                    triggerShake();
                  }
                }}
                className={`flex-[2] py-4 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 ${
                  mode === 'predict' 
                    ? (validation.valid ? 'bg-purple-600 hover:bg-purple-500' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed')
                    : (validation.valid ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-zinc-800 text-rose-500/50 border-rose-500/10 border hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30')
                }`}
              >
                {mode === 'predict' ? (
                  <><Layers className="w-5 h-5" /> 예측</>
                ) : (
                  <><Send className="w-5 h-5" /> 확인</>
                )}
              </button>
            </div>
            {mode === 'predict' && predictions.length > 0 && (
              <button
                onClick={handleClearPredictions}
                className="w-full py-3 mt-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 border border-zinc-800"
              >
                <RefreshCcw className="w-4 h-4" /> 예측 초기화
              </button>
            )}
          </div>
        )}

      </main>

      {/* Action Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-md text-white">
          <div className="flex items-center justify-between p-4 border-b border-zinc-900">
            <h2 className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-indigo-400" /> 전체 행동 로그
            </h2>
            <button 
              onClick={() => setShowLogModal(false)}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {moves.length === 0 ? (
              <div className="text-center py-12 text-zinc-600 text-xs font-bold uppercase tracking-wider">
                기록된 행동이 없습니다.
              </div>
            ) : (
              [...moves].reverse().map((move) => {
                const p = players.find((pl) => pl.id === move.playerId);
                return (
                  <div key={move.id} className="p-3.5 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex justify-between items-start gap-2">
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
                          <span key={i} className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-900 rounded font-mono text-[8.5px] text-zinc-400">
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
      )}
    </div>
  );
}
