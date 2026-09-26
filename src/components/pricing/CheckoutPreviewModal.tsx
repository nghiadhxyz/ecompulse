import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  CreditCard,
  QrCode,
  Wallet,
  Building2,
  Tag,
  ArrowRight,
  Zap,
  Clock,
  HelpCircle,
  Briefcase,
  Crown,
  FileText,
  PhoneCall,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PricingPlan, UserSubscription } from '../../types/pricing';
import {
  validatePromoCode,
  saveSubscription,
  formatVND,
} from '../../utils/subscriptionStorage';

interface CheckoutPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PricingPlan | null;
  language: 'vi' | 'en';
  onSubscriptionSuccess: (sub: UserSubscription) => void;
}

export const CheckoutPreviewModal: React.FC<CheckoutPreviewModalProps> = ({
  isOpen,
  onClose,
  plan,
  language,
  onSubscriptionSuccess,
}) => {
  const isEnterprise = plan?.id === 'enterprise';

  const [promoInput, setPromoInput] = useState<string>(
    plan?.id === 'pro_monthly' ? 'ECOMPULSE119' : ''
  );
  const [promoMessage, setPromoMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(
    plan?.id === 'pro_monthly'
      ? { text: 'Áp dụng mã ưu đãi tháng đầu tiên: 119.000 VNĐ', isError: false }
      : null
  );
  const [discountAmount, setDiscountAmount] = useState<number>(
    plan?.id === 'pro_monthly' ? 180000 : 0
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    'vietqr' | 'momo' | 'card' | 'bank'
  >('vietqr');
  const [shopName, setShopName] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [storeCount, setStoreCount] = useState('5-20');
  const [customRequirement, setCustomRequirement] = useState('');
  const [wantsVat, setWantsVat] = useState(isEnterprise);
  const [isActivating, setIsActivating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !plan) return null;

  const basePrice = plan.price;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const handleApplyPromo = () => {
    const res = validatePromoCode(promoInput, plan.id, language);
    if (res.valid) {
      setDiscountAmount(res.discountAmount);
      setPromoMessage({ text: res.message, isError: false });
    } else {
      setDiscountAmount(0);
      setPromoMessage({ text: res.message, isError: true });
    }
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // Ignore if confetti not supported
    }
  };

  const handleConfirmActivation = () => {
    setIsActivating(true);
    setTimeout(() => {
      const newSub = saveSubscription(
        plan.id,
        plan.id === 'pro_semi_annual' ? 6 : plan.id === 'enterprise' ? 12 : 1
      );
      setIsActivating(false);
      setIsSuccess(true);
      triggerConfetti();

      setTimeout(() => {
        onSubscriptionSuccess(newSub);
        setIsSuccess(false);
        onClose();
      }, 1800);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-3xl bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 border border-white/20 shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Modal Top Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl border ${
              isEnterprise
                ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                : 'bg-blue-500/20 border-blue-400/30 text-blue-300'
            }`}>
              {isEnterprise ? <Crown className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                {isEnterprise
                  ? language === 'vi'
                    ? 'Đăng Ký Tư Vấn & Báo Giá Gói Enterprise'
                    : 'Enterprise Custom Quote Inquiry'
                  : language === 'vi'
                  ? 'Xem Trước Đăng Ký Gói'
                  : 'Checkout Preview'}
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  isEnterprise
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-bold'
                    : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                }`}>
                  {plan.name}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isEnterprise
                  ? language === 'vi'
                    ? 'Tùy biến SLA, API riêng, Multimodal AI và bảo mật dữ liệu tuyệt đối'
                    : 'Custom SLA, Private API, Multimodal AI & Legal compliance'
                  : language === 'vi'
                  ? 'Kích hoạt ngay để mở khóa toàn bộ sức mạnh AI & Tự động hóa'
                  : 'Activate now to unlock AI decision tools and automation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          /* Success Screen */
          <div className="p-10 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-2xl font-black text-white">
              {isEnterprise
                ? language === 'vi'
                  ? 'Đã Ghi Nhận Yêu Cầu Enterprise & Mở Khóa Thử Nghiệm! 🎉'
                  : 'Enterprise Request Received & Trial Activated! 🎉'
                : language === 'vi'
                ? 'Nâng Cấp Thành Công! 🎉'
                : 'Upgrade Successful! 🎉'}
            </h4>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              {isEnterprise
                ? language === 'vi'
                  ? 'Kỹ sư giải pháp của EcomPulse sẽ liên hệ qua Zalo/Email trong vòng 2 giờ làm việc để tư vấn tích hợp API và gửi báo giá chi tiết.'
                  : 'An EcomPulse Solution Engineer will contact you within 2 hours for API setup and custom quotation.'
                : language === 'vi'
                ? `Bạn đã mở khóa thành công ${plan.name}. Toàn bộ tính năng AI RAG, Gmail Alert và Bộ thẻ hành động đã sẵn sàng!`
                : `Successfully activated ${plan.name}. All AI RAG features and smart action cards are ready!`}
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isEnterprise
                  ? language === 'vi'
                    ? 'Trạng thái: Kích hoạt Enterprise Trial (Local-First)'
                    : 'Status: Enterprise Trial Active'
                  : language === 'vi'
                  ? 'Trạng thái: Hoạt động (Active)'
                  : 'Status: Active'}
              </span>
            </div>
          </div>
        ) : (
          /* Checkout Content Form */
          <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
            {/* 1. Plan Summary Card */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'vi' ? 'Gói Dịch Vụ Đã Chọn' : 'Selected Plan'}
                </span>
                <h4 className="text-base font-black text-white flex items-center gap-2">
                  {plan.name}
                  {isEnterprise && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/30">
                      SLA Riêng
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-300">{plan.targetAudience}</p>
              </div>
              <div className="text-left sm:text-right">
                {isEnterprise ? (
                  <div>
                    <div className="text-lg font-black text-cyan-300">
                      {language === 'vi' ? 'Báo Giá Theo Nhu Cầu' : 'Custom Quote'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {language === 'vi' ? 'Thanh toán Quý / Năm' : 'Quarterly / Annual'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-slate-400 line-through">
                      {plan.originalPrice && plan.originalPrice > plan.price
                        ? formatVND(plan.originalPrice)
                        : ''}
                    </div>
                    <div className="text-xl font-black text-emerald-400">
                      {formatVND(finalPrice)}
                    </div>
                    <div className="text-[11px] text-slate-400">{plan.billingText}</div>
                  </>
                )}
              </div>
            </div>

            {/* 2. Promo Code Box (Only for non-enterprise) */}
            {!isEnterprise && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    {language === 'vi' ? 'Mã Khuyến Mãi / Voucher Ưu Đãi' : 'Promo Code / Voucher'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {language === 'vi' ? 'Gợi ý: ECOMPULSE119, AIRISER2026' : 'Try: ECOMPULSE119, AIRISER2026'}
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder={language === 'vi' ? 'Nhập mã giảm giá...' : 'Enter promo code...'}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950/60 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-400 font-mono tracking-wider uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-xs font-bold text-white transition-all"
                  >
                    {language === 'vi' ? 'Áp Dụng' : 'Apply'}
                  </button>
                </div>
                {promoMessage && (
                  <p
                    className={`text-[11px] font-medium flex items-center gap-1 ${
                      promoMessage.isError ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {promoMessage.text}
                  </p>
                )}
              </div>
            )}

            {/* 3. Shop & Customer Info Form */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                {isEnterprise
                  ? language === 'vi'
                    ? 'Thông Tin Doanh Nghiệp / Thương Hiệu / Agency'
                    : 'Enterprise & Agency Information'
                  : language === 'vi'
                  ? 'Thông Tin Gian Hàng & Liên Hệ'
                  : 'Merchant & Contact Info'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder={
                      isEnterprise
                        ? language === 'vi'
                          ? 'Tên Công Ty / Thương Hiệu / Agency'
                          : 'Company / Brand / Agency name'
                        : language === 'vi'
                        ? 'Tên gian hàng / Shop TMĐT'
                        : 'Store name / Shop'
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder={
                      isEnterprise
                        ? language === 'vi'
                          ? 'Họ tên Người phụ trách / CEO / CMO'
                          : 'Representative full name'
                        : language === 'vi'
                        ? 'Họ và tên chủ shop'
                        : 'Owner full name'
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      language === 'vi'
                        ? 'Email công ty nhận báo giá & hợp đồng'
                        : 'Company email for quote & SLA'
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={
                      language === 'vi'
                        ? 'Số điện thoại / Zalo kết nối 1-1'
                        : 'Phone / Zalo for 1-1 support'
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {isEnterprise && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {language === 'vi' ? 'Số lượng gian hàng quản lý:' : 'Number of managed stores:'}
                    </label>
                    <select
                      value={storeCount}
                      onChange={(e) => setStoreCount(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400"
                    >
                      <option value="1-3">1 - 3 Gian hàng (Shopee/TikTok Shop)</option>
                      <option value="5-20">5 - 20 Gian hàng (Thương hiệu lớn)</option>
                      <option value="20+">&gt; 20 Gian hàng (Agency / Chuỗi bán buôn)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {language === 'vi' ? 'Yêu cầu tính năng trọng tâm:' : 'Key focus requirement:'}
                    </label>
                    <input
                      type="text"
                      value={customRequirement}
                      onChange={(e) => setCustomRequirement(e.target.value)}
                      placeholder={
                        language === 'vi'
                          ? 'Ví dụ: Multimodal AI hóa đơn, API ERP riêng...'
                          : 'E.g. Custom API ERP, Multimodal OCR...'
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vat-check"
                  checked={wantsVat}
                  onChange={(e) => setWantsVat(e.target.checked)}
                  className="rounded bg-slate-950/80 border-white/20 text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <label
                  htmlFor="vat-check"
                  className="text-[11px] text-slate-300 cursor-pointer select-none"
                >
                  {language === 'vi'
                    ? 'Yêu cầu xuất hóa đơn điện tử VAT cho công ty & Hợp đồng SLA bảo hành'
                    : 'Request official electronic VAT invoice & SLA Contract'}
                </label>
              </div>
            </div>

            {/* 4. Payment Gateway Placeholder / Enterprise Notice */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  {isEnterprise
                    ? language === 'vi'
                      ? 'Hình Thức Hợp Tác Doanh Nghiệp'
                      : 'Enterprise Partnership Mode'
                    : language === 'vi'
                    ? 'Phương Thức Thanh Toán (Tích Hợp Sẵn)'
                    : 'Payment Method'}
                </span>
                <span className="text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-400/20 font-bold">
                  {isEnterprise
                    ? language === 'vi'
                      ? 'Kỹ sư 1-1 chuyên trách'
                      : 'Dedicated Engineer'
                    : language === 'vi'
                    ? 'Cổng thanh toán tự động'
                    : 'Automatic gateway'}
                </span>
              </div>

              {isEnterprise ? (
                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-2 text-xs text-slate-200">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {language === 'vi'
                        ? 'Cam Kết Pháp Lý & Bảo Mật Quyền Riêng Tư'
                        : 'Legal Compliance & Enterprise Data Privacy Shield'}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {language === 'vi'
                      ? 'Hợp đồng dịch vụ doanh nghiệp chính thức, bảo mật dữ liệu On-Premise 100%, bảo hành tính sẵn sàng hệ thống (Uptime SLA 99.9%) và xuất hóa đơn VAT theo quý hoặc theo năm.'
                      : 'Official corporate contract, 100% On-Premise zero data leakage, 99.9% Uptime SLA and quarterly/annual VAT invoices.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('vietqr')}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPaymentMethod === 'vietqr'
                        ? 'bg-blue-600/20 border-blue-400 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-cyan-400 mb-2" />
                    <div>
                      <p className="text-xs font-bold leading-tight">VietQR 24/7</p>
                      <p className="text-[10px] text-slate-400">Quét mã Napas</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('momo')}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPaymentMethod === 'momo'
                        ? 'bg-pink-600/20 border-pink-400 text-white shadow-lg shadow-pink-500/10'
                        : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <Wallet className="w-5 h-5 text-pink-400 mb-2" />
                    <div>
                      <p className="text-xs font-bold leading-tight">Ví MoMo / Zalo</p>
                      <p className="text-[10px] text-slate-400">Thanh toán ví</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPaymentMethod === 'card'
                        ? 'bg-indigo-600/20 border-indigo-400 text-white shadow-lg shadow-indigo-500/10'
                        : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-indigo-400 mb-2" />
                    <div>
                      <p className="text-xs font-bold leading-tight">Visa / Master</p>
                      <p className="text-[10px] text-slate-400">Thẻ quốc tế</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('bank')}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPaymentMethod === 'bank'
                        ? 'bg-emerald-600/20 border-emerald-400 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-emerald-400 mb-2" />
                    <div>
                      <p className="text-xs font-bold leading-tight">Chuyển Khoản</p>
                      <p className="text-[10px] text-slate-400">Doanh nghiệp</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 5. Total Price & Activation Button */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-slate-400 block">
                  {isEnterprise
                    ? language === 'vi'
                      ? 'Phương án hợp tác:'
                      : 'Engagement Model:'
                    : language === 'vi'
                    ? 'Tổng thanh toán:'
                    : 'Total Payment:'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-black text-white">
                    {isEnterprise
                      ? language === 'vi'
                        ? 'Báo Giá Theo Nhu Cầu'
                        : 'Custom Enterprise Quote'
                      : formatVND(finalPrice)}
                  </span>
                  {!isEnterprise && discountAmount > 0 && (
                    <span className="text-xs text-emerald-400 font-semibold">
                      (Tiết kiệm {formatVND(discountAmount)})
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isActivating}
                onClick={handleConfirmActivation}
                className={`py-3 px-6 rounded-2xl text-white font-bold text-sm shadow-xl border border-white/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                  isEnterprise
                    ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 shadow-cyan-500/25'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/25'
                }`}
              >
                {isActivating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {isEnterprise
                        ? language === 'vi'
                          ? 'Đang gửi yêu cầu tư vấn...'
                          : 'Submitting request...'
                        : language === 'vi'
                        ? 'Đang kích hoạt gói...'
                        : 'Activating plan...'}
                    </span>
                  </>
                ) : (
                  <>
                    {isEnterprise ? (
                      <PhoneCall className="w-4 h-4 text-cyan-200" />
                    ) : (
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                    )}
                    <span>
                      {isEnterprise
                        ? language === 'vi'
                          ? 'Gửi Yêu Cầu & Kích Hoạt Tư Vấn 1-1'
                          : 'Submit & Request 1-on-1 Consult'
                        : language === 'vi'
                        ? 'Kích Hoạt Ngay (Trải Nghiệm)'
                        : 'Activate Now (Instant)'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
