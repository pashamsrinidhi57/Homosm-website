# 01 – Current Site (homasm.com) IA Audit

**Business:** Homasm Interiors, Hyderabad, India. Residential interiors + execution ("Discipline • Precision • Trust"; "No delays. No excuses. Only precision.").
**Contact:** +91 97011 05981, +91 99480 48111, info@homasm.com, WhatsApp, Instagram `homasmofficial`, Facebook, YouTube.
**Platform today:** WordPress + Elementor on the purchased "Kitchor" (WPOpal) kitchen theme. Evidence: custom post types `kitchor_service` / `kitchor_project`, leftover demo links (cart, my-account, `source.wpopal.com`), demo author slug. Fonts: Plus Jakarta Sans, Poppins, Rajdhani. SEO: Rank Math. Analytics: GTM.
**Primary conversion:** "Book a design appointment" / phone / WhatsApp / enquiry form.

## Sitemap (from sitemap.xml)

```
/ (Home)
├── About us ............................ /about-us-01/
├── Services ............................ /service/
│   ├── Premium Wood & Surface Solutions  /service/premium-wood-surface-solutions/
│   ├── Kitchen Design (Modular Kitchen)  /service/kitchen-design/
│   ├── Kitchen Planner .................. /service/kitchen-planner/
│   ├── Home Check ....................... /service/home-check/
│   └── Smart Care ....................... /service/smart-care/
│   (page also lists: Residential, Commercial, Space Planning, Modular Kitchen)
├── Interior pages (nav dropdown "Projects")
│   ├── Full Home Interiors .............. /full-home-interiors/
│   ├── Modular Kitchen Interiors ........ /modular-kitchen-interiors/
│   ├── Living Room Interiors ............ /living-room-interiors/
│   └── Bedroom Interiors ................ /bedroom-interiors/
├── Projects ............................ /project/  (also /projects/)
│   ├── 2 BHK / 3 BHK / 4 BHK / 5 BHK / Villa / Studio Apartment
│   │   (6 project posts exist: 2-bhk, 4-bhk, 5-bhk, villa, kitchen-project-01, kitchen-project-05)
│   ├── Project categories: Contemporary, Indian Classic, Indian Traditional,
│   │   Minimalist, Modern, Small Space, Top Sellers, Vintage   (/project-cat/*)
│   └── Gallery .......................... /projects/gallery/ (Abhiti Gems & Jewelz, CS Luxurio, …)
├── Pricing ............................. /our-pricing/   (renders empty – broken/unfinished)
├── Blog ................................ /blog/  (10 articles, SEO-driven guides)
├── FAQs ................................ /faqs/  (Pre-Construction, After Contract, Misc)
├── Book an appointment ................. /book-a-appointment/
├── Contact ............................. /contact-01/
├── Privacy policy ...................... /privacy-policy/
└── Orphans / duplicates: /home-interior/ (duplicate home), /kitchens/ (leftover theme demo:
    "Milano", "Larch", "dTC show home"), cart / my-account links
```

## Homepage section order
1. Hero – "Creative solutions by professional designers"
2. Services: Residential, Modern Living, Classic & Elegant, Luxury Interiors
3. Why choose us: Full-Service Execution, Deliver Value, Trusted Partner, Integrity & Accountability
4. Execution philosophy band ("Discipline • Precision • Trust")
5. Projects: 2 / 3 / 4 / 5 BHK, Villa, Studio Apartment
6. Blog: "Follow the latest news" (6 posts)
7. CTA "You dream it, we design it" + enquiry form
8. Footer: phone, quick links, gallery, socials

## Other page contents
- **About:** Who We Are; Reasonable Pricing / Execution Excellence / Professional Team; Quality of Work; Milestones timeline; Build with HOMASM; Client testimonials.
- **Services:** How we work (Consult & brief → Design & plan → Execute on site → Handover & support).
- **Kitchen design:** Styles, layouts, Indian-cooking focus, storage, finishes, hardware, material options.
- **Blog (10):** design trends 2026, coastal / farmhouse / country / Hollywood-glam styles, living room, modular kitchen & dining, best designers in Hyderabad, step-by-step guide, what is interior design.

## Problems to fix (inputs to redesign)
- Duplicated/orphan pages (home-interior, kitchens, projects vs project), empty pricing page, theme-demo remnants (cart/account/WPOpal).
- Project pages are thin (one heading + "The Result") – no case-study storytelling, no materials, no before/after, no budget/timeline.
- Project taxonomy mixes unit size (BHK) with style – two different mental models.
- Navigation labels "Projects" dropdown actually lists service pages.
- No 360/3D/video, no lead-qualifying flow beyond a form.
- ~200–270 KB of HTML per page (Elementor bloat) → slow on mobile.

## Content volume
6 projects, 5 service pages, 4 interior-type pages, 10 blog posts, 8 style categories, ~6 testimonials-class items, 3 FAQ groups. Small enough to rebuild fully.
