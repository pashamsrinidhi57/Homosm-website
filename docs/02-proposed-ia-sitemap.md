# 02 – Proposed IA & Sitemap (draft)

**Principle:** one immersive spine (the "Walkthrough") + conventional pages underneath for SEO, speed and accessibility. The 3D layer enhances; every route also works as a normal page.

## Primary navigation
`Work` · `Services` · `Process` · `Journal` · `About` · **`Book a consultation`** (persistent CTA) + WhatsApp/phone

## Sitemap
```
/                         Home – cinematic scroll "walkthrough" (see 03)
/work                     Portfolio index (filter: space type, style, size/BHK)
  /work/[slug]            Case study (hero 3D/parallax, story, materials, before/after, gallery, result)
  /work/gallery           Masonry gallery (kept – popular)
/services                 Overview
  /services/full-home-interiors
  /services/modular-kitchens
  /services/living-rooms
  /services/bedrooms-wardrobes
  /services/premium-wood-surfaces      (materials showcase – best place for texture)
  /services/commercial                 (listed today; confirm if offered)
  /services/home-check-smart-care      (merge Home Check + Smart Care + Kitchen Planner – confirm)
/materials                NEW – interactive material & finish library (texture hero feature)
/process                  NEW – 4-step journey (Consult → Design → Execute → Handover) + timelines
/pricing                  Ranges / packages or "how we quote" (currently empty page)
/about                    Story, team, milestones, testimonials
/journal                  Blog (keep all 10 posts + URLs for SEO)
  /journal/[slug]
/faqs
/book                     Consultation booking (multi-step, qualifies BHK / budget / area / timeline)
/contact                  Address, map, phone, WhatsApp, form
/privacy-policy
/404
```

## Old → new URL map (301 redirects required – protect SEO)
| Old | New |
|---|---|
| /about-us-01/ | /about |
| /service/, /service/kitchen-design/ | /services, /services/modular-kitchens |
| /service/premium-wood-surface-solutions/ | /services/premium-wood-surfaces |
| /service/kitchen-planner/, /home-check/, /smart-care/ | /services/home-check-smart-care (TBC) |
| /full-home-interiors/, /modular-kitchen-interiors/, /living-room-interiors/, /bedroom-interiors/ | /services/* equivalents |
| /project/, /projects/ | /work |
| /project/[x]/ | /work/[x] |
| /project-cat/[style]/ | /work?style=[style] |
| /projects/gallery/ | /work/gallery |
| /blog/, /[post-slug]/ | /journal, /journal/[post-slug] (**keep post slugs identical** if client prefers zero SEO risk – TBC) |
| /our-pricing/, /faqs/, /contact-01/, /book-a-appointment/ | /pricing, /faqs, /contact, /book |
| /home-interior/, /kitchens/ | 301 → / and /services/modular-kitchens |

## Home page flow (summary – detail in 03)
Hero reveal → Promise ("Discipline • Precision • Trust") → Services as rooms → Featured projects → Materials close-up → Process → Testimonials → Journal → Book CTA.
