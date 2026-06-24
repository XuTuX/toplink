'use client';

import { useRouter } from 'next/navigation';
import { Layers, Shield, User } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-sans p-6 justify-center items-center">
      {/* Main Container */}
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-full border border-indigo-100 mb-5">
            <Layers className="w-3.5 h-3.5" />
            3D 블록 전략 보드 게임
          </div>
          <h1 className="text-5xl font-black mt-2 tracking-tight text-zinc-100">
            TOP LINK
          </h1>
          <p className="text-zinc-400 mt-4 text-sm leading-relaxed font-medium">
            L-블록을 배치하고, 상대를 견제하며, 6×6×6 보드에서 더 많은 영역을 장악하세요.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => router.push('/player')}
            className="w-full p-6 bg-zinc-900 border border-zinc-800 hover:border-indigo-300 hover:bg-zinc-800 rounded-[24px] text-left transition-colors group flex items-center gap-4 shadow-sm"
          >
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 transition-colors">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-100">플레이어로 참가하기</div>
              <div className="text-sm text-zinc-500 mt-1 font-medium">모바일을 통해 기존 방에 접속하기</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dealer')}
            className="w-full p-6 bg-zinc-900 border border-zinc-800 hover:border-emerald-300 hover:bg-zinc-800 rounded-[24px] text-left transition-colors group flex items-center gap-4 shadow-sm"
          >
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 transition-colors">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-100">게임 호스팅하기</div>
              <div className="text-sm text-zinc-500 mt-1 font-medium">새로운 방을 만들고 보드를 관리하기</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
