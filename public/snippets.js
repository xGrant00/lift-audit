// Fix Kit — paste-ready sections keyed to findings.
// Every snippet is self-contained (scoped class prefix, no dependencies) so it
// can be dropped into a Shopify Custom Liquid section, a Webflow/Framer embed,
// a WordPress HTML block, or any theme file. Edit freely in the editor.

window.FIX_KIT = {
  "testimonials": {
    name: "Testimonial trio",
    blurb: "Three-card social proof section. Swap in real quotes, names, and roles — specificity is what sells.",
    platform: "Shopify: Add section → Custom Liquid. Webflow/Framer: Embed element. WordPress: Custom HTML block.",
    html: `<section class="la-testimonials">
  <h2>What customers say</h2>
  <div class="la-testimonials-grid">
    <figure class="la-quote">
      <blockquote>"Set up in ten minutes and our signups went up 22% in the first month."</blockquote>
      <figcaption><strong>Dana Reyes</strong><span>Founder, Brightline Co.</span></figcaption>
    </figure>
    <figure class="la-quote">
      <blockquote>"The first tool my whole team actually adopted without being asked twice."</blockquote>
      <figcaption><strong>Marcus Webb</strong><span>Ops Lead, Fieldstone</span></figcaption>
    </figure>
    <figure class="la-quote">
      <blockquote>"Support answered in four minutes on a Sunday. That sealed it for me."</blockquote>
      <figcaption><strong>Priya Nair</strong><span>Owner, Nair Studio</span></figcaption>
    </figure>
  </div>
</section>`,
    css: `.la-testimonials { padding: 56px 20px; max-width: 1080px; margin: 0 auto; }
.la-testimonials h2 { text-align: center; font-size: 28px; margin: 0 0 32px; }
.la-testimonials-grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.la-quote { margin: 0; padding: 24px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.04); }
.la-quote blockquote { margin: 0 0 16px; font-size: 16px; line-height: 1.55; }
.la-quote blockquote::before { content: "“"; font-size: 34px; line-height: 0; vertical-align: -10px; color: #c9c9c9; margin-right: 2px; }
.la-quote figcaption strong { display: block; font-size: 14px; }
.la-quote figcaption span { font-size: 13px; color: #777; }`,
  },

  "guarantee": {
    name: "Risk-reversal strip",
    blurb: "Sits directly under your primary CTA. Only promise what you actually honor.",
    platform: "Paste right below your buy/signup button in the theme template or page builder.",
    html: `<div class="la-guarantee">
  <span class="la-guarantee-item">✓ 30-day money-back guarantee</span>
  <span class="la-guarantee-item">✓ No credit card required</span>
  <span class="la-guarantee-item">✓ Cancel anytime</span>
</div>`,
    css: `.la-guarantee { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 22px; margin-top: 14px; }
.la-guarantee-item { font-size: 13.5px; color: #3f3f3f; }
.la-guarantee-item::first-letter { color: #157f52; }`,
  },

  "hero-cta": {
    name: "Hero CTA block",
    blurb: "Headline, subline, and one dominant action. Rewrite the copy for your offer — the structure does the rest.",
    platform: "Use as the top section of a landing page. On Shopify, an Image banner section's custom Liquid works too.",
    html: `<section class="la-hero">
  <h1>Get [the outcome] without [the pain]</h1>
  <p>One sentence on how it works and who it's for. Keep it under 20 words.</p>
  <a class="la-hero-btn" href="/signup">Start free — takes 2 minutes</a>
  <p class="la-hero-sub">No credit card required</p>
</section>`,
    css: `.la-hero { text-align: center; padding: 80px 20px 64px; max-width: 720px; margin: 0 auto; }
.la-hero h1 { font-size: clamp(30px, 5vw, 48px); line-height: 1.1; margin: 0 0 16px; }
.la-hero p { font-size: 18px; color: #555; margin: 0 0 28px; }
.la-hero-btn { display: inline-block; background: #157f52; color: #fff; font-size: 18px; font-weight: 700; padding: 16px 36px; border-radius: 10px; text-decoration: none; transition: transform .1s, box-shadow .1s; }
.la-hero-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(21,127,82,.35); }
.la-hero-sub { font-size: 13px; color: #888; margin-top: 12px !important; }`,
  },

  "sticky-cta": {
    name: "Sticky mobile CTA bar",
    blurb: "Keeps the buy/signup action one thumb-tap away on long mobile pages. Hidden on desktop by default.",
    platform: "Shopify: paste in theme.liquid before </body> (or a Custom Liquid section). Elsewhere: any global embed slot.",
    html: `<div class="la-sticky-bar">
  <div class="la-sticky-info">
    <strong>$49.00</strong>
    <span>Free shipping over $75</span>
  </div>
  <a class="la-sticky-btn" href="#buy">Add to cart</a>
</div>`,
    css: `.la-sticky-bar { position: fixed; bottom: 0; left: 0; right: 0; z-index: 999; display: none; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid #e2e2e2; box-shadow: 0 -4px 16px rgba(0,0,0,.08); }
.la-sticky-info strong { display: block; font-size: 17px; }
.la-sticky-info span { font-size: 12px; color: #157f52; }
.la-sticky-btn { background: #111; color: #fff; font-weight: 700; font-size: 15px; padding: 13px 26px; border-radius: 8px; text-decoration: none; white-space: nowrap; }
@media (max-width: 768px) { .la-sticky-bar { display: flex; } }`,
  },


  "payment-badges": {
    name: "Payment methods row",
    blurb: "Text-pill badges (no image assets to host). Replace with your platform's official logo images when available.",
    platform: "Place near the buy button or in the footer. Shopify themes usually have a built-in setting for this too (Theme settings → Payment icons).",
    html: `<div class="la-payments" aria-label="Accepted payment methods">
  <span class="la-pay">VISA</span>
  <span class="la-pay">Mastercard</span>
  <span class="la-pay">AMEX</span>
  <span class="la-pay">PayPal</span>
  <span class="la-pay"> Pay</span>
  <span class="la-pay">G Pay</span>
  <span class="la-pay">Klarna</span>
</div>`,
    css: `.la-payments { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 14px 0; }
.la-pay { font-size: 11px; font-weight: 700; letter-spacing: .04em; color: #444; border: 1px solid #d8d8d8; border-radius: 5px; padding: 5px 10px; background: #fafafa; }`,
  },

  "shipping-info": {
    name: "Shipping & returns buy-box block",
    blurb: "Answers the two biggest hesitations at the exact moment of decision. Put your real numbers in.",
    platform: "Place directly under the Add to cart button in your product template (Shopify: main-product.liquid or a product metafield block).",
    html: `<ul class="la-shipfacts">
  <li><span class="la-shipfacts-icon">🚚</span><div><strong>Free shipping over $75</strong><span>Orders before 2pm ship same day</span></div></li>
  <li><span class="la-shipfacts-icon">↩️</span><div><strong>30-day free returns</strong><span>Prepaid label included</span></div></li>
  <li><span class="la-shipfacts-icon">🔒</span><div><strong>Secure checkout</strong><span>256-bit SSL encryption</span></div></li>
</ul>`,
    css: `.la-shipfacts { list-style: none; margin: 18px 0; padding: 16px; border: 1px solid #e6e6e6; border-radius: 10px; display: grid; gap: 12px; }
.la-shipfacts li { display: flex; gap: 12px; align-items: flex-start; }
.la-shipfacts-icon { font-size: 18px; line-height: 1.3; }
.la-shipfacts strong { display: block; font-size: 14px; }
.la-shipfacts li div span { font-size: 12.5px; color: #777; }`,
  },

  "review-stars": {
    name: "Star rating summary",
    blurb: "Compact rating line for beside the product title. Link it to your full reviews section. Only show real numbers.",
    platform: "Place next to the product title. Pairs with review apps (Judge.me, Loox, Okendo) or your own review data.",
    html: `<a class="la-stars" href="#reviews">
  <span class="la-stars-icons" aria-hidden="true">★★★★★</span>
  <span class="la-stars-text"><strong>4.8</strong> · 1,214 reviews</span>
</a>`,
    css: `.la-stars { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: inherit; }
.la-stars-icons { color: #f5a623; font-size: 16px; letter-spacing: 1px; }
.la-stars-text { font-size: 14px; color: #444; }
.la-stars:hover .la-stars-text { text-decoration: underline; }`,
  },

  "urgency-bar": {
    name: "Deadline announcement bar",
    blurb: "Top-of-page bar for a true deadline. Delete it when the deadline passes — evergreen fake urgency destroys trust.",
    platform: "Shopify: Announcement bar section, or paste at the top of theme.liquid's body. Elsewhere: first element inside <body>.",
    html: `<div class="la-urgency" role="status">
  <strong>Enrollment closes Friday at midnight</strong>
  <span>— save your spot before the doors shut</span>
  <a href="#signup">Claim my spot →</a>
</div>`,
    css: `.la-urgency { background: #14201c; color: #fff; text-align: center; padding: 11px 16px; font-size: 14px; }
.la-urgency strong { font-weight: 700; }
.la-urgency span { opacity: .85; }
.la-urgency a { color: #7ee2b1; font-weight: 700; margin-left: 8px; text-decoration: none; }
.la-urgency a:hover { text-decoration: underline; }`,
  },
};
