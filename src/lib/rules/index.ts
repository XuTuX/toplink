import { BLOCK_ROTATIONS, BlockShape } from './rotations';

export const BOARD_SIZE = 6;
export const BOARD_HEIGHT = 6;
export const BOARD_CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export type PlayerId = 'P1' | 'P2' | 'P3' | 'P4';

export interface Player {
  id: PlayerId;
  name: string;
  color: string; // e.g. 'Blue', 'Red', 'Green', 'Yellow' or CSS color code
  password?: string;
}

export interface Coord {
  x: number; // 0~5
  y: number; // 0~5
  z: number; // >= 0
}

export interface PlacedCell {
  x: number;
  y: number;
  z: number;
  playerId: PlayerId;
  blockId: string;
  turnId: string;
}

export interface Move {
  id: string;
  round: number;
  turnIndex: number;
  playerId: PlayerId;
  origin: Coord;
  rotationIndex: number;
  cells: Coord[];
  valid: boolean;
  invalidReason?: string;
  createdAt: string;
}

export interface TopViewCell {
  x: number;
  y: number;
  playerId: PlayerId | null;
  z: number | null;
}

export interface PlayerResult {
  playerId: PlayerId;
  largestConnectionSize: number;
  largestConnectionCells: { x: number; y: number }[];
  score: number;
  topViewCellCount: number;
  heightScore: number; // Sum of z coordinates of player's cubes on the board
  rank: number;
}

export interface GameResult {
  topView: TopViewCell[][];
  playerResults: PlayerResult[];
  winnerIds: PlayerId[];
}

export interface GameState {
  id: string;
  status: 'setup' | 'playing' | 'end_pending' | 'ended' | 'round_ended';
  players: Player[];
  baseTurnOrder: PlayerId[];
  round: number;
  turnIndexInRound: number; // 0 to 3
  board: PlacedCell[];
  moves: Move[];
  endPending: boolean;
  endTriggeredByMoveId?: string;
  endTriggeredAtRound?: number;
  result?: GameResult;
  roundRevealed?: boolean;
  roundTopView?: TopViewCell[][] | null;
}

// 1. Generate Block Rotations (from rotations module)
export function generateBlockRotations(): BlockShape[] {
  return BLOCK_ROTATIONS;
}

// 2. Apply Rotation relative to an origin Coord
export function applyRotation(origin: Coord, rotation: BlockShape): Coord[] {
  return rotation.map((c) => ({
    x: origin.x + c.x,
    y: origin.y + c.y,
    z: origin.z + c.z,
  }));
}

// 3. Check if coord is inside the 6x6x6 board
export function isInsideBoard(cell: Coord): boolean {
  return cell.x >= 0 && cell.x < BOARD_SIZE
    && cell.y >= 0 && cell.y < BOARD_SIZE
    && cell.z >= 0 && cell.z < BOARD_HEIGHT;
}

// 4. Check if cell exists at coord
export function hasCell(board: PlacedCell[], coord: Coord): boolean {
  return board.some((c) => c.x === coord.x && c.y === coord.y && c.z === coord.z);
}

// Helper to check if a coordinate matches another coordinate in a simple array
export function hasCoord(coords: Coord[], coord: Coord): boolean {
  return coords.some((c) => c.x === coord.x && c.y === coord.y && c.z === coord.z);
}

// 5. Check if cell is supported
export function isCellSupported(
  cell: Coord,
  board: PlacedCell[],
  newCells: Coord[]
): boolean {
  if (cell.z === 0) return true;

  const below = {
    x: cell.x,
    y: cell.y,
    z: cell.z - 1,
  };

  return hasCell(board, below) || hasCoord(newCells, below);
}

// 5.5. Calculate Landing Z using gravity simulation
export function calculateLandingZ(
  board: PlacedCell[],
  x: number,
  y: number,
  rotationIndex: number
): number | null {
  const rotations = generateBlockRotations();
  if (rotationIndex < 0 || rotationIndex >= rotations.length) {
    return null;
  }
  const rotation = rotations[rotationIndex];

  // 1. Verify 2D boundaries for all cubes
  for (const c of rotation) {
    const rx = x + c.x;
    const ry = y + c.y;
    if (rx < 0 || rx >= BOARD_SIZE || ry < 0 || ry >= BOARD_SIZE) {
      return null;
    }
  }

  // 2. Start from a high z and decrement until we hit a collision (overlap or below floor)
  let z = BOARD_HEIGHT;
  while (z >= -BOARD_HEIGHT) {
    let hasCollision = false;
    for (const c of rotation) {
      const cz = z + c.z;
      if (cz < 0 || board.some((bc) => bc.x === x + c.x && bc.y === y + c.y && bc.z === cz)) {
        hasCollision = true;
        break;
      }
    }
    if (hasCollision) {
      return z + 1;
    }
    z--;
  }
  return 0;
}

// 6. Validate Placement
export function validatePlacement(
  game: GameState,
  playerId: PlayerId,
  origin: { x: number; y: number; z?: number },
  rotationIndex: number,
  options: { allowOverlap?: boolean; allowFloating?: boolean } = {}
): {
  valid: boolean;
  cells: Coord[];
  reason?: string;
  landingZ?: number;
} {
  const rotations = generateBlockRotations();
  if (rotationIndex < 0 || rotationIndex >= rotations.length) {
    return { valid: false, cells: [], reason: 'Invalid rotation index' };
  }

  let landingZ = origin.z;
  if (landingZ === undefined) {
    const calc = calculateLandingZ(game.board, origin.x, origin.y, rotationIndex);
    if (calc === null) {
      return { valid: false, cells: [], reason: 'Out of board boundaries' };
    }
    landingZ = calc;
  }

  const resolvedOrigin: Coord = { x: origin.x, y: origin.y, z: landingZ };
  const cells = applyRotation(resolvedOrigin, rotations[rotationIndex]);

  // Rule 1: Must be inside board
  for (const cell of cells) {
    if (!isInsideBoard(cell)) {
      return { valid: false, cells, reason: `Cell (${cell.x}, ${cell.y}, ${cell.z}) is out of board boundaries`, landingZ };
    }
  }

  // Predictions can opt out of physical constraints, but authoritative moves cannot.
  if (!options.allowOverlap) {
    for (const cell of cells) {
      if (hasCell(game.board, cell)) {
        return { valid: false, cells, reason: `Cell (${cell.x}, ${cell.y}, ${cell.z}) overlaps with an existing cube`, landingZ };
      }
    }
  }

  if (!options.allowFloating) {
    for (const cell of cells) {
      if (!isCellSupported(cell, game.board, cells)) {
        return { valid: false, cells, reason: `Cell (${cell.x}, ${cell.y}, ${cell.z}) is floating (no support directly below)`, landingZ };
      }
    }
  }

  return { valid: true, cells, landingZ };
}

// Helper to rotate array by offset
export function rotateArray<T>(arr: T[], offset: number): T[] {
  const len = arr.length;
  if (len === 0) return [];
  const normalizedOffset = ((offset % len) + len) % len;
  return [...arr.slice(normalizedOffset), ...arr.slice(0, normalizedOffset)];
}

// 7. Get Current Turn Order (Snake Draft)
export function getCurrentTurnOrder(game: GameState): PlayerId[] {
  if (game.round % 2 === 0) {
    return [...game.baseTurnOrder].reverse();
  }
  return game.baseTurnOrder;
}

// 8. Get Current PlayerId
export function getCurrentPlayer(game: GameState): PlayerId {
  const order = getCurrentTurnOrder(game);
  return order[game.turnIndexInRound];
}

// 9. Column Height
export function getColumnHeight(board: PlacedCell[], x: number, y: number): number {
  const cells = board.filter((c) => c.x === x && c.y === y);
  if (cells.length === 0) return 0;
  return Math.max(...cells.map((c) => c.z)) + 1;
}

// 10. Max Height
export function getMaxHeight(board: PlacedCell[]): number {
  if (board.length === 0) return 0;
  return Math.max(...board.map((c) => c.z)) + 1;
}

// 11. Trigger the final round when the tower reaches the board ceiling.
export function shouldTriggerEnd(board: PlacedCell[]): boolean {
  return getMaxHeight(board) >= BOARD_HEIGHT;
}

// 12. Apply Move
export function applyMove(
  game: GameState,
  playerId: PlayerId,
  origin: { x: number; y: number; z?: number },
  rotationIndex: number
): GameState {
  if (game.status !== 'playing' && game.status !== 'end_pending') {
    return game;
  }

  // 1. Verify it's the player's turn
  const expectedPlayer = getCurrentPlayer(game);
  if (playerId !== expectedPlayer) {
    // If somehow another player tries to move, we can ignore or throw
    // For robust pure state transition, we reject it
    return game;
  }

  const moveId = `move_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const validation = validatePlacement(game, playerId, origin, rotationIndex);
  const landingZ = validation.landingZ ?? origin.z ?? 0;
  const resolvedOrigin: Coord = { x: origin.x, y: origin.y, z: landingZ };

  let updatedBoard = [...game.board];
  let endPending = game.endPending;
  let endTriggeredByMoveId = game.endTriggeredByMoveId;
  let endTriggeredAtRound = game.endTriggeredAtRound;

  // 2. Create Move log
  const newMove: Move = {
    id: moveId,
    round: game.round,
    turnIndex: game.turnIndexInRound,
    playerId,
    origin: resolvedOrigin,
    rotationIndex,
    cells: validation.cells,
    valid: validation.valid,
    invalidReason: validation.reason,
    createdAt: new Date().toISOString(),
  };

  if (validation.valid) {
    // 3. Add cubes to the board
    const blockId = `block_${moveId}`;
    const newPlacedCells: PlacedCell[] = validation.cells.map((c) => ({
      x: c.x,
      y: c.y,
      z: c.z,
      playerId,
      blockId,
      turnId: moveId,
    }));
    updatedBoard = [...updatedBoard, ...newPlacedCells];

    // 4. Check whether the board ceiling has been reached.
    const heightTriggered = shouldTriggerEnd(updatedBoard);
    if (heightTriggered && !endPending) {
      endPending = true;
      endTriggeredByMoveId = moveId;
      endTriggeredAtRound = game.round;
    }
  }

  // 5. Update turns
  const newRound = game.round;
  const newTurnIndex = game.turnIndexInRound + 1;
  let newStatus: GameState['status'] = game.status;
  let finalResult = game.result;

  // If round ends (all active seats acted)
  if (newTurnIndex >= game.baseTurnOrder.length) {
    if (endPending) {
      newStatus = 'ended';
      // Compute final results
      finalResult = calculateResultsInternal(updatedBoard, game.players);
    } else {
      // Set status to 'round_ended' instead of auto-incrementing
      newStatus = 'round_ended';
    }
  } else {
    // Round is still ongoing. If we are playing but already endPending was true before, keep it.
    newStatus = endPending ? 'end_pending' : 'playing';
  }

  return {
    ...game,
    status: newStatus,
    round: newRound,
    turnIndexInRound: newTurnIndex,
    board: updatedBoard,
    moves: [...game.moves, newMove],
    endPending,
    endTriggeredByMoveId,
    endTriggeredAtRound,
    result: finalResult,
    roundRevealed: newStatus === 'round_ended' ? false : game.roundRevealed,
    roundTopView: newStatus === 'round_ended' ? null : game.roundTopView,
  };
}

// 12.5. Start Next Round (Core transition)
export function startNextRound(game: GameState): GameState {
  if (game.status !== 'round_ended') {
    return game;
  }
  return {
    ...game,
    round: game.round + 1,
    turnIndexInRound: 0,
    status: game.endPending ? 'end_pending' : 'playing',
    roundRevealed: false,
    roundTopView: null,
  };
}

// 13. Compute Top View
export function computeTopView(board: PlacedCell[]): TopViewCell[][] {
  const topView: TopViewCell[][] = [];

  for (let x = 0; x < BOARD_SIZE; x++) {
    topView[x] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      // Find the cell with the highest z
      const columnCells = board.filter((c) => c.x === x && c.y === y);
      if (columnCells.length > 0) {
        const highest = columnCells.reduce((max, c) => (c.z > max.z ? c : max), columnCells[0]);
        topView[x][y] = {
          x,
          y,
          playerId: highest.playerId,
          z: highest.z,
        };
      } else {
        topView[x][y] = {
          x,
          y,
          playerId: null,
          z: null,
        };
      }
    }
  }

  return topView;
}

// 14. Find Largest Connected Area
export function findLargestConnectedArea(
  topView: TopViewCell[][],
  playerId: PlayerId
): {
  size: number;
  cells: { x: number; y: number }[];
} {
  const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
  let largestComponent: { x: number; y: number }[] = [];

  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (topView[x][y].playerId === playerId && !visited[x][y]) {
        // Start BFS
        const queue: { x: number; y: number }[] = [{ x, y }];
        const currentComponent: { x: number; y: number }[] = [];
        visited[x][y] = true;

        let head = 0;
        while (head < queue.length) {
          const curr = queue[head++];
          currentComponent.push(curr);

          for (const dir of directions) {
            const nx = curr.x + dir.dx;
            const ny = curr.y + dir.dy;

            if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
              if (topView[nx][ny].playerId === playerId && !visited[nx][ny]) {
                visited[nx][ny] = true;
                queue.push({ x: nx, y: ny });
              }
            }
          }
        }

        if (currentComponent.length > largestComponent.length) {
          largestComponent = currentComponent;
        }
      }
    }
  }

  return {
    size: largestComponent.length,
    cells: largestComponent,
  };
}

// Internal helper to calculate results from board and players list
function calculateResultsInternal(board: PlacedCell[], players: Player[]): GameResult {
  const topView = computeTopView(board);

  // Compute stats for each player
  const playerResults: PlayerResult[] = players.map((player) => {
    const conn = findLargestConnectedArea(topView, player.id);
    const score = conn.size * conn.size;

    // Count cells in top view
    let topViewCellCount = 0;
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        if (topView[x][y].playerId === player.id) {
          topViewCellCount++;
        }
      }
    }

    // Height score: sum of z of all their cubes on the board
    const playerCubes = board.filter((c) => c.playerId === player.id);
    const heightScore = playerCubes.reduce((sum, c) => sum + c.z, 0);

    return {
      playerId: player.id,
      largestConnectionSize: conn.size,
      largestConnectionCells: conn.cells,
      score,
      topViewCellCount,
      heightScore,
      rank: 1, // Will be calculated next
    };
  });

  // Calculate ranks
  // Sort copy of results by rules:
  // 1. score DESC
  // 2. topViewCellCount DESC
  // 3. heightScore DESC
  const sorted = [...playerResults].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.topViewCellCount !== a.topViewCellCount) return b.topViewCellCount - a.topViewCellCount;
    return b.heightScore - a.heightScore;
  });

  // Map ranking
  const rankMap = new Map<PlayerId, number>();
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const isTie =
        curr.score === prev.score &&
        curr.topViewCellCount === prev.topViewCellCount &&
        curr.heightScore === prev.heightScore;
      if (!isTie) {
        currentRank = i + 1;
      }
    }
    rankMap.set(sorted[i].playerId, currentRank);
  }

  // Apply ranks to results
  playerResults.forEach((r) => {
    r.rank = rankMap.get(r.playerId) || 1;
  });

  // Winners are those with rank 1
  const winnerIds = playerResults.filter((r) => r.rank === 1).map((r) => r.playerId);

  return {
    topView,
    playerResults,
    winnerIds,
  };
}

// 15. Calculate Results (public wrapper)
export function calculateResults(game: GameState): GameResult {
  return calculateResultsInternal(game.board, game.players);
}
