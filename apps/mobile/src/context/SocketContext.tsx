import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SOCKET_URL = (process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1").replace(
  /\/api\/v1\/?$/,
  ""
);

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  isConnecting: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!accessToken || !user) {
      // Logged out — disconnect if connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setIsConnecting(false);
      }
      return;
    }

    // Already connected with same token, nothing to do
    if (socketRef.current?.connected) return;

    setIsConnecting(true);

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      setIsConnecting(false);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", () => {
      setIsConnecting(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, [accessToken, user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, isConnecting }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
