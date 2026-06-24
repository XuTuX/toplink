import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from '../socketEvents';
import {
  createRoom,
  addPlayer,
  startGame,
  processMove,
  forceSkipTurn,
  forceEndGame,
  kickPlayer,
  resetGame,
  getRoom,
  rejoinHost,
  revealRound,
  startNextRound,
  getHostGameState,
  getPlayerGameState,
} from './gameManager';

export const handleSocketConnection = (
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) => {
  console.log(`Socket connected: ${socket.id}`);

  const sendStateUpdate = async (roomCode: string) => {
    const room = getRoom(roomCode);
    if (!room) return;

    const sockets = await io.in(roomCode).fetchSockets();
    sockets.forEach((roomSocket) => {
      if (roomSocket.data.isHost) {
        roomSocket.emit('game_state_update', getHostGameState(room.gameState), roomCode);
      } else if (roomSocket.data.playerId) {
        roomSocket.emit(
          'game_state_update',
          getPlayerGameState(room.gameState, roomSocket.data.playerId),
          roomCode
        );
      }
    });
  };

  socket.on('host_create_room', () => {
    const { roomCode, hostSecret } = createRoom(socket.id);
    socket.data.isHost = true;
    socket.data.roomCode = roomCode;
    socket.join(roomCode);
    socket.emit('room_created', roomCode, hostSecret);
    void sendStateUpdate(roomCode);
  });

  socket.on('host_rejoin', (roomCode, hostSecret) => {
    if (rejoinHost(roomCode, hostSecret, socket.id)) {
      socket.data.isHost = true;
      socket.data.roomCode = roomCode;
      socket.join(roomCode);
      socket.emit('host_rejoined');
      void sendStateUpdate(roomCode);
    } else {
      socket.emit('error_message', '방을 찾을 수 없거나 호스트 인증에 실패했습니다.');
    }
  });

  socket.on('host_start_game', (roomCode) => {
    if (startGame(roomCode, socket.id)) {
      void sendStateUpdate(roomCode);
    } else {
      socket.emit('error_message', 'Failed to start game');
    }
  });

  socket.on('host_force_skip', (roomCode) => {
    if (forceSkipTurn(roomCode, socket.id)) {
      void sendStateUpdate(roomCode);
    }
  });

  socket.on('host_force_end', (roomCode) => {
    if (forceEndGame(roomCode, socket.id)) {
      void sendStateUpdate(roomCode);
    }
  });

  socket.on('host_reveal_round', (roomCode) => {
    if (revealRound(roomCode, socket.id)) {
      void sendStateUpdate(roomCode);
    } else {
      socket.emit('error_message', '라운드 종료 후에만 결과를 공개할 수 있습니다.');
    }
  });

  socket.on('host_start_next_round', (roomCode) => {
    if (startNextRound(roomCode, socket.id)) {
      void sendStateUpdate(roomCode);
      const room = getRoom(roomCode);
      if (room) {
        io.to(roomCode).emit('round_started', room.gameState.round);
      }
    } else {
      socket.emit('error_message', '라운드 결과를 먼저 공개해주세요.');
    }
  });

  socket.on('host_kick_player', (roomCode, playerId) => {
    if (kickPlayer(roomCode, socket.id, playerId)) {
      // Find the player's socket and emit kicked event
      io.in(roomCode).fetchSockets().then(sockets => {
        sockets.forEach(s => {
          if (s.data.playerId === playerId) {
            s.emit('kicked', 'You were kicked by the host.');
            s.leave(roomCode);
          }
        });
      });
      void sendStateUpdate(roomCode);
    }
  });

  socket.on('host_reset_game', (roomCode) => {
    if (resetGame(roomCode, socket.id)) {
      void sendStateUpdate(roomCode);
    }
  });

  socket.on('player_join', (roomCode, nickname, password) => {
    const result = addPlayer(roomCode, nickname, password);
    if (result.success && result.playerId) {
      socket.data.isHost = false;
      socket.data.roomCode = roomCode;
      socket.data.playerId = result.playerId;
      socket.join(roomCode);
      socket.emit('player_joined', result.playerId);
      void sendStateUpdate(roomCode);
    } else {
      socket.emit('error_message', result.message || 'Failed to join');
    }
  });

  socket.on('player_move', (roomCode, playerId, origin, rotationIndex) => {
    // Basic verification
    if (socket.data.playerId !== playerId || socket.data.roomCode !== roomCode) {
      socket.emit('error_message', 'Unauthorized move');
      return;
    }

    if (processMove(roomCode, playerId, origin, rotationIndex)) {
      void sendStateUpdate(roomCode);
    } else {
      socket.emit('error_message', 'Invalid move');
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // If host disconnects, maybe broadcast a pause event?
    // If player disconnects, we can just let their turn skip if host forces it.
    // For now, no complex cleanup to allow reconnection.
  });
};
