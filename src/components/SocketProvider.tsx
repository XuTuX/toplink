'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../lib/socketEvents';
import { useGameStore } from '../lib/store/gameStore';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextType {
  socket: GameSocket | null;
  isConnected: boolean;
  error: string | null;
  clearError: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  error: null,
  clearError: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setGameState = useGameStore(state => state.setGameState);

  useEffect(() => {
    // Connect to the same host that serves the page
    const socketInstance: GameSocket = io({
      autoConnect: true,
      reconnection: true,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    // Global listener for game state updates
    socketInstance.on('game_state_update', (newState) => {
      setGameState(newState);
    });

    socketInstance.on('error_message', (msg) => {
      setError(msg);
      // Auto-clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    });

    socketInstance.on('kicked', (msg) => {
      setError(msg);
      // Let the UI handle redirection or state
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [setGameState]);

  const clearError = () => setError(null);

  return (
    <SocketContext.Provider value={{ socket, isConnected, error, clearError }}>
      {children}
    </SocketContext.Provider>
  );
};
