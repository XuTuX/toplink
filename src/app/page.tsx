'use client';

import { useRouter } from 'next/navigation';
import { Layers, Shield, User } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-sans p-6 relative overflow-hidden selection:bg-indigo-600 selection:text-white justify-center items-center">
      {/* Background elements */}
      <div className="absolute top-[-10%] left-[15%] h-[500px] w-[700px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[5%] right-[10%] h-[400px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] h-[300px] w-[500px] rounded-full bg-purple-600/5 blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto z-10 relative">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 rounded-full border border-indigo-500/20 mb-5">
            <Layers className="w-3.5 h-3.5" />
            3D 블록 전략 보드 게임
          </div>
          <h1 className="text-5xl font-black mt-2 tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
            TOP LINK
          </h1>
          <p className="text-zinc-400 mt-4 text-sm leading-relaxed font-medium">
            L-블록을 배치하고, 상대를 견제하며, 5×5 보드에서 더 많은 영역을 장악하세요.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => router.push('/player')}
            className="w-full p-6 bg-zinc-900 border border-zinc-800 hover:border-indigo-500 hover:bg-zinc-800 rounded-[24px] text-left transition-all group flex items-center gap-4 cursor-pointer shadow-lg"
          >
            <div className="p-3 bg-zinc-800 group-hover:bg-indigo-500/20 rounded-xl text-zinc-400 group-hover:text-indigo-400 transition-colors">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-black text-white group-hover:text-indigo-300 transition-colors">플레이어로 참가하기</div>
              <div className="text-sm text-zinc-500 mt-1 font-medium">모바일을 통해 기존 방에 접속하기</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dealer')}
            className="w-full p-6 bg-zinc-900 border border-zinc-800 hover:border-emerald-500 hover:bg-zinc-800 rounded-[24px] text-left transition-all group flex items-center gap-4 cursor-pointer shadow-lg"
          >
            <div className="p-3 bg-zinc-800 group-hover:bg-emerald-500/20 rounded-xl text-zinc-400 group-hover:text-emerald-400 transition-colors">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">게임 호스팅하기</div>
              <div className="text-sm text-zinc-500 mt-1 font-medium">새로운 방을 만들고 보드를 관리하기</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
