import { create } from 'zustand';
import { GameState } from '../rules';

interface GameStore extends GameState {
  setGameState: (state: GameState) => void;
}

const getInitialState = (): GameState => ({
  id: 'toplink-game',
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

export const useGameStore = create<GameStore>((set) => ({
  ...getInitialState(),

  setGameState: (state: GameState) => {
    set({
      ...state,
      roundTopView: state.roundTopView ?? null,
      topViewHistory: state.topViewHistory ?? [],
    });
  },
}));
