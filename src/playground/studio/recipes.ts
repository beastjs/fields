import type { PageRecipe } from './types'

/** Curated page compositions; keep stable ids so saved catalog references survive updates. */
export const pageRecipes: PageRecipe[] = [
  {
    id: 'brutalist-manifesto',
    title: 'Brutalist manifesto',
    description: 'Heavy rules, poster-scale type, and a marquee that shouts — a creative studio with opinions.',
    templates: ['topbar-index', 'hero-manifesto', 'features-index', 'stats-giant', 'cta-shout', 'footer-wordmark']
  },
  {
    id: 'kinetic-type-foundry',
    title: 'Kinetic type foundry',
    description: 'Giant words drifting in both directions, specimen cards that come alive, and a letterpress sign-up.',
    templates: ['topbar-floating', 'hero-kinetic', 'products-specimen', 'stats-giant', 'testimonials-pullquote', 'newsletter-letterpress', 'footer-colophon']
  },
  {
    id: 'gallery-exhibition',
    title: 'Gallery exhibition',
    description: 'A hushed gallery: a framed abstract canvas, a salon-hung wall of works, and a roll of artists.',
    templates: ['topbar-gallery', 'hero-exhibition', 'products-salon', 'team-artists', 'testimonials-pullquote', 'footer-colophon']
  },
  {
    id: 'swiss-poster',
    title: 'Swiss poster',
    description: 'International Typographic Style on the web: a visible grid, a colossal numeral, primary shapes, and a spinning stamp.',
    templates: ['topbar-index', 'hero-swiss', 'features-shapes', 'stats-giant', 'cta-stamp', 'footer-wordmark']
  },
  {
    id: 'orbital-studio',
    title: 'Orbital studio',
    description: 'Rings and glowing satellites circling a light headline, for an immersive or experiential studio.',
    templates: ['topbar-floating', 'hero-orbit', 'features-index', 'testimonials-pullquote', 'cta-stamp', 'footer-wordmark']
  },
  {
    id: 'editorial-magazine',
    title: 'Editorial magazine',
    description: 'A print magazine online: masthead nameplate, cover story, a two-column long read, and a colophon.',
    templates: ['topbar-masthead', 'hero-cover', 'features-editorial', 'testimonials-pullquote', 'newsletter-letterpress', 'footer-colophon']
  },
  {
    id: 'architect-blueprint',
    title: 'Architect’s blueprint',
    description: 'Drafting-paper grids, a line-drawn section with dimension marks, measured numbers, and a long read about craft.',
    templates: ['topbar-gallery', 'hero-blueprint', 'stats-giant', 'features-editorial', 'cta-stamp', 'footer-colophon']
  },
  {
    id: 'festival-poster',
    title: 'Festival poster',
    description: 'A turning sunburst, a billed lineup in three sizes, a tabbed running order, and a shouting ticket band.',
    templates: ['topbar-floating', 'hero-lineup', 'guides-timetable', 'stats-giant', 'cta-shout', 'footer-wordmark']
  },
  {
    id: 'cut-and-paste-zine',
    title: 'Cut-and-paste zine',
    description: 'Tilted word blocks, taped notes, starbursts, and stickers — a scrappy, handmade publication.',
    templates: ['topbar-index', 'hero-collage', 'features-stickers', 'testimonials-pullquote', 'newsletter-letterpress', 'footer-wordmark']
  },
  {
    id: 'generative-studio',
    title: 'Generative art studio',
    description: 'A shimmering field of computed dots, a disciplines index, and a salon of generative editions.',
    templates: ['topbar-floating', 'hero-dotfield', 'features-index', 'products-salon', 'cta-stamp', 'footer-colophon']
  },
  {
    id: 'bauhaus-school',
    title: 'Bauhaus school',
    description: 'Circles, triangles, and quarter-rounds that turn on hover, a geometric foundation course, and its makers.',
    templates: ['topbar-index', 'hero-bauhaus', 'features-shapes', 'team-artists', 'cta-shout', 'footer-wordmark']
  },
  {
    id: 'slow-reading-journal',
    title: 'Slow-reading journal',
    description: 'Staggered serif verses, wide margins, a long read with a drop cap, and letters by post.',
    templates: ['topbar-masthead', 'hero-verse', 'features-editorial', 'newsletter-letterpress', 'footer-colophon']
  },
  {
    id: 'saas-launch',
    title: 'SaaS launch',
    description: 'The classic software landing page, from hero to pricing.',
    templates: ['topbar-marketing', 'hero-centered', 'partners-marquee', 'features-bento', 'guides-steps', 'testimonials-wall', 'pricing-tiers', 'faq-accordion', 'cta-banner', 'footer-columns']
  },
  {
    id: 'waitlist',
    title: 'Pre-launch waitlist',
    description: 'Collect early sign-ups and tell your founding story.',
    templates: ['topbar-responsive-menu', 'hero-waitlist', 'features-grid', 'team-founders', 'faq-accordion', 'footer-simple']
  },
  {
    id: 'storefront',
    title: 'Storefront',
    description: 'Sell products with reviews and a newsletter.',
    templates: ['topbar-centered', 'hero-statement', 'products-grid', 'testimonials-spotlight', 'newsletter-card', 'footer-columns']
  },
  {
    id: 'platform',
    title: 'Product platform',
    description: 'A multi-product company page with proof and plan comparison.',
    templates: ['topbar-marketing', 'hero-split', 'partners-dual-marquee', 'stats-row', 'products-suite', 'features-alternating', 'guides-walkthrough', 'pricing-compare', 'cta-split', 'footer-signoff']
  },
  {
    id: 'signed-out-landing',
    title: 'Signed-out landing',
    description: 'The default page a visitor sees before signing in: topbar, hero, call to action, footer.',
    templates: ['topbar-default', 'hero-default', 'cta-default', 'footer-default']
  },
  {
    id: 'minimal-launch',
    title: "Minimal launch",
    description: "A quiet, compact launch: bold centered type, three benefits, one invitation, and a minimal sign-off.",
    templates: ['topbar-centered', 'hero-centered', 'features-grid', 'cta-split', 'footer-simple']
  },
  {
    id: 'bento-product',
    title: "Bento product",
    description: "An editorial opening paired with modular feature tiles, a product tour, and a single clear price.",
    templates: ['topbar-marketing', 'hero-statement', 'features-bento', 'products-tabs', 'pricing-single', 'faq-accordion', 'footer-columns']
  },
  {
    id: 'interactive-product-tour',
    title: "Interactive product tour",
    description: "Let visitors explore: a split hero, switchable product views, guided steps, and rotating customer stories.",
    templates: ['topbar-responsive-menu', 'hero-split', 'products-tabs', 'guides-walkthrough', 'testimonials-carousel', 'cta-banner', 'footer-simple']
  },
  {
    id: 'solo-founder',
    title: "Solo founder",
    description: "A personal product story with a founder letter, focused benefits, and one all-inclusive plan.",
    templates: ['topbar-centered', 'hero-centered', 'team-founders', 'features-grid', 'pricing-single', 'faq-columns', 'footer-signoff']
  },
  {
    id: 'developer-launch',
    title: "Developer launch",
    description: "A product-led starting point for a developer tool, with a walkthrough, resources, and transparent tiers.",
    templates: ['topbar-marketing', 'hero-split', 'features-bento', 'guides-walkthrough', 'guides-library', 'pricing-tiers', 'footer-columns']
  },
  {
    id: 'enterprise-platform',
    title: "Enterprise platform",
    description: "A spacious enterprise pitch built around customer logos, measurable outcomes, a product suite, and plan comparison.",
    templates: ['topbar-marketing', 'hero-statement', 'partners-grid', 'stats-story', 'products-suite', 'testimonials-spotlight', 'pricing-compare', 'faq-columns', 'cta-split', 'footer-columns']
  },
  {
    id: 'automation-platform',
    title: "Automation platform",
    description: "Explain an automation workflow through an app preview, interactive steps, alternating benefits, and clear pricing.",
    templates: ['topbar-responsive-menu', 'hero-split', 'guides-walkthrough', 'features-alternating', 'stats-row', 'pricing-tiers', 'faq-accordion', 'cta-banner', 'footer-simple']
  },
  {
    id: 'analytics-product',
    title: "Analytics product",
    description: "Lead with the product, then make the case with metrics, feature tiles, customer proof, and plan details.",
    templates: ['topbar-marketing', 'hero-split', 'stats-row', 'features-bento', 'stats-story', 'testimonials-spotlight', 'pricing-compare', 'footer-columns']
  },
  {
    id: 'collaboration-workspace',
    title: "Collaboration workspace",
    description: "A friendly team-software page with social proof, product tabs, onboarding steps, and customer voices.",
    templates: ['topbar-responsive-menu', 'hero-centered', 'partners-marquee', 'products-tabs', 'guides-steps', 'testimonials-wall', 'pricing-tiers', 'cta-split', 'footer-simple']
  },
  {
    id: 'product-suite',
    title: "Connected product suite",
    description: "An expansive suite overview with a statement hero, product pillars, switchable details, and a guided tour.",
    templates: ['topbar-marketing', 'hero-statement', 'products-suite', 'products-tabs', 'guides-walkthrough', 'partners-grid', 'cta-banner', 'footer-columns']
  },
  {
    id: 'feature-release',
    title: "Feature release",
    description: "A focused release announcement: show the change, explain the benefits, walk through it, and invite people back.",
    templates: ['topbar-centered', 'hero-split', 'features-alternating', 'guides-steps', 'newsletter-inline', 'cta-split', 'footer-simple']
  },
  {
    id: 'single-offer',
    title: "One product, one price",
    description: "A restrained sales page that pairs a strong product introduction with one plan and one customer story.",
    templates: ['topbar-centered', 'hero-centered', 'features-grid', 'testimonials-spotlight', 'pricing-single', 'faq-accordion', 'footer-simple']
  },
  {
    id: 'pricing-led',
    title: "Choose your plan",
    description: "A short conversion page that brings pricing forward, followed by reassurance and straightforward answers.",
    templates: ['topbar-marketing', 'hero-centered', 'pricing-tiers', 'testimonials-carousel', 'faq-columns', 'cta-split', 'footer-simple']
  },
  {
    id: 'comparison-led',
    title: "Compare the details",
    description: "Give deliberate buyers room to explore product capabilities, compare plans, and resolve their questions.",
    templates: ['topbar-responsive-menu', 'hero-split', 'products-tabs', 'pricing-compare', 'faq-columns', 'testimonials-spotlight', 'cta-banner', 'footer-columns']
  },
  {
    id: 'early-access',
    title: "Early access",
    description: "A compact email-first page with a preview of the benefits and a personal note from the people building it.",
    templates: ['topbar-centered', 'hero-waitlist', 'features-bento', 'team-founders', 'footer-simple']
  },
  {
    id: 'community-beta',
    title: "Community beta",
    description: "Invite early users into the story with an email hero, team introduction, customer voices, and open answers.",
    templates: ['topbar-responsive-menu', 'hero-waitlist', 'team-grid', 'testimonials-wall', 'faq-columns', 'newsletter-inline', 'footer-signoff']
  },
  {
    id: 'launch-countdown',
    title: "Launch journal",
    description: "Build anticipation with an email invitation, a product preview, the founding story, and a place for ongoing updates.",
    templates: ['topbar-marketing', 'hero-waitlist', 'products-tabs', 'team-founders', 'newsletter-card', 'footer-columns']
  },
  {
    id: 'creative-studio',
    title: "Creative studio",
    description: "Oversized editorial type, a modular capabilities grid, selected offerings, and a warm team-led close.",
    templates: ['topbar-centered', 'hero-statement', 'features-bento', 'products-suite', 'testimonials-spotlight', 'team-grid', 'cta-split', 'footer-signoff']
  },
  {
    id: 'independent-consultant',
    title: "Independent consultant",
    description: "A personal service page with an editorial introduction, a founder-style letter, a simple process, and client proof.",
    templates: ['topbar-centered', 'hero-statement', 'team-founders', 'guides-steps', 'testimonials-spotlight', 'cta-banner', 'footer-simple']
  },
  {
    id: 'boutique-agency',
    title: "Boutique agency",
    description: "A polished service-company composition balancing an ambitious headline, capabilities, outcomes, and a small team.",
    templates: ['topbar-responsive-menu', 'hero-statement', 'partners-grid', 'features-alternating', 'stats-story', 'team-grid', 'cta-split', 'footer-signoff']
  },
  {
    id: 'service-subscription',
    title: "Service subscription",
    description: "Present a repeatable service with a three-step process, a clear package, customer stories, and answers.",
    templates: ['topbar-centered', 'hero-centered', 'guides-steps', 'features-grid', 'pricing-single', 'testimonials-carousel', 'faq-accordion', 'footer-simple']
  },
  {
    id: 'company-story',
    title: "Our company story",
    description: "An editorial company page that moves from mission to founders, milestones, people, and a closing invitation.",
    templates: ['topbar-marketing', 'hero-statement', 'team-founders', 'stats-story', 'team-grid', 'partners-grid', 'cta-split', 'footer-signoff']
  },
  {
    id: 'people-first',
    title: "People first",
    description: "Put the team at the heart of the page, supported by a founding letter, company benefits, and a simple call to action.",
    templates: ['topbar-responsive-menu', 'hero-statement', 'team-grid', 'team-founders', 'features-grid', 'cta-banner', 'footer-simple']
  },
  {
    id: 'customer-stories',
    title: "Customer stories",
    description: "A proof-rich page with a headline story, results, a wall of customer voices, and deeper resources.",
    templates: ['topbar-marketing', 'hero-centered', 'testimonials-spotlight', 'stats-story', 'testimonials-wall', 'guides-library', 'cta-split', 'footer-columns']
  },
  {
    id: 'trust-and-proof',
    title: "Built on trust",
    description: "A measured company pitch combining a static logo grid, key metrics, capabilities, and an extended customer story.",
    templates: ['topbar-centered', 'hero-split', 'partners-grid', 'stats-row', 'features-alternating', 'testimonials-spotlight', 'faq-columns', 'footer-signoff']
  },
  {
    id: 'editorial-store',
    title: "Editorial collection",
    description: "A magazine-like shop composition with oversized type, a product collection, a brand story, and quiet email signup.",
    templates: ['topbar-centered', 'hero-statement', 'products-grid', 'team-founders', 'testimonials-carousel', 'newsletter-inline', 'footer-signoff']
  },
  {
    id: 'product-drop',
    title: "Product drop",
    description: "A concise collection launch: a strong opening, shoppable cards, customer proof, and an updates card.",
    templates: ['topbar-responsive-menu', 'hero-centered', 'products-grid', 'testimonials-wall', 'newsletter-card', 'footer-simple']
  },
  {
    id: 'maker-store',
    title: "Maker storefront",
    description: "Give a collection a human voice with a personal brand letter, product cards, reviews, and buying questions.",
    templates: ['topbar-centered', 'hero-statement', 'team-founders', 'products-grid', 'testimonials-spotlight', 'faq-columns', 'footer-simple']
  },
  {
    id: 'digital-products',
    title: "Digital product collection",
    description: "Show a digital offering as a connected suite, explain how to get started, and close with a simple price.",
    templates: ['topbar-marketing', 'hero-centered', 'products-suite', 'guides-steps', 'pricing-single', 'faq-accordion', 'newsletter-inline', 'footer-columns']
  },
  {
    id: 'resource-hub',
    title: "Resource hub",
    description: "A calm editorial home for guides and playbooks, with featured benefits and a prominent newsletter invitation.",
    templates: ['topbar-responsive-menu', 'hero-statement', 'guides-library', 'features-grid', 'newsletter-card', 'footer-columns']
  },
  {
    id: 'learning-path',
    title: "Learn by doing",
    description: "A learning-oriented composition with a step-by-step introduction, an interactive walkthrough, and a resource library.",
    templates: ['topbar-centered', 'hero-centered', 'guides-steps', 'guides-walkthrough', 'guides-library', 'faq-accordion', 'newsletter-inline', 'footer-simple']
  },
  {
    id: 'newsletter-publication',
    title: "The weekly edit",
    description: "An email-first publication starter with an editorial introduction, reading cards, a personal letter, and signup.",
    templates: ['topbar-centered', 'hero-statement', 'guides-library', 'team-founders', 'newsletter-card', 'footer-signoff']
  },
  {
    id: 'community-home',
    title: "Community home",
    description: "A welcoming community composition with shared benefits, people, member stories, and resources to explore.",
    templates: ['topbar-responsive-menu', 'hero-centered', 'features-grid', 'team-grid', 'testimonials-wall', 'guides-library', 'newsletter-inline', 'footer-columns']
  },
  {
    id: 'founders-manifesto',
    title: "Founders manifesto",
    description: "A deliberately spare story page: a strong statement, a personal letter, a few meaningful numbers, and a signature close.",
    templates: ['topbar-centered', 'hero-statement', 'team-founders', 'stats-row', 'cta-split', 'footer-signoff']
  },
  {
    id: 'premium-showcase',
    title: "Premium product showcase",
    description: "A generous editorial product presentation with alternating details, an interactive showcase, and a single price.",
    templates: ['topbar-centered', 'hero-statement', 'features-alternating', 'products-tabs', 'testimonials-spotlight', 'pricing-single', 'cta-split', 'footer-signoff']
  }
]
