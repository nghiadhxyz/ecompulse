import React, { useEffect, useState } from 'react';
import { Cloud, Cpu, Lock, ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  getAiPrivacyMode,
  getCloudConsentDate,
  getLocalLlmConfig,
  grantCloudConsent,
  onAiPrivacyChange,
  PRIVACY_MODE_INFO,
  revokeCloudConsent,
  setAiPrivacyMode,
  setLocalLlmConfig,
  testLocalLlm,
  type AiPrivacyMode,
} from '../../utils/aiPrivacy';
import { GhostButton, PrimaryButton, Section } from '../seller/ui';

const ICON: Record<AiPrivacyMode, typeof Lock> = { local_only: Lock, privacy_ai: Cpu, cloud_ai: Cloud };

/** Hook: current privacy mode, re-rendered when it changes anywhere in the app. */
export function useAiPrivacyMode(): AiPrivacyMode {
  const [mode, setMode] = useState(getAiPrivacyMode);
  useEffect(() => onAiPrivacyChange(() => setMode(getAiPrivacyMode())), []);
  return mode;
}

export const AiPrivacySettings: React.FC<{ lang: 'vi' | 'en' }> = ({ lang }) => {
  const vi = lang === 'vi';
  const mode = useAiPrivacyMode();
  const [consentDate, setConsentDate] = useState(getCloudConsentDate);
  const [askConsent, setAskConsent] = useState(false);
  const [agree, setAgree] = useState(false);
  const [llm, setLlm] = useState(getLocalLlmConfig);
  const [test, setTest] = useState<{ state: 'idle' | 'loading' | 'ok' | 'error'; text?: string }>({ state: 'idle' });

  const choose = (m: AiPrivacyMode) => {
    if (m === 'cloud_ai' && !getCloudConsentDate()) {
      setAskConsent(true);
      setAgree(false);
      return;
    }
    setAiPrivacyMode(m);
  };

  const runTest = async () => {
    setLocalLlmConfig(llm);
    setTest({ state: 'loading' });
    try {
      const models = await testLocalLlm(llm);
      setTest({ state: 'ok', text: models.length ? `${vi ? 'Model có sẵn' : 'Models'}: ${models.slice(0, 6).join(', ')}` : vi ? 'Kết nối được, chưa thấy model nào.' : 'Connected, no models listed.' });
    } catch (e) {
      setTest({
        state: 'error',
        text: vi
          ? `Không kết nối được (${e instanceof Error ? e.message : 'lỗi'}). Với Ollama, chạy với OLLAMA_ORIGINS cho phép trang này (CORS).`
          : `Could not connect (${e instanceof Error ? e.message : 'error'}). For Ollama, set OLLAMA_ORIGINS to allow this page (CORS).`,
      });
    }
  };

  return (
    <Section
      title={vi ? 'Quyền riêng tư AI' : 'AI privacy'}
      subtitle={vi ? 'Chọn nơi Dolphin được phép gửi câu hỏi. Số liệu luôn được tính trên máy bạn — AI chỉ diễn đạt lại.' : 'Choose where Dolphin may send questions. Numbers are always computed locally — AI only rephrases.'}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2" role="radiogroup" aria-label={vi ? 'Chế độ AI' : 'AI mode'}>
        {(Object.keys(PRIVACY_MODE_INFO) as AiPrivacyMode[]).map((m) => {
          const Icon = ICON[m];
          const info = PRIVACY_MODE_INFO[m];
          const active = mode === m;
          return (
            <button
              key={m}
              role="radio"
              aria-checked={active}
              onClick={() => choose(m)}
              className={`text-left rounded-xl border p-3 ${active ? 'border-sky-500 bg-sky-500/10' : 'border-white/10 hover:bg-white/[0.04]'}`}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Icon className="w-4 h-4" aria-hidden /> {vi ? info.vi : info.en}
                {active && <CheckCircle2 className="w-4 h-4 text-sky-300 ml-auto" aria-label={vi ? 'Đang chọn' : 'Selected'} />}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{vi ? info.descVi : info.descEn}</p>
            </button>
          );
        })}
      </div>

      {askConsent && (
        <div className="mt-3 rounded-xl border border-[#fab219]/40 bg-[#fab219]/[0.06] p-3" role="dialog" aria-label={vi ? 'Xác nhận Cloud AI' : 'Cloud AI consent'}>
          <h3 className="text-sm font-bold text-white">{vi ? 'Trước khi bật Cloud AI' : 'Before enabling Cloud AI'}</h3>
          <ul className="text-xs text-slate-300 mt-1.5 space-y-1 list-disc pl-4">
            <li>{vi ? 'Được gửi: số liệu tổng hợp đã tính (doanh thu, số đơn, tỷ lệ, tên SKU/kênh) và câu hỏi của bạn.' : 'Sent: computed aggregates (revenue, orders, rates, SKU/channel names) and your question.'}</li>
            <li>{vi ? 'Không gửi: file Excel gốc, danh sách đơn, tên/SĐT/địa chỉ người mua, mã người mua.' : 'Never sent: raw Excel, order rows, buyer names/phones/addresses/IDs.'}</li>
            <li>{vi ? 'Dữ liệu đi qua máy chủ EcomPulse tới Google Gemini và chịu điều khoản của Google. Đây không phải "zero knowledge".' : 'Data passes through the EcomPulse server to Google Gemini under Google terms. This is not "zero knowledge".'}</li>
            <li>{vi ? 'AI không tính số liệu và có thể diễn đạt sai — luôn đối chiếu với phần Bằng chứng.' : 'AI does not compute numbers and can phrase things wrongly — always check the Evidence.'}</li>
          </ul>
          <label className="flex items-center gap-2 text-xs text-slate-200 mt-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            {vi ? 'Tôi đã đọc và đồng ý gửi số liệu tổng hợp đã ẩn danh tới Cloud AI.' : 'I understand and agree to send anonymized aggregates to Cloud AI.'}
          </label>
          <div className="flex gap-2 mt-2">
            <PrimaryButton
              disabled={!agree}
              onClick={() => {
                grantCloudConsent();
                setAiPrivacyMode('cloud_ai');
                setConsentDate(getCloudConsentDate());
                setAskConsent(false);
              }}
            >
              {vi ? 'Bật Cloud AI' : 'Enable Cloud AI'}
            </PrimaryButton>
            <GhostButton onClick={() => setAskConsent(false)}>{vi ? 'Hủy' : 'Cancel'}</GhostButton>
          </div>
        </div>
      )}

      {mode === 'cloud_ai' && consentDate && (
        <p className="text-xs text-slate-400 mt-3 flex flex-wrap items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
          {vi ? `Đã đồng ý lúc ${new Date(consentDate).toLocaleString('vi-VN')}.` : `Consent given ${new Date(consentDate).toLocaleString('en-US')}.`}
          <button
            className="underline underline-offset-2 text-slate-300"
            onClick={() => {
              revokeCloudConsent();
              setConsentDate(null);
            }}
          >
            {vi ? 'Rút lại đồng ý (về Local Only)' : 'Revoke (back to Local Only)'}
          </button>
        </p>
      )}

      {mode === 'privacy_ai' && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h3 className="text-xs font-bold text-slate-300 mb-2">{vi ? 'Mô hình trên máy (OpenAI-compatible: Ollama, LM Studio, llama.cpp…)' : 'On-device model (OpenAI-compatible)'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-2 items-end">
            <label className="text-xs text-slate-400">
              {vi ? 'Địa chỉ' : 'Base URL'}
              <input value={llm.baseUrl} onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })} className="mt-1 w-full bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1.5 text-sm text-slate-100" />
            </label>
            <label className="text-xs text-slate-400">
              Model
              <input value={llm.model} onChange={(e) => setLlm({ ...llm, model: e.target.value })} className="mt-1 w-full bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1.5 text-sm text-slate-100" />
            </label>
            <GhostButton onClick={runTest}>
              {test.state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
              {vi ? 'Lưu & kiểm tra' : 'Save & test'}
            </GhostButton>
          </div>
          {test.state === 'ok' && <p className="text-xs text-[#4ade80] mt-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> {test.text}</p>}
          {test.state === 'error' && <p className="text-xs text-[#f87171] mt-2 flex items-start gap-1"><XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden /> {test.text}</p>}
        </div>
      )}
    </Section>
  );
};
