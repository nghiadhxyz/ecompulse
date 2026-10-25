import React, { useMemo, useState } from 'react';
import { Send, Sparkles, Loader2, Lock, Cpu, Cloud } from 'lucide-react';
import Markdown from 'react-markdown';
import { askDolphin, answerToAiPayload, compareRanges, fmtByUnit, formatRangeVi, questionUnavailable, SUGGESTED_QUESTIONS, type Bilingual, type DolphinAnswer } from '../../analytics';
import { aiChat, aiRephrase, type AiReply } from '../../utils/aiClient';
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

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question) return;

    const localAnswer = askDolphin(dataset, question, ctx);
    const newTurn: Turn = {
      answer: localAnswer,
      ai: mode !== 'local_only' ? 'loading' : undefined,
    };

    setTurns((t) => [newTurn, ...t].slice(0, 8));
    setInput('');

    if (mode !== 'local_only') {
      try {
        let comparison: any = null;
        try {
          comparison = compareRanges(dataset, { range, platforms }, previousRange);
        } catch {
          comparison = null;
        }

        const analyticsData = {
          question,
          period: `${formatRangeVi(range)} so với ${formatRangeVi(previousRange)}`,
          platforms: platforms?.join(', ') || 'Tất cả các sàn',
          kpis: comparison?.metrics
            ? {
                paidRevenue: comparison.metrics.gmv.current,
                previousPaidRevenue: comparison.metrics.gmv.previous,
                revenueGrowthRate: comparison.metrics.gmv.percentageDelta,
                placedRevenue: comparison.metrics.placedGmv.current,
                paidOrders: comparison.metrics.orders.current,
                previousPaidOrders: comparison.metrics.orders.previous,
                cancelRate: comparison.metrics.cancelRate.current,
                adSpend: comparison.metrics.adSpend.current,
                roas: comparison.metrics.roas.current,
                aov: comparison.metrics.aov?.current,
              }
            : null,
          localInsight: tr(lang, localAnswer.insight),
          localInterpretation: tr(lang, localAnswer.interpretation),
          evidence: localAnswer.evidence?.map((e) => ({
            label: tr(lang, e.label),
            current: e.current,
            baseline: e.baseline,
          })),
          dailyMetricsTrends: dataset.dailyMetrics.slice(-20).map((d) => ({
            date: d.date,
            placedRevenue: d.placedGmv,
            paidRevenue: d.paidGmv,
            placedOrders: d.placedOrders,
            paidOrders: d.paidOrders,
            cancelledOrders: d.cancelledOrders,
          })),
          topProducts: dataset.products.slice(0, 8).map((p) => ({
            name: p.name,
            sku: p.sku,
            category: p.category,
            price: p.listPrice,
          })),
        };

        const res = await aiChat({
          message: question,
          history: turns.slice(0, 3).map((t) => ({
            role: 'assistant',
            content: typeof t.ai === 'object' && t.ai?.text ? t.ai.text : tr(lang, t.answer.insight),
          })),
          analyticsData,
          language: lang,
        });

        setTurns((prev) =>
          prev.map((item) => (item.answer === localAnswer ? { ...item, ai: res } : item))
        );
      } catch {
        setTurns((prev) =>
          prev.map((item) =>
            item.answer === localAnswer
              ? {
                  ...item,
                  ai: {
                    text:
                      lang === 'vi'
                        ? 'Không thể kết nối với mô hình AI lúc này. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.'
                        : 'Could not connect to AI model.',
                    source: 'unavailable',
                  },
                }
              : item
          )
        );
      }
    }
  };

  const rephrase = async (i: number) => {
    const turn = turns[i];
    setTurns((t) => t.map((x, k) => (k === i ? { ...x, ai: 'loading' } : x)));
    const ai = await aiRephrase(answerToAiPayload(turn.answer, lang), lang);
    setTurns((t) => t.map((x) => (x.answer === turn.answer ? { ...x, ai } : x)));
  };

  return (
    <section className="bg-surface border border-line shadow-card rounded-2xl p-4 sm:p-5" aria-label={vi ? 'Hỏi Dolphin' : 'Ask Dolphin'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <img src={dolphinAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <h2 className="text-base font-black text-fg">{vi ? 'Hỏi Dolphin' : 'Ask Dolphin'}</h2>
            <p className="text-xs text-muted">{vi ? `Trả lời bằng số liệu ${formatRangeVi(range)} so với ${formatRangeVi(previousRange)}` : `Answers from ${formatRangeVi(range)} vs ${formatRangeVi(previousRange)}`}</p>
          </div>
        </div>
        <button onClick={() => goTo('settings')} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg border border-line text-fg hover:bg-hover" title={vi ? 'Đổi chế độ quyền riêng tư AI' : 'Change AI privacy mode'}>
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
          className="flex-1 min-w-0 bg-surface-2 border border-line rounded-xl px-3 py-2 text-sm text-fg placeholder:text-muted"
        />
        <button type="submit" className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary text-primary-contrast text-sm font-bold" aria-label={vi ? 'Hỏi' : 'Ask'}>
          <Send className="w-4 h-4" aria-hidden />
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {[...SUGGESTED_QUESTIONS].sort((a, b) => Number(blocked.has(a)) - Number(blocked.has(b))).map((q) => chip(q, 'text-[11px] px-2 py-1 rounded-lg border border-line text-fg hover:bg-hover'))}
      </div>
      {blocked.size > 0 && (
        <p className="text-[11px] text-muted mt-1">
          {vi ? `Câu hỏi mờ chưa trả lời được với dữ liệu hiện có (cần file xuất đơn hàng hoặc giá vốn) — di chuột để xem lý do.` : 'Dimmed questions need an order export or COGS — hover for the reason.'}
        </p>
      )}

      <div className="space-y-3 mt-4">
        {turns.map((t, i) => {
          const a = t.answer;
          const aiReply: AiReply | null = typeof t.ai === 'object' && t.ai !== null ? t.ai : null;
          const hasAi = aiReply !== null;
          const isAiLoading = t.ai === 'loading';

          return (
            <article key={`${a.question}-${turns.length - i}`} className="rounded-xl border border-line bg-surface-2 p-3 sm:p-4 space-y-3">
              <p className="text-xs text-muted">
                <b className="text-fg">{vi ? 'Bạn hỏi: ' : 'You asked: '}</b>
                <span className="text-fg font-medium">{a.question}</span>
              </p>

              {/* 1. Gemini AI Analysis (shown when mode !== 'local_only') */}
              {isAiLoading && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span className="text-xs font-semibold">
                    {vi ? 'Dolphin Gemini AI đang phân tích dữ liệu cửa hàng...' : 'Dolphin Gemini AI is analyzing store data...'}
                  </span>
                </div>
              )}

              {aiReply && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-surface border border-primary/30 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>{vi ? 'Dolphin Gemini AI Trả Lời:' : 'Dolphin Gemini AI Answer:'}</span>
                    </div>
                    <span className="text-[10px] text-muted font-medium bg-surface-2 px-2 py-0.5 rounded-full border border-line">
                      {aiReply.source === 'cloud' ? 'Cloud AI (Gemini)' : 'AI Model'}
                    </span>
                  </div>
                  <div className="text-sm text-fg leading-relaxed">
                    <Markdown
                      components={{
                        h1: ({ children }) => <h1 className="text-base font-bold text-fg mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold text-primary mt-3 mb-1.5">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xs font-bold text-fg uppercase tracking-wider mt-3 mb-1">{children}</h3>,
                        p: ({ children }) => <p className="text-xs sm:text-sm text-fg leading-relaxed mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm text-fg my-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 text-xs sm:text-sm text-fg my-2">{children}</ol>,
                        li: ({ children }) => <li className="leading-snug">{children}</li>,
                        strong: ({ children }) => <strong className="font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">{children}</strong>,
                      }}
                    >
                      {aiReply.text}
                    </Markdown>
                  </div>
                </div>
              )}

              {/* 2. Structured Local Evidence */}
              <div className="pt-2 border-t border-line space-y-2.5">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-muted">
                    {vi ? (hasAi ? 'Chi tiết số liệu tính toán (Evidence Mode)' : 'Nhận định') : (hasAi ? 'Calculated numbers (Evidence Mode)' : 'Insight')}
                  </h3>
                  <p className="text-sm text-fg leading-relaxed">{tr(lang, a.insight)}</p>
                </div>
                {a.evidence.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-muted">{vi ? 'Bằng chứng' : 'Evidence'}</h3>
                    <ul className="mt-1 space-y-1">
                      {a.evidence.map((e, k) => (
                        <li key={k} className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg border-b border-line pb-1">
                          <span className="min-w-0">
                            <b className="text-fg">{tr(lang, e.label)}</b>
                            {e.current !== null && <>: {fmtByUnit(e.current, e.unit, lang)}</>} <span className="text-muted">({tr(lang, e.currentLabel)})</span>
                            {e.baseline !== undefined && e.baseline !== null && (
                              <>
                                {', '}
                                {fmtByUnit(e.baseline, e.unit, lang)} <span className="text-muted">({e.baselineLabel ? tr(lang, e.baselineLabel) : ''})</span>
                              </>
                            )}
                            {e.sampleSize !== undefined && <span className="text-muted">, n={e.sampleSize}</span>}
                          </span>
                          {e.filter && <EvidenceButton compact lang={lang} onClick={() => openEvidence({ title: tr(lang, e.label), filter: e.filter!, evidence: [e] })} />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.interpretation && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-muted">{vi ? 'Diễn giải' : 'Interpretation'}</h3>
                    <p className="text-sm text-fg leading-relaxed">{tr(lang, a.interpretation)}</p>
                  </div>
                )}
                {a.nextChecks && a.nextChecks.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-muted">{vi ? 'Nên kiểm tra tiếp' : 'Next check'}</h3>
                    <ul className="list-disc pl-4 text-sm text-fg space-y-0.5">
                      {a.nextChecks.map((c, k) => (
                        <li key={k}>{tr(lang, c)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {a.intent !== 'unknown' && !a.unavailable && mode !== 'local_only' && !hasAi && (
                <div className="mt-2 pt-2 border-t border-line">
                  <button onClick={() => rephrase(i)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden />
                    {vi ? `Diễn đạt lại bằng ${PRIVACY_MODE_INFO[mode].vi}` : `Rephrase with ${PRIVACY_MODE_INFO[mode].en}`}
                  </button>
                </div>
              )}

              {a.followUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {a.followUps.filter((q) => !blocked.has(q)).map((q) => chip(q, 'text-[11px] px-2 py-0.5 rounded-lg border border-line text-muted hover:text-fg'))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-[11px] text-muted mt-3">
        {vi
          ? 'Dolphin tính mọi con số trên máy của bạn và chỉ nói điều số liệu cho thấy — không khẳng định nguyên nhân, không dự đoán chắc chắn.'
          : 'Dolphin computes every number on your device and only states what the data shows — no causal claims, no guaranteed predictions.'}
      </p>
    </section>
  );
};
