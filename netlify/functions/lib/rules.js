// CRO rule engine.
// Shared checklist + page-type packs (SaaS landing / e-commerce product / funnel).
// Each rule returns null (not applicable / no data) or { status, detail }.

const CATEGORIES = {
  first_impression: "First impression",
  cta: "Calls to action",
  trust: "Trust & credibility",
  forms: "Forms & friction",
  speed: "Speed & performance",
  mobile: "Mobile experience",
  content: "Content & clarity",
  product: "Product page",
  funnel: "Funnel discipline",
};

export const PAGE_TYPES = {
  auto: "Auto-detect",
  product: "Product page",
  funnel: "Funnel / opt-in page",
  generic: "General landing page",
};

const WEIGHTS = { high: 8, medium: 4, low: 2 };

// ---------------------------------------------------------------- detection
export function detectPageType(d) {
  if (!d) return "generic";
  const productScore =
    (d.addToCartCTA ? 3 : 0) +
    (d.priceMatches > 0 ? 1 : 0) +
    (d.variantSelector ? 2 : 0) +
    (d.shippingWords ? 1 : 0) +
    (d.reviewsWidget ? 1 : 0);
  const funnelScore =
    (d.forms?.length > 0 ? 2 : 0) +
    (d.navLinks !== null && d.navLinks <= 3 ? 2 : 0) +
    (d.exitLinks !== null && d.exitLinks <= 8 ? 2 : 0) +
    (d.countdown ? 2 : 0);

  const best = Math.max(productScore, funnelScore);
  if (best < 4) return "generic";
  if (best === productScore) return "product";
  return "funnel";
}

// ---------------------------------------------------------------- shared rules
const SHARED_RULES = [
  {
    id: "h1-present", category: "first_impression", severity: "high",
    title: "Clear headline (H1)",
    why: "Visitors decide in ~5 seconds whether a page is for them. One clear H1 stating the value proposition is the single strongest anchor for that decision.",
    fix: "Add exactly one H1 that says what you offer and who it's for, in plain words. Lead with the outcome the visitor gets.",
    test: (d) => {
      if (d.h1Count === 0) return { status: "fail", detail: "No H1 found on the page." };
      if (d.h1Count > 1) return { status: "warn", detail: `${d.h1Count} H1s found — multiple headlines compete and dilute the message.` };
      return { status: "pass", detail: `H1: “${d.h1Text.slice(0, 90)}”` };
    },
  },
  {
    id: "h1-above-fold", category: "first_impression", severity: "high",
    title: "Headline visible without scrolling",
    why: "If the value proposition isn't in the first screenful, many visitors bounce before ever reading it.",
    fix: "Move the main headline into the hero so it renders inside the first viewport on desktop and mobile.",
    test: (d) => {
      if (d.h1Count === 0 || d.h1AboveFold === null) return null;
      return d.h1AboveFold
        ? { status: "pass", detail: "The H1 appears above the fold." }
        : { status: "fail", detail: "The H1 only appears after scrolling." };
    },
  },
  {
    id: "headline-length", category: "first_impression", severity: "low",
    title: "Headline is scannable",
    why: "Headlines over ~12 words get skimmed, not read. Short, benefit-led headlines convert better in most tests.",
    fix: "Trim the H1 to one idea. Move supporting detail into a subheadline.",
    test: (d) => {
      if (!d.h1Text) return null;
      const words = d.h1Text.split(/\s+/).length;
      if (words > 15) return { status: "warn", detail: `H1 is ${words} words — likely too long to scan.` };
      return { status: "pass", detail: `H1 is ${words} words.` };
    },
  },
  {
    id: "title-tag", category: "first_impression", severity: "medium",
    title: "Title tag set and sized",
    why: "The title tag is your headline in search results and browser tabs — it shapes click-through before anyone reaches the page.",
    fix: "Write a 30–60 character title: primary benefit or keyword first, brand last.",
    test: (d) => {
      if (!d.title) return { status: "fail", detail: "Missing <title> tag." };
      const len = d.title.length;
      if (len < 15 || len > 70) return { status: "warn", detail: `Title is ${len} characters — aim for 30–60.` };
      return { status: "pass", detail: `Title (${len} chars): “${d.title.slice(0, 70)}”` };
    },
  },
  {
    id: "meta-description", category: "first_impression", severity: "low",
    title: "Meta description present",
    why: "A missing description lets search engines improvise your pitch. A good one lifts organic click-through — traffic quality starts before the visit.",
    fix: "Add a 120–160 character meta description that states the offer and a reason to click.",
    test: (d) => {
      if (!d.metaDescription) return { status: "warn", detail: "No meta description found." };
      const len = d.metaDescription.length;
      if (len < 50 || len > 170) return { status: "warn", detail: `Meta description is ${len} chars — aim for 120–160.` };
      return { status: "pass", detail: `Meta description is ${len} chars.` };
    },
  },
  {
    id: "no-interstitials", category: "first_impression", severity: "medium",
    title: "No immediate popups or overlays",
    why: "Interstitials shown before a visitor has read anything are one of the most reliable conversion killers, and Google penalizes intrusive ones on mobile.",
    fix: "Trigger popups on exit intent, 50%+ scroll depth, or a 20–30s delay instead of on page load.",
    test: (d) => {
      if (d.overlays === null) return null;
      if (d.overlays > 0) return { status: "warn", detail: `${d.overlays} large fixed overlay(s) detected shortly after load.` };
      return { status: "pass", detail: "No large overlays detected on load." };
    },
  },
  {
    id: "no-carousel", category: "first_impression", severity: "low",
    title: "No hero carousel",
    why: "Rotating carousels split attention across messages; visitors interact with slide 1 almost exclusively while later slides go unseen.",
    fix: "Replace the carousel with one static hero carrying your strongest message; give runners-up their own sections below.",
    test: (d) =>
      d.carousels > 0
        ? { status: "warn", detail: `${d.carousels} carousel/slider component(s) detected.` }
        : { status: "pass", detail: "No carousels detected." },
  },
  {
    id: "cta-above-fold", category: "cta", severity: "high",
    title: "Primary CTA above the fold",
    why: "Visitors ready to act shouldn't have to hunt. A visible primary action in the first viewport captures high-intent traffic immediately.",
    fix: "Place one button-styled CTA in the hero, visually dominant, with an action-specific label (“Start free trial”, not “Submit”).",
    snippet: "hero-cta",
    test: (d) => {
      if (d.ctasAboveFold === null) return null;
      if (d.ctasAboveFold === 0) return { status: "fail", detail: "No button-style CTA is visible in the first viewport." };
      return { status: "pass", detail: `${d.ctasAboveFold} CTA(s) visible above the fold.` };
    },
  },
  {
    id: "cta-exists", category: "cta", severity: "high",
    title: "Page has a clear action to take",
    why: "A page without a next step is a dead end — every visit that doesn't convert somewhere is spent traffic.",
    fix: "Decide the one action this page exists to produce, and make it a button.",
    snippet: "hero-cta",
    test: (d) => {
      const buttons = d.ctas.filter((c) => c.isButtonLike);
      if (buttons.length === 0) return { status: "fail", detail: "No button-like calls to action found anywhere on the page." };
      return { status: "pass", detail: `${buttons.length} button-like element(s) found.` };
    },
  },
  {
    id: "cta-action-language", category: "cta", severity: "medium",
    title: "CTAs use action language",
    why: "Labels like “Submit” or “Click here” describe mechanics, not value. Verb-plus-outcome labels (“Get my quote”) consistently outperform them.",
    fix: "Rewrite button labels as first-person outcomes: what does the visitor get when they click?",
    test: (d) => {
      const buttons = d.ctas.filter((c) => c.isButtonLike && c.text);
      if (!buttons.length) return null;
      const actionable = buttons.filter((c) => c.actionable).length;
      if (actionable / buttons.length < 0.3)
        return { status: "warn", detail: `Only ${actionable} of ${buttons.length} buttons use action-oriented language.` };
      return { status: "pass", detail: `${actionable} of ${buttons.length} buttons use action verbs.` };
    },
  },
  {
    id: "cta-focus", category: "cta", severity: "medium",
    title: "One primary action, not many",
    why: "When everything is a call to action, nothing is. Pages with a single dominant goal reliably beat pages that ask for five different things.",
    fix: "Pick one conversion goal. Demote secondary actions to text links and cut the rest.",
    test: (d) =>
      d.distinctCtaTexts > 8
        ? { status: "warn", detail: `${d.distinctCtaTexts} distinct button labels — the page may be asking for too many different actions.` }
        : { status: "pass", detail: `${d.distinctCtaTexts} distinct button label(s).` },
  },
  {
    id: "sticky-mobile-cta", category: "cta", severity: "low",
    title: "CTA reachable while scrolling on mobile",
    why: "On long mobile pages the moment of decision often arrives mid-scroll. A sticky action bar keeps the next step one thumb-tap away.",
    fix: "Add a slim sticky bottom bar on mobile with the primary CTA (and price, for products).",
    snippet: "sticky-cta",
    mobileRule: true,
    test: (d) => {
      if (d.stickyCta === null || d.stickyCta === undefined) return null;
      return d.stickyCta
        ? { status: "pass", detail: "A sticky/fixed CTA is present on mobile." }
        : { status: "warn", detail: "No sticky CTA detected on the mobile layout." };
    },
  },
  {
    id: "https", category: "trust", severity: "high",
    title: "Served over HTTPS",
    why: "Browsers flag non-HTTPS pages as “Not secure” right in the address bar — a conversion killer on any page with a form.",
    fix: "Install a TLS certificate (free via Let's Encrypt) and 301-redirect all HTTP traffic to HTTPS.",
    test: (d) =>
      d.https
        ? { status: "pass", detail: "Page is served over HTTPS." }
        : { status: "fail", detail: "Page is NOT served over HTTPS." },
  },
  {
    id: "social-proof", category: "trust", severity: "high",
    title: "Social proof present",
    why: "Testimonials, customer counts, ratings, and client logos are the strongest general-purpose conversion levers — people follow other people.",
    fix: "Add at least one form of proof near the CTA: a specific testimonial with name and photo, a “trusted by N customers” line, or a logo strip.",
    snippet: "testimonials",
    test: (d) => {
      const t = d.trust;
      const signals = [t.testimonialWords, t.socialProofNumbers, t.logosSection].filter(Boolean).length;
      if (signals === 0) return { status: "fail", detail: "No testimonials, customer numbers, or client logos detected." };
      if (signals === 1) return { status: "warn", detail: "Only one type of social proof detected — consider layering (testimonial + numbers + logos)." };
      return { status: "pass", detail: `${signals} types of social proof detected.` };
    },
  },
  {
    id: "risk-reversal", category: "trust", severity: "medium",
    title: "Risk reversal offered",
    why: "Guarantees, free trials, “no credit card required”, and easy cancellation directly attack the fear that blocks the click.",
    fix: "Add a risk-reversal line directly under the primary CTA: guarantee, trial terms, or cancellation policy.",
    snippet: "guarantee",
    test: (d) =>
      d.trust.guarantee
        ? { status: "pass", detail: "Guarantee / risk-reversal language found." }
        : { status: "warn", detail: "No guarantee, refund, or risk-free language detected." },
  },
  {
    id: "contact-visible", category: "trust", severity: "medium",
    title: "A human is reachable",
    why: "Visible contact options signal a real business behind the page. For high-consideration purchases, a phone number alone can lift conversions.",
    fix: "Add a contact link in the footer at minimum; for high-ticket offers, put a phone number or chat in the header.",
    test: (d) =>
      d.hasContact || d.phoneVisible
        ? { status: "pass", detail: "Contact route detected (link, email, or phone)." }
        : { status: "warn", detail: "No contact link, email, or phone number found." },
  },
  {
    id: "privacy-policy", category: "trust", severity: "low",
    title: "Privacy policy linked",
    why: "A privacy link is table stakes for form pages — its absence looks amateurish and is a legal exposure in most jurisdictions.",
    fix: "Link a privacy policy in the footer and next to any email-capture form.",
    test: (d) =>
      d.hasPrivacy
        ? { status: "pass", detail: "Privacy policy link found." }
        : { status: "warn", detail: "No privacy policy link detected." },
  },
  {
    id: "favicon", category: "trust", severity: "low",
    title: "Favicon set",
    why: "A missing favicon reads as unfinished in browser tabs and bookmark lists — a small but persistent credibility leak.",
    fix: "Add a favicon (SVG or 32px PNG) via <link rel=\"icon\">.",
    test: (d) =>
      d.favicon
        ? { status: "pass", detail: "Favicon present." }
        : { status: "warn", detail: "No favicon found." },
  },
  {
    id: "form-length", category: "forms", severity: "high",
    title: "Forms ask only for what's needed",
    why: "Each extra field measurably cuts completion. Going from 6+ fields to 3 routinely lifts form conversions by double digits.",
    fix: "Cut every field you don't need to start the relationship. Ask for the rest after conversion (progressive profiling).",
    test: (d) => {
      if (!d.forms.length) return null;
      const worst = Math.max(...d.forms.map((f) => f.fieldCount));
      if (worst > 7) return { status: "fail", detail: `A form asks for ${worst} fields.` };
      if (worst > 4) return { status: "warn", detail: `A form asks for ${worst} fields — trim if possible.` };
      return { status: "pass", detail: `Largest form has ${worst} field(s).` };
    },
  },
  {
    id: "form-labels", category: "forms", severity: "medium",
    title: "Form fields are labeled",
    why: "Unlabeled fields confuse users (especially once placeholders vanish mid-typing) and fail accessibility — both cost completions.",
    fix: "Give every field a visible label or at least an aria-label; don't rely on placeholder text alone.",
    test: (d) => {
      if (!d.forms.length) return null;
      const totals = d.forms.reduce((a, f) => ({ f: a.f + f.fieldCount, l: a.l + f.labeledCount }), { f: 0, l: 0 });
      if (totals.f === 0) return null;
      const unlabeled = totals.f - totals.l;
      if (unlabeled > 0) return { status: "warn", detail: `${unlabeled} of ${totals.f} form fields have no label, aria-label, or placeholder.` };
      return { status: "pass", detail: `All ${totals.f} form fields are labeled.` };
    },
  },
  {
    id: "load-time", category: "speed", severity: "high",
    title: "Page loads fast",
    why: "Conversion probability drops sharply past ~3 seconds of load time; on mobile the majority of visitors abandon slow pages entirely.",
    fix: "Compress and lazy-load images, defer non-critical scripts, enable caching/CDN. Attack the largest asset first.",
    test: (d) => {
      if (!d.loadMs) return null;
      const s = (d.loadMs / 1000).toFixed(1);
      if (d.loadMs > 6000) return { status: "fail", detail: `Full load took ${s}s.` };
      if (d.loadMs > 3000) return { status: "warn", detail: `Full load took ${s}s — aim for under 3s.` };
      return { status: "pass", detail: `Full load in ${s}s.` };
    },
  },
  {
    id: "page-weight", category: "speed", severity: "medium",
    title: "Page weight is reasonable",
    why: "Heavy pages are slow pages, especially on mobile networks. The median top-performing landing page is well under 2 MB.",
    fix: "Serve images as WebP/AVIF sized to their containers, subset fonts, and audit third-party scripts.",
    test: (d) => {
      if (!d.pageBytes) return null;
      const mb = d.pageBytes / 1048576;
      if (mb > 5) return { status: "fail", detail: `~${mb.toFixed(1)} MB transferred.` };
      if (mb > 2.5) return { status: "warn", detail: `~${mb.toFixed(1)} MB transferred — aim for under 2 MB.` };
      return { status: "pass", detail: `~${mb.toFixed(1)} MB transferred.` };
    },
  },
  {
    id: "request-count", category: "speed", severity: "low",
    title: "Request count under control",
    why: "Every third-party script and asset is a potential delay and a point of failure between the visitor and your content.",
    fix: "Combine assets where sensible and remove trackers/widgets that aren't earning their keep.",
    test: (d) => {
      if (d.requestCount === null || d.requestCount === undefined) return null;
      if (d.requestCount > 150) return { status: "warn", detail: `${d.requestCount} network requests on load.` };
      return { status: "pass", detail: `${d.requestCount} network requests.` };
    },
  },
  {
    id: "broken-images", category: "speed", severity: "medium",
    title: "No broken images",
    why: "A broken image icon is an instant credibility hit — visitors read it as a broken business.",
    fix: "Fix or remove failing image sources; add automated image checks to your deploy pipeline.",
    test: (d) => {
      if (d.brokenImgs === null || d.brokenImgs === undefined) return null;
      if (d.brokenImgs > 0) return { status: "fail", detail: `${d.brokenImgs} image(s) failed to load.` };
      return { status: "pass", detail: "All images loaded." };
    },
  },
  {
    id: "viewport-meta", category: "mobile", severity: "high",
    title: "Mobile viewport configured",
    why: "Without a viewport meta tag the page renders zoomed-out on phones — unreadable and untappable for what is likely most of your traffic.",
    fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.',
    test: (d) =>
      d.hasViewportMeta
        ? { status: "pass", detail: "Viewport meta tag present." }
        : { status: "fail", detail: "No viewport meta tag — page is not mobile-optimized." },
  },
  {
    id: "mobile-overflow", category: "mobile", severity: "medium",
    title: "No horizontal scrolling on mobile",
    why: "Content wider than the screen forces side-scrolling — a strong signal of a broken layout that tanks mobile engagement.",
    fix: "Find the overflowing element (often a fixed-width image, table, or embed) and constrain it with max-width: 100%.",
    mobileRule: true,
    test: (d) => {
      if (d.horizontalOverflow === null) return null;
      return d.horizontalOverflow
        ? { status: "fail", detail: "Page content overflows the mobile viewport horizontally." }
        : { status: "pass", detail: "No horizontal overflow on mobile." };
    },
  },
  {
    id: "tap-targets", category: "mobile", severity: "medium",
    title: "Tap targets are big enough",
    why: "Buttons under ~44px tall cause mis-taps and rage-taps on phones — friction exactly where you can least afford it.",
    fix: "Make interactive elements at least 44×44px with breathing room between them.",
    mobileRule: true,
    test: (d) => {
      if (d.smallTapTargets === null) return null;
      if (d.smallTapTargets > 3) return { status: "warn", detail: `${d.smallTapTargets} interactive elements are under 40px tall on mobile.` };
      return { status: "pass", detail: "Tap targets look adequately sized." };
    },
  },
  {
    id: "font-size", category: "mobile", severity: "medium",
    title: "Body text is readable",
    why: "Body text under 16px forces pinch-zooming on phones; visitors don't zoom, they leave.",
    fix: "Set body copy to 16px minimum on mobile (18px is safer for long-form).",
    mobileRule: true,
    test: (d) => {
      if (!d.medianFontPx) return null;
      if (d.medianFontPx < 14) return { status: "fail", detail: `Median paragraph font size is ${Math.round(d.medianFontPx)}px on mobile.` };
      if (d.medianFontPx < 16) return { status: "warn", detail: `Median paragraph font size is ${Math.round(d.medianFontPx)}px — 16px+ recommended.` };
      return { status: "pass", detail: `Median paragraph font size is ${Math.round(d.medianFontPx)}px.` };
    },
  },
  {
    id: "content-depth", category: "content", severity: "low",
    title: "Enough content to persuade",
    why: "Thin pages can't answer objections; visitors leave to research elsewhere and rarely come back.",
    fix: "Cover the buying questions: what it is, who it's for, what it costs, why you over alternatives, what happens next.",
    test: (d) =>
      d.wordCount < 100
        ? { status: "warn", detail: `Only ~${d.wordCount} words of visible copy.` }
        : { status: "pass", detail: `~${d.wordCount} words of copy.` },
  },
  {
    id: "structure", category: "content", severity: "low",
    title: "Content is structured for scanning",
    why: "People scan before they read. Subheadings let a scanner reconstruct your argument in seconds.",
    fix: "Break copy into sections with descriptive H2s that make sense read on their own.",
    test: (d) =>
      d.wordCount > 400 && d.h2Count === 0
        ? { status: "warn", detail: "Long copy with zero H2 subheadings." }
        : { status: "pass", detail: `${d.h2Count} H2 subheading(s).` },
  },
  {
    id: "alt-text", category: "content", severity: "low",
    title: "Images have alt text",
    why: "Alt text serves accessibility, image SEO, and the moment an image fails to load — three wins for one attribute.",
    fix: "Write descriptive alt text for meaningful images; use empty alt (alt=\"\") for decorative ones.",
    test: (d) => {
      if (!d.imgCount) return null;
      if (d.imgsMissingAlt > 0) return { status: "warn", detail: `${d.imgsMissingAlt} of ${d.imgCount} images missing alt text.` };
      return { status: "pass", detail: `All ${d.imgCount} images have alt text.` };
    },
  },
  {
    id: "autoplay", category: "content", severity: "low",
    title: "No autoplaying video",
    why: "Autoplay grabs bandwidth and attention the visitor didn't offer — it correlates with higher bounce, especially on mobile data.",
    fix: "Make video click-to-play with a compelling poster frame.",
    test: (d) =>
      d.autoplayVideos > 0
        ? { status: "warn", detail: `${d.autoplayVideos} autoplaying video(s) detected.` }
        : { status: "pass", detail: "No autoplaying video." },
  },
  {
    id: "lang-attr", category: "content", severity: "low",
    title: "Language declared",
    why: "The lang attribute helps screen readers, translation tools, and search engines interpret the page correctly.",
    fix: 'Add lang="en" (or the correct code) to the <html> element.',
    test: (d) =>
      d.lang
        ? { status: "pass", detail: `Language: ${d.lang}` }
        : { status: "warn", detail: "No lang attribute on <html>." },
  },
];

// ---------------------------------------------------------------- product pack
const PRODUCT_RULES = [
  {
    id: "pp-price-visible", category: "product", severity: "high",
    title: "Price clearly visible",
    why: "Shoppers who can't find the price assume the worst and leave. Price is the #1 piece of information on any product page.",
    fix: "Show the price adjacent to the product title, large enough to read at a glance. Show the discount math if on sale.",
    test: (d) =>
      d.priceMatches > 0
        ? { status: "pass", detail: `${d.priceMatches} price(s) detected on the page.` }
        : { status: "fail", detail: "No visible price detected." },
  },
  {
    id: "pp-add-to-cart", category: "product", severity: "high",
    title: "Add-to-cart / buy button present",
    why: "The buy button is the whole point of the page. It must exist, look like a button, and (ideally) be visible without scrolling.",
    fix: "Add a high-contrast “Add to cart” or “Buy now” button near the price, above the fold on desktop and mobile.",
    snippet: "sticky-cta",
    test: (d) => {
      if (!d.addToCartCTA) return { status: "fail", detail: "No add-to-cart / buy button detected." };
      const atf = d.ctas.find((c) => /add to (cart|bag)|buy now/i.test(c.text) && c.aboveFold);
      if (d.ctas.some((c) => c.aboveFold !== null) && !atf)
        return { status: "warn", detail: "Buy button exists but wasn't visible above the fold." };
      return { status: "pass", detail: "Buy button present." };
    },
  },
  {
    id: "pp-reviews", category: "product", severity: "high",
    title: "Customer reviews shown",
    why: "Products with visible reviews convert dramatically better than those without — reviews are the product page's social proof engine.",
    fix: "Add a star summary near the title (linked to full reviews below). Even a handful of honest reviews beats none.",
    snippet: "review-stars",
    test: (d) =>
      d.reviewsWidget
        ? { status: "pass", detail: "Reviews / ratings detected." }
        : { status: "fail", detail: "No reviews or star ratings detected on the page." },
  },
  {
    id: "pp-shipping", category: "product", severity: "medium",
    title: "Shipping & returns info near the buy box",
    why: "Unexpected shipping cost is the top reason for cart abandonment. Answering “when will it arrive, what if it doesn't fit?” at the point of decision removes the two biggest hesitations.",
    fix: "State shipping cost/threshold, delivery estimate, and return window right below the buy button.",
    snippet: "shipping-info",
    test: (d) => {
      const s = d.shippingWords, r = d.returnsWords;
      if (s && r) return { status: "pass", detail: "Shipping and returns information found." };
      if (s || r) return { status: "warn", detail: `Only ${s ? "shipping" : "returns"} info detected — add the other.` };
      return { status: "fail", detail: "No shipping or returns information detected." };
    },
  },
  {
    id: "pp-gallery", category: "product", severity: "medium",
    title: "Multiple product images",
    why: "Shoppers can't touch the product — photos are the product. Multiple angles, scale shots, and in-use photos substitute for the store experience.",
    fix: "Provide 4+ images: hero shot, detail close-ups, scale/context, and lifestyle use.",
    test: (d) => {
      if (!d.imgCount) return { status: "fail", detail: "No images detected." };
      if (d.imgCount < 3) return { status: "warn", detail: `Only ${d.imgCount} image(s) on the page.` };
      return { status: "pass", detail: `${d.imgCount} images on the page.` };
    },
  },
  {
    id: "pp-payment-badges", category: "product", severity: "low",
    title: "Payment method badges",
    why: "Recognizable payment logos (Visa, PayPal, Apple Pay, Klarna) answer “can I pay my way?” and add borrowed trust at the moment of highest anxiety.",
    fix: "Show accepted payment method badges near the buy button or in the footer.",
    snippet: "payment-badges",
    test: (d) =>
      d.paymentBadges
        ? { status: "pass", detail: "Payment method badges detected." }
        : { status: "warn", detail: "No payment method badges detected." },
  },
  {
    id: "pp-urgency", category: "product", severity: "low",
    title: "Stock / urgency cues",
    why: "Honest scarcity (“Only 3 left”, “Order by 2pm for same-day dispatch”) gives fence-sitters a reason to decide now instead of never.",
    fix: "Show real stock levels or dispatch cutoffs. Never fake it — fabricated urgency destroys trust when discovered.",
    test: (d) =>
      d.urgencyWords
        ? { status: "pass", detail: "Stock/urgency cues found." }
        : { status: "warn", detail: "No stock or urgency cues detected (optional, but effective when honest)." },
  },
  {
    id: "pp-breadcrumbs", category: "product", severity: "low",
    title: "Breadcrumb navigation",
    why: "Breadcrumbs let shoppers step back to the category instead of bouncing, and they feed structured data to search engines.",
    fix: "Add a Home › Category › Product breadcrumb trail above the title.",
    test: (d) =>
      d.breadcrumbs
        ? { status: "pass", detail: "Breadcrumbs detected." }
        : { status: "warn", detail: "No breadcrumb navigation detected." },
  },
];

// ---------------------------------------------------------------- funnel pack
const FUNNEL_RULES = [
  {
    id: "fu-single-goal", category: "funnel", severity: "high",
    title: "One goal, one action",
    why: "A funnel page exists to produce exactly one action. Every additional distinct CTA is a fork that splits and leaks traffic.",
    fix: "Reduce to one CTA (repeated is fine). Remove or demote everything else.",
    test: (d) =>
      d.distinctCtaTexts <= 3
        ? { status: "pass", detail: `${d.distinctCtaTexts} distinct CTA label(s).` }
        : { status: "warn", detail: `${d.distinctCtaTexts} distinct CTA labels — a funnel page should have one job.` },
  },
  {
    id: "fu-no-nav", category: "funnel", severity: "high",
    title: "Navigation stripped",
    why: "Removing the site nav from dedicated funnel pages is one of the most consistently positive A/B results on record — fewer exits, more conversions.",
    fix: "Strip header nav to logo only (unlinked or linked to this page). Keep legal links in a minimal footer.",
    test: (d) => {
      if (d.navLinks === null) return null;
      if (d.navLinks > 6) return { status: "fail", detail: `${d.navLinks} nav links — each is an exit from the funnel.` };
      if (d.navLinks > 3) return { status: "warn", detail: `${d.navLinks} nav links — consider stripping further.` };
      return { status: "pass", detail: `${d.navLinks} nav link(s).` };
    },
  },
  {
    id: "fu-exit-links", category: "funnel", severity: "medium",
    title: "Few escape hatches overall",
    why: "Beyond the nav, every outbound link on a funnel page competes with the conversion. Link equity is exit equity here.",
    fix: "Audit every link: if it doesn't move the visitor toward the goal or satisfy a legal requirement, cut it.",
    test: (d) => {
      if (d.exitLinks === null) return null;
      if (d.exitLinks > 25) return { status: "warn", detail: `${d.exitLinks} links on the page — heavy for a funnel step.` };
      return { status: "pass", detail: `${d.exitLinks} link(s) on the page.` };
    },
  },
  {
    id: "fu-form-above-fold", category: "funnel", severity: "high",
    title: "Capture form within reach",
    why: "On opt-in pages the form is the product. If it's buried, the page is asking for scroll commitment before value commitment.",
    fix: "Place the form (or the button that reveals it) in the first viewport, with the headline making the exchange obvious.",
    test: (d) => {
      if (!d.forms.length) return { status: "warn", detail: "No form found — if the goal is opt-in, the mechanism is missing." };
      if (d.forms[0].aboveFold === null) return { status: "pass", detail: `${d.forms.length} form(s) present.` };
      return d.forms.some((f) => f.aboveFold)
        ? { status: "pass", detail: "A form is visible above the fold." }
        : { status: "warn", detail: "Forms exist but none are visible above the fold." };
    },
  },
  {
    id: "fu-urgency", category: "funnel", severity: "low",
    title: "Deadline or reason to act now",
    why: "“Later” is the funnel's biggest competitor. An honest deadline, cohort date, or expiring bonus converts intent into action.",
    fix: "Add a true deadline (enrollment close, price change, bonus expiry) and show it near the CTA.",
    snippet: "urgency-bar",
    test: (d) =>
      d.urgencyWords || d.countdown
        ? { status: "pass", detail: d.countdown ? "Countdown timer detected." : "Urgency language found." }
        : { status: "warn", detail: "No deadline or urgency detected (use only if honest)." },
  },
  {
    id: "fu-footer-farm", category: "funnel", severity: "low",
    title: "Footer isn't a link farm",
    why: "A full sitemap footer on a funnel page reintroduces every exit you removed from the nav.",
    fix: "Use a minimal funnel footer: copyright, privacy, terms, contact. Nothing else.",
    test: (d) => {
      if (d.footerLinks === null || d.footerLinks === undefined) return null;
      if (d.footerLinks > 12) return { status: "warn", detail: `${d.footerLinks} links in the footer.` };
      return { status: "pass", detail: `${d.footerLinks} footer link(s).` };
    },
  },
];

const PACKS = { product: PRODUCT_RULES, funnel: FUNNEL_RULES, generic: [] };

// ---------------------------------------------------------------- runner
export function runRules(scan, pageType = "auto") {
  const desktop = scan.desktop;
  const mobile = scan.mobile;

  const resolvedType = pageType === "auto" ? detectPageType(desktop) : pageType;
  const rules = [...SHARED_RULES, ...(PACKS[resolvedType] || [])];

  const findings = [];
  for (const rule of rules) {
    const source = rule.mobileRule && mobile ? mobile : desktop;
    if (!source) continue;
    let result;
    try { result = rule.test(source); } catch { result = null; }
    if (!result) continue;
    findings.push({
      id: rule.id,
      category: rule.category,
      categoryLabel: CATEGORIES[rule.category],
      severity: rule.severity,
      title: rule.title,
      why: rule.why,
      fix: rule.fix,
      snippet: rule.snippet || null,
      status: result.status,
      detail: result.detail,
      surface: rule.mobileRule && mobile ? "mobile" : "desktop",
    });
  }

  let maxPenalty = 0, penalty = 0;
  for (const f of findings) {
    const w = WEIGHTS[f.severity];
    maxPenalty += w;
    if (f.status === "fail") penalty += w;
    else if (f.status === "warn") penalty += w / 2;
  }
  const score = maxPenalty ? Math.round(100 * (1 - penalty / maxPenalty)) : 100;

  const categories = {};
  for (const key of Object.keys(CATEGORIES)) {
    const cf = findings.filter((f) => f.category === key);
    if (!cf.length) continue;
    let max = 0, pen = 0;
    for (const f of cf) {
      const w = WEIGHTS[f.severity];
      max += w;
      if (f.status === "fail") pen += w;
      else if (f.status === "warn") pen += w / 2;
    }
    categories[key] = {
      label: CATEGORIES[key],
      score: Math.round(100 * (1 - pen / max)),
      counts: {
        pass: cf.filter((f) => f.status === "pass").length,
        warn: cf.filter((f) => f.status === "warn").length,
        fail: cf.filter((f) => f.status === "fail").length,
      },
    };
  }

  const order = { fail: 0, warn: 1, pass: 2 };
  const sevOrder = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.status] - order[b.status] || sevOrder[a.severity] - sevOrder[b.severity]);

  return { score, categories, findings, pageType: resolvedType, requestedType: pageType };
}
