# Chain Time Machine design

## Overview

Chain Time Machine is a one-page Ethereum explorer for people who want to pair a public address with a historical block, or compare two blocks. It uses a dark, compact interface with mint accents, restrained borders, technical labels, and a large deterministic orbital drawing. The address supplies the drawing; the selected block supplies its exact UTC timestamp. The drawing is decorative, not a cryptographic identity or proof of ownership.

The reusable hierarchy is a prominent heading, clearly separated controls and results, and quieter supporting information. The two-column explorer and three supporting explanations are this page's composition, not a requirement for every future surface. There is one dark appearance, English copy, and no wallet connection, theme switch, modal, or persistent account state.

The implementation's source of truth is [src/styles.css](src/styles.css), followed by [src/App.tsx](src/App.tsx), [src/components/Fingerprint.tsx](src/components/Fingerprint.tsx), and [src/components/Icon.tsx](src/components/Icon.tsx). React and TypeScript provide the interface; Vite exports the static page using `base: './'` in [vite.config.ts](vite.config.ts). Review evidence and limitations are recorded separately in [artifacts/validation.md](artifacts/validation.md).

The design review and this document follow the supplied Better Interface guide: Jakub Krehel's [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), MIT, and Paul Bakaus's [Impeccable documentation method](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), Apache-2.0, as adapted in the assignment's pinned reference.

## Colors

The canonical format is hexadecimal CSS, with primitive colors and semantic aliases in `:root` of [src/styles.css](src/styles.css). Use semantic aliases for the shared interface.

| Semantic token | Implemented value | Role |
| --- | --- | --- |
| `--bg-page` | `--neutral-950`: `#0b1011` | Page, inputs, mode-switch recess |
| `--bg-panel` | `--neutral-900`: `#101617` | Explorer controls and network badge |
| `--bg-control` | `--neutral-850`: `#141c1d` | Notification surface |
| `--bg-hover` | `--neutral-800`: `#1e2929` | Selected mode and neutral hover states |
| `--border-subtle` | `#283332` | Structure and separators |
| `--border-control` | `#617269` | Input boundaries and control hover borders |
| `--text-primary` | `--neutral-100`: `#edf2ed` | Main headings, values, labels |
| `--text-secondary` | `--neutral-400`: `#a6b5ae` | Secondary values and icon controls |
| `--text-muted` | `--neutral-500`: `#8b9b96` | Hints, explanations, quiet labels |
| `--accent-fill` | `--mint-200`: `#b8f5d1` | Main action, selected navigation underline, result emphasis |
| `--accent-hover` | `--mint-100`: `#cefbdc` | Main action hover |
| `--text-on-accent` | `#132c23` | Main action and text selection foreground |
| `--text-error` | `--red-200`: `#ffb4ac` | Invalid inputs and error text |
| `--focus-ring` | `--mint-200`: `#b8f5d1` | Keyboard focus perimeter |

The result panel uses `#111819`; its snapshot card uses `#0e1816` with a `#33483e` outline and `#283d33` internal rules. Card microtype uses `#91a398`; timestamps use `#a6b5ae`. The request-error panel uses `#291e1d` and `#85564f`. The disabled primary button uses `#8bb79d`. These are component-local values in the same stylesheet, rather than additional themes.

The fingerprint's gradient and faint glow live in [Fingerprint.tsx](src/components/Fingerprint.tsx): ink runs from `#e6ffdf` through `#93e1c0` to `#3d7d71`, with a `#75dbb5` radial glow. Decorative SVG colors do not define control states. Status meaning also appears in text or icons. Measured contrast pairs and rendered checks belong to the validation record.

## Typography

Both fonts are bundled locally as WOFF2 and load with `font-display: swap`; no font service is required. `--font-sans` is `Manrope, Arial, sans-serif`, with the local variable normal face declared for weights 400–800. `--font-mono` is `'IBM Plex Mono', Consolas, monospace`, with a normal 400 face. Font synthesis is disabled. The `.mono` class explicitly uses weight 400 and tabular numerals for stable addresses, blocks, timestamps, and durations.

Font assets and attribution:

- [manrope-latin.woff2](public/fonts/manrope-latin.woff2), copyright 2018 The Manrope Project Authors; [SIL OFL 1.1 license](public/fonts/Manrope-LICENSE.txt).
- [ibm-plex-mono-latin.woff2](public/fonts/ibm-plex-mono-latin.woff2), copyright 2017 IBM Corp., reserved font name Plex; [SIL OFL 1.1 license](public/fonts/IBM-Plex-Mono-LICENSE.txt).

At the default 16px root size, the semantic scale is `--text-caption` 11px, `--text-small` 12px, `--text-body-sm` 13px, `--text-body` 14px, `--text-input` 16px, and `--text-title` 18px. Component rules refine these roles:

| Role | Actual treatment |
| --- | --- |
| Main heading | `clamp(2.5rem, 4.2vw, 3.5rem)`, weight 500, line-height 1.12, tracking −2.4px; mobile clamp 2–2.65rem with −1.5px tracking |
| Intro description | 14px, 1.8 line-height; 13px on narrow mobile |
| Field labels | 13px, weight 500, 1.5 line-height |
| Primary action | 13px, weight 700 |
| Address and block inputs | 12px and 14px on desktop; both 16px at 53rem and below |
| Snapshot block number | 24px desktop, 23px mobile; mono |
| Timestamp | 12px snapshot desktop; 11px comparison and narrow mobile; 1.7 line-height |
| Supporting explanations | Usually 12px, 1.8 line-height, max-width 44ch; mobile max-width 50ch |

Decorative microtype is intentionally smaller than body copy: art coordinates and labels reach 7px on narrow screens; serial numbers and status captions are generally 8–10px. These sizes are not a template for new instructions or input text. Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`. Full address readouts wrap with `overflow-wrap: anywhere` and remain selectable. Text is not replaced by ellipses. Uppercase eyebrow styling uses CSS with positive tracking, rather than changing the source wording.

## Layout

The centered `.app-shell` is at most 1264px wide, including 40px inline padding. The header is in normal document flow. The hero precedes `.workspace`; controls precede results in both the DOM and mobile reading order. The default workspace grid is `.83fr 1.17fr`, with a dividing border and approximately 29–31px panel padding. The supporting section uses three equal columns. No fixed toolbar obscures the page.

The spacing tokens are `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`, `--space-10: 40px`, and `--space-12: 48px`. The shell and header consume these tokens; many component-specific intervals remain literal values in the stylesheet. Reuse the scale where it fits rather than claiming every gap is tokenized. Direction-dependent padding and margins generally use logical properties.

| Breakpoint | Implemented adaptation |
| --- | --- |
| At most 68rem / 1088px | Compact header; hide version badge; 22px panel insets; workspace becomes `.9fr 1.1fr`; comparison connector disappears and the block readouts use two columns |
| At most 53rem / 848px | 28px shell insets; workspace stacks controls above results; separating border moves to the top; 26px panel padding; all inputs become 16px; brand subtitle moves to a second line |
| At most 36rem / 576px | 20px shell insets; navigation wraps to a separate row; hero aside and forced desktop line break disappear; supporting features and footer stack; result padding reduces; SVG sizes by aspect ratio |
| At most 22rem / 352px | 14px shell insets; smaller header spacing; 16px control-panel insets; comparison block readouts stack into one column |

The card and fields use `min-width: 0` where needed; addresses and duration values can wrap. The form's two comparison inputs remain side by side, while the resulting block readouts stack at the smallest breakpoint. Content remains in normal scrolling flow. The browser review confirmed loaded fonts and no page overflow at desktop 1440px and mobile 390px; the complete final viewport matrix and any unperformed zoom/device checks are in [artifacts/validation.md](artifacts/validation.md).

## Elevation & Depth

The interface is mostly flat. Tonal differences and 1px borders separate the page, explorer, card, and field surfaces. The selected mode alone has a small `0 2px 4px #0003` shadow. The orbital illustration gains depth from overlapping lines and a low-opacity SVG glow, not an animated canvas or image asset.

The skip link is the only elevated navigation element (`z-index: 20`); it appears on focus. There are no dialogs, scrims, floating menus, or toast overlays. Notifications remain in document flow beneath the explanatory section.

## Shapes

The shared radius tokens are `--radius-sm: 6px` for inputs and the primary action, `--radius-md: 10px` for the snapshot card, and `--radius-lg: 14px` for the workspace. The result panel follows the workspace's right corners on desktop and bottom corners when stacked. The snapshot card clips its artwork and internal surfaces within its rounded boundary.

The mode-switch track uses 8px corners, its buttons 4px, and icon buttons 5px. The network badge is a pill with a 100px radius. Structural rules are 1px; active navigation has a 2px underline. Keep these roles distinct rather than rounding every component into a pill.

## Components

**Page shell and navigation — [App.tsx](src/App.tsx), [styles.css](src/styles.css).** `.site-header`, `.brand`, `.network-pill`, and the named main navigation are page patterns, not exported library components. Native anchor links navigate within this one page. The first focusable element is a skip link to `main`. The Etherscan link on a snapshot opens the selected block in a new tab and includes that behavior in its accessible name.

**Mode switch and form — [App.tsx](src/App.tsx).** Two native buttons form a labelled group and expose selection through `aria-pressed`. Snapshot mode requires an address and one block; comparison adds a second block. Each input has a real label, hints or field errors through `aria-describedby`, and `aria-invalid` when appropriate. Invalid submission focuses the first failing input after its error renders and announces a summary. Block inputs request a numeric keyboard. “Try an example” fills the fields without silently submitting them.

**Primary action and states — [App.tsx](src/App.tsx), `.primary-button`.** One mint filled action submits the form. It retains its action label while loading, becomes natively disabled, shows a spinner and explanatory status, and marks the result panel busy. The result can show a labelled recorded example, loading, successful snapshot/comparison, or an instructive comparison empty state. Network errors include recovery guidance; earlier results remain available. Edited inputs display an explicit stale-result caption for a previous submitted result. Mode changes cancel the current lookup.

**Snapshot/comparison card — [App.tsx](src/App.tsx), `.snapshot-card` and `.comparison-card`.** These are local page patterns containing an address readout, orbital drawing, block readouts, source status, and optional comparison differences. `BlockReadout({ block, label, onMessage })` is a local helper for the formatted number, copy control, and semantic `<time>` with an ISO value. Visible timestamps explicitly say UTC. Block and time differences are absolute, so either input order works.

**Fingerprint — [Fingerprint.tsx](src/components/Fingerprint.tsx), [chain.ts](src/lib/chain.ts).** `Fingerprint` accepts `address` and optional `small`. The `small` prop currently adds a class without a separate style variant; the active compact sizing comes from `.comparison-card`. Trimmed, lowercase addresses feed a deterministic FNV-1a seed and a seeded sequence. Multiple seeded parameters control the projected orbital geometry. The SVG has an accessible image name and instance-specific gradient IDs. Changing block numbers leaves the address drawing unchanged. Collisions remain possible; this is decorative visualization.

**Copy control and feedback — [App.tsx](src/App.tsx).** Local `CopyButton({ value, label, onMessage })` copies the exact raw value, changes its icon and accessible name to confirm success, and restores the icon after 2.2 seconds. Copy failure instructs manual selection. The stable polite status region also carries lookup and form feedback, with a dismiss button; request errors use an alert. Icon buttons are 36px square on desktop, 40px on narrow mobile, with a 30×32px comparison exception for density.

**Icons and focus — [Icon.tsx](src/components/Icon.tsx), [styles.css](src/styles.css).** `Icon` accepts `name`, optional `size` (default 20), and optional `style`. Inline SVG icons use a consistent 1.5px rounded stroke and `currentColor`; these supporting icons are hidden from assistive technology. Interactive controls supply their own accessible names. `:focus-visible` uses a 2px mint outline, offset 4px (2px for inputs). Forced-colors mode uses system `Highlight` and explicit button borders.

**Motion — [styles.css](src/styles.css).** Hover styles only run on hover-capable devices. Under `prefers-reduced-motion: no-preference`, color/background/border transitions last 150ms with `cubic-bezier(.2, 0, 0, 1)`, and the loading spinner rotates once per second. Under reduced motion, those transitions and the spin are absent; the loading text still communicates state. The fingerprint itself does not animate.

## Do's and Don'ts

- Start a related surface inside `.app-shell`, with the shared type and semantic color tokens. Use the workspace split only when controls and results benefit from it.
- Keep one clear filled primary action for a task; use outlined or quiet controls for supporting actions.
- Preserve labels, visible keyboard focus, full selectable identifiers, exact UTC timestamps, and the input/result distinction.
- Keep addresses local. A fingerprint does not establish identity, ownership, balances, or activity at a block.
- Preserve 16px mobile input text and wrapping of long values. Keep decorative microtype separate from essential instructions.
- Use existing SVG icons and local font files. Do not introduce a remote asset dependency for an existing role.
- For an additional page or section, reuse the shell, fields, button states, and card treatments; supply one main heading and meaningful section headings; add a static-safe anchor/hash route or explicitly exported page; then check its narrow layout, keyboard path, errors, and production asset paths. Update this document only for implemented changes.
