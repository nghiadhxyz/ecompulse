import React, { useMemo, useState } from 'react';
import { Send, Sparkles, Loader2, Lock, Cpu, Cloud } from 'lucide-react';
import { askDolphin, answerToAiPayload, fmtByUnit, formatRangeVi, questionUnavailable, SUGGESTED_QUESTIONS, type Bilingual, type DolphinAnswer } from '../../analytics';
import { aiRephrase, type AiReply } from '../../utils/aiClient';
import { PRIVACY_MODE_INFO } from '../../utils/aiPrivacy';
import { useAiPrivacyMode } from '../workspace/AiPrivacySettings';
import { useWorkspace } from './SellerContext';
import { EvidenceButton, tr } from './ui';
import dolphinAvatar from '../../assets/images/dolphin_ai_avatar_1787721342181.jpg';

const MODE_ICON = { local_only: Lock, privacy_ai: Cpu, cloud_ai: Cloud };

interface Turn {
  answer: DolphinAnswer;
  ai?: AiReply | 'loading';
}

export const DolphinAsk: React.FC = () => {
  const { lang, dataset, range, previousRange, platforms, openEvidence, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const mode = useAiPrivacyMode();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const ctx = useMemo(() => ({ range, previousRange, platforms }), [range, previousRange, platforms]);
  const ModeIcon = MODE_ICON[mode];
  // Questions the loaded data cannot answer (no order export / COGS) are dimmed, with the reason.
  const blocked = useMemo(() => {
    const out = new Map<string, Bilingual>();
    for (const q of SUGGESTED_QUESTIONS) {
      const reason = questionUnavailable(dataset, q, ctx);
      if (reason) out.set(q, reason);
    }
    return out;
  }, [dataset, ctx]);
  const chip = (q: string, className: string) => {
    const reason = blocked.get(q);
    return (
      <button
        key={q}
        onClick={() => ask(q)}
        disabled={!!reason}
        title={reason ? tr(lang, reason) : undefined}
        aria-disabled={!!reason}
        className={`${className} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
      >
        {q}
      </button>
    );
  };

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    setTurns((t) => [{ answer: askDolphin(dataset, question, ctx) }, ...t].slice(0, 8));
    setInput('');
  };

  const rephrase = async (i: number) => {
    const turn = turns[i];
    setTurns((t) => t.map((x, k) => (k === i ? { ...x, ai: 'loading' } : x)));
    const ai = await aiRephrase(answerToAiPayload(turn.answer, lang), lang);
    setTurns((t) => t.map((x) => (x.answer === turn.answer ? { ...x, ai } : x)));
  };

  return (
    <section className="glass-panel rounded-2xl p-4 sm:p-5" aria-label={vi ? 'Hỏi Dolphin' : 'Ask Dolphin'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <img src={dolphinAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <h2 className="text-base font-black text-white">{vi ? 'Hỏi Dolphin' : 'Ask Dolphin'}</h2>
            <p className="text-xs text-slate-400">{vi ? `Trả lời bằng số liệu ${formatRangeVi(range)} so với ${formatRangeVi(previousRange)}` : `Answers from ${formatRangeVi(range)} vs ${formatRangeVi(previousRange)}`}</p>
          </div>
        </div>
        <button onClick={() => goTo('settings')} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg border border-white/15 text-slate-300 hover:bg-white/[0.06]" title={vi ? 'Đổi chế độ quyền riêng tư AI' : 'Change AI privacy mode'}>
          <ModeIcon className="w-3.5 h-3.5" aria-hidden /> {vi ? PRIVACY_MODE_INFO[mode].vi : PRIVACY_MODE_INFO[mode].en}
        </button>
      </div>

      <form
        className="flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="dolphin-q" className="sr-only">{vi ? 'Câu hỏi' : 'Question'}</label>
        <input
          id="dolphin-q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={vi ? 'Ví dụ: Tại sao lợi nhuận giảm?' : 'e.g. Why did profit drop?'}
          className="flex-1 min-w-0 bg-white/[0.06] border border-white/15 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button type="submit" className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold" aria-label={vi ? 'Hỏi' : 'Ask'}>
          <Send className="w-4 h-4" aria-hidden />
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {[...SUGGESTED_QUESTIONS].sort((a, b) => Number(blocked.has(a)) - Number(blocked.has(b))).map((q) => chip(q, 'text-[11px] px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:bg-white/[0.06]'))}
      </div>
      {blocked.size > 0 && (
        <p className="text-[11px] text-slate-500 mt-1">
          {vi ? `Câu hỏi mờ chưa trả lời được với dữ liệu hiện có (cần file xuất đơn hàng hoặc giá vốn) — di chuột để xem lý do.` : 'Dimmed questions need an order export or COGS — hover for the reason.'}
        </p>
      )}

      <div className="space-y-3 mt-4">
        {turns.map((t, i) => {
          const a = t.answer;
          return (
            <article key={`${a.question}-${turns.length - i}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs text-slate-400 mb-2">
                <b className="text-slate-200">{vi ? 'Bạn hỏi: ' : 'You asked: '}</b>
                {a.question}
              </p>
              <div className="space-y-2.5">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-sky-300">{vi ? 'Nhận định' : 'Insight'}</h3>
                  <p className="text-sm text-slate-100 leading-relaxed">{tr(lang, a.insight)}</p>
                </div>
                {a.evidence.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-sky-300">{vi ? 'Bằng chứng' : 'Evidence'}</h3>
                    <ul className="mt-1 space-y-1">
                      {a.evidence.map((e, k) => (
                        <li key={k} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 border-b border-white/5 pb-1">
                          <span className="min-w-0">
                            <b className="text-slate-100">{tr(lang, e.label)}</b>
                            {e.current !== null && <>: {fmtByUnit(e.current, e.unit, lang)}</>} <span className="text-slate-500">({tr(lang, e.currentLabel)})</span>
                            {e.baseline !== undefined && e.baseline !== null && (
                              <>
                                {' · '}
                                {fmtByUnit(e.baseline, e.unit, lang)} <span className="text-slate-500">({e.baselineLabel ? tr(lang, e.baselineLabel) : ''})</span>
                              </>
                            )}
                            {e.sampleSize !== undefined && <span className="text-slate-500"> · n={e.sampleSize}</span>}
                          </span>
                          {e.filter && <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, e.label), filter: e.filter!, evidence: [e] })} />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-sky-300">{vi ? 'Diễn giải' : 'Interpretation'}</h3>
                  <p className="text-sm text-slate-200 leading-relaxed">{tr(lang, a.interpretation)}</p>
                </div>
                {a.nextChecks.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-sky-300">{vi ? 'Nên kiểm tra tiếp' : 'Next check'}</h3>
                    <ul className="list-disc pl-4 text-sm text-slate-200 space-y-0.5">
                      {a.nextChecks.map((c, k) => (
                        <li key={k}>{tr(lang, c)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {a.intent !== 'unknown' && !a.unavailable && mode !== 'local_only' && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  {t.ai === undefined && (
                    <button onClick={() => rephrase(i)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200">
                      <Sparkles className="w-3.5 h-3.5" aria-hidden />
                      {vi ? `Diễn đạt lại bằng ${PRIVACY_MODE_INFO[mode].vi}` : `Rephrase with ${PRIVACY_MODE_INFO[mode].en}`}
                    </button>
                  )}
                  {t.ai === 'loading' && (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> {vi ? 'Đang diễn đạt lại…' : 'Rephrasing…'}</p>
                  )}
                  {t.ai && t.ai !== 'loading' && (
                    <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      <p className="text-[10px] text-slate-500 mb-1">
                        {t.ai.source === 'cloud' || t.ai.source === 'local_llm'
                          ? vi ? 'AI diễn đạt lại từ số liệu ở trên — không tính số mới. Luôn đối chiếu phần Bằng chứng.' : 'AI rephrasing of the numbers above — no new calculations.'
                          : ''}
                      </p>
                      {t.ai.text}
                    </div>
                  )}
                </div>
              )}
              {a.followUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {a.followUps.filter((q) => !blocked.has(q)).map((q) => chip(q, 'text-[11px] px-2 py-0.5 rounded-lg border border-white/10 text-slate-400 hover:text-white'))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        {vi
          ? 'Dolphin tính mọi con số trên máy của bạn và chỉ nói điều số liệu cho thấy — không khẳng định nguyên nhân, không dự đoán chắc chắn.'
          : 'Dolphin computes every number on your device and only states what the data shows — no causal claims, no guaranteed predictions.'}
      </p>
    </section>
  );
};
