import React, { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  COMPETITION_LABELS,
  fmtCount,
  fmtDay,
  fmtMoney,
  fmtMoneyCompact,
  fmtMultiple,
  fmtRate,
  formatRangeVi,
  KEYWORD_CLASS_LABELS,
  keywordIntelligence,
  KW_MIN_CLICKS,
  MATCH_TYPE_LABELS,
  VERDICT_LABELS,
  type Competition,
  type KeywordClass,
  type OpportunityVerdict,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { Badge, CardGrid, Chip, SectionCard, type Tone } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { axisProps, CHART, gridProps, tooltipProps } from '../../../theme/chart';
import { ShareBar, Th } from '../ui';

const CLASS_TONE: Record<KeywordClass, Tone> = {
  scale: 'up',
  keep: 'info',
  too_broad: 'warn',
  below_break_even: 'down',
  waste: 'down',
  little_data: 'note',
};
const CLASS_ORDER: KeywordClass[] = ['waste', 'below_break_even', 'too_broad', 'scale', 'keep', 'little_data'];
const VERDICT_TONE: Record<OpportunityVerdict, Tone> = { new: 'up', rising: 'info', crowded: 'warn', declining: 'down', stable: 'neutral' };
const VERDICT_ORDER: OpportunityVerdict[] = ['new', 'rising', 'crowded', 'declining', 'stable'];
const COMPETITION_TONE: Record<Competition, Tone> = { low: 'up', medium: 'neutral', high: 'down' };

const Trend: React.FC<{ v: number | null; lang: 'vi' | 'en' }> = ({ v, lang }) =>
  v === null ? <span className="text-muted">—</span> : <span className={v > 0.05 ? 'text-up' : v < -0.05 ? 'text-down' : 'text-muted'}>{v > 0.05 ? '↑' : v < -0.05 ? '↓' : ''} {fmtRate(Math.abs(v), lang, 0)}</span>;

export const KeywordExplorerView: React.FC = () => {
  const { lang, dataset, baseFilter, range, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const ki = useMemo(() => keywordIntelligence(dataset, baseFilter), [dataset, baseFilter]);
  const [cls, setCls] = useState<KeywordClass | 'all'>('all');
  const [verdict, setVerdict] = useState<OpportunityVerdict | 'all'>('all');
  const [picked, setPicked] = useState<string | null>(null);

  // Default trend: the keyword whose normal-day impressions grew most.
  const trendKey = useMemo(() => {
    if (picked && ki.dailyByKey[picked]) return picked;
    const withDays = ki.rows.filter((r) => ki.dailyByKey[r.key]);
    const best = [...withDays].sort((a, b) => (b.trend ?? -Infinity) - (a.trend ?? -Infinity))[0];
    return best?.key ?? null;
  }, [picked, ki]);

  if (!ki.available) {
    return (
      <Section title={vi ? 'Từ khóa quảng cáo' : 'Keyword Explorer'}>
        <NotEnoughData
          lang={lang}
          reason={
            vi
              ? 'Chưa có báo cáo từ khóa. Xuất báo cáo "Từ khóa" của Quảng cáo Tìm kiếm Sản phẩm (Shopee Ads) và nhập ở trang Nhập dữ liệu. Có thể kèm sheet "Gợi ý từ khóa" (lượt tìm kiếm, giá thầu đề xuất) để xem cơ hội mới.'
              : 'No keyword report. Export the Shopee Ads keyword report and import it in the Data Hub.'
          }
          action={<GhostButton onClick={() => goTo('dataHub')}>{vi ? 'Nhập dữ liệu' : 'Import data'}</GhostButton>}
        />
      </Section>
    );
  }

  const t = ki.totals;
  const shown = cls === 'all' ? ki.rows : ki.rows.filter((r) => r.classification === cls);
  const opps = verdict === 'all' ? ki.opportunities : ki.opportunities.filter((o) => o.verdict === verdict);
  const series = trendKey ? ki.dailyByKey[trendKey] : null;
  const trendRow = ki.rows.find((r) => r.key === trendKey);
  const wasted = ki.spendByClass.waste + ki.spendByClass.below_break_even;
  const tiles: { l: string; v: string; bad?: boolean; sub?: string }[] = [
    { l: vi ? 'Chi phí từ khóa' : 'Keyword spend', v: fmtMoneyCompact(t.spend, lang) },
    { l: vi ? 'GMV quy đổi' : 'Attributed GMV', v: fmtMoneyCompact(t.gmv, lang) },
    { l: 'ROAS', v: fmtMultiple(t.roas, lang) },
    { l: 'CTR', v: fmtRate(t.ctr, lang, 2) },
    { l: vi ? 'Tỷ lệ chuyển đổi' : 'CVR', v: fmtRate(t.cvr, lang, 2) },
    { l: 'CPC', v: fmtMoney(t.cpc, lang) },
    {
      l: vi ? 'Chi cho từ khóa lỗ / lãng phí' : 'Spend losing money',
      v: `${fmtMoneyCompact(wasted, lang)} (${fmtRate(t.spend ? wasted / t.spend : null, lang, 0)})`,
      bad: wasted > 0,
      sub: vi ? 'Lãng phí + dưới hòa vốn' : 'Wasted + below break-even',
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-small text-muted">
        {vi
          ? 'Nguồn: báo cáo từ khóa của Quảng cáo Tìm kiếm. Chi phí từ khóa là một phần chi phí Ads (không cộng thêm). Doanh thu và đơn do sàn quy đổi cho từ khóa. EcomPulse chỉ thấy dữ liệu của shop — mức cạnh tranh được ước lượng từ giá thầu đề xuất, không phải số liệu của đối thủ.'
          : 'Source: search-ad keyword report. Keyword spend is part of Ads spend. Competition is estimated from suggested bids, not competitor data.'}
      </p>

      {ki.rows.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
            {tiles.map((x) => (
              <div key={x.l} className="flex min-h-28 min-w-0 flex-col rounded-card border border-line bg-surface px-4 py-3.5 shadow-card">
                <div className="text-small text-muted">{x.l}</div>
                <div className={`mt-1 text-xl font-bold tabular ${x.bad ? 'text-down' : 'text-fg'}`}>{x.v}</div>
                {x.sub && <div className="mt-auto truncate text-small text-muted" title={x.sub}>{x.sub}</div>}
              </div>
            ))}
          </div>
          {ki.notes.map((n, i) => (
            <p key={i} className="rounded-control bg-warn-soft px-3 py-2 text-small text-warn">
              {tr(lang, n)}
            </p>
          ))}

          <SectionCard
            title={vi ? 'Từ khóa đang chạy' : 'Keywords'}
            description={`${formatRangeVi(range)} · ${vi ? 'Mỗi từ khóa được xếp một nhóm theo quy tắc ở phần Ghi chú — rê chuột lên nhóm để xem lý do' : 'One class per keyword, rules in the notes'}`}
            tools={
              <div className="flex flex-wrap gap-1" role="group" aria-label={vi ? 'Lọc theo đánh giá' : 'Filter by class'}>
                <Chip selected={cls === 'all'} onClick={() => setCls('all')}>
                  {vi ? 'Tất cả' : 'All'} ({ki.rows.length})
                </Chip>
                {CLASS_ORDER.filter((c) => ki.counts[c] > 0).map((c) => (
                  <Chip key={c} selected={cls === c} onClick={() => setCls(c)}>
                    {tr(lang, KEYWORD_CLASS_LABELS[c].label)} ({ki.counts[c]})
                  </Chip>
                ))}
              </div>
            }
            notesLabel={vi ? 'Ghi chú' : 'Notes'}
            notes={
              vi
                ? [
                    `Chưa đủ dữ liệu: dưới ${KW_MIN_CLICKS} lượt click và chưa có đơn. Lãng phí: từ ${KW_MIN_CLICKS} lượt click trở lên nhưng không có đơn.`,
                    'Dưới hòa vốn: ROAS thấp hơn ROAS hòa vốn của sản phẩm được quảng cáo (1 ÷ biên lợi nhuận trước Ads); khi chưa có giá vốn, dùng ngưỡng 1,5x.',
                    'Quá rộng: CTR chưa bằng một nửa CTR chung trên ít nhất 1.000 lượt xem. Đẩy mạnh: ít nhất 3 đơn và ROAS ≥ 1,5 × hòa vốn.',
                    'Xu hướng: lượt xem trung bình mỗi ngày thường (bỏ ngày sale) ở nửa sau so với nửa đầu kỳ đang xem.',
                    'Lời sau Ads = GMV quy đổi × biên lợi nhuận trước Ads − chi phí. GMV quy đổi do sàn báo cáo, có thể trùng với đơn tự nhiên.',
                  ]
                : ['Rules: < 30 clicks and no order = not enough data; ≥ 30 clicks and no order = wasted; ROAS < break-even = below break-even; CTR < half the average on ≥ 1,000 impressions = too broad; ≥ 3 orders and ROAS ≥ 1.5 × break-even = scale.']
            }
          >
            <div className={TABLE.frame}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <Th left className="sticky left-0 z-20 bg-surface-2">{vi ? 'Từ khóa' : 'Keyword'}</Th>
                    <Th left>{vi ? 'Đánh giá' : 'Class'}</Th>
                    <Th left>{vi ? 'Nên làm' : 'Action'}</Th>
                    <Th>{vi ? 'Chi phí' : 'Spend'}</Th>
                    <Th>{vi ? 'Tỷ trọng' : 'Share'}</Th>
                    <Th>{vi ? 'Lượt xem' : 'Impr.'}</Th>
                    <Th>CTR</Th>
                    <Th>CPC</Th>
                    <Th>{vi ? 'Đơn' : 'Orders'}</Th>
                    <Th>CVR</Th>
                    <Th>GMV</Th>
                    <Th>ROAS</Th>
                    <Th>{vi ? 'Hòa vốn' : 'Break-even'}</Th>
                    <Th>{vi ? 'Lời sau Ads' : 'Profit after ads'}</Th>
                    <Th title={vi ? 'Lượt xem ngày thường, nửa sau so với nửa đầu kỳ' : 'Normal-day impressions, 2nd half vs 1st'}>{vi ? 'Xu hướng' : 'Trend'}</Th>
                    <Th title={vi ? 'Thứ hạng hiển thị trung bình (1 = đầu trang)' : 'Average position'}>{vi ? 'Thứ hạng' : 'Rank'}</Th>
                    <Th>{vi ? 'Giá thầu' : 'Bid'}</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.key} className={`${TABLE.tr} text-fg ${r.key === trendKey ? 'bg-primary-soft' : ''}`}>
                      <td className="sticky left-0 z-10 max-w-[240px] bg-surface px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => setPicked(r.key)}
                          disabled={!ki.dailyByKey[r.key]}
                          className="block max-w-full truncate text-left font-medium text-fg hover:text-primary disabled:hover:text-fg"
                          title={vi ? 'Xem xu hướng theo ngày' : 'Show the daily trend'}
                        >
                          {r.keyword}
                        </button>
                        <div className="truncate text-small text-muted" title={r.adName}>
                          {r.matchType ? tr(lang, MATCH_TYPE_LABELS[r.matchType]) : ''}
                          {r.sku ? ` · ${r.sku}` : ''}
                        </div>
                      </td>
                      <td className={TABLE.td}>
                        <Badge tone={CLASS_TONE[r.classification]} title={r.reasons.map((x) => tr(lang, x)).join('\n')}>
                          {tr(lang, KEYWORD_CLASS_LABELS[r.classification].label)}
                        </Badge>
                      </td>
                      <td className={`${TABLE.td} max-w-[220px] truncate text-small text-muted`} title={r.reasons.map((x) => tr(lang, x)).join('\n')}>
                        {tr(lang, KEYWORD_CLASS_LABELS[r.classification].action)}
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.spend, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>
                        {fmtRate(r.spendShare, lang, 0)}
                        <ShareBar share={r.spendShare} />
                      </td>
                      <td className={`${TABLE.td} text-right`}>{fmtCount(r.impressions, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtRate(r.ctr, lang, 2)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoney(r.cpc, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtCount(r.orders, lang)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtRate(r.cvr, lang, 2)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtMoneyCompact(r.gmv, lang)}</td>
                      <td className={`${TABLE.td} text-right font-semibold`}>{fmtMultiple(r.roas, lang)}</td>
                      <td className={`${TABLE.td} text-right text-muted`} title={r.marginIsEstimate ? (vi ? 'Ước tính theo số bạn nhập' : 'Estimate') : undefined}>
                        {fmtMultiple(r.breakEvenRoas, lang)}
                        {r.marginIsEstimate && '*'}
                      </td>
                      <td className={`${TABLE.td} text-right font-medium ${r.profitAfterAds === null ? '' : r.profitAfterAds < 0 ? 'text-down' : 'text-up'}`}>
                        {r.profitAfterAds === null ? <span className="text-muted">—</span> : fmtMoneyCompact(r.profitAfterAds, lang)}
                      </td>
                      <td className={`${TABLE.td} text-right`}>
                        <Trend v={r.trend} lang={lang} />
                      </td>
                      <td className={`${TABLE.td} text-right`}>{r.avgPosition === null ? '—' : r.avgPosition.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</td>
                      <td className={`${TABLE.td} text-right text-muted`}>{fmtMoney(r.bid, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <CardGrid>
            <SectionCard
              span={8}
              title={trendRow ? `${vi ? 'Xu hướng' : 'Trend'} · ${trendRow.keyword}` : vi ? 'Xu hướng từ khóa' : 'Keyword trend'}
              description={vi ? 'Cột: lượt xem mỗi ngày · Đường: đơn · Vạch đứt: ngày sale. Bấm tên từ khóa trong bảng để đổi.' : 'Bars: impressions · Line: orders · Dashed: sale days. Click a keyword to switch.'}
            >
              {series ? (
                <div className="h-56" role="img" aria-label={vi ? 'Lượt xem và đơn theo ngày của từ khóa' : 'Keyword impressions and orders by day'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series.map((d) => ({ ...d, label: fmtDay(d.date) }))}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="label" tick={axisProps.tick} tickLine={false} minTickGap={16} axisLine={{ stroke: CHART.grid }} />
                      <YAxis yAxisId="i" tickFormatter={(v: number) => fmtCount(v, lang)} tick={axisProps.tick} width={48} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="o" orientation="right" allowDecimals={false} tick={axisProps.tick} width={28} tickLine={false} axisLine={false} />
                      <Tooltip {...tooltipProps} cursor={{ fill: 'var(--hover)' }} formatter={(v: number, n: string) => [fmtCount(v, lang), n === 'impressions' ? (vi ? 'Lượt xem' : 'Impressions') : vi ? 'Đơn' : 'Orders']} />
                      {series.filter((d) => d.saleDay).map((d) => (
                        <ReferenceLine key={d.date} yAxisId="i" x={fmtDay(d.date)} stroke={CHART.saleDay} strokeDasharray={CHART.compareDash} />
                      ))}
                      <Bar yAxisId="i" isAnimationActive={false} dataKey="impressions" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
                      <Line yAxisId="o" isAnimationActive={false} type="monotone" dataKey="orders" stroke={CHART.up} strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-small text-muted">{vi ? 'Báo cáo chỉ có số tổng cả kỳ — không vẽ được theo ngày.' : 'Period totals only — no daily trend.'}</p>
              )}
              {trendRow && trendRow.reasons.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-small text-muted">
                  {trendRow.reasons.map((x, i) => (
                    <li key={i}>• {tr(lang, x)}</li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard span={4} title={vi ? 'Ngân sách theo đánh giá' : 'Spend by class'} description={vi ? 'Tiền đang chạy vào nhóm nào' : 'Where the money goes'}>
              <ul className="space-y-3">
                {CLASS_ORDER.filter((c) => ki.counts[c] > 0).map((c) => {
                  const share = t.spend ? ki.spendByClass[c] / t.spend : null;
                  return (
                    <li key={c} className="flex items-center justify-between gap-3 text-sm">
                      <Badge tone={CLASS_TONE[c]}>{tr(lang, KEYWORD_CLASS_LABELS[c].label)}</Badge>
                      <span className="flex items-center gap-2 tabular text-fg">
                        {fmtMoneyCompact(ki.spendByClass[c], lang)}
                        <span className="w-10 text-right text-small text-muted">{fmtRate(share, lang, 0)}</span>
                        <ShareBar share={share} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          </CardGrid>
        </>
      ) : (
        <NotEnoughData
          lang={lang}
          reason={
            ki.periodRowsOutside > 0
              ? vi
                ? `Không có số liệu từ khóa trong khoảng ${formatRangeVi(range)}. Báo cáo đã nhập là số tổng cả kỳ — hãy chọn trọn kỳ báo cáo (hoặc dài hơn); EcomPulse không chia nhỏ số tổng theo ngày.`
                : `No keyword data in ${formatRangeVi(range)}. The report is a period total — select the whole period.`
              : vi
                ? `Không có số liệu từ khóa trong khoảng ${formatRangeVi(range)}.`
                : `No keyword data in ${formatRangeVi(range)}.`
          }
        />
      )}

      <SectionCard
        title={vi ? 'Cơ hội từ khóa' : 'Keyword opportunities'}
        description={
          vi
            ? 'Theo cách của Amazon Opportunity Explorer: nhu cầu (lượt tìm kiếm), xu hướng (so với 30 ngày trước) và mức cạnh tranh (giá thầu đề xuất). Ảnh chụp tại lúc xuất file, không theo kỳ đang xem.'
            : 'Like Amazon Opportunity Explorer: demand, trend and competition (suggested bid). A snapshot from the export date.'
        }
        tools={
          ki.opportunities.length > 0 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label={vi ? 'Lọc cơ hội' : 'Filter opportunities'}>
              <Chip selected={verdict === 'all'} onClick={() => setVerdict('all')}>
                {vi ? 'Tất cả' : 'All'} ({ki.opportunities.length})
              </Chip>
              {VERDICT_ORDER.map((v) => {
                const n = ki.opportunities.filter((o) => o.verdict === v).length;
                return n > 0 ? (
                  <Chip key={v} selected={verdict === v} onClick={() => setVerdict(v)}>
                    {tr(lang, VERDICT_LABELS[v])} ({n})
                  </Chip>
                ) : null;
              })}
            </div>
          )
        }
        notesLabel={vi ? 'Cách tính' : 'Method'}
        notes={
          vi
            ? [
                `Cạnh tranh: giá thầu đề xuất ≤ 0,8 × trung vị (${fmtMoney(ki.medianSuggestedBid, lang)}) là thấp, ≥ 1,25 × trung vị là cao. Giá thầu cao nghĩa là nhiều shop đang trả tiền cho từ khóa đó.`,
                'Điểm cơ hội (0–100) = 45% nhu cầu (lượt tìm kiếm, thang log) + 35% xu hướng (−50% → +100%) + 20% giá thầu rẻ. Đây là thứ tự ưu tiên để thử, không phải dự báo doanh số.',
                'Cơ hội mới: shop chưa chạy, lượt tìm kiếm tăng ≥ 20% và cạnh tranh không cao. Nhu cầu đang lên: tăng ≥ 20%. Đang giảm: giảm ≥ 10%.',
                'Từ khóa mới phải liên quan tới sản phẩm thật của shop — kiểm tra trước khi đặt giá thầu.',
              ]
            : ['Competition from the suggested bid vs the median; score = 45% demand + 35% trend + 20% cheap bid.']
        }
      >
        {ki.opportunities.length === 0 ? (
          <p className="text-small text-muted">
            {vi
              ? 'Chưa có dữ liệu gợi ý từ khóa. Thêm sheet "Gợi ý từ khóa" (từ khóa, lượt tìm kiếm 30 ngày gần nhất / 30 ngày trước, giá thầu đề xuất) vào file báo cáo từ khóa để thấy cơ hội mới.'
              : 'No keyword planner data. Add a suggestions sheet (keyword, search volume, suggested bid) to the keyword file.'}
          </p>
        ) : (
          <div className={TABLE.frame}>
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
                <tr>
                  <Th left className="sticky left-0 z-20 bg-surface-2">{vi ? 'Từ khóa' : 'Keyword'}</Th>
                  <Th left>{vi ? 'Đánh giá' : 'Verdict'}</Th>
                  <Th>{vi ? 'Điểm' : 'Score'}</Th>
                  <Th>{vi ? 'Lượt tìm kiếm' : 'Searches'}</Th>
                  <Th>{vi ? 'Thay đổi' : 'Change'}</Th>
                  <Th>{vi ? 'Giá thầu đề xuất' : 'Suggested bid'}</Th>
                  <Th left>{vi ? 'Cạnh tranh' : 'Competition'}</Th>
                  <Th left>{vi ? 'Shop' : 'Shop'}</Th>
                  <Th left>{vi ? 'Lý do' : 'Why'}</Th>
                </tr>
              </thead>
              <tbody>
                {opps.map((o) => (
                  <tr key={`${o.platform}|${o.keyword}`} className={`${TABLE.tr} text-fg`}>
                    <td className="sticky left-0 z-10 max-w-[220px] truncate bg-surface px-3 py-1.5 font-medium" title={o.keyword}>
                      {o.keyword}
                    </td>
                    <td className={TABLE.td}>
                      <Badge tone={VERDICT_TONE[o.verdict]}>{tr(lang, VERDICT_LABELS[o.verdict])}</Badge>
                    </td>
                    <td className={`${TABLE.td} text-right font-semibold`}>{o.score ?? '—'}</td>
                    <td className={`${TABLE.td} text-right`}>{fmtCount(o.searchVolume, lang)}</td>
                    <td className={`${TABLE.td} text-right`}>
                      <Trend v={o.growth} lang={lang} />
                    </td>
                    <td className={`${TABLE.td} text-right`}>{fmtMoney(o.suggestedBid, lang)}</td>
                    <td className={TABLE.td}>{o.competition ? <Badge tone={COMPETITION_TONE[o.competition]}>{tr(lang, COMPETITION_LABELS[o.competition])}</Badge> : <span className="text-muted">—</span>}</td>
                    <td className={`${TABLE.td} text-small`}>
                      {o.running ? (
                        o.performance ? (
                          <Badge tone={CLASS_TONE[o.performance]}>
                            {vi ? 'Đang chạy' : 'Running'} · {tr(lang, KEYWORD_CLASS_LABELS[o.performance].label)}
                          </Badge>
                        ) : (
                          <span className="text-muted">{vi ? 'Đang chạy' : 'Running'}</span>
                        )
                      ) : (
                        <span className="text-muted">{vi ? 'Chưa chạy' : 'Not bid'}</span>
                      )}
                    </td>
                    <td className={`${TABLE.td} max-w-[360px] truncate text-small text-muted`} title={o.reasons.map((x) => tr(lang, x)).join('\n')}>
                      {o.reasons.map((x) => tr(lang, x)).join(' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
