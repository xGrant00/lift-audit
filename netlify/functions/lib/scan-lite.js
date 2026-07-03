// Lite scanner: fetches raw HTML and extracts what it can without a browser.
// Used automatically when Puppeteer can't launch. No screenshots, no
// layout/fold data, but most content and trust heuristics still work.

import * as cheerio from "cheerio";

const ACTION_WORDS =
  /\b(get|start|try|buy|shop|order|book|join|sign\s?up|subscribe|download|request|claim|reserve|schedule|contact|talk|demo|quote|apply|add to cart|checkout|donate|register|learn more|free)\b/i;

export async function scanLite(url) {
  const started = Date.now();
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (compatible; LiftAudit/1.0)" },
    signal: AbortSignal.timeout(30000),
  });
  const html = await res.text();
  const loadMs = Date.now() - started;
  const $ = cheerio.load(html);

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const ctas = [];
  $('a,button,input[type=submit],[role=button]').each((_, el) => {
    const $el = $(el);
    const text = ($el.text() || $el.attr("value") || $el.attr("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length > 60) return;
    const cls = ($el.attr("class") || "").toLowerCase();
    const looksButton =
      el.tagName !== "a" || cls.includes("btn") || cls.includes("button") || cls.includes("cta");
    const actionable = ACTION_WORDS.test(text);
    if (!looksButton && !actionable) return;
    ctas.push({
      text: text.slice(0, 60),
      isButtonLike: looksButton,
      actionable,
      aboveFold: null,
      href: $el.attr("href") || "",
    });
  });

  const forms = $("form")
    .map((_, f) => {
      const $f = $(f);
      const fields = $f.find("input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea");
      let labeled = 0;
      fields.each((_, i) => {
        const $i = $(i);
        const id = $i.attr("id");
        if (
          (id && $(`label[for="${id}"]`).length) ||
          $i.parents("label").length ||
          $i.attr("aria-label") ||
          $i.attr("placeholder")
        )
          labeled++;
      });
      return {
        fieldCount: fields.length,
        labeledCount: labeled,
        aboveFold: null,
        hasEmail: $f.find('input[type=email],input[name*=email]').length > 0,
      };
    })
    .get();

  const imgs = $("img");
  const imgsMissingAlt = imgs.filter((_, i) => !($(i).attr("alt") || "").trim()).length;

  const h1s = $("h1")
    .map((_, h) => $(h).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  const footerText = $("footer").text();

  const navText = $("nav a, header a").map((_, a) => $(a).text()).get().join(" ");
  const priceMatches = (bodyText.match(/[$€£]\s?\d[\d,]*(\.\d{2})?|\d[\d,]*(\.\d{2})?\s?(USD|EUR|GBP|kr)\b/g) || []).length;
  const signals = {
    priceMatches,
    addToCartCTA: ctas.some((c) => /add to (cart|bag|basket)|buy now|purchase/i.test(c.text)),
    reviewsWidget:
      $('[class*="review"],[class*="rating"],[itemprop="aggregateRating"],[class*="stars"]').length > 0 ||
      /★|⭐/.test(bodyText) || /\b\d(\.\d)?\s*(out of|\/)\s*5\b/i.test(bodyText),
    shippingWords: /\b(free shipping|shipping|delivery|dispatch|arrives)\b/i.test(bodyText),
    returnsWords: /\b(returns?|exchange|refund policy|\d+[- ]day returns?)\b/i.test(bodyText),
    paymentBadges:
      $('img[src*="visa"],img[src*="mastercard"],img[src*="paypal"],img[src*="klarna"],img[alt*="visa"],img[alt*="paypal"],[class*="payment-icons"]').length > 0 ||
      /\b(visa|mastercard|paypal|apple pay|google pay|klarna|afterpay)\b/i.test(bodyText),
    breadcrumbs: $('[class*="breadcrumb"],nav[aria-label*="breadcrumb"],[itemtype*="BreadcrumbList"]').length > 0,
    urgencyWords: /\b(only \d+ left|low stock|selling fast|limited (time|stock|spots)|ends (today|tonight|soon)|last chance|order (by|within)|hurry|almost gone|closes|deadline)\b/i.test(bodyText),
    countdown: $('[class*="countdown"],[class*="timer"],[data-countdown]').length > 0,
    pricingLink: $('a[href*="pricing"],a[href*="plans"]').length > 0 || /\bpricing\b/i.test(navText),
    trialWords: /\b(free trial|start (for )?free|try (it )?free|no credit card|get a demo|book a demo|request a demo|freemium|14[- ]day|30[- ]day trial)\b/i.test(bodyText),
    faqPresent:
      $("details").length > 1 || /\b(faq|frequently asked questions)\b/i.test(bodyText) ||
      $('[class*="faq"],[class*="accordion"]').length > 0,
    variantSelector: $('select[name*="variant"],[class*="variant"],[class*="swatch"],form[action*="/cart"] select').length > 0,
    exitLinks: $('a[href]').filter((_, a) => {
      const h = $(a).attr("href") || "";
      return h && !h.startsWith("#") && !h.startsWith("javascript");
    }).length,
    footerLinks: $("footer a").length,
    stickyCta: null,
    bodySample: bodyText.slice(0, 6000),
  };

  return {
    mode: "lite",
    desktop: {
      ...signals,
      viewport: "desktop",
      status: res.status,
      finalUrl: res.url,
      https: res.url.startsWith("https://"),
      loadMs,
      requestCount: null,
      pageBytes: Buffer.byteLength(html),
      perf: { domContentLoaded: null, transferSize: Buffer.byteLength(html), lcp: null },
      title: $("title").first().text().trim(),
      metaDescription: $('meta[name="description"]').attr("content") || "",
      hasViewportMeta: $('meta[name="viewport"]').length > 0,
      favicon: $('link[rel*="icon"]').length > 0,
      lang: $("html").attr("lang") || "",
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      h1Count: h1s.length,
      h1Text: h1s[0] || "",
      h1AboveFold: null,
      h2Count: $("h2").length,
      ctas,
      ctasAboveFold: null,
      distinctCtaTexts: [...new Set(ctas.filter((c) => c.isButtonLike).map((c) => c.text.toLowerCase()))].length,
      forms,
      imgCount: imgs.length,
      imgsMissingAlt,
      brokenImgs: 0,
      navLinks: $("nav a, header a").length,
      trust: {
        testimonialWords: /\b(testimonial|review|rated|stars|trusted by|loved by|customers? say)\b/i.test(bodyText),
        guarantee: /\b(guarantee|money[- ]back|refund|risk[- ]free|cancel anytime|no credit card)\b/i.test(bodyText),
        socialProofNumbers: /\b\d{1,3}(,\d{3})*\+?\s*(customers|users|companies|teams|reviews|clients|downloads|members)\b/i.test(bodyText),
        securityWords: /\b(ssl|secure checkout|encrypted|gdpr|soc ?2|iso ?27001|pci)\b/i.test(bodyText),
        logosSection: $('[class*="logo"] img, [class*="clients"] img, [class*="brands"] img, [class*="trusted"] img').length > 0,
      },
      hasPrivacy: /privacy/i.test(footerText) || $('a[href*="privacy"]').length > 0,
      hasContact:
        /\b(contact|support|help)\b/i.test(footerText) ||
        $('a[href^="mailto:"],a[href^="tel:"],a[href*="contact"]').length > 0,
      phoneVisible: /(\+?\d[\d\s().-]{8,}\d)/.test(bodyText.slice(0, 4000)),
      medianFontPx: null,
      smallTapTargets: null,
      overlays: null,
      carousels: $('[class*="carousel"],[class*="slider"],[class*="swiper"],[data-slick]').length,
      videos: $("video, iframe[src*='youtube'], iframe[src*='vimeo']").length,
      autoplayVideos: $("video[autoplay]").length,
      horizontalOverflow: null,
      screenshotFull: null,
      screenshotFold: null,
    },
    mobile: null,
  };
}
