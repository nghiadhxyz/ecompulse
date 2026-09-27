# EcomPulse — light redesign: tokens & component conventions

Scope: the **Seller** and **Analyst** workspaces. The landing page, the classic dashboard and
Internal Finance keep their dark look. The workspace is **light by default**; dark is an option
(moon / sun button in the top bar, remembered per browser in `localStorage["ecompulse-theme"]`).

Presentation only: no logic, formula, figure or calculation test changes.

Screenshots (before / after each page group) are kept locally in `docs/redesign/` and are not
committed (see `.gitignore`); only this README is.

## 1. Tokens — `src/styles/tokens.css` (the only place with colour values)

Pages never write hex codes or raw Tailwind palette colours (`text-slate-400`, `bg-sky-600`…).
They use the utilities generated from the tokens:

| Role | Variable | Utility | Light |
|---|---|---|---|
| Page background | `--bg` | `bg-bg` | `#F5F7FB` |
| Card | `--surface` | `bg-surface` | `#FFFFFF` |
| Table header, secondary cell | `--surface-2` | `bg-surface-2` | `#F8FAFC` |
| Border | `--border` | `border-line`, `divide-line` | `#E5E9F0` |
| Text | `--text` | `text-fg` | `#0F172A` |
| Secondary text (≥ 4.5:1) | `--text-muted` | `text-muted` | `#5B6475` (5.96:1) |
| Row hover | `--hover` | `bg-hover`, `hover:bg-hover` | `#F8FAFC` |
| Primary (selected, links) | `--primary` | `text-primary`, `bg-primary` | `#2563EB` |
| Selected tab / chip | `--primary-soft` | `bg-primary-soft` | `#EAF1FF` |
| Second accent (fills only) | `--accent` | `bg-accent` | `#F97316` |
| Modal / drawer backdrop | `--overlay` | `bg-overlay` | slate 40% |

Status — strong text on a soft fill, never white text on a light fill:

| Tone | Text / fill | Use |
|---|---|---|
| `up` | `#15803D` / `#E8F7EE` | increase, good |
| `down` | `#C2410C` / `#FFF1E8` | decrease, bad — **orange, not red** |
| `mismatch` | `#B91C1C` / `#FDECEC` | **only** "Dữ liệu không khớp" and "Không hợp lệ" |
| `note` | `#475569` / `#F1F5F9` | "Lưu ý" (grey) |
| `warn` | `#92400E` / `#FEF6E0` | warning (yellow) |
| `info` | `#0369A1` / `#E6F4FB` | information |

Utilities: `text-<tone>`, `bg-<tone>-soft`, `bg-<tone>` (dots). Up and down always differ by
the arrow too (↑ ↓), not only by colour.

Channels — fixed in every chart and table (`src/theme/chart.ts → CHANNEL_COLOR`):

| Channel | Fill (areas, bars) | Line (thin lines, dots, outlines) |
|---|---|---|
| Thẻ sản phẩm | `#2563EB` | `#2563EB` |
| Affiliate | `#F97316` | `#EA580C` |
| Video | `#14B8A6` | `#0D9488` |
| Livestream | `#8B5CF6` | `#7C3AED` |
| Lớp Ads | — (never a solid fill) | `#64748B`, dashed |

- Stacked charts, and any chart that has to be read through its legend, use the **line**
  colour for the fills too.
- Labels use the text colour, never the channel colour.
- Multi-series palette: `--chart-1…6`. The comparison period uses the same colour, dashed, at 50%.
- Chart chrome: `--chart-grid` `#EEF1F5` (horizontal only), `--chart-axis`, `--chart-anomaly`
  (orange dot), `--chart-sale-day` (grey dot) + `--chart-sale-band`.

Type — **Be Vietnam Pro**, bundled (`src/styles/fonts.css`, `@fontsource`, subsets latin +
vietnamese, 400/500/600/700; no network). Inter stays for the legacy screens, bundled the same
way. Numbers: `tabular` (tabular-nums).

| Utility | Size / weight | Use |
|---|---|---|
| `text-page` | 22 / 600 | page title |
| `text-card-title` | 16 / 600 | card title |
| `text-kpi` | 28 / 700, tabular | KPI value |
| `text-body` | 14 / 400 | body |
| `text-small` | 12 / 500 | secondary text, table headers, badges |

Spacing, radius, shadow — 8px grid; card padding 20px; 16px between cards;
`rounded-card` 14px, `rounded-control` 10px (buttons, chips, inputs), badges `rounded-full`;
`shadow-card` (two soft layers, none in dark). No page gradients, no coloured left border on
cards, no emoji as icons (lucide icons only).

## 2. Components

`src/components/ui/primitives.tsx`
- `Badge` (tones above) · `Chip` · `Tabs` (selected = `bg-primary-soft text-primary`, others
  muted, no border) · `Button` (`primary` / `secondary` / `ghost`) · `ThemeToggle`.
- `SectionCard` — title + one-line description left, tools right; long notes in the
  collapsible **Ghi chú** footer. `span={12|8|6|4}` inside a `CardGrid` (12 columns: big
  tables 12, chart pairs 6 + 6).
- `PageTitle`, `CardGrid`.
- `EmptyState` — small icon, one line of reason, one action; at most 160px tall.

`src/components/ui/data.tsx`
- `KpiCard` — fixed height 128px; label + ⓘ definition → big number → comparison line
  (`DeltaBadge` ↑/↓ + "so với …"). Order stage tag top-right ("Đặt" / "Thanh toán"). Data
  problems are a dot (grey / yellow / red) that opens a popover (`DataFlag`) — never long
  text inside the card.
- `KpiGrid` — 2 columns on mobile, 3 ≥ 900px, 4 ≥ 1200px, 5 ≥ 1440px. Metrics without
  data are not cards: one chip line at the end ("Chưa đủ dữ liệu: Lợi nhuận · Margin —
  Nhập giá vốn").
- `DeltaBadge`, `DataFlag`.
- `AlertStack` — one frame instead of stacked banners: "3 lưu ý về dữ liệu" + expand;
  red → yellow → grey → info.
- `DataTable` + `TABLE` class names + `Th` — sticky header on `surface-2` (12/600 muted),
  44px rows, thin horizontal rules, hover `hover`, numbers right-aligned and tabular, first
  column sticky with "…" + tooltip, empty columns (Δ, Lợi nhuận, Margin) hidden.
- `ShareBar` — 6px, rounded, channel colour.
- `FunnelBars` — horizontal bars proportional to the value, step rate between two bars, a
  step without data collapses into one dim line.

Legacy names keep working (`seller/ui.tsx`: `KpiCard`, `Section`, `NotEnoughData`,
`DeltaChip`, `SeverityBadge`, `PrimaryButton`, `GhostButton`, `EvidenceButton`;
`analyst/ui.tsx`: `ChangeCell`, `ShareBar`, `Th`, `BreakdownTable`) and render the new
components.

Charts: `src/theme/chart.ts` — `gridProps`, `xAxisProps`, `axisProps`, `tooltipProps` (white,
soft shadow), `legendProps` (top right), `CHANNEL_COLOR`, `SERIES`, `CHART`. Curves use
`type="monotone"`.

## 3. Layout

- **Top bar** — white; the moon / sun toggle next to the language button.
- **Sidebar** (Analyst) — white, 248px, collapsible to 72px (icons only). Groups: Hôm nay ·
  Hiệu quả · Tăng trưởng · Phân tích sâu · Kế hoạch, then the data pages. The selected item
  is `bg-primary-soft text-primary`. The footer shows "x/y nhóm phân tích" → opens Chất lượng
  dữ liệu.
- **Filter bar** — sticky under the top bar, white. Period · comparison · platform ·
  category · order stage (Đặt / Thanh toán) · dates in view on the right. A filter that
  does not apply to the page is dimmed, with the reason in a tooltip.
- **Content** — at most 1440px, centred. Order on every page: page title → AlertStack →
  KpiGrid → SectionCards.

## 4. Accessibility checks

- Text contrast ≥ 4.5:1 (secondary text and badge text included; computed values above).
- Clickable items are real `<button>` / `<a>` and at least 40px tall.
- KPI cards in one row have the same height (fixed 128px).
- No table scrolls horizontally at 1440px unless it has more than 10 columns.
- No hex colour outside `src/styles/tokens.css` in the workspace pages (grep check).
