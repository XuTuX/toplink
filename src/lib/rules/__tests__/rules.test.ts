import { describe, it, expect } from 'vitest';
import {
  GameState,
  validatePlacement,
  applyMove,
  computeTopView,
  findLargestConnectedArea,
  calculateResults,
  getCurrentTurnOrder,
  getCurrentPlayer,
  Player,
  startNextRound
} from '../index';

const INITIAL_PLAYERS: Player[] = [
  { id: 'P1', name: 'Player 1', color: 'blue' },
  { id: 'P2', name: 'Player 2', color: 'red' },
  { id: 'P3', name: 'Player 3', color: 'green' },
  { id: 'P4', name: 'Player 4', color: 'yellow' },
];

const createEmptyGame = (): GameState => ({
  id: 'test-game',
  status: 'playing',
  players: INITIAL_PLAYERS,
  baseTurnOrder: ['P1', 'P2', 'P3', 'P4'],
  round: 1,
  turnIndexInRound: 0,
  board: [],
  moves: [],
  endPending: false,
});

describe('Top Link Rules Engine', () => {
  describe('Placement Validation', () => {
    it('should validate normal placement on the ground (z=0)', () => {
      const game = createEmptyGame();
      // Rotation Index 4 is: (0,0,0), (1,0,0), (0,0,1)
      const res = validatePlacement(game, 'P1', { x: 0, y: 0, z: 0 }, 4);
      expect(res.valid).toBe(true);
      expect(res.cells).toEqual([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ]);
    });

    it('should invalidate placement outside the board', () => {
      const game = createEmptyGame();
      const res = validatePlacement(game, 'P1', { x: 5, y: 5, z: 0 }, 4); // goes to x=6
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('out of board boundaries');
    });

    it('should invalidate placement that overlaps existing cells', () => {
      let game = createEmptyGame();
      // Place a block at (0,0,0)
      game = applyMove(game, 'P1', { x: 0, y: 0, z: 0 }, 4);
      
      // Try to place another block overlapping at (0,0,0)
      const res = validatePlacement(game, 'P2', { x: 0, y: 0, z: 0 }, 4);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('overlaps');
    });

    it('should invalidate placement if a cell is floating (z > 0 with no support)', () => {
      const game = createEmptyGame();
      // Try to place at z=1, but the ground below is completely empty
      const res = validatePlacement(game, 'P1', { x: 0, y: 0, z: 1 }, 4);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('floating');
    });

    it('should validate placement at z > 0 if supported by existing cells', () => {
      let game = createEmptyGame();
      // Place a flat block at z=0: (0,0,0), (1,0,0), (0,1,0) (Rotation 0)
      game = applyMove(game, 'P1', { x: 0, y: 0, z: 0 }, 0);
      
      // Now place another block on top of it at z=1.
      // Rotation 4: (0,0,1), (1,0,1), (0,0,2) relative to origin (0,0,1)
      const res = validatePlacement(game, 'P2', { x: 0, y: 0, z: 1 }, 4);
      expect(res.valid).toBe(true);
    });

    it('should validate vertical placement supported by its own block cells', () => {
      const game = createEmptyGame();
      // Rotation 4: (0,0,0), (1,0,0), (0,0,1)
      // Cell (0,0,1) is at z=1. Its support cell is (0,0,0), which is in the same block!
      const res = validatePlacement(game, 'P1', { x: 0, y: 0, z: 0 }, 4);
      expect(res.valid).toBe(true);
    });
  });

  describe('Gravity-based Placement Validation', () => {
    it('should automatically compute landing Z on empty board', () => {
      const game = createEmptyGame();
      // Rotation 4: (0,0,0), (1,0,0), (0,0,1)
      // Omit Z
      const res = validatePlacement(game, 'P1', { x: 0, y: 0 }, 4);
      expect(res.valid).toBe(true);
      expect(res.landingZ).toBe(0);
      expect(res.cells).toEqual([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ]);
    });

    it('should automatically stack blocks when using gravity', () => {
      let game = createEmptyGame();
      // Place first block flat at (0,0) (Rotation 0: (0,0,0), (1,0,0), (0,1,0))
      // Since it's gravity-based, we omit Z in applyMove
      game = applyMove(game, 'P1', { x: 0, y: 0 }, 0);
      expect(game.board.length).toBe(3);
      expect(game.board.every(c => c.z === 0)).toBe(true);

      // Now place another block on top of it at (0,0) (Rotation 4: (0,0,0), (1,0,0), (0,0,1) relative to origin)
      // Omit Z: it should land on top of the existing cells.
      const res = validatePlacement(game, 'P2', { x: 0, y: 0 }, 4);
      expect(res.valid).toBe(true);
      expect(res.landingZ).toBe(1);
      expect(res.cells).toEqual([
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 0, z: 1 },
        { x: 0, y: 0, z: 2 },
      ]);

      // Apply the move and verify the board updates correctly
      game = applyMove(game, 'P2', { x: 0, y: 0 }, 4);
      expect(game.board.length).toBe(6);
      
      const p2Cells = game.board.filter(c => c.playerId === 'P2').map(c => ({ x: c.x, y: c.y, z: c.z }));
      expect(p2Cells).toContainEqual({ x: 0, y: 0, z: 1 });
      expect(p2Cells).toContainEqual({ x: 1, y: 0, z: 1 });
      expect(p2Cells).toContainEqual({ x: 0, y: 0, z: 2 });
    });
  });

  describe('Top View Calculation', () => {
    it('should correctly project player colors to top view, masking lower layers', () => {
      let game = createEmptyGame();
      // P1 places flat block at z=0: (0,0,0), (1,0,0), (0,1,0)
      game = applyMove(game, 'P1', { x: 0, y: 0, z: 0 }, 0);
      // P2 places block on top at z=1: (0,0,1), (1,0,1), (0,0,2)
      game = applyMove(game, 'P2', { x: 0, y: 0, z: 1 }, 4);

      const topView = computeTopView(game.board);
      // At (0,0), highest cell is z=2 (P2)
      expect(topView[0][0].playerId).toBe('P2');
      expect(topView[0][0].z).toBe(2);

      // At (1,0), highest cell is z=1 (P2)
      expect(topView[1][0].playerId).toBe('P2');
      expect(topView[1][0].z).toBe(1);

      // At (0,1), highest cell is z=0 (P1) because P2's block didn't cover it
      expect(topView[0][1].playerId).toBe('P1');
      expect(topView[0][1].z).toBe(0);

      // Empty cell
      expect(topView[2][2].playerId).toBeNull();
      expect(topView[2][2].z).toBeNull();
    });
  });

  describe('Largest Connection Scoring', () => {
    it('should calculate connections orthogonally and ignore diagonals', () => {
      // Create a mock top view
      const topView = Array.from({ length: 6 }, (_, x) =>
        Array.from({ length: 6 }, (_, y) => ({
          x,
          y,
          playerId: null as string | null,
          z: null as number | null,
        }))
      );

      // Connect 3 cells of P1 orthogonally: (0,0), (0,1), (1,1)
      topView[0][0].playerId = 'P1';
      topView[0][1].playerId = 'P1';
      topView[1][1].playerId = 'P1';

      // Place a diagonal cell of P1 at (2,2) - should not connect
      topView[2][2].playerId = 'P1';

      const res = findLargestConnectedArea(topView, 'P1');
      expect(res.size).toBe(3);
      expect(res.cells).toContainEqual({ x: 0, y: 0 });
      expect(res.cells).toContainEqual({ x: 0, y: 1 });
      expect(res.cells).toContainEqual({ x: 1, y: 1 });
      expect(res.cells).not.toContainEqual({ x: 2, y: 2 });
    });

    it('should return score as size squared (n^2)', () => {
      let game = createEmptyGame();
      // P1 places flat block: (0,0,0), (1,0,0), (0,1,0) (3 connected cells)
      game = applyMove(game, 'P1', { x: 0, y: 0, z: 0 }, 0);
      
      const results = calculateResults(game);
      const p1Result = results.playerResults.find((r) => r.playerId === 'P1');
      expect(p1Result?.largestConnectionSize).toBe(3);
      expect(p1Result?.score).toBe(9); // 3^2
    });
  });

  describe('Turn Management & Round Progression', () => {
    it('should correctly rotate starting player round-by-round', () => {
      let game = createEmptyGame();
      expect(getCurrentPlayer(game)).toBe('P1');
      expect(getCurrentTurnOrder(game)).toEqual(['P1', 'P2', 'P3', 'P4']);

      // Advance 4 turns (round 1 ends)
      game = applyMove(game, 'P1', { x: 0, y: 0, z: 0 }, 4); // P1
      game = applyMove(game, 'P2', { x: 2, y: 0, z: 0 }, 4); // P2
      game = applyMove(game, 'P3', { x: 0, y: 2, z: 0 }, 4); // P3
      game = applyMove(game, 'P4', { x: 2, y: 2, z: 0 }, 4); // P4

      expect(game.status).toBe('round_ended');

      const blockedMove = applyMove(game, 'P4', { x: 4, y: 4, z: 0 }, 0);
      expect(blockedMove).toBe(game);

      game = startNextRound(game);

      expect(game.round).toBe(2);
      expect(game.turnIndexInRound).toBe(0);
      expect(getCurrentPlayer(game)).toBe('P4');
      expect(getCurrentTurnOrder(game)).toEqual(['P4', 'P3', 'P2', 'P1']);
    });

    it('should consume turn and progress even if move is invalid', () => {
      let game = createEmptyGame();
      expect(getCurrentPlayer(game)).toBe('P1');

      // Make an invalid move (out of boundaries)
      game = applyMove(game, 'P1', { x: 5, y: 5, z: 0 }, 4);
      expect(game.moves[0].valid).toBe(false);
      expect(game.board.length).toBe(0); // block not placed
      expect(game.turnIndexInRound).toBe(1); // turn advanced
      expect(getCurrentPlayer(game)).toBe('P2'); // next player's turn
    });

    it('should trigger end pending when height >= 5 and end at the end of the round', () => {
      let game = createEmptyGame();
      // Setup the board so one column is at z=4 (height 5)
      // We will place blocks on top of each other.
      // Rotation 0: (0,0,0), (1,0,0), (0,1,0) at z=0
      game = applyMove(game, 'P1', { x: 0, y: 0, z: 0 }, 0); // P1
      game = applyMove(game, 'P2', { x: 2, y: 0, z: 0 }, 0); // P2
      game = applyMove(game, 'P3', { x: 0, y: 2, z: 0 }, 0); // P3
      game = applyMove(game, 'P4', { x: 2, y: 2, z: 0 }, 0); // P4 (End Round 1)
      game = startNextRound(game);

      // Round 2
      game = applyMove(game, 'P4', { x: 0, y: 0, z: 1 }, 0); // P4 (z=1)
      game = applyMove(game, 'P3', { x: 2, y: 0, z: 1 }, 0); // P3 (z=1)
      game = applyMove(game, 'P2', { x: 0, y: 2, z: 1 }, 0); // P2 (z=1)
      game = applyMove(game, 'P1', { x: 2, y: 2, z: 1 }, 0); // P1 (z=1) (End Round 2)
      game = startNextRound(game);

      // Round 3
      game = applyMove(game, 'P1', { x: 0, y: 0, z: 2 }, 0); // P1 (z=2)
      game = applyMove(game, 'P2', { x: 2, y: 0, z: 2 }, 0); // P2 (z=2)
      game = applyMove(game, 'P3', { x: 0, y: 2, z: 2 }, 0); // P3 (z=2)
      game = applyMove(game, 'P4', { x: 2, y: 2, z: 2 }, 0); // P4 (z=2) (End Round 3)
      game = startNextRound(game);

      // Round 4
      game = applyMove(game, 'P4', { x: 0, y: 0, z: 3 }, 0); // P4 (z=3)
      game = applyMove(game, 'P3', { x: 2, y: 0, z: 3 }, 0); // P3 (z=3)
      game = applyMove(game, 'P2', { x: 0, y: 2, z: 3 }, 0); // P2 (z=3)
      game = applyMove(game, 'P1', { x: 2, y: 2, z: 3 }, 0); // P1 (z=3) (End Round 4)
      game = startNextRound(game);

      // Round 5 - Player 1 places a block.
      // Rotation 4: relative coords are (0,0,0), (1,0,0), (0,0,1).
      // Placing at origin (0,0,4) -> cubes at (0,0,4), (1,0,4), (0,0,5).
      // This will make column (0,0) reach height 6 (z=5).
      expect(game.endPending).toBe(false);
      game = applyMove(game, 'P1', { x: 0, y: 0, z: 4 }, 4); // P1 (z=4, z=5)
      
      expect(game.endPending).toBe(true); // height >= 5 reached
      expect(game.status).toBe('end_pending'); // game is in pending state

      // Other players must still get their turn in this round (Round 5: P2, P3, P4)
      game = applyMove(game, 'P2', { x: 2, y: 0, z: 4 }, 4); // P2
      expect(game.status).toBe('end_pending');

      game = applyMove(game, 'P3', { x: 0, y: 2, z: 4 }, 4); // P3
      expect(game.status).toBe('end_pending');

      game = applyMove(game, 'P4', { x: 2, y: 2, z: 4 }, 4); // P4 (End Round 5)
      
      // Now the round has ended, game should transition to 'ended'
      expect(game.status).toBe('ended');
      expect(game.result).toBeDefined();
      expect(game.result?.winnerIds).toBeDefined();
    });
  });
});
