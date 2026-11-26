# 04 – Technical Approach (draft, pending answers in 05)

## Candidate stack
- **Framework:** Next.js (App Router) + TypeScript – SSG/ISR for SEO, route transitions.
- **3D:** three.js via React Three Fiber + drei; postprocessing (bloom, DOF, grain) sparingly.
- **Animation:** GSAP + ScrollTrigger (scroll choreography), Lenis (smooth scroll), Framer Motion (UI).
- **Assets:** Blender → glTF/GLB (Draco/Meshopt), KTX2 textures; hero shots may be pre-rendered image/video sequences.
- **CMS:** headless (Sanity or WordPress-headless) so staff can add projects/posts; content migrated from WP.
- **Forms/leads:** booking form → email + WhatsApp + CRM/Sheets webhook.
- **Hosting:** Vercel/Netlify/Cloudflare. **Analytics:** GA4 via GTM (kept).

## Approaches considered
1. **Full real-time 3D scene** – most "wow", heaviest, risky on low-end Android (core audience in India).
2. **Pre-rendered cinematic sequences scrubbed on scroll + light WebGL accents** – best fidelity per KB, smoother on mobile, less interactive.
3. **Hybrid (recommended):** real-time 3D for hero + materials viewer; pre-rendered/photographic sequences for heavy beats; tiered quality.

## Performance budget
- LCP < 2.5 s on mid-range 4G Android; initial JS < 200 KB gz before 3D chunk; 3D chunk lazy-loaded after first paint with a designed loader.
- Texture memory budget ~100 MB mobile; GPU tiering (auto-drop DPR, shadows, post FX); 60 fps target, 30 fps floor.
- Fallback: no-WebGL / low-power / save-data → high-quality static imagery with CSS parallax.

## SEO & accessibility
- Server-rendered text content; all headings/copy in DOM (not canvas). Keep 10 blog slugs; 301 map; LocalBusiness + Service schema; Hyderabad local SEO preserved.
- WCAG 2.2 AA: keyboard nav, focus states, contrast on dark scenes, reduced-motion, captions for any video.

## Risks
Asset production cost/time (biggest), mobile performance, SEO regression on migration, client-supplied imagery quality.
