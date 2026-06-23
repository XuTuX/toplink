import { GameState, Player, PlayerId, applyMove, calculateResults, getCurrentPlayer } from '../rules/index';

interface Room {
  roomCode: string;
  hostSocketId: string;
  gameState: GameState;
  players: Player[]; // Connected players
}

const rooms = new Map<string, Room>();

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
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
});

const DEFAULT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308'];

export const createRoom = (hostSocketId: string): string => {
  let roomCode = generateRoomCode();
  while (rooms.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  rooms.set(roomCode, {
    roomCode,
    hostSocketId,
    gameState: getInitialState(roomCode),
    players: [],
  });

  return roomCode;
};

export const getRoom = (roomCode: string): Room | undefined => {
  return rooms.get(roomCode);
};

export const addPlayer = (roomCode: string, nickname: string): { success: boolean, message?: string, playerId?: PlayerId } => {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, message: 'Room not found' };
  if (room.gameState.status !== 'setup') return { success: false, message: 'Game has already started' };
  if (room.players.length >= 4) return { success: false, message: 'Room is full' };
  if (room.players.some((player) => player.name.toLowerCase() === nickname.toLowerCase())) {
    return { success: false, message: 'Nickname is already in use' };
  }

  const playerId = (['P1', 'P2', 'P3', 'P4'] as PlayerId[]).find(
    (id) => !room.players.some((player) => player.id === id)
  );
  if (!playerId) return { success: false, message: 'Room is full' };
  const newPlayer: Player = {
    id: playerId,
    name: nickname,
    color: DEFAULT_COLORS[room.players.length % DEFAULT_COLORS.length],
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

  let newRound = room.gameState.round;
  let newTurnIndex = room.gameState.turnIndexInRound + 1;
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
      newRound += 1;
      newTurnIndex = 0;
    }
  }

  room.gameState = {
    ...room.gameState,
    round: newRound,
    turnIndexInRound: newTurnIndex,
    status: newStatus,
    moves: [...room.gameState.moves, skipMove],
    result: finalResult,
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
