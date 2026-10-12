# EcomPulse — redesign v2: tokens & component conventions

Scope: the **Seller (Chủ shop)** and **Analyst (Phân tích)** workspaces. The landing page, the
classic dashboard and Internal Finance keep their dark look for now (`docs/progress.md`). The
workspace is **light by default**; dark is an option (moon / sun button in the top bar,
remembered per browser in `localStorage["ecompulse-theme"]`).

Presentation only: no logic, formula, figure, data structure or flow changes. If a visual change
needs one, stop and ask first.

Direction — **"tiền polymer Việt Nam"**: the colours of the notes a seller counts every day, figures
set like the columns of a cash book. One highlight per page; everything else quiet.

Screenshots (before / after) are kept locally in `docs/redesign/` and are not committed (see
`.gitignore`); only this README is.

## Changes from v1

| Item | v1 | v2 | Why |
|---|---|---|---|
| Primary | `#2563EB` (Tailwind blue) | `#0B6A85` Xanh 500k | A default colour said nothing about the product; the 500.000đ note does |
| Page ground | `#F5F7FB` blue-grey | `#F3F5F4` Giấy | Calmer, sits with the teal |
| Accent | `#F97316` (same as "decrease" and the Affiliate channel) | `#A3336F` Hồng 50k | An accent must never read as a warning |
| Figures & headings | Be Vietnam Pro | Archivo, narrowed (wdth 78%) | Large numbers fit a phone column without "67,3 tri…"; gives the page a voice |
| Type scale | 22 / 16 / 28 / 14 / 12 | 34 / 18 / 48 & 34 / 15 / 13 | Clearer hierarchy; 13px minimum for secondary text |
| Cards | Every block a 14px card with a shadow | Text and figures sit on the page; only tables, charts and interactive blocks are framed (12px, hairline, no shadow) | Less "SaaS template", more hierarchy |
| KPIs (overview pages) | 9–12 equal cards | 4 headline figures + a ledger of the rest | The figures that matter come first |
| Navigation names | English (Executive Overview, Root Cause…) | Vietnamese, English name in the tooltip | Sellers should not have to translate |
| Phone navigation | `<select>` (Analyst), 10px labels (Seller) | "Menu" button opening a side sheet; 11px labels that wrap | One-handed use, readable |
| Filter bar on phones | Every control visible (half the screen) | One summary line, "Đổi bộ lọc" opens the controls | Content first |
| Top bar (workspace) | 9 items | Logo, Sàn / Tài chính switch, mode, language, theme, account; plan, tour and security moved into the account menu | Less noise, nothing removed |
| Separators | "A · B · C" strings | Commas or line breaks | Easier to read |

## 1. Tokens — `src/styles/tokens.css` (the only place with colour values)

Pages never write hex codes or raw Tailwind palette colours. They use the utilities generated
from the tokens.

### Base palette (light)

| Name | Hex | Variable / utility | Role | Contrast |
|---|---|---|---|---|
| Giấy | `#F3F5F4` | `--bg` / `bg-bg` | Page ground | — |
| Mực | `#17221E` | `--text` / `text-fg` | Text | 14.9:1 on Giấy |
| Xanh 500k | `#0B6A85` | `--primary` / `text-primary`, `bg-primary` | Selected item, links, primary button | 6.2:1 on white |
| Hồng 50k | `#A3336F` | `--accent` / `text-accent` | The page's single highlight (first headline figure) | 6.4:1 on white |
| Lá | `#1E7A3C` | `--up` / `text-up`, `bg-up-soft` | Increase, good | 4.75:1 on its soft fill |
| Cam | `#C2410C` | `--down` / `text-down`, `bg-down-soft` | Decrease, bad — **orange, the warning colour** | 4.65:1 on its soft fill |

Supporting: `--surface #FFFFFF` (framed blocks), `--surface-2 #F7F9F8` (table header), `--border
#DDE3E0`, `--text-muted #55625C` (5.8:1 on Giấy), `--primary-soft #E3F1F5` (selected chip / tab,
5.3:1 with primary), `--hover #EEF2F0`, `--overlay`.

Status — strong text on a soft fill, never white text on a light fill:

| Tone | Text / fill | Use |
|---|---|---|
| `up` | `#1E7A3C` / `#E7F4EB` | increase, good |
| `down` | `#C2410C` / `#FFF0E6` | decrease, bad — orange, not red |
| `mismatch` | `#B91C1C` / `#FDECEC` | **only** "Dữ liệu không khớp" and "Không hợp lệ" |
| `note` | `#475569` / `#EEF2F1` | "Lưu ý" (grey) |
| `warn` | `#92400E` / `#FEF6E0` | warning (yellow) |
| `info` | `#0369A1` / `#E6F4FB` | information |

Up and down always differ by the arrow too (↑ ↓), not only by colour.

### Dark (workspace option)

`.ep-app[data-theme='dark']`: ground `#0E1513`, surface `#151E1B`, text `#E6ECE9` (14.2:1), muted
`#9DABA5` (7.1:1), primary `#5BB8D1`, accent `#E58BBE`, up `#5BD48A`, down `#FB923C`. The `:root`
dark block is the legacy dark of the landing, classic dashboard and Internal Finance — do not
change it for the workspace.

### Channels — unchanged from v1 (`src/theme/chart.ts → CHANNEL_COLOR`)

| Channel | Fill (areas, bars) | Line (thin lines, dots, outlines) |
|---|---|---|
| Thẻ sản phẩm | `#2563EB` | `#2563EB` |
| Affiliate | `#F97316` | `#EA580C` |
| Video | `#14B8A6` | `#0D9488` |
| Livestream | `#8B5CF6` | `#7C3AED` |
| Lớp Ads | — (never a solid fill) | `#64748B`, dashed |

- Stacked charts, and any chart read through its legend, use the **line** colour for fills too.
- Labels use the text colour, never the channel colour.
- Multi-series palette `--chart-1…6`: Xanh 500k, orange, blue, violet, ochre, Hồng 50k. The
  comparison period uses the same colour, dashed, at 50%.
- Chart chrome: `--chart-grid` (horizontal only), `--chart-axis`, `--chart-anomaly` (orange dot),
  `--chart-sale-day` (grey dot) + `--chart-sale-band`.

### Type

Both bundled (`src/styles/fonts.css`, `@fontsource`, latin + vietnamese, no network):

- **Be Vietnam Pro** — all text (`--font-text`). Made for Vietnamese diacritics.
- **Archivo** variable, width axis 62–125% — figures and headings (`--font-figure`, utility
  `font-figure`), set at `--figure-stretch: 78%`.

| Utility | Size / weight | Use |
|---|---|---|
| `text-figure` | 48 / 650, Archivo 78%, tabular | headline figure (desktop) |
| `text-page` | 34 / 650, Archivo 78% | page title |
| `text-kpi` | 34 / 650, Archivo 78%, tabular | headline figure (phone), KPI cards |
| `text-card-title` | 18 / 650, Archivo 88% | section title |
| `text-lead` | 18 / 30, Be Vietnam Pro | the brief paragraph (max 72ch) |
| `text-body` | 15 / 24 | body |
| `text-small` | 13 / 18, 500 | secondary text, table headers, badges |

No all-caps labels; sentence case everywhere.

### Spacing, radius, shadow

`--space-1…7` = 4 · 8 · 12 · 16 · 24 · 32 · 48. `--radius-panel` 12px (`rounded-card`),
`--radius-ctl` 8px (`rounded-control`), badges `rounded-full`. **No shadows** (`--card-shadow:
none`). No page gradients, no coloured left border on blocks, no emoji as icons (lucide only).

## 2. Components

`src/components/ui/primitives.tsx` — `Badge`, `Chip`, `Tabs` (selected = `bg-primary-soft
text-primary`), `Button` (`primary` / `secondary` / `ghost`), `ThemeToggle`, `SectionCard` (framed
block: title + one-line description left, tools right, long notes in the collapsible **Ghi chú**
footer; `span={12|8|6|4}` inside a `CardGrid`), `PageTitle`, `CardGrid`, `EmptyState`.

`src/components/ui/data.tsx`
- **`FigureStrip`** (v2) — the 4 headline figures of an overview page, unframed between two
  hairlines, separated by vertical rules: label + ⓘ → figure (`text-kpi lg:text-figure`) →
  `DeltaBadge` + "so với …". 2 columns on phones, 4 from `lg`. `accentFirst` paints the first
  figure Hồng 50k — the page's one highlight. Metrics without data become the "Chưa đủ dữ liệu:"
  line with its action.
- **`MetricLedger`** (v2) — the remaining metrics as rows (name left; figure and change right),
  2 columns from `md`; an optional `sub` line under the name ("Tỷ lệ hủy 19,7%"); no comparison
  shows "—" with the reason in the tooltip.
- `KpiCard` / `KpiGrid` — still used by pages not yet converted.
- `DeltaBadge`, `DataFlag`, `AlertStack`, `DataTable` + `TABLE` + `Th`, `ShareBar`, `FunnelBars` —
  as in v1.

`src/components/workspace/BriefLead.tsx` (v2) — the Dolphin brief of the day before the latest
date, exactly as the Alerts / Dolphin page builds it, labelled "Bản tin Dolphin ngày dd/mm", with
"Xem bản tin và cảnh báo".

Legacy names keep working (`seller/ui.tsx`, `analyst/ui.tsx`).

## 3. Layout

- **Top bar** — surface colour; logo, Sàn / Tài chính switch, mode (neutral button), language,
  theme, account. Plan, 1-minute tour and security centre are in the account menu.
- **Analyst sidebar** — on the page ground, a hairline on its right, no card; 248px, collapsible to
  72px. Groups: Hôm nay · Hiệu quả · Tăng trưởng · Phân tích sâu · Kế hoạch, then Dữ liệu. Selected
  item `bg-primary-soft text-primary`, semibold; English page name in the tooltip. Footer: data
  status ("Đủ dữ liệu: x/y nhóm") → Chất lượng dữ liệu.
- **Seller tabs** — a row of tabs over a hairline (no card); on phones a bottom bar of 7 items.
- **Phones (Analyst)** — a "Menu" button with the current page name opens a side sheet with every
  group; choosing a page closes it.
- **Filter bar** — sticky, framed. From `lg`: period · comparison · platform · category · order
  stage · dates on the right. Below `lg`: one line "30 ngày, so với …" + "Đổi bộ lọc".
- **Overview pages** — Bản tin Dolphin → FigureStrip (4) → "Chỉ số khác" ledger → framed analysis
  sections. Other pages: page title → AlertStack → content (converted page by page).
- **Content** — at most 1440px, centred, 32px between page parts.

### Page names (Analyst)

Tổng quan điều hành · Cảnh báo & Dolphin AI · Ngành hàng · Sản phẩm & Combo · Doanh thu & Lợi nhuận ·
Sức khỏe đơn hàng · Khách hàng · Lưu lượng & phễu · Chiến dịch & lịch sale · Quảng cáo · Từ khóa quảng
cáo · Livestream · Video & Affiliate · Nguyên nhân thay đổi · Bất thường & cơ hội · Mô phỏng What-If ·
Thống kê nâng cao · Tác động thay đổi · Kế hoạch tháng · Việc cần làm · Xuất báo cáo · Nhập dữ liệu ·
Chất lượng dữ liệu · Ánh xạ cột · Giá vốn, phí & cài đặt. Buttons that lead to a page use its name.

## 4. Accessibility checks

- Text contrast ≥ 4.5:1 in both themes (values above).
- Clickable items are real `<button>` / `<a>`, at least 40px tall (44px for phone controls).
- Visible focus ring (`2px` primary outline) on every focusable element; `prefers-reduced-motion`
  respected.
- No horizontal page scroll at 390px.
- No hex colour outside `src/styles/tokens.css` in the workspace pages (grep check).
