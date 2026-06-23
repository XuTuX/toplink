import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  GameState,
  Player,
  PlayerId,
  Coord,
  applyMove,
  calculateResults,
  getCurrentPlayer,
  getCurrentTurnOrder
} from '../rules';

interface GameStore extends GameState {
  // Actions
  setupGame: (players: Player[], baseTurnOrder: PlayerId[]) => void;
  placeBlock: (playerId: PlayerId, origin: { x: number; y: number; z?: number }, rotationIndex: number) => void;
  forceSkipTurn: () => void;
  forceEndStage: () => void;
  resetGame: () => void;
}

const DEFAULT_PLAYERS: Player[] = [
  { id: 'P1', name: 'Blue Player', color: '#3b82f6' }, // Tailind blue-500
  { id: 'P2', name: 'Red Player', color: '#ef4444' },  // Tailwind red-500
  { id: 'P3', name: 'Green Player', color: '#22c55e' }, // Tailwind green-500
  { id: 'P4', name: 'Yellow Player', color: '#eab308' }, // Tailwind yellow-500
];

const DEFAULT_TURN_ORDER: PlayerId[] = ['P1', 'P2', 'P3', 'P4'];

const getInitialState = (): GameState => ({
  id: 'toplink-game',
  status: 'setup',
  players: DEFAULT_PLAYERS,
  baseTurnOrder: DEFAULT_TURN_ORDER,
  round: 1,
  turnIndexInRound: 0,
  board: [],
  moves: [],
  endPending: false,
});

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...getInitialState(),

      setupGame: (players, baseTurnOrder) => {
        set({
          ...getInitialState(),
          players,
          baseTurnOrder,
          status: 'playing',
        });
      },

      placeBlock: (playerId, origin, rotationIndex) => {
        const state = get();
        if (state.status !== 'playing' && state.status !== 'end_pending') return;
        
        // Ensure it's this player's turn
        const currentPlayer = getCurrentPlayer(state);
        if (playerId !== currentPlayer) return;

        const nextState = applyMove(state, playerId, origin, rotationIndex);
        set(nextState);
      },

      forceSkipTurn: () => {
        const state = get();
        if (state.status !== 'playing' && state.status !== 'end_pending') return;

        const playerId = getCurrentPlayer(state);
        // Create an invalid skip move log
        const moveId = `skip_${Date.now()}`;
        const skipMove = {
          id: moveId,
          round: state.round,
          turnIndex: state.turnIndexInRound,
          playerId,
          origin: { x: 0, y: 0, z: 0 },
          rotationIndex: 0,
          cells: [],
          valid: false,
          invalidReason: 'Forced skip by dealer',
          createdAt: new Date().toISOString(),
        };

        let newRound = state.round;
        let newTurnIndex = state.turnIndexInRound + 1;
        let newStatus: GameState['status'] = state.status;
        let finalResult = state.result;

        if (newTurnIndex >= 4) {
          if (state.endPending) {
            newStatus = 'ended';
            finalResult = calculateResults({
              ...state,
              board: state.board,
            });
          } else {
            newRound += 1;
            newTurnIndex = 0;
          }
        }

        set({
          round: newRound,
          turnIndexInRound: newTurnIndex,
          status: newStatus,
          moves: [...state.moves, skipMove],
          result: finalResult,
        });
      },

      forceEndStage: () => {
        const state = get();
        if (state.status === 'setup' || state.status === 'ended') return;

        const finalResult = calculateResults(state);
        set({
          status: 'ended',
          endPending: true,
          result: finalResult,
        });
      },

      resetGame: () => {
        set(getInitialState());
      },
    }),
    {
      name: 'toplink-game-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Cross-tab synchronization logic
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'toplink-game-storage') {
      // Force Zustand to re-hydrate from localStorage
      useGameStore.persist.rehydrate();
    }
  });
}
