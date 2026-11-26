# 07 – Hero build notes (v0 prototype)

Astro 6 static site. Hero = `src/components/Hero.astro` + `src/scripts/hero-scene.ts` (three.js, procedural, no external assets).

**How it works:** the hero is 780vh tall with a sticky 100svh stage. Scroll position maps to progress `p` (0-1), smoothed (exponential ease). Nine build stages each own a window of `p` (`STAGES` in hero-scene.ts); camera dollies from a high survey view to an eye-level 3/4 view via keyframes.

| p | Stage |
|---|---|
| 0.00-0.10 | Survey: grid, plot outline draws itself, corner pegs |
| 0.09-0.18 | Foundation slab rises |
| 0.17-0.34 | Walls rise (window opening) |
| 0.33-0.42 | Electrical/plumbing conduits draw in |
| 0.41-0.50 | Ceiling soffit drops in, cove strip |
| 0.49-0.58 | Timber floor sweeps in |
| 0.57-0.69 | Plaster paint, fluted wood feature wall, glazing, curtains |
| 0.69-0.90 | Furniture drops in (sofa, table, chairs, lamp, plant) |
| 0.88-1.00 | Warm lights on, WhatsApp/call CTA appears |

**Texturing:** procedural canvas PBR-ish maps (timber planks with grain + joints, fluted oak with bump, plaster grain), IBL via RoomEnvironment, ACES tone mapping, soft sun shadows through the window.

**Fallbacks:** `prefers-reduced-motion` skips smoothing; no WebGL shows a plain panel; mobile caps pixel ratio and shadow-map size; render loop pauses when hero is off-screen.

**Next:** swap procedural furniture for Blender-rendered/GLB assets (see 03/04), add real textures, then build Work, Services, Materials pages.

Run: `npm run dev`
