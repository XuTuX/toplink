import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  createRoom,
  getHostGameState,
  getPlayerGameState,
  getRoom,
  processMove,
  revealRound,
  startGame,
  startNextRound,
} from '../gameManager';

describe('gameManager round flow', () => {
  it('requires the host to reveal the round before starting the next one', () => {
    const hostSocketId = 'host-round-flow';
    const { roomCode } = createRoom(hostSocketId);

    expect(addPlayer(roomCode, 'Player 1', '1111').success).toBe(true);
    expect(addPlayer(roomCode, 'Player 2', '2222').success).toBe(true);
    expect(startGame(roomCode, hostSocketId)).toBe(true);

    expect(processMove(roomCode, 'P1', { x: 0, y: 0 }, 0)).toBe(true);
    expect(processMove(roomCode, 'P2', { x: 2, y: 2 }, 4)).toBe(true);
    expect(getRoom(roomCode)?.gameState.status).toBe('round_ended');
    expect(getRoom(roomCode)?.gameState.round).toBe(1);

    const endedState = getRoom(roomCode)!.gameState;
    const hostView = getHostGameState(endedState);
    const p1View = getPlayerGameState(endedState, 'P1');
    const p2MoveInP1View = p1View.moves.find((move) => move.playerId === 'P2');

    expect(hostView.board).toHaveLength(6);
    expect(hostView.players.every((player) => player.password === undefined)).toBe(true);
    expect(p1View.players.every((player) => player.password === undefined)).toBe(true);
    expect(p1View.board).toHaveLength(3);
    expect(p1View.board.every((cell) => cell.playerId === 'P1')).toBe(true);
    expect(p2MoveInP1View?.origin).toEqual({ x: 0, y: 0, z: 0 });
    expect(p2MoveInP1View?.rotationIndex).toBe(0);
    expect(p2MoveInP1View?.cells).toEqual([]);
    expect(p1View.roundTopView).toBeNull();

    expect(startNextRound(roomCode, hostSocketId)).toBe(false);
    expect(revealRound(roomCode, hostSocketId)).toBe(true);

    const revealedP1View = getPlayerGameState(getRoom(roomCode)!.gameState, 'P1');
    expect(revealedP1View.board.every((cell) => cell.playerId === 'P1')).toBe(true);
    expect(revealedP1View.moves.find((move) => move.playerId === 'P2')?.cells).toEqual([]);
    expect(revealedP1View.roundTopView).toHaveLength(6);
    expect(revealedP1View.roundTopView?.flat().every((cell) => cell.z === null)).toBe(true);
    expect(revealedP1View.topViewHistory).toHaveLength(1);
    expect(revealedP1View.topViewHistory[0].round).toBe(1);
    expect(revealedP1View.topViewHistory[0].topView.flat().every((cell) => cell.z === null)).toBe(true);

    expect(startNextRound(roomCode, hostSocketId)).toBe(true);

    expect(getRoom(roomCode)?.gameState.status).toBe('playing');
    expect(getRoom(roomCode)?.gameState.round).toBe(2);
    expect(getRoom(roomCode)?.gameState.turnIndexInRound).toBe(0);
    expect(getRoom(roomCode)?.gameState.roundRevealed).toBe(false);
    expect(getPlayerGameState(getRoom(roomCode)!.gameState, 'P1').roundTopView).toBeNull();
    expect(getPlayerGameState(getRoom(roomCode)!.gameState, 'P1').topViewHistory).toHaveLength(1);
    expect(getPlayerGameState(getRoom(roomCode)!.gameState, 'P1').board.every((cell) => cell.playerId === 'P1')).toBe(true);

    // Round 2 starts with P2. The server uses P1's hidden block as support
    // even though P2 submitted no client-computed Z value.
    expect(processMove(roomCode, 'P2', { x: 0, y: 0 }, 4)).toBe(true);
    const authoritativeP2Cells = getRoom(roomCode)!.gameState.board
      .filter((cell) => cell.playerId === 'P2' && cell.turnId === getRoom(roomCode)!.gameState.moves.at(-1)?.id)
      .map((cell) => cell.z);
    expect(authoritativeP2Cells).toEqual([1, 1, 2]);

    const p1ViewAfterHiddenPlacement = getPlayerGameState(getRoom(roomCode)!.gameState, 'P1');
    expect(p1ViewAfterHiddenPlacement.board.every((cell) => cell.playerId === 'P1')).toBe(true);
    expect(p1ViewAfterHiddenPlacement.moves.at(-1)?.cells).toEqual([]);
  });
});
