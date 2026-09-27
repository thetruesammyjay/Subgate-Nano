# Subgate Nano design system

> Navy ink on cool marble.

Subgate Nano uses a Calendly-inspired visual language: a quiet scheduling
workspace with generous breathing room, white product surfaces, soft blue-gray
boundaries, and one vivid blue action color. The streaming subject matter stays
distinct through playback meters, access rules, wallet state, and settlement
receipts. The interface must feel calm and trustworthy before it feels
technical.

This document is the visual source of truth for `apps/web`. It replaces the
previous hard-edged black-and-paper treatment. Avoid the visual language of a
terminal, crypto trading screen, or generic dark SaaS dashboard.

## 1. Visual direction

The page canvas is cool marble rather than warm paper. Text is deep ink navy,
not pure black. Cards float above the canvas with restrained blue-tinted
shadows. Primary actions are electric blue; deep navy is used for secondary
dark actions and navigation. Decorative magenta and cyan forms may sit behind a
product visual, but never become functional UI colors.

The design should communicate:

- clear access before playback;
- calm confidence around money and wallet signatures;
- a product workspace rather than a marketing collage;
- one obvious action in each region;
- generous space around large editorial headings.

Use the supplied logo files as-is:

- `apps/web/public/subgate-logo.png` for desktop headers and auth surfaces;
- `apps/web/public/subgate-ico.png` for compact navigation and the favicon.

## 2. Color tokens

```css
--color-ink-navy: #0b3558;
--color-signal-blue: #006bff;
--color-slate-gray: #476788;
--color-mist-gray: #a6bbd1;
--color-cloud: #f8f9fb;
--color-paper: #ffffff;
--color-pebble: #f0f3f8;
--color-hairline: #d4e0ed;
--color-carbon: #0a0a0a;
--color-coral-magenta: #e55cff;
--color-sky-cyan: #0099ff;
--color-deep-cobalt: #004eba;
```

| Role | Token | Use |
| --- | --- | --- |
| Primary ink | `--color-ink-navy` | Headings, body text, icons, dark CTAs |
| Primary action | `--color-signal-blue` | Filled buttons, links, live state, focus |
| Secondary text | `--color-slate-gray` | Descriptions, helper text, metadata |
| Disabled text | `--color-mist-gray` | Disabled and inactive states |
| Canvas | `--color-cloud` | Public pages, dashboard shell, footer |
| Elevated surface | `--color-paper` | Cards, panels, booking/access widgets |
| Input/hover fill | `--color-pebble` | Inputs, selected rows, subtle washes |
| Border | `--color-hairline` | Card edges, dividers, form boundaries |
| Decorative warmth | `--color-coral-magenta` | Blurred blob behind a product visual only |
| Decorative cool | `--color-sky-cyan` | Blurred blob behind a product visual only |

Never use pure black for normal text. Keep success, warning, and danger
semantic colors separate from signal blue:

```css
--color-success: #257a3e;
--color-warning: #b37a00;
--color-danger: #b4232e;
```

## 3. Typography

Gilroy is the reference face. Use the installed/system substitute without
adding a font download dependency:

```css
--font-gilroy: "Manrope", "Inter", "Segoe UI", sans-serif;
--font-mono: "Cascadia Mono", "SFMono-Regular", Consolas, monospace;
```

Use the geometric sans for every visible interface element. Mono is reserved
for wallet addresses, payment amounts, network labels, and compact status
metadata; it must not dominate the page.

| Role | Size | Weight | Line height |
| --- | ---: | ---: | ---: |
| Display | 68-80px | 700 | 1.2 |
| Page heading | 50-68px | 700 | 1.2 |
| Section heading | 38-50px | 700 | 1.2 |
| Subheading | 24-28px | 600 | 1.4 |
| Body | 16px | 400 | 1.5 |
| Body small | 14px | 400-500 | 1.4 |
| Button | 16-18px | 600 | 1.4 |
| Caption | 12px | 500 | 1.5 |

Headings are left aligned in hero and workspace contexts. Centered section
headers are reserved for explanatory feature blocks. Do not use tracked-out
all-caps labels above every heading.

## 4. Spacing, shape, and elevation

Use an 8px base rhythm: `8`, `16`, `24`, `32`, `40`, `48`, `56`, `64`, `72`,
and `96px`. Keep page content inside a `1200px` maximum width with generous
outer margins. Section gaps are normally `48px` to `64px`.

Shapes communicate hierarchy:

- feature/product cards: `16px` radius;
- dashboard and access panels: `24px` radius;
- inputs and buttons: `8px` radius;
- badges: pill radius only when compact state is the purpose;
- no universal radius applied to every element.

Use blue-tinted elevation instead of neutral black shadows:

```css
--shadow-card: rgba(71, 103, 136, 0.04) 0 4px 5px,
  rgba(71, 103, 136, 0.03) 0 8px 15px,
  rgba(71, 103, 136, 0.08) 0 30px 50px;
--shadow-control: rgba(71, 103, 136, 0.04) 0 4px 5px,
  rgba(71, 103, 136, 0.03) 0 8px 15px,
  rgba(71, 103, 136, 0.06) 0 15px 30px;
```

Do not add broad gradients to page backgrounds. A soft, blurred coral or cyan
blob may sit behind a white product card as atmosphere.

## 5. Shared components

### Navigation

Use a `64px` sticky public header. The full wordmark sits left, the primary
links sit toward the center/right, and one dark navy CTA sits at the far right.
At mobile widths, use the icon mark and a full-width surface menu below the
header.

### Buttons

- Primary: signal blue fill, white text, `8px` radius, 16-18px semibold label.
- Dark secondary: ink navy fill, white text, `8px` radius.
- Outline: paper surface, hairline border, ink navy text, `8px` radius.
- Text link: no container, ink navy text, signal-blue hover.
- Destructive: danger red, never signal blue.

Button copy uses direct verbs: `Explore streams`, `Start watching`, `New
stream`, `Save changes`, `Publish`, `Unpublish`, and `Stop and settle`.

### Cards and panels

Cards are white, spacious, and purposeful. A card should have one job. Use a
hairline border and shadow together only for a surface that is meaningfully
elevated. Avoid stacking many small cards inside one another.

### Badges and states

Use a pale pebble/blue fill with deep cobalt text for informational badges.
Published, settled, and healthy states use green; live and selected states use
signal blue; pending states use amber; failed or rejected states use danger
red. Always include text, never color alone.

### Forms

Labels remain visible. Inputs use pebble fill, hairline border, 8px radius, and
at least a 44px target height. Focus uses a 2px signal-blue ring. A validation
message names the problem and the fix.

## 6. Public web composition

The public hero is a two-column editorial split:

```text
sticky header: logo | how it works | explore streams | creator desk | CTA
-----------------------------------------------------------------------
left: 80px headline, body, blue/dark actions
right: white viewing-session product card
       cyan or magenta blob offset behind the card
-----------------------------------------------------------------------
trust/flow band, then paired feature blocks and stream directory
```

The viewing-session card is a product visual: price, rate, watch time, live
state, and receipt status. It is not a dark terminal panel. The stream
directory uses a small number of elevated cards with clear pricing and a
single `Open` action.

The viewer route keeps the same language:

```text
title + creator + playback surface | white access card
description and session receipt   | price, network, wallet action
```

For a `402 Payment Required` response, show amount, network, asset, and the
next action in friendly copy. Do not expose raw facilitator errors as the
primary message.

## 7. Creator and admin workspaces

Creator and admin pages share the light marble canvas and elevated white
panels. They are denser than the public page but should not become black
control rooms.

At desktop widths (`1024px` and above), use a slim left sidebar, a quiet top
bar, a large page heading, and a four-metric strip. Active navigation uses a
signal-blue rule or a pale blue wash, not a floating pill. The primary header
action is blue; a dark navy action may be used once where contrast is useful.

Creator overview order:

1. greeting, context, and `New stream`;
2. Live now, Published, Watch time, and Settled revenue;
3. live/recent stream product panel;
4. settlement activity;
5. stream inventory and its actions.

Admin overview order:

1. system context and health;
2. Creators, Published streams, Active sessions, and Settled;
3. creator/stream approval queue;
4. settlement health and audit activity.

The stream editor uses two white 24px-radius panels side by side on desktop.
On mobile it becomes one ordered form with the save action easy to reach.

## 8. Responsive rules

Breakpoints: `640px`, `768px`, `1024px`, `1280px`, and `1536px`.

- Public header becomes icon mark plus full-width menu below `768px`.
- Hero columns stack; product cards remain readable before secondary copy.
- Creator/admin sidebars become a compact header, drawer, and bottom navigation.
- Metrics use two columns at 375px and one column at 320px.
- Tables become stacked records when columns no longer compare well.
- Keep one primary action visible per region and maintain 44px touch targets.
- Check 320px, 375px, 430px, 768px, 1024px, 1280px, and 1440px.

## 9. Empty, loading, accessibility, and motion

Empty states invite action: “No streams yet. Create a stream to start
accepting paid views.” Loading states preserve the final card or row geometry.
Errors describe what failed and the recovery path.

Every screen must preserve semantic headings, visible keyboard focus, readable
contrast, accessible icon labels, browser zoom, and reduced-motion behavior.
Motion should explain a user action: opening a drawer, confirming a payment,
or highlighting a just-saved row. Do not animate every card on page load.

## 10. Implementation map

| Area | Files |
| --- | --- |
| Tokens and responsive rules | `apps/web/app/globals.css` |
| Public shell | `apps/web/components/site-header.tsx`, `apps/web/app/page.tsx` |
| Logo assets | `apps/web/public/subgate-logo.png`, `apps/web/public/subgate-ico.png` |
| Creator workspace | `apps/web/app/dashboard/`, `apps/web/features/creator/` |
| Admin workspace | `apps/web/app/admin/`, `apps/web/features/admin/` |
| Viewer | `apps/web/app/streams/`, `apps/web/features/viewer/` |
| API boundary | `apps/web/app/api/`, `apps/web/lib/api-client.ts` |

FastAPI remains the source of truth for creator identity, streams, sessions,
settlements, and receipts. The web app never connects directly to PostgreSQL.
