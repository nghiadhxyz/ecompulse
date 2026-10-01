import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, X, ShieldCheck, Zap, ShoppingBag, Building2, CheckCircle2, AlertTriangle, Play, Upload, Bot, Check, Calendar, Lock } from 'lucide-react';
import dolphinAvatar from '../../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import { ShopeeLogo, TikTokShopLogo } from '../PlatformLogos';

export interface DolphinOnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMarketplace?: () => void;
  onStartInternalFinance?: () => void;
  onLoadDemoSample?: () => void;
  onOpenUpload?: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
  language?: 'vi' | 'en';
}

interface TourStep {
  id: number;
  badge: string;
  title: string;
  subtitle: string;
  illustrationType: 'intro' | 'dual_tracks' | 'export_guide' | 'ai_pillars' | 'ready_action';
}

/**
 * Colours come from the design tokens only: on the landing page (outside the workspace shell)
 * :root resolves to the dark set; inside the workspace the modal follows the light / dark toggle.
 */
const CARD = 'rounded-control border border-line bg-surface';
/** Icon tile by status tone. */
const TILE = {
  primary: 'bg-primary-soft text-primary',
  up: 'bg-up-soft text-up',
  down: 'bg-down-soft text-down',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
} as const;
/** Numbered step dot per export guide. */
const STEP_DOT = { shopee: TILE.down, tiktok: TILE.info, internal: TILE.up } as const;

const GuideSteps: React.FC<{ tone: keyof typeof STEP_DOT; items: { title: string; text: string }[] }> = ({ tone, items }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {items.map((s, i) => (
      <div key={s.title} className={`${CARD} space-y-1.5 p-3.5`}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-small font-semibold ${STEP_DOT[tone]}`}>{i + 1}</span>
        <h5 className="text-sm font-semibold text-fg">{s.title}</h5>
        <p className="text-small leading-snug text-muted">{s.text}</p>
      </div>
    ))}
  </div>
);

export const DolphinOnboardingTourModal: React.FC<DolphinOnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onStartMarketplace,
  onStartInternalFinance,
  onLoadDemoSample,
  onOpenUpload,
  onOpenChatWithPrompt,
  language = 'vi',
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedPlatformGuide, setSelectedPlatformGuide] = useState<'shopee' | 'tiktok' | 'internal'>('shopee');

  // Reset to step 0 when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps: TourStep[] = [
    {
      id: 1,
      badge: 'Bước 1/5 · Giới thiệu trợ lý',
      title: 'Chào mừng bạn đến với EcomPulse AI',
      subtitle: 'Trợ lý Dolphin AI đồng hành cùng bạn bóc tách dữ liệu bán hàng, kiểm soát dòng tiền và tối ưu tăng trưởng.',
      illustrationType: 'intro',
    },
    {
      id: 2,
      badge: 'Bước 2/5 · 2 luồng quản trị',
      title: 'Khám phá 2 Luồng Phân Tích Chuyên Biệt',
      subtitle: 'Lựa chọn luồng phù hợp với mục tiêu: Bóc tách đơn sàn TMĐT hoặc Quản trị tài chính P&L nội bộ.',
      illustrationType: 'dual_tracks',
    },
    {
      id: 3,
      badge: 'Bước 3/5 · Hướng dẫn xuất file sàn',
      title: 'Cách Xuất Báo Cáo Chuẩn Từ Các Sàn',
      subtitle: 'Hướng dẫn 3 bước nhanh để tải file Excel từ Shopee, TikTok Shop hoặc nạp file P&L.',
      illustrationType: 'export_guide',
    },
    {
      id: 4,
      badge: 'Bước 4/5 · 7 trụ cột phân tích',
      title: 'Chẩn Đoán Rò Rỉ & Thẻ Hành Động AI',
      subtitle: 'Hệ thống tự động phát hiện rò rỉ COD, phân loại SKU Zombie, tối ưu Shopee Ads và xuất lịch Google Calendar.',
      illustrationType: 'ai_pillars',
    },
    {
      id: 5,
      badge: 'Bước 5/5 · Sẵn sàng bắt đầu',
      title: 'Bạn đã sẵn sàng trải nghiệm!',
      subtitle: 'Bắt đầu ngay bằng việc nạp dữ liệu mẫu Demo Shopee Mega 8.8 (3.260 đơn) hoặc tải file báo cáo của bạn.',
      illustrationType: 'ready_action',
    },
  ];

  const current = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const valueCard = (tone: keyof typeof TILE, Icon: typeof ShieldCheck, title: React.ReactNode, text: string) => (
    <div className={`${CARD} flex items-start gap-3.5 p-4`}>
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${TILE[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-fg">{title}</h4>
        <p className="mt-0.5 text-small leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  );

  const checkList = (tone: 'primary' | 'up', items: string[]) => (
    <div className="space-y-1.5 pt-1 text-small text-fg">
      {items.map((x) => (
        <div key={x} className="flex items-center gap-2">
          <CheckCircle2 className={`h-4 w-4 shrink-0 ${tone === 'primary' ? 'text-primary' : 'text-up'}`} aria-hidden />
          <span>{x}</span>
        </div>
      ))}
    </div>
  );

  const guideTab = (key: 'shopee' | 'tiktok' | 'internal', icon: React.ReactNode, label: string) => {
    const on = selectedPlatformGuide === key;
    return (
      <button
        type="button"
        onClick={() => setSelectedPlatformGuide(key)}
        aria-pressed={on}
        className={`inline-flex min-h-10 items-center gap-2 rounded-control px-3.5 text-sm font-medium whitespace-nowrap transition-colors ${on ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-hover hover:text-fg'}`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  const guideHeader = (icon: React.ReactNode, title: string, note: string) => (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
        {icon}
        {title}
      </span>
      <span className="text-small text-muted">{note}</span>
    </div>
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-5 md:p-8">
      {/* Main Container Card */}
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-card border border-line bg-surface text-fg shadow-card">
        {/* 1. Header & progress */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-control border border-line bg-surface-2 p-0.5">
              <img src={dolphinAvatar} alt="Dolphin AI" className="h-full w-full rounded-[8px] object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-fg">Dolphin AI Tour</span>
                <span className="inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-small font-medium text-primary">Hướng Dẫn Người Dùng</span>
              </div>
              <span className="text-small text-muted">Khám phá toàn bộ nền tảng chỉ trong 1 phút</span>
            </div>
          </div>

          {/* Stepper */}
          <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Các bước">
            {steps.map((_, idx) => (
              <button key={idx} type="button" onClick={() => setCurrentStep(idx)} className="flex h-10 items-center px-0.5" title={`Nhảy tới bước ${idx + 1}`} aria-label={`Bước ${idx + 1}`} aria-current={idx === currentStep ? 'step' : undefined}>
                <span className={`block h-2 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-7 bg-primary' : idx < currentStep ? 'w-2.5 bg-primary/50' : 'w-2 bg-line hover:bg-muted'}`} />
              </button>
            ))}
          </div>

          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-fg" title="Đóng tour hướng dẫn (ESC)" aria-label="Đóng">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* 2. Body (scrollable) */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-left sm:p-8">
          <div className="space-y-2">
            <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-small font-semibold text-primary">{current.badge}</span>
            <h2 id="tour-title" className="text-2xl font-bold leading-snug tracking-tight text-fg sm:text-3xl">
              {current.title}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">{current.subtitle}</p>
          </div>

          {/* Step 1: intro */}
          {current.illustrationType === 'intro' && (
            <div className="grid grid-cols-1 gap-5 pt-2 animate-in fade-in duration-300 md:grid-cols-12">
              <div className="space-y-3 md:col-span-7">
                {valueCard('info', ShieldCheck, 'Local-First RAM Security (Bảo mật 100%)', 'Toàn bộ dữ liệu file Excel được xử lý trực tiếp trong bộ nhớ RAM trình duyệt của bạn. Tự động loại bỏ tên khách, SĐT, địa chỉ (PII Scrubbing).')}
                {valueCard('primary', Bot, 'AI Business Analyst: Tuyệt đối không bịa số', 'Dolphin AI chỉ trích xuất số liệu thực tế có bằng chứng dẫn chứng từ file báo cáo của shop. Nếu thiếu chỉ số, Dolphin sẽ chỉ rõ nguyên nhân.')}
                {valueCard('up', Zap, <>Tính toán tức thì &lt; 1 giây</>, 'Không cần chờ đợi. Đối soát hàng nghìn đơn hàng, doanh thu thực nhận, rò rỉ COD và phân loại Pareto SKU trong chớp mắt.')}
              </div>

              <div className={`${CARD} flex flex-col items-center justify-center space-y-3 bg-surface-2 p-5 text-center md:col-span-5`}>
                <div className="h-20 w-20 overflow-hidden rounded-card border border-line bg-surface p-1">
                  <img src={dolphinAvatar} alt="Dolphin AI" className="h-full w-full rounded-control object-cover" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-fg">Dolphin AI Assistant</h4>
                  <span className="text-small font-medium text-primary">Trợ lý Phân tích Dữ liệu TMĐT</span>
                </div>
                <div className={`${CARD} w-full p-3 text-small italic text-muted`}>&ldquo;Chào bạn! Tôi sẵn sàng giúp bạn tìm ra điểm rò rỉ dòng tiền và nhân bản doanh số!&rdquo;</div>
              </div>
            </div>
          )}

          {/* Step 2: two tracks */}
          {current.illustrationType === 'dual_tracks' && (
            <div className="grid grid-cols-1 gap-5 pt-2 animate-in fade-in duration-300 md:grid-cols-2">
              <div className="flex flex-col justify-between space-y-4 rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-primary/50">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-small font-semibold text-primary">Luồng 1</span>
                    <div className="flex items-center gap-1.5">
                      <ShopeeLogo className="h-4 w-4" />
                      <TikTokShopLogo className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-control ${TILE.primary}`}>
                      <ShoppingBag className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <h4 className="text-card-title text-fg">Phân Tích Sàn TMĐT</h4>
                      <p className="text-small font-medium text-muted">Shopee • TikTok Shop</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">
                    Dành cho các chủ shop, nhà bán hàng trên sàn TMĐT muốn bóc tách doanh thu thực nhận, đối soát phễu 3 bước, rò rỉ hoàn hủy COD và hiệu quả Shopee Ads ROAS.
                  </p>
                  {checkList('primary', ['Bóc tách phễu: Đặt hàng ➔ Xác nhận ➔ Thanh toán', 'Chẩn đoán 7 kênh traffic & Đo lường KOC/Live', 'Phân loại Pareto SKU Class A / B / Zombie'])}
                </div>
                {onStartMarketplace && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartMarketplace();
                    }}
                    className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-control bg-primary text-sm font-semibold text-primary-contrast transition-opacity hover:opacity-90"
                  >
                    <span>Chọn Luồng 1: Sàn TMĐT</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              <div className="flex flex-col justify-between space-y-4 rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-up/50">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-up-soft px-2.5 py-0.5 text-small font-semibold text-up">Luồng 2</span>
                    <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-small font-medium text-muted">53 Cột Chuẩn v1.0</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-control ${TILE.up}`}>
                      <Building2 className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <h4 className="text-card-title text-fg">Tài Chính & P&L Nội Bộ</h4>
                      <p className="text-small font-medium text-muted">Business Corporate Finance (SMEs)</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">
                    Dành cho ban giám đốc, kế toán quản trị muốn kiểm soát toàn diện báo cáo P&L, đối soát Giá vốn COGS, chi phí vận hành OPEX, biên lợi nhuận và Unit Economics.
                  </p>
                  {checkList('up', ['Nhận diện ngữ nghĩa Từ điển tiếng Việt 53 cột', '10 quy tắc cấm nhầm lẫn số liệu tài chính', 'Kế hoạch hành động ưu tiên P0 / P1 / P2'])}
                </div>
                {onStartInternalFinance && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartInternalFinance();
                    }}
                    className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-control border border-line bg-surface text-sm font-semibold text-fg transition-colors hover:bg-hover"
                  >
                    <span>Chọn Luồng 2: Tài Chính Nội Bộ</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: export guide */}
          {current.illustrationType === 'export_guide' && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-300">
              <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line pb-2" role="group" aria-label="Chọn sàn">
                {guideTab('shopee', <ShopeeLogo className="h-4 w-4 rounded" />, 'Shopee')}
                {guideTab('tiktok', <TikTokShopLogo className="h-4 w-4 rounded" />, 'TikTok Shop')}
                {guideTab('internal', <Building2 className="h-4 w-4" aria-hidden />, 'Excel Nội Bộ (P&L)')}
              </div>

              <div className="space-y-4 rounded-card border border-line bg-surface-2 p-5">
                {selectedPlatformGuide === 'shopee' && (
                  <>
                    {guideHeader(<ShopeeLogo className="h-4 w-4" />, 'Quy trình xuất báo cáo Shopee Seller Centre:', 'File mẫu chuẩn: 21 Sheets hoặc 1 Sheet tổng')}
                    <GuideSteps
                      tone="shopee"
                      items={[
                        { title: 'Vào Phân Tích Bán Hàng', text: 'Đăng nhập Kênh Người Bán > Dữ Liệu > Phân Tích Bán Hàng.' },
                        { title: 'Chọn Khung Thời Gian', text: 'Chọn mốc thời gian (Theo ngày Mega Sale, Tuần hoặc Tháng).' },
                        { title: 'Tải Báo Cáo Excel (.xlsx)', text: 'Bấm nút “Tải Dữ Liệu” và kéo thả file vào EcomPulse.' },
                      ]}
                    />
                  </>
                )}
                {selectedPlatformGuide === 'tiktok' && (
                  <>
                    {guideHeader(<TikTokShopLogo className="h-4 w-4" />, 'Quy trình xuất báo cáo TikTok Shop Seller Center:', 'Hỗ trợ phân tích Live & Video KOC')}
                    <GuideSteps
                      tone="tiktok"
                      items={[
                        { title: 'Vào Phân Tích La Bàn', text: 'Seller Center > Phân tích > La bàn dữ liệu (Compass).' },
                        { title: 'Chọn Doanh Thu & Live', text: 'Chọn báo cáo hiệu suất Video & Phiên Livestream.' },
                        { title: 'Xuất File Excel', text: 'Bấm Xuất báo cáo (Export Excel) và nạp vào hệ thống.' },
                      ]}
                    />
                  </>
                )}
                {selectedPlatformGuide === 'internal' && (
                  <>
                    {guideHeader(<Building2 className="h-4 w-4 text-up" aria-hidden />, 'Cấu trúc file báo cáo Tài chính nội bộ P&L:', 'Tự động nhận diện 53 cột tiếng Việt')}
                    <GuideSteps
                      tone="internal"
                      items={[
                        { title: 'Doanh Thu & Giá Vốn (COGS)', text: 'Doanh thu gộp (Placed), Doanh thu thuần (Paid), Giá vốn hàng bán.' },
                        { title: 'Chi Phí Vận Hành & Ads', text: 'Phí sàn, phí vận chuyển, chi phí Ads, hoa hồng KOC / Affiliate.' },
                        { title: 'Lợi Nhuận Gộp & Ròng', text: 'EcomPulse tự động tính toán biên lợi nhuận và điểm hòa vốn.' },
                      ]}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 4: analysis pillars */}
          {current.illustrationType === 'ai_pillars' && (
            <div className="grid grid-cols-1 gap-3.5 pt-2 animate-in fade-in duration-300 sm:grid-cols-2">
              {(
                [
                  { tone: 'down', Icon: AlertTriangle, title: '1. Chẩn đoán Rò rỉ COD', text: 'Bóc tách chênh lệch giữa Doanh thu đặt hàng (Placed) và Doanh thu thực nhận (Paid), chỉ đích danh kênh rò rỉ nặng nhất và tỷ lệ rơi rụng.' },
                  { tone: 'primary', Icon: ShoppingBag, title: '2. Phân loại SKU Pareto & Zombie', text: 'Tự động phân loại sản phẩm chủ lực (Hero Class A) và cảnh báo SKU Zombie có lượt xem nhưng 0 đơn hàng để giải phóng tồn kho.' },
                  { tone: 'warn', Icon: Zap, title: '3. Tối ưu Shopee Ads ROAS', text: 'Đánh giá hiệu suất chi phí quảng cáo, phát hiện từ khóa lãng phí ngân sách và đề xuất tăng ngân sách cho từ khóa chính xác ROAS > 5.0x.' },
                  { tone: 'up', Icon: Calendar, title: '4. Thẻ Hành Động & Google Sync', text: 'Tự động sinh các thẻ hành động ưu tiên (P0 Khẩn cấp, P1 Cơ hội, P2 Tối ưu) kèm tính năng 1-click đồng bộ lịch sang Google Calendar.' },
                ] as const
              ).map(({ tone, Icon, title, text }) => (
                <div key={title} className={`${CARD} space-y-2 p-4`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-control ${TILE[tone]}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-fg">{title}</span>
                  </div>
                  <p className="text-small leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Step 5: ready */}
          {current.illustrationType === 'ready_action' && (
            <div className="space-y-5 pt-2 animate-in fade-in duration-300">
              <div className="space-y-3 rounded-card border border-line bg-surface-2 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                  <h4 className="text-sm font-semibold text-fg">Bạn muốn bắt đầu như thế nào?</h4>
                </div>
                <p className="text-sm leading-relaxed text-muted">Chọn một trong 3 cách thức bên dưới để bắt đầu trải nghiệm sức mạnh phân tích của EcomPulse AI:</p>

                <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onLoadDemoSample) onLoadDemoSample();
                    }}
                    className="space-y-2 rounded-control bg-primary p-4 text-left text-primary-contrast transition-opacity hover:opacity-90"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-control bg-white/20">
                      <Play className="h-4 w-4 fill-current" aria-hidden />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold">1. Nạp Demo 1-Click</span>
                      <span className="block text-small leading-tight opacity-90">Shopee Mega 8.8 (3.260 đơn)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenUpload) onOpenUpload();
                    }}
                    className={`${CARD} space-y-2 p-4 text-left transition-colors hover:bg-hover`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-control ${TILE.primary}`}>
                      <Upload className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-fg">2. Tải Lên File Của Bạn</span>
                      <span className="block text-small leading-tight text-muted">Excel Shopee, TikTok Shop</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenChatWithPrompt) onOpenChatWithPrompt('Shop tui mới bắt đầu thì nên xem chỉ số nào trước?');
                    }}
                    className={`${CARD} space-y-2 p-4 text-left transition-colors hover:bg-hover`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-control ${TILE.info}`}>
                      <Bot className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-fg">3. Chat Với Dolphin AI</span>
                      <span className="block text-small leading-tight text-muted">Hỏi đáp &amp; Nhận tư vấn trực tiếp</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Footer navigation */}
        <div className="flex shrink-0 items-center justify-between border-t border-line bg-surface px-6 py-4">
          {currentStep > 0 ? (
            <button type="button" onClick={handlePrev} className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-hover">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span>Quay lại</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-small text-muted">
              <Lock className="h-3.5 w-3.5 text-up" aria-hidden />
              <span>Bảo mật On-Premise 100% trong RAM</span>
            </span>
          )}

          {currentStep < steps.length - 1 ? (
            <button type="button" onClick={handleNext} className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-contrast transition-opacity hover:opacity-90">
              <span>Bước tiếp theo</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-6 text-sm font-semibold text-primary-contrast transition-opacity hover:opacity-90">
              <span>Hoàn tất & Bắt đầu</span>
              <Check className="h-4 w-4 stroke-[3]" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
