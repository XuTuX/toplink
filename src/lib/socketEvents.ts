import { GameState, PlayerId } from './rules';

// Server -> Client
export interface ServerToClientEvents {
  room_created: (roomCode: string) => void;
  player_joined: (playerId: PlayerId) => void;
  game_state_update: (state: GameState, roomCode: string) => void;
  error_message: (message: string) => void;
  kicked: (message: string) => void;
}

// Client -> Server
export interface ClientToServerEvents {
  // Host actions
  host_create_room: () => void;
  host_start_game: (roomCode: string) => void;
  host_force_skip: (roomCode: string) => void;
  host_force_end: (roomCode: string) => void;
  host_kick_player: (roomCode: string, playerId: PlayerId) => void;
  host_reset_game: (roomCode: string) => void;

  // Player actions
  player_join: (roomCode: string, nickname: string, password?: string) => void;
  player_move: (roomCode: string, playerId: PlayerId, origin: { x: number, y: number, z?: number }, rotationIndex: number) => void;
}

// Inter-server events (not used yet but good for types)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data (session data attached to socket)
export interface SocketData {
  roomCode?: string;
  isHost: boolean;
  playerId?: PlayerId;
}
