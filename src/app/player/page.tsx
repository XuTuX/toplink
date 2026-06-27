'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { BOARD_CELL_COUNT, BOARD_HEIGHT, BOARD_SIZE, getCurrentPlayer, validatePlacement, getColumnHeight, PlacedCell, GameState, PlayerId, Coord, computeTopView, generateBlockRotations } from '@/lib/rules';
import { useSocket } from '@/components/SocketProvider';
import { User, Activity, AlertCircle, RotateCw, Send, Eye, RefreshCcw, Layers, ScrollText, LayoutGrid, Trash2 } from 'lucide-react';
import BoardIsometric from '@/components/BoardIsometric';
import TopViewGrid from '@/components/TopViewGrid';

function translateReason(reason: string) {
  if (!reason) return '';
  if (reason.includes('overlaps with an existing cube')) return '이미 두어져 있는 공간을 건드렸습니다.';
  if (reason.includes('out of board boundaries')) return '보드 밖으로 벗어났습니다.';
  if (reason.includes('floating')) return '공중에 띄울 수 없습니다.';
  return '유효하지 않은 수입니다.';
}

interface PlayerSession {
  roomCode: string;
  nickname: string;
  password: string;
}

export default function PlayerPage() {
  const { socket, isConnected, error } = useSocket();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);

  const [isShaking, setIsShaking] = useState(false);
  const restoredSessionRef = useRef<PlayerSession | null>(null);
  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  // General placement state
  const [originX, setOriginX] = useState(2);
  const [originY, setOriginY] = useState(2);
  const [rotationIndex, setRotationIndex] = useState(0);

  // Modes: 'action' (my actual turn) | 'predict' (guessing opponent placements) | 'log' (history of placements)
  const [mode, setMode] = useState<'action' | 'predict' | 'log'>('action');

  // Prediction state
  const [predictions, setPredictions] = useState<PlacedCell[]>([]);
  const predictionCounterRef = useRef(0);
  const [predictPlayerId, setPredictPlayerId] = useState<PlayerId | null>(null);
  const [predictShape, setPredictShape] = useState<'L-Block' | '1x1'>('1x1');
  const [manualZ, setManualZ] = useState<number | null>(null);

  // History state
  const [selectedHistoryMoveId, setSelectedHistoryMoveId] = useState<string | null>(null);
  const [selectedTopViewRound, setSelectedTopViewRound] = useState<number | null>(null);
  const lastProcessedMoveIdRef = useRef<string | null>(null);

  // Round transition state
  const [showRoundOverlay, setShowRoundOverlay] = useState(false);
  const [announcedRound, setAnnouncedRound] = useState<number | null>(null);
  const roundOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, players, round, board, moves, roundRevealed, roundTopView, topViewHistory } = useGameStore();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && roomCode.trim() && nickname.trim() && password.trim()) {
      sessionStorage.setItem('playerSession', JSON.stringify({
        roomCode: roomCode.toUpperCase(),
        nickname: nickname.trim(),
        password: password.trim()
      }));
      socket.emit('player_join', roomCode.toUpperCase(), nickname.trim(), password.trim());
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    if (!socket || !isConnected) return;

    const sessionStr = sessionStorage.getItem('playerSession');
    if (sessionStr && !joined) {
      try {
        const session = JSON.parse(sessionStr) as PlayerSession;
        if (!session.roomCode || !session.nickname || !session.password) {
          throw new Error('Invalid player session');
        }
        restoredSessionRef.current = session;
        const timer = setTimeout(() => {
          socket.emit('player_join', session.roomCode, session.nickname, session.password);
        }, 0);
        return () => clearTimeout(timer);
      } catch {
        sessionStorage.removeItem('playerSession');
      }
    }
  }, [socket, isConnected, joined]);

  useEffect(() => {
    if (!socket) return;

    const onPlayerJoined = (joinedPlayerId: PlayerId) => {
      setPlayerId(joinedPlayerId);
      setJoined(true);
    };

    const onRoundStarted = (nextRound: number) => {
      if (roundOverlayTimerRef.current) {
        clearTimeout(roundOverlayTimerRef.current);
      }
      setPredictions([]);
      setSelectedHistoryMoveId(null);
      setSelectedTopViewRound(null);
      setMode('action');
      setAnnouncedRound(nextRound);
      setShowRoundOverlay(true);
      roundOverlayTimerRef.current = setTimeout(() => {
        setShowRoundOverlay(false);
        roundOverlayTimerRef.current = null;
      }, 3000);
    };

    socket.on('player_joined', onPlayerJoined);
    socket.on('round_started', onRoundStarted);
    return () => {
      socket.off('player_joined', onPlayerJoined);
      socket.off('round_started', onRoundStarted);
      if (roundOverlayTimerRef.current) {
        clearTimeout(roundOverlayTimerRef.current);
        roundOverlayTimerRef.current = null;
      }
    };
  }, [socket]);

  // Watch for server-side move failures.
  useEffect(() => {
    if (moves.length === 0 || !playerId) return;
    const latestMove = moves[moves.length - 1];
    if (latestMove.id === lastProcessedMoveIdRef.current) return;
    lastProcessedMoveIdRef.current = latestMove.id;

    if (latestMove.playerId !== playerId || latestMove.valid) return;

    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const startTimer = setTimeout(() => {
      setIsShaking(true);
      resetTimer = setTimeout(() => setIsShaking(false), 400);
    }, 0);
    return () => {
      clearTimeout(startTimer);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [moves, playerId]);




  const activePlayerId = players.length > 0 ? getCurrentPlayer(useGameStore.getState()) : null;
  const isMyTurn = playerId === activePlayerId;
  const me = players.find(p => p.id === playerId);
  const opponents = players.filter((player) => player.id !== playerId);
  const activePredictionPlayerId = predictPlayerId ?? opponents[0]?.id ?? null;

  // The actual board the player sees: Only their blocks, plus any predictions
  const myBlocks = board.filter(b => b.playerId === playerId);
  const visibleBoard = myBlocks;
  const sharedTopView = roundTopView ?? computeTopView([]);
  const latestTopViewEntry = topViewHistory.length > 0 ? topViewHistory[topViewHistory.length - 1] : null;
  const selectedTopViewEntry = selectedTopViewRound
    ? topViewHistory.find((entry) => entry.round === selectedTopViewRound) ?? latestTopViewEntry
    : latestTopViewEntry;
  const latestMove = moves[moves.length - 1];
  let effectEvent: { id: string; type: 'stopped' | 'disappear'; cells: Coord[]; color: string } | null = null;

  if (latestMove?.playerId === playerId) {
    const color = me?.color || '#fff';
    if (!latestMove.valid) {
      effectEvent = { id: latestMove.id, type: 'disappear', cells: latestMove.cells, color };
    }
  }

  // Predictions are local notes. They can affect prediction stacking, but must
  // not block an actual move that the authoritative server can still accept.
  const syntheticGameState: GameState = {
    ...useGameStore.getState(),
    board: mode === 'predict' ? [...myBlocks, ...predictions] : myBlocks
  };

  const currentRotationIndex = (mode === 'predict' && predictShape === '1x1') ? -1 : rotationIndex;

  // Clamp origin to fit within board boundaries based on current rotation
  let clampedX = originX;
  let clampedY = originY;

  if (currentRotationIndex === -1) {
    if (clampedX < 0) clampedX = 0;
    if (clampedX >= BOARD_SIZE) clampedX = BOARD_SIZE - 1;
    if (clampedY < 0) clampedY = 0;
    if (clampedY >= BOARD_SIZE) clampedY = BOARD_SIZE - 1;
  } else {
    const rotations = generateBlockRotations();
    if (currentRotationIndex >= 0 && currentRotationIndex < rotations.length) {
      const rotation = rotations[currentRotationIndex];
      let minX = 0, maxX = 0, minY = 0, maxY = 0;
      for (const c of rotation) {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
      }
      if (clampedX + minX < 0) clampedX = -minX;
      if (clampedX + maxX >= BOARD_SIZE) clampedX = BOARD_SIZE - 1 - maxX;
      if (clampedY + minY < 0) clampedY = -minY;
      if (clampedY + maxY >= BOARD_SIZE) clampedY = BOARD_SIZE - 1 - maxY;
    }
  }

  // Custom validation to support 1x1 block
  const computeValidation = () => {
    if (!playerId) return { valid: false, cells: [], reason: '', landingZ: 0 };

    if (mode === 'predict' && predictShape === '1x1') {
      if (!activePredictionPlayerId) return { valid: false, cells: [], reason: '', landingZ: 0 };
      const z = manualZ !== null
        ? manualZ
        : getColumnHeight(syntheticGameState.board, clampedX, clampedY);
      return {
        valid: true,
        cells: [{ x: clampedX, y: clampedY, z }],
        landingZ: z
      };
    }

    const targetPlayerId = mode === 'action' ? playerId : activePredictionPlayerId;
    if (!targetPlayerId) return { valid: false, cells: [], reason: '', landingZ: 0 };

    return validatePlacement(
      syntheticGameState,
      targetPlayerId,
      { x: clampedX, y: clampedY, z: manualZ !== null && mode === 'predict' ? manualZ : undefined },
      currentRotationIndex === -1 ? 0 : currentRotationIndex,
      mode === 'predict'
        ? { allowOverlap: true, allowFloating: true }
        : { allowFloating: true }
    );
  };

  const validation = computeValidation();

  // History Preview
  const historyMove = useGameStore.getState().moves.find(m => m.id === selectedHistoryMoveId);
  const canInspectHistoryMove = Boolean(historyMove && historyMove.playerId === playerId);
  const historyCells: Coord[] = canInspectHistoryMove ? historyMove?.cells || [] : [];
  const predictionGroups = predictions.reduce<Array<{ id: string; playerId: PlayerId; cells: PlacedCell[] }>>((groups, cell) => {
    const existingGroup = groups.find((group) => group.id === cell.turnId);
    if (existingGroup) {
      existingGroup.cells.push(cell);
      return groups;
    }

    return [...groups, { id: cell.turnId, playerId: cell.playerId, cells: [cell] }];
  }, []);

  const handleCellClick = (x: number, y: number) => {
    setSelectedHistoryMoveId(null); // Clear history selection on new interaction

    if (mode === 'action' && !isMyTurn) return;

    setOriginX(x);
    setOriginY(y);
  };

  const handleRotate = () => {
    setSelectedHistoryMoveId(null); // Clear history selection
    if (mode === 'predict' && predictShape === '1x1') return;
    setRotationIndex((prev) => (prev + 1) % 12);
  };

  const handleConfirmMove = () => {
    if (mode === 'predict') {
      if (validation.valid && activePredictionPlayerId) {
        // Place prediction block locally
        predictionCounterRef.current += 1;
        const predictionId = `prediction_${predictionCounterRef.current}`;
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
      const activeRoomCode = roomCode || restoredSessionRef.current?.roomCode;
      if (socket && activeRoomCode && isMyTurn && playerId && validation.valid) {
        socket.emit('player_move', activeRoomCode, playerId, { x: clampedX, y: clampedY }, rotationIndex);
        // Reset mode just in case
        setMode('action');
      }
    }
  };

  const handleClearPredictions = () => {
    if (!window.confirm('모든 예측을 지울까요?')) return;
    setPredictions([]);
  };

  const handleRemovePrediction = (predictionId: string) => {
    setPredictions((current) => current.filter((cell) => cell.turnId !== predictionId));
  };

  if (!joined) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 p-6">
        <form onSubmit={handleJoin} className="w-full max-w-sm space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-zinc-100">게임 참가</h1>
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
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-base font-bold transition-colors"
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
          <User className="w-8 h-8 text-zinc-100" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-zinc-100">환영합니다, {me?.name}!</h2>
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
      <header className="px-6 py-4 bg-zinc-950/90 border-b border-zinc-900 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2" style={{ borderColor: me?.color, backgroundColor: me?.color + '20' }} />
          <div>
            <div className="text-sm font-black text-zinc-100">{me?.name}</div>
            <div className="text-[10px] text-zinc-500 uppercase font-bold">플레이어 {me?.id}</div>
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          {mode === 'predict' && (
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
              예측 모드
            </span>
          )}
          {mode === 'log' && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
              기록 모드
            </span>
          )}
          <div className="text-[10px] text-zinc-500 uppercase font-bold">라운드 {round}</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4">

        {/* Mode Toggle & Turn Status */}
        <div className="w-full max-w-sm mb-4 space-y-3">
          {!(status === 'round_ended' && roundRevealed) && (
            <div className="flex bg-zinc-900 p-1 rounded-xl">
            <button
              onClick={() => {
                setMode('action');
                setSelectedHistoryMoveId(null);
                setSelectedTopViewRound(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'action' ? 'bg-white text-zinc-100 shadow-sm border border-zinc-800' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Activity className="w-4 h-4 inline-block mr-1.5" /> 행동
            </button>
            <button
              onClick={() => {
                setMode('predict');
                setSelectedHistoryMoveId(null);
                setSelectedTopViewRound(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'predict' ? 'bg-purple-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Eye className="w-4 h-4 inline-block mr-1.5" /> 예측
            </button>
            <button
              onClick={() => {
                setMode('log');
                setSelectedHistoryMoveId(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'log' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ScrollText className="w-4 h-4 inline-block mr-1.5" /> 기록
            </button>
            </div>
          )}

          {status === 'round_ended' ? (
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-4 text-center space-y-1">
              <div className="text-xs text-indigo-600 font-bold flex items-center justify-center gap-1.5">
                <ScrollText className="w-4 h-4" /> {round}라운드 종료
              </div>
              <p className="text-[10px] text-zinc-400">
                {roundRevealed
                  ? "호스트가 라운드 결과를 공개했습니다. 탑뷰를 확인하세요."
                  : "모든 플레이어가 배치를 완료했습니다. 호스트가 결과를 공개하기를 기다리고 있습니다..."}
              </p>
            </div>
          ) : mode === 'action' ? (
            <div className={`rounded-2xl p-4 transition-all border ${
              isMyTurn ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}>
              <div className="flex items-center justify-center gap-2 font-black text-sm uppercase tracking-widest">
                {isMyTurn ? (
                  <><Activity className="w-5 h-5" /> 당신의 차례입니다</>
                ) : (
                  <><User className="w-5 h-5" /> 대기 중: {players.find(p => p.id === activePlayerId)?.name}</>
                )}
              </div>
            </div>
          ) : mode === 'predict' ? (
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
          ) : (
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-4 text-center">
              <div className="text-xs text-indigo-400 font-bold flex items-center justify-center gap-1.5">
                <ScrollText className="w-4 h-4" /> 배치 기록 확인 모드
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                기록을 클릭하면 해당 턴의 배치 형태가 보드에 표시됩니다.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="w-full max-w-sm mb-4 p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Keep primary placement controls visible before the tall 3D board. */}
        {status !== 'round_ended' && mode !== 'log' && (mode === 'action' ? isMyTurn : true) && (
          <div className="w-full max-w-sm mb-4 space-y-3">
            {mode === 'predict' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-3 flex justify-between items-center text-sm">
                <span className="text-zinc-400 font-bold text-xs tracking-wider">
                  {String.fromCharCode(97 + clampedX)}{clampedY + 1} <span className="uppercase text-[10px] ml-1 opacity-50">Z:</span> {manualZ !== null ? manualZ : validation.landingZ ?? 0}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setManualZ(Math.max(0, (manualZ !== null ? manualZ : validation.landingZ ?? 0) - 1))} className="w-8 h-8 bg-zinc-800 rounded-lg text-zinc-100 font-bold hover:bg-zinc-700">-</button>
                  <button onClick={() => setManualZ((manualZ !== null ? manualZ : validation.landingZ ?? 0) + 1)} className="w-8 h-8 bg-zinc-800 rounded-lg text-zinc-100 font-bold hover:bg-zinc-700">+</button>
                  {manualZ !== null && (
                    <button onClick={() => setManualZ(null)} className="px-3 h-8 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg text-[10px] font-black uppercase hover:bg-purple-600/40">자동</button>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRotate}
                disabled={mode === 'predict' && predictShape === '1x1'}
                className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 border border-zinc-800"
              >
                <RotateCw className="w-5 h-5" /> 회전 {rotationIndex + 1}/12
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
            {!validation.valid && (
              <p className="text-center text-xs font-bold text-rose-500">
                {translateReason(validation.reason || '')}
              </p>
            )}
            {mode === 'predict' && predictionGroups.length > 0 && (
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-zinc-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-400" /> 예측 목록
                  </span>
                  <button
                    onClick={handleClearPredictions}
                    className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg font-bold transition-all text-[10px] flex items-center gap-1.5 border border-zinc-800"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> 전체 지우기
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {predictionGroups.map((prediction, index) => {
                    const predictedPlayer = players.find((p) => p.id === prediction.playerId);
                    return (
                      <div
                        key={prediction.id}
                        className="w-full p-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full border border-white/10 shrink-0"
                              style={{ backgroundColor: predictedPlayer?.color }}
                            />
                            <span className="font-extrabold text-zinc-200 text-xs truncate">
                              예측 {index + 1} · {predictedPlayer?.name || prediction.playerId}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {prediction.cells.map((cell, cellIndex) => (
                              <span key={cellIndex} className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[8.5px] text-zinc-400">
                                {String.fromCharCode(97 + cell.x)}{cell.y + 1}(Z:{cell.z})
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePrediction(prediction.id)}
                          className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 flex items-center justify-center shrink-0 transition-colors"
                          title="예측 지우기"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hide the 3D board while the host presents the round result. */}
        {!(status === 'round_ended' && roundRevealed) && (() => {
          let currentPreviewCells: Coord[] = [];
          let currentPredictedCells = predictions.map(c => ({
            x: c.x, y: c.y, z: c.z, color: players.find(p => p.id === c.playerId)?.color || '#fff'
          }));

          if (selectedHistoryMoveId) {
            currentPreviewCells = historyCells;
          } else if (mode === 'action' && isMyTurn) {
            // Float the actionable block directly above the 6-cell-high board.
            currentPreviewCells = validation.cells.map(c => ({
              ...c,
              z: c.z - (validation.landingZ ?? 0) + BOARD_HEIGHT
            }));
            // Show the landing spot as a ghost block
            const ghostColor = validation.valid ? (activeColor || '#ffffff') : '#ef4444';
            currentPredictedCells = validation.cells.map(c => ({
              x: c.x, y: c.y, z: c.z, color: ghostColor
            }));
          } else if (mode === 'predict') {
            currentPreviewCells = validation.cells;
          }

          return (
            <div className={`w-full max-w-xl bg-zinc-900/40 rounded-[32px] p-4 border flex flex-col items-center shadow-2xl mb-6 relative overflow-hidden transition-colors ${
              isShaking ? 'border-rose-500 bg-rose-500/5 animate-shake' : 'border-zinc-800'
            }`}>
              {mode === 'predict' && (
                <div className="absolute inset-0 bg-purple-500/5 pointer-events-none" />
              )}

              <BoardIsometric
                board={visibleBoard}
                players={players}
                predictedCells={currentPredictedCells}
                previewCells={currentPreviewCells}
                isPreviewValid={selectedHistoryMoveId ? historyMove?.valid : validation.valid}
                previewColor={selectedHistoryMoveId && canInspectHistoryMove ? (historyMove?.valid ? (players.find(p => p.id === historyMove.playerId)?.color || '#22c55e') : '#ef4444') : (!validation.valid ? '#ef4444' : activeColor)}
                onCellClick={handleCellClick}
                isHistoryPreview={!!selectedHistoryMoveId}
                effectEvent={effectEvent}
              />
            </div>
          );
        })()}

        {/* 2D Top View Share Grid for Round End */}
        {status === 'round_ended' && roundRevealed && (
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-6 mb-6 text-center space-y-5 shadow-xl">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <Eye className="w-4 h-4" /> 라운드 탑 뷰 영토 점유율
            </h3>
            <div className="grid grid-cols-6 gap-2 sm:gap-2.5 w-full max-w-md aspect-square mx-auto bg-zinc-950 p-3 sm:p-4 rounded-2xl border border-zinc-900 shadow-inner">
              {Array.from({ length: BOARD_SIZE }, (_, y) =>
                Array.from({ length: BOARD_SIZE }, (_, x) => {
                  const cell = sharedTopView[x][y];
                  const pColor = cell.playerId ? players.find((p) => p.id === cell.playerId)?.color : null;
                  return (
                    <div
                      key={`${x}-${y}`}
                      className="rounded-lg sm:rounded-xl aspect-square border border-white/5 flex items-center justify-center font-black text-xs text-white shadow-sm transition-all"
                      style={{ backgroundColor: pColor || '#f3f4f6', boxShadow: cell.playerId ? 'inset 0 0 0 1px rgba(17,24,39,0.08)' : 'none' }}
                    >
                      {cell.playerId ? cell.playerId : ''}
                    </div>
                  );
                })
              )}
            </div>
            {/* Grid ratio info */}
            <div className="w-full max-w-md mx-auto space-y-2.5 pt-3 text-left border-t border-zinc-800">
              {players.map((p) => {
                const cellCount = sharedTopView.flat().filter((cell) => cell.playerId === p.id).length;
                const percent = Math.round((cellCount / BOARD_CELL_COUNT) * 100);
                return (
                  <div key={p.id} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full border border-white/10" style={{ backgroundColor: p.color }} />
                      <span className="font-extrabold text-zinc-300">{p.name}</span>
                    </div>
                    <span className="font-mono text-zinc-400 font-bold">{cellCount} 칸 ({percent}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Log Tab Panel */}
        {mode === 'log' && !(status === 'round_ended' && roundRevealed) && (
          <div className="w-full max-w-sm space-y-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold text-zinc-400 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="w-4 h-4 text-indigo-400" /> 공개된 탑뷰 기록
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">{topViewHistory.length}</span>
              </div>

              {topViewHistory.length === 0 ? (
                <div className="text-center py-5 text-zinc-600 text-xs font-bold">
                  아직 공개된 탑뷰가 없습니다.
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {[...topViewHistory].reverse().map((entry) => {
                      const isSelected = selectedTopViewEntry?.round === entry.round;
                      return (
                        <button
                          key={entry.round}
                          onClick={() => setSelectedTopViewRound(entry.round)}
                          className={`px-3 py-2 rounded-xl border text-[10px] font-black shrink-0 transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-zinc-950/50 text-zinc-400 border-zinc-800 hover:text-white'
                          }`}
                        >
                          {entry.round}R 탑뷰
                        </button>
                      );
                    })}
                  </div>

                  {selectedTopViewEntry && (
                    <TopViewGrid
                      topView={selectedTopViewEntry.topView}
                      players={players}
                      className="pt-1"
                    />
                  )}
                </>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
              <div className="text-xs font-bold text-zinc-400 mb-2 flex justify-between items-center">
                <span>배치 기록 (클릭하여 위치 확인)</span>
                {selectedHistoryMoveId && (
                  <button
                    onClick={() => setSelectedHistoryMoveId(null)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 transition-colors"
                  >
                    미리보기 해제
                  </button>
                )}
              </div>
              {moves.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-xs font-bold uppercase tracking-wider">
                  기록된 행동이 없습니다.
                </div>
              ) : (
                [...moves].reverse().map((move) => {
                  const p = players.find((pl) => pl.id === move.playerId);
                  const isSelected = selectedHistoryMoveId === move.id;
                  const canInspectMove = move.playerId === playerId;
                  return (
                    <button
                      key={move.id}
                      onClick={() => {
                        if (canInspectMove) {
                          setSelectedHistoryMoveId(isSelected ? null : move.id);
                        }
                      }}
                      disabled={!canInspectMove}
                      className={`w-full text-left p-3 border rounded-xl flex justify-between items-center transition-all ${
                        isSelected
                          ? 'bg-indigo-650/20 border-indigo-500/50 shadow-lg ring-1 ring-indigo-500/30'
                          : canInspectMove
                            ? 'bg-zinc-950/40 border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800'
                            : 'bg-zinc-950/20 border-zinc-900 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ backgroundColor: p?.color }} />
                          <span className="font-extrabold text-zinc-200 text-xs">{p?.name || move.playerId}</span>
                        </div>
                        <span className="text-[9.5px] text-zinc-500 block font-mono">
                          라운드 {move.round} · {move.valid ? `슬롯 ${move.turnIndex + 1}` : '패스'}
                        </span>
                        {move.valid && canInspectMove && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {move.cells.map((c, i) => (
                              <span key={i} className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[8.5px] text-zinc-400">
                                {String.fromCharCode(97 + c.x)}{c.y + 1}(Z:{c.z})
                              </span>
                            ))}
                          </div>
                        )}
                        {!canInspectMove && (
                          <span className="text-[9px] text-zinc-600 font-bold">상대 배치 위치는 공개되지 않습니다</span>
                        )}
                      </div>
                      <div>
                        {move.valid ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-black text-[9px] uppercase tracking-wider">유효</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md font-black text-[9px] uppercase tracking-wider">스킵</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

      </main>

      {/* Round Start Overlay */}
      {showRoundOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/90 transition-all animate-fade-in duration-300">
          <div className="text-center space-y-4 max-w-sm px-6">
            <div className="text-[10px] bg-indigo-500/20 text-indigo-600 border border-indigo-500/30 px-3 py-1.5 rounded-full font-bold uppercase tracking-widest inline-block">
              ROUND START
            </div>
            <h1 className="text-5xl font-black text-zinc-100 tracking-tight">
              {announcedRound ?? round}라운드 시작!
            </h1>
            <p className="text-zinc-400 text-xs font-bold tracking-wide leading-relaxed">
              새로운 블록 배치가 시작됩니다. 상대방의 블록 위치를 예측해 보세요.
            </p>
            <div className="w-12 h-1 bg-indigo-500 mx-auto rounded-full mt-6" />
          </div>
        </div>
      )}

    </div>
  );
}
