import React from 'react';
import { Sparkles } from 'lucide-react';
import dolphinAvatar from '../../assets/images/dolphin_ai_avatar_1787721342181.jpg';

export interface DolphinFloatingWidgetProps {
  onOpenChat: () => void;
  onOpenTour?: () => void;
  onLoadDemoSample?: () => void;
  currentContext?: 'home' | 'features' | 'marketplace' | 'internal_finance' | 'dashboard';
  hasData?: boolean;
}

export const DolphinFloatingWidget: React.FC<DolphinFloatingWidgetProps> = ({
  onOpenChat,
  hasData = false,
}) => {
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end space-y-2 pointer-events-auto select-none">
      {/* =========================================================================
          MAIN FLOATING TRIGGER BUTTON
      ========================================================================= */}
      <div className="relative group">
        {/* Ambient Ring Pulse Glow */}
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 blur-sm opacity-70 group-hover:opacity-100 animate-pulse transition duration-300 pointer-events-none" />

        <button
          onClick={onOpenChat}
          className="relative flex items-center space-x-3 px-4 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-slate-950 via-[#0b1335] to-[#140e36] border-2 border-cyan-400/60 hover:border-cyan-300 text-white shadow-2xl shadow-cyan-950/90 transition-all duration-300 hover:scale-105 active:scale-95 group/btn"
        >
          {/* Avatar with Status indicator */}
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-cyan-400/80 shadow-md flex-shrink-0 bg-slate-950 p-0.5">
            <img src={dolphinAvatar} alt="Dolphin AI" className="w-full h-full object-cover rounded-full" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900 animate-pulse" />
          </div>

          <div className="text-left">
            <div className="flex items-center space-x-1">
              <span className="text-xs font-black tracking-tight text-white group-hover/btn:text-cyan-200 transition-colors">
                Dolphin AI
              </span>
              <Sparkles className="w-3 h-3 text-cyan-300 fill-cyan-300/40" />
            </div>
            <span className="text-[10px] text-cyan-200 block font-medium">
              {hasData ? 'Đang đọc dữ liệu' : 'Trợ lý phân tích'}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

