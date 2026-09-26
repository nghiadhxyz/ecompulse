import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, X, ArrowRight, Play, BookOpen, HelpCircle } from 'lucide-react';
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
  onOpenTour,
  onLoadDemoSample,
  currentContext = 'home',
  hasData = false,
}) => {
  const [showBubble, setShowBubble] = useState<boolean>(true);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Auto show bubble on context change unless dismissed manually
  useEffect(() => {
    if (!isDismissed) {
      setShowBubble(true);
    }
  }, [currentContext, isDismissed]);

  const getBubbleContent = () => {
    if (hasData) {
      return {
        title: 'Dolphin AI đang đọc dữ liệu shop!',
        text: 'Cần tôi phân tích điểm rò rỉ đơn COD, sản phẩm bán chạy nhất hay tối ưu ngân sách Ads?',
        actionText: 'Hỏi Dolphin ngay',
        actionType: 'chat',
      };
    }

    switch (currentContext) {
      case 'features':
        return {
          title: 'Khám phá tính năng EcomPulse',
          text: 'Xem quy trình 2 bước Auto-Pipeline hoặc mở Tour hướng dẫn để làm quen nhé!',
          actionText: 'Xem Tour 1 phút',
          actionType: 'tour',
        };
      case 'marketplace':
        return {
          title: 'Hướng dẫn xuất báo cáo sàn',
          text: 'Bạn cần hướng dẫn tải file từ Shopee, TikTok Shop hay muốn nạp Demo 1-click?',
          actionText: 'Xem hướng dẫn tải',
          actionType: 'tour',
        };
      case 'internal_finance':
        return {
          title: 'Phân hệ Tài chính P&L (53 Cột)',
          text: 'Cần hỗ trợ tra cứu từ điển ngữ nghĩa 53 cột hoặc đối soát COGS & lãi gộp?',
          actionText: 'Hỏi Dolphin AI',
          actionType: 'chat',
        };
      case 'home':
      default:
        return {
          title: '👋 Xin chào bạn mới!',
          text: 'Khám phá 2 luồng phân tích và cách Dolphin AI giúp bạn bịt rò rỉ dòng tiền trong 1 phút.',
          actionText: 'Mở Tour hướng dẫn',
          actionType: 'tour',
        };
    }
  };

  const bubble = getBubbleContent();

  const handleActionClick = () => {
    if (bubble.actionType === 'tour' && onOpenTour) {
      onOpenTour();
    } else {
      onOpenChat();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end space-y-2 pointer-events-auto select-none">
      {/* =========================================================================
          1. CONTEXT-AWARE SPEECH BUBBLE
      ========================================================================= */}
      {showBubble && !isDismissed && (
        <div className="relative max-w-[290px] sm:max-w-[320px] p-3.5 rounded-2xl bg-gradient-to-br from-[#0c1333]/95 via-slate-900/95 to-[#161338]/95 border border-cyan-400/40 shadow-2xl shadow-cyan-950/80 backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-300 text-left">
          {/* Close Bubble Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowBubble(false);
              setIsDismissed(true);
            }}
            className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all"
            title="Đóng thông báo"
          >
            <X className="w-3 h-3" />
          </button>

          {/* Speech Bubble Arrow pointing down */}
          <div className="absolute -bottom-2 right-6 w-3.5 h-3.5 bg-[#161338] border-r border-b border-cyan-400/40 transform rotate-45" />

          {/* Bubble Content */}
          <div className="space-y-1.5 pr-4">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h5 className="text-xs font-black text-white">{bubble.title}</h5>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
              {bubble.text}
            </p>
          </div>

          {/* Quick Action Chips */}
          <div className="flex items-center space-x-2 pt-2.5 mt-2 border-t border-white/10">
            <button
              onClick={handleActionClick}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-[11px] shadow-md shadow-blue-950/50 flex items-center space-x-1 transition-all active:scale-95"
            >
              <span>{bubble.actionText}</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            {onLoadDemoSample && !hasData && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadDemoSample();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-slate-300 hover:text-white flex items-center space-x-1 transition-all active:scale-95"
                title="Nạp dữ liệu mẫu Shopee Mega 8.8"
              >
                <Play className="w-2.5 h-2.5 fill-cyan-400 text-cyan-400" />
                <span>Nạp Demo</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          2. MAIN FLOATING TRIGGER BUTTON
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
