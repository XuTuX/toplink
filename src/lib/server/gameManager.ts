import { GameState, Player, PlayerId, TopViewCell, TopViewHistoryEntry, applyMove, calculateResults, computeTopView, getCurrentPlayer, startNextRound as rulesStartNextRound } from '../rules/index';

interface Room {
  roomCode: string;
  hostSocketId: string;
  hostSecret: string;
  gameState: GameState;
  players: Player[]; // Connected players
}

const rooms = new Map<string, Room>();

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

const generateHostSecret = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const getInitialState = (id: string): GameState => ({
  id,
  status: 'setup',
  players: [],
  baseTurnOrder: [],
  round: 1,
  turnIndexInRound: 0,
  board: [],
  moves: [],
  endPending: false,
  roundRevealed: false,
  roundTopView: null,
  topViewHistory: [],
});

const withoutPasswords = (players: Player[]): Player[] => players.map((player) => ({
  id: player.id,
  name: player.name,
  color: player.color,
}));

const withoutHeight = (topView: TopViewCell[][] | null | undefined): TopViewCell[][] | null | undefined => {
  if (topView == null) return topView;
  return topView.map((column) => column.map((cell) => ({ ...cell, z: null })));
};

const withoutHeightHistory = (history: TopViewHistoryEntry[]): TopViewHistoryEntry[] => (
  history.map((entry) => ({
    ...entry,
    topView: withoutHeight(entry.topView) ?? [],
  }))
);

const upsertTopViewHistoryEntry = (
  history: TopViewHistoryEntry[],
  entry: TopViewHistoryEntry
): TopViewHistoryEntry[] => {
  const withoutCurrentRound = history.filter((item) => item.round !== entry.round);
  return [...withoutCurrentRound, entry].sort((a, b) => a.round - b.round);
};

export const getHostGameState = (state: GameState): GameState => ({
  ...state,
  players: withoutPasswords(state.players),
});

export const getPlayerGameState = (state: GameState, playerId: PlayerId): GameState => ({
  ...state,
  players: withoutPasswords(state.players),
  board: state.board.filter((cell) => cell.playerId === playerId),
  moves: state.moves.map((move) => move.playerId === playerId ? move : {
    ...move,
    origin: { x: 0, y: 0, z: 0 },
    rotationIndex: 0,
    cells: [],
    invalidReason: undefined,
  }),
  roundTopView: withoutHeight(state.roundTopView),
  result: state.result ? {
    ...state.result,
    topView: withoutHeight(state.result.topView) ?? [],
  } : undefined,
  topViewHistory: withoutHeightHistory(state.topViewHistory ?? []),
});

const DEFAULT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308'];

export const createRoom = (hostSocketId: string): { roomCode: string, hostSecret: string } => {
  let roomCode = generateRoomCode();
  while (rooms.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  const hostSecret = generateHostSecret();

  rooms.set(roomCode, {
    roomCode,
    hostSocketId,
    hostSecret,
    gameState: getInitialState(roomCode),
    players: [],
  });

  return { roomCode, hostSecret };
};

export const rejoinHost = (roomCode: string, hostSecret: string, newSocketId: string): boolean => {
  const room = rooms.get(roomCode);
  if (!room) return false;
  
  if (room.hostSecret === hostSecret) {
    room.hostSocketId = newSocketId;
    return true;
  }
  return false;
};

export const getRoom = (roomCode: string): Room | undefined => {
  return rooms.get(roomCode);
};

export const addPlayer = (roomCode: string, nickname: string, password?: string): { success: boolean, message?: string, playerId?: PlayerId } => {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, message: 'Room not found' };

  // 1. Check for reconnection: if the nickname already exists in the room
  const existingPlayer = room.players.find(
    (player) => player.name.toLowerCase() === nickname.toLowerCase()
  );
  if (existingPlayer) {
    if (existingPlayer.password && existingPlayer.password === password) {
      // Return their existing playerId so they can reconnect
      return { success: true, playerId: existingPlayer.id };
    } else {
      return { success: false, message: 'Invalid password or nickname is already in use' };
    }
  }

  if (room.gameState.status !== 'setup') return { success: false, message: 'Game has already started' };
  if (room.players.length >= 4) return { success: false, message: 'Room is full' };

  const playerId = (['P1', 'P2', 'P3', 'P4'] as PlayerId[]).find(
    (id) => !room.players.some((player) => player.id === id)
  );
  if (!playerId) return { success: false, message: 'Room is full' };
  
  const newPlayer: Player = {
    id: playerId,
    name: nickname,
    color: DEFAULT_COLORS[room.players.length % DEFAULT_COLORS.length],
    password: password,
  };

  room.players.push(newPlayer);
  room.gameState.players = room.players;
  room.gameState.baseTurnOrder.push(playerId);

  return { success: true, playerId };
};

export const startGame = (roomCode: string, hostSocketId: string): boolean => {
  const room = rooms.get(roomCode);
  if (!room || room.hostSocketId !== hostSocketId) return false;
  if (room.players.length < 1) return false; // In a real game maybe at least 2, but 1 is fine for testing

  room.gameState.status = 'playing';
  return true;
};

export const processMove = (roomCode: string, playerId: PlayerId, origin: { x: number, y: number, z?: number }, rotationIndex: number): boolean => {
  const room = rooms.get(roomCode);
  if (!room) return false;
  if (room.gameState.status !== 'playing' && room.gameState.status !== 'end_pending') return false;

  const currentPlayer = getCurrentPlayer(room.gameState);
  if (playerId !== currentPlayer) return false;

  try {
    room.gameState = applyMove(room.gameState, playerId, origin, rotationIndex);
    return true;
  } catch (error) {
    console.error("Invalid move:", error);
    return false;
  }
};

export const forceSkipTurn = (roomCode: string, hostSocketId: string): boolean => {
  const room = rooms.get(roomCode);
  if (!room || room.hostSocketId !== hostSocketId) return false;
  if (room.gameState.status !== 'playing' && room.gameState.status !== 'end_pending') return false;

  const playerId = getCurrentPlayer(room.gameState);

  const moveId = `skip_${Date.now()}`;
  const skipMove = {
    id: moveId,
    round: room.gameState.round,
    turnIndex: room.gameState.turnIndexInRound,
    playerId,
    origin: { x: 0, y: 0, z: 0 },
    rotationIndex: 0,
    cells: [],
    valid: false,
    invalidReason: 'Forced skip by dealer',
    createdAt: new Date().toISOString(),
  };

  const newRound = room.gameState.round;
  const newTurnIndex = room.gameState.turnIndexInRound + 1;
  let newStatus: GameState['status'] = room.gameState.status;
  let finalResult = room.gameState.result;

  if (newTurnIndex >= room.players.length) {
    if (room.gameState.endPending) {
      newStatus = 'ended';
      finalResult = calculateResults({
        ...room.gameState,
        board: room.gameState.board,
      });
    } else {
      newStatus = 'round_ended';
    }
  }

  room.gameState = {
    ...room.gameState,
    round: newRound,
    turnIndexInRound: newTurnIndex,
    status: newStatus,
    moves: [...room.gameState.moves, skipMove],
    result: finalResult,
    roundRevealed: newStatus === 'round_ended' ? false : room.gameState.roundRevealed,
    roundTopView: newStatus === 'round_ended' ? null : room.gameState.roundTopView,
  };

  return true;
};

export const forceEndGame = (roomCode: string, hostSocketId: string): boolean => {
  const room = rooms.get(roomCode);
  if (!room || room.hostSocketId !== hostSocketId) return false;
  if (room.gameState.status === 'setup' || room.gameState.status === 'ended') return false;

  room.gameState.status = 'ended';
  room.gameState.endPending = true;
  room.gameState.result = calculateResults(room.gameState);
  return true;
};

export const kickPlayer = (roomCode: string, hostSocketId: string, playerId: PlayerId): boolean => {
  const room = rooms.get(roomCode);
  if (!room || room.hostSocketId !== hostSocketId) return false;

  // Actually we should just remove them or mark them as kicked.
  // For simplicity, we just keep their blocks but skip their turns.
  // Or remove them from baseTurnOrder if setup.
  if (room.gameState.status === 'setup') {
    room.players = room.players.filter(p => p.id !== playerId);
    room.gameState.players = room.players;
    room.gameState.baseTurnOrder = room.gameState.baseTurnOrder.filter(id => id !== playerId);
    return true;
  }

  // If in game, we can't just remove them, we might need to mark them as 'surrendered' or similar,
  // but rules/index.ts might not have this. For now, skipping their turn might be the best we can do.
  return false;
};

export const resetGame = (roomCode: string, hostSocketId: string): boolean => {
  const room = rooms.get(roomCode);
  if (!room || room.hostSocketId !== hostSocketId) return false;

  const currentPlayers = room.players;
  const currentBaseOrder = room.gameState.baseTurnOrder;

  room.gameState = {
    ...getInitialState(roomCode),
    players: currentPlayers,
    baseTurnOrder: currentBaseOrder,
  };
  return true;
};

export const revealRound = (roomCode: string, hostSocketId: string): boolean => {
  const room = rooms.get(roomCode);
  if (!room || room.hostSocketId !== hostSocketId) return false;
  if (room.gameState.status !== 'round_ended') return false;

  room.gameState.roundRevealed = true;
  const revealedTopView = withoutHeight(computeTopView(room.gameState.board)) ?? [];
  room.gameState.roundTopView = revealedTopView;
  room.gameState.topViewHistory = upsertTopViewHistoryEntry(room.gameState.topViewHistory ?? [], {
    round: room.gameState.round,
    revealedAt: new Date().toISOString(),
    topView: revealedTopView,
  });
  return true;
};

export const startNextRound = (roomCode: string, hostSocketId: string): boolean => {
  const room = rooms.get(roomCode);
  if (!room || room.hostSocketId !== hostSocketId) return false;
  if (room.gameState.status !== 'round_ended') return false;
  if (!room.gameState.roundRevealed) return false;

  room.gameState = rulesStartNextRound(room.gameState);
  return true;
};
