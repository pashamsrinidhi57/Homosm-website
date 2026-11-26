# 03 – Experience, Motion & Texture Direction (draft)

## Concept
"Walk through a Homasm home." Scrolling moves a camera through a calm, softly lit, photoreal-looking space; each section is a room/vignette. Real project photography and real material scans carry the credibility; 3D carries the wow.

## Scroll choreography (home)
| Beat | Visual | Motion |
|---|---|---|
| 1 Hero | Dimly lit room, key light sweeps on, headline resolves | Camera dolly-in, light bloom, text mask reveal |
| 2 Promise | Hand-off to wall plane with the three words | Parallax depth, line-by-line reveal |
| 3 Services | Four vignettes (living, kitchen, bedroom, full home) | Camera glides room to room; hover = object lift/tilt |
| 4 Materials | Macro close-ups: veneer grain, marble, fluted panels, brass | Slow camera push, light raking across the surface to show relief |
| 5 Projects | Project cards as floating "frames" in 3D space | Drag/scroll carousel, shared-element transition into case study |
| 6 Process | Floor-plan wireframe → built room | Morph from line drawing to textured render |
| 7 CTA | Warm sunset-lit room | Slow orbit, magnetic CTA |

## Texture / material quality (priority from client)
- PBR textures (albedo, normal, roughness, AO) for hero materials: walnut/teak veneer, fluted wood, marble, quartz, fabric/bouclé, brushed brass, matte laminate.
- Real photographed/scanned swatches from Homasm's actual catalog where possible (client to supply).
- HDRI studio + baked lightmaps for soft, believable light; subtle film grain, depth of field, vignette.
- Compressed GPU textures (KTX2/Basis), 2K max for hero, 1K elsewhere.
- Interactive `/materials`: pick a finish → applies live to a cabinet/wall sample, raking-light slider.

## Motion principles
- Cinematic = slow, eased, weighty: ease-out-expo / custom cubic-bezier, 0.8–1.4 s for hero moves; no bounce.
- Scroll-linked (scrubbed) for camera; time-based for UI reveals.
- Smooth scroll (inertia) with native scroll semantics preserved.
- Page transitions: crossfade + camera continuity; shared-element for project → case study.
- Sound: optional, off by default.
- `prefers-reduced-motion`: static hero image, no scrubbing, simple fades.

## Page-level 3D usage
Home = full scene. Services = one hero object each. Case studies = hero parallax + optional 360/GLB viewer. About/FAQ/Journal/Contact = restrained (typography, subtle depth) so reading stays easy.

## Asset pipeline options (to decide)
(a) Commission/model scenes in Blender → glTF; (b) AI image-to-3D for props (assist only); (c) pre-rendered video/image sequences scrubbed on scroll for heaviest shots; (d) hybrid (recommended, see 04).
