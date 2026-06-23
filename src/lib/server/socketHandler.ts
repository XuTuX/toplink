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
  getRoom
} from './gameManager';

export const handleSocketConnection = (
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) => {
  console.log(`Socket connected: ${socket.id}`);

  const sendStateUpdate = (roomCode: string) => {
    const room = getRoom(roomCode);
    if (room) {
      io.to(roomCode).emit('game_state_update', room.gameState, roomCode);
    }
  };

  socket.on('host_create_room', () => {
    const roomCode = createRoom(socket.id);
    socket.data.isHost = true;
    socket.data.roomCode = roomCode;
    socket.join(roomCode);
    socket.emit('room_created', roomCode);
    sendStateUpdate(roomCode);
  });

  socket.on('host_start_game', (roomCode) => {
    if (startGame(roomCode, socket.id)) {
      sendStateUpdate(roomCode);
    } else {
      socket.emit('error_message', 'Failed to start game');
    }
  });

  socket.on('host_force_skip', (roomCode) => {
    if (forceSkipTurn(roomCode, socket.id)) {
      sendStateUpdate(roomCode);
    }
  });

  socket.on('host_force_end', (roomCode) => {
    if (forceEndGame(roomCode, socket.id)) {
      sendStateUpdate(roomCode);
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
      sendStateUpdate(roomCode);
    }
  });

  socket.on('host_reset_game', (roomCode) => {
    if (resetGame(roomCode, socket.id)) {
      sendStateUpdate(roomCode);
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
      sendStateUpdate(roomCode);
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
      sendStateUpdate(roomCode);
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
