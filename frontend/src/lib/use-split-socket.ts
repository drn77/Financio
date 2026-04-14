'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ISplitMessage, ISplitParticipant } from '@shared/models';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface SplitSocketEvents {
  onMessage?: (message: ISplitMessage) => void;
  onReceipt?: (data: { receipt: any; message: ISplitMessage }) => void;
  onReceiptUpdate?: (receipt: any) => void;
  onClaim?: (data: { action: 'add' | 'remove'; splitReceiptItemId: string; participantId: string; claim?: any }) => void;
  onParticipant?: (data: { type: 'joined' | 'settled'; participant: ISplitParticipant }) => void;
  onArchived?: (data: { splitId: string }) => void;
  onError?: (data: { message: string }) => void;
}

export function useSplitSocket(
  splitId: string | null,
  auth: { userId?: string; guestToken?: string },
  events: SplitSocketEvents,
) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Stable refs for event callbacks
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!splitId) return;
    if (!auth.userId && !auth.guestToken) return;

    const socket = io(`${API_URL}/split`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('split:join', {
        splitId,
        userId: auth.userId,
        guestToken: auth.guestToken,
      });
    });

    socket.on('split:joined', () => {
      setIsConnected(true);
    });

    socket.on('split:message', (msg: ISplitMessage) => {
      eventsRef.current.onMessage?.(msg);
    });

    socket.on('split:receipt', (data: any) => {
      eventsRef.current.onReceipt?.(data);
    });

    socket.on('split:receipt:update', (data: any) => {
      eventsRef.current.onReceiptUpdate?.(data);
    });

    socket.on('split:claim', (data: any) => {
      eventsRef.current.onClaim?.(data);
    });

    socket.on('split:participant', (data: any) => {
      eventsRef.current.onParticipant?.(data);
    });

    socket.on('split:archived', (data: any) => {
      eventsRef.current.onArchived?.(data);
    });

    socket.on('split:error', (data: any) => {
      eventsRef.current.onError?.(data);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [splitId, auth.userId, auth.guestToken]);

  const sendMessage = useCallback((content: string) => {
    socketRef.current?.emit('split:message', { content });
  }, []);

  const claimItem = useCallback((splitReceiptItemId: string) => {
    socketRef.current?.emit('split:claim', { splitReceiptItemId });
  }, []);

  const unclaimItem = useCallback((splitReceiptItemId: string) => {
    socketRef.current?.emit('split:unclaim', { splitReceiptItemId });
  }, []);

  const settle = useCallback(() => {
    socketRef.current?.emit('split:settle');
  }, []);

  return {
    isConnected,
    sendMessage,
    claimItem,
    unclaimItem,
    settle,
  };
}
