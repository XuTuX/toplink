'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useSocket } from '@/components/SocketProvider';

export default function DealerPage() {
  const router = useRouter();
  const { socket, isConnected, error } = useSocket();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (socket) {
      const onRoomCreated = (roomCode: string, hostSecret: string) => {
        sessionStorage.setItem('hostSession', JSON.stringify({ roomCode, hostSecret }));
        router.push(`/dealer/${roomCode}`);
      };
      
      socket.on('room_created', onRoomCreated);

      return () => {
        socket.off('room_created', onRoomCreated);
      };
    }
  }, [socket, router]);

  const handleCreateRoom = () => {
    if (socket) {
      setIsCreating(true);
      socket.emit('host_create_room');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 font-sans p-6">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 text-center space-y-8 shadow-2xl">
        <div className="mx-auto w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 mb-4">
          <Shield className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">호스트 시작하기</h1>
          <p className="text-sm text-zinc-400">새로운 방을 만들고 플레이어들을 초대하세요.</p>
        </div>

        {!isConnected ? (
          <div className="p-4 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-bold animate-pulse">
            서버에 연결 중...
          </div>
        ) : (
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-lg font-black transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:shadow-none active:scale-95"
          >
            {isCreating ? '방 생성 중...' : '새로운 방 만들기'}
          </button>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
