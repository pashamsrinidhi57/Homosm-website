# 08 – Design System & Colour System (v0.1)

Source of truth in code: `src/styles/tokens.css`. Live reference page: `/design-system`.

## Brand read from the logo
Three voices: **signature script** "Homasm" (black, over a **saffron `#FDB041` block** cropped at ~64% width), a **high-contrast serif wordmark**, and a **humanist sans tagline** "Your Interior Execution Partner". The design system keeps those three voices: saffron for brand, ink for text, script only in the logo.

## Colour
Palettes are generated in OKLCH from the brand saffron so steps are perceptually even.

**Saffron (brand):** 50 `#FFF6EC` · 100 `#FFEDD8` · 200 `#FFDFB9` · 300 `#FFCE91` · 400 `#FEC172` · **500 `#FDB041`** · 600 `#D89533` · 700 `#AB731E` · 800 `#7E5415` · 900 `#57390A` · 950 `#331F03`

**Ink (warm neutral):** 0 `#FFFBF8` · 50 `#F9F2ED` · 100 `#F0E8E2` · 200 `#E1D9D2` · 300 `#CBC2BB` · 400 `#A69D95` · 500 `#827871` · 600 `#625952` · 700 `#463E38` · 800 `#2D2823` · 900 `#191511` · 950 `#0E0A08`

**Semantic roles (light):** `--bg` ink-50 · `--bg-raised` ink-0 · `--bg-sunken` ink-100 · `--text` ink-950 · `--text-muted` ink-600 · `--text-accent` saffron-800 · `--brand` saffron-500 · `--on-brand` ink-950.
**Dark (`[data-theme='dark']`):** bg ink-950, raised ink-900, text ink-50, muted ink-300, accent text saffron-500.

**Rules**
- Saffron is a *fill and highlight* colour. Never text on cream (1.7:1). For accent text use `--text-accent`.
- Text on saffron is always ink-950 (10.8:1). Never white (1.8:1).
- Ratio of use: ~70% cream/ink neutrals, ~25% ink, ~5% saffron. Saffron marks the one action per view (WhatsApp / book).
- Status: success `#3F7D58`, danger `#B3402E`.

| Pair | Ratio | Grade |
|---|---|---|
| ink-950 / ink-50 | 17.8 | AAA |
| ink-950 / saffron-500 | 10.8 | AAA |
| saffron-500 / ink-950 | 10.8 | AAA |
| ink-600 / ink-50 | 6.2 | AA |
| saffron-800 / ink-50 | 6.0 | AA |

## Typography
- **Display: Cormorant (variable)**, a high-contrast serif that echoes the wordmark. Headlines, large numerals, italic accents in `--text-accent`.
- **Body/UI: Cabin (variable)**, a humanist sans close to the tagline. Body 17px/1.6, UI 14-15px, eyebrows 13px, 0.28em tracking, uppercase.
- **Script:** logo only. Never set copy in script.
- Fluid scale `--fs-0` … `--fs-5` (0.8rem → 6.5rem) with `clamp()`.
- Swap candidates if you have the original brand fonts: tell me the wordmark and tagline typefaces and I'll replace them in one place (`--font-display`, `--font-body`).

## Logo usage
Script mark is an inline SVG (`Logo.astro`) using `currentColor`. Variants: ink on cream, ink on saffron, cream on ink; with saffron block in the header; typeset wordmark + tagline (`Wordmark.astro`). Never recolour the saffron block; clear space = H crossbar height. **Open item:** the serif wordmark + tagline lockup in the PNG you shared is recreated in type, not traced. Send the vector file if you want the exact lockup.

## Components (v0)
Buttons: `primary` (saffron, the one CTA), `solid` (ink), `ghost` (outline). Cards: raised, soft shadow, radius 20. Radius scale 4/10/20/pill. Shadows `--shadow-1/2`.

## Motion
`--ease` cubic-bezier(.22,1,.36,1) for reveals; `--ease-cine` cubic-bezier(.65,0,.35,1) for scrubbed camera moves; durations 0.25 / 0.5 / 0.9 / 1.4s. No bounce. Reduced-motion removes transitions.

## 3D scene palette
Neutral cream walls, oak timber, warm cove light (`#FFC98A`), saffron used sparingly for accents (survey pegs, cushion, plan lines) so the brand colour reads as a highlight in the room.
