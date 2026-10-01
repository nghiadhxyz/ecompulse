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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" role="radiogroup" aria-label={vi ? 'Chế độ AI' : 'AI mode'}>
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
              className={`rounded-control border p-3.5 text-left ${active ? 'border-primary bg-primary-soft ring-2 ring-primary/20' : 'border-line hover:bg-hover'}`}
            >
              <div className={`flex items-center gap-2 text-sm font-semibold ${active ? 'text-primary' : 'text-fg'}`}>
                <Icon className="h-4 w-4" aria-hidden /> {vi ? info.vi : info.en}
                {active && <CheckCircle2 className="ml-auto h-4 w-4" aria-label={vi ? 'Đang chọn' : 'Selected'} />}
              </div>
              <p className="mt-1 text-small leading-relaxed text-muted">{vi ? info.descVi : info.descEn}</p>
            </button>
          );
        })}
      </div>

      {askConsent && (
        <div className="mt-4 rounded-control border border-warn/40 bg-warn-soft p-4" role="dialog" aria-label={vi ? 'Xác nhận Cloud AI' : 'Cloud AI consent'}>
          <h3 className="text-sm font-semibold text-fg">{vi ? 'Trước khi bật Cloud AI' : 'Before enabling Cloud AI'}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg">
            <li>{vi ? 'Được gửi: số liệu tổng hợp đã tính (doanh thu, số đơn, tỷ lệ, tên SKU/kênh) và câu hỏi của bạn.' : 'Sent: computed aggregates (revenue, orders, rates, SKU/channel names) and your question.'}</li>
            <li>{vi ? 'Không gửi: file Excel gốc, danh sách đơn, tên/SĐT/địa chỉ người mua, mã người mua.' : 'Never sent: raw Excel, order rows, buyer names/phones/addresses/IDs.'}</li>
            <li>{vi ? 'Dữ liệu đi qua máy chủ EcomPulse tới Google Gemini và chịu điều khoản của Google. Đây không phải "zero knowledge".' : 'Data passes through the EcomPulse server to Google Gemini under Google terms. This is not "zero knowledge".'}</li>
            <li>{vi ? 'AI không tính số liệu và có thể diễn đạt sai — luôn đối chiếu với phần Bằng chứng.' : 'AI does not compute numbers and can phrase things wrongly — always check the Evidence.'}</li>
          </ul>
          <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-fg">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-4 w-4 accent-primary" />
            {vi ? 'Tôi đã đọc và đồng ý gửi số liệu tổng hợp đã ẩn danh tới Cloud AI.' : 'I understand and agree to send anonymized aggregates to Cloud AI.'}
          </label>
          <div className="mt-2 flex gap-2">
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
        <p className="mt-3 flex flex-wrap items-center gap-2 text-small text-muted">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {vi ? `Đã đồng ý lúc ${new Date(consentDate).toLocaleString('vi-VN')}.` : `Consent given ${new Date(consentDate).toLocaleString('en-US')}.`}
          <button
            type="button"
            className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline"
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
        <div className="mt-4 rounded-control border border-line bg-surface-2 p-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">{vi ? 'Mô hình trên máy (OpenAI-compatible: Ollama, LM Studio, llama.cpp…)' : 'On-device model (OpenAI-compatible)'}</h3>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_200px_auto]">
            <label className="text-small font-medium text-muted">
              {vi ? 'Địa chỉ' : 'Base URL'}
              <input value={llm.baseUrl} onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })} className="mt-1 min-h-10 w-full rounded-control border border-line bg-surface px-2.5 text-sm text-fg" />
            </label>
            <label className="text-small font-medium text-muted">
              Model
              <input value={llm.model} onChange={(e) => setLlm({ ...llm, model: e.target.value })} className="mt-1 min-h-10 w-full rounded-control border border-line bg-surface px-2.5 text-sm text-fg" />
            </label>
            <GhostButton onClick={runTest}>
              {test.state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {vi ? 'Lưu & kiểm tra' : 'Save & test'}
            </GhostButton>
          </div>
          {test.state === 'ok' && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-up">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> {test.text}
            </p>
          )}
          {test.state === 'error' && (
            <p className="mt-3 flex items-start gap-1.5 rounded-control bg-down-soft px-3 py-2 text-sm text-down">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {test.text}
            </p>
          )}
        </div>
      )}
    </Section>
  );
};
