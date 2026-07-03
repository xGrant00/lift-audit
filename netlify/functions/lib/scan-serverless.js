// Browser scan for serverless (Netlify Functions / AWS Lambda).
// Same extraction as the original scan-browser.js, but uses puppeteer-core
// with @sparticuz/chromium and caps screenshot height to stay inside
// Lambda memory limits.

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const MAX_SHOT_HEIGHT = 8000; // px — cap full-page capture
const NAV_TIMEOUT = 35000; // ms — per-viewport page load ceiling
const STEP_TIMEOUT = 20000; // ms — per-viewport evaluate/screenshot ceiling
const VIEWPORT_TIMEOUT = 60000; // ms — hard ceiling for one whole viewport pass
const SCAN_TIMEOUT = 100000; // ms — hard ceiling for the whole browser scan (both viewports)

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took too long (>${Math.round(ms / 1000)}s)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Runs inside the page. Must be self-contained (it is serialized into the browser).
function extractInPage(viewportLabel) {
  const vh = window.innerHeight;
  const doc = document;
  const bodyText = (doc.body?.innerText || "").replace(/\s+/g, " ").trim();

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  };

  const ACTION_WORDS =
    /\b(get|start|try|buy|shop|order|book|join|sign\s?up|subscribe|download|request|claim|reserve|schedule|contact|talk|demo|quote|apply|add to cart|checkout|donate|register|learn more|free)\b/i;

  const ctaEls = [...doc.querySelectorAll('a,button,input[type="submit"],input[type="button"],[role="button"]')].filter(isVisible);
  const ctas = [];
  for (const el of ctaEls) {
    const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 60) continue;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const looksButton =
      el.tagName !== "A" || s.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(s.borderRadius) > 0 ||
      el.className.toLowerCase().includes("btn") || el.className.toLowerCase().includes("button") ||
      el.className.toLowerCase().includes("cta");
    const actionable = ACTION_WORDS.test(text);
    if (!looksButton && !actionable) continue;
    ctas.push({
      text: text.slice(0, 60),
      top: Math.round(r.top + window.scrollY),
      aboveFold: r.top < vh && r.bottom > 0,
      width: Math.round(r.width),
      height: Math.round(r.height),
      isButtonLike: looksButton,
      actionable,
      href: el.tagName === "A" ? el.getAttribute("href") || "" : "",
    });
  }

  const h1s = [...doc.querySelectorAll("h1")].filter(isVisible);
  const h1Texts = h1s.map((h) => h.innerText.replace(/\s+/g, " ").trim()).filter(Boolean);
  const firstH1 = h1s[0];
  const h1AboveFold = firstH1 ? firstH1.getBoundingClientRect().top < vh : false;

  const forms = [...doc.querySelectorAll("form")].filter(isVisible).map((f) => {
    const fields = [...f.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea")].filter(isVisible);
    const labeled = fields.filter((i) => {
      const id = i.getAttribute("id");
      return (
        (id && doc.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
        i.closest("label") || i.getAttribute("aria-label") || i.getAttribute("placeholder")
      );
    });
    const r = f.getBoundingClientRect();
    return {
      fieldCount: fields.length,
      labeledCount: labeled.length,
      aboveFold: r.top < vh && r.bottom > 0,
      hasEmail: !!f.querySelector('input[type=email],input[name*=email i]'),
    };
  });

  const imgs = [...doc.querySelectorAll("img")].filter(isVisible);
  const imgsMissingAlt = imgs.filter((i) => !(i.getAttribute("alt") || "").trim()).length;
  const brokenImgs = imgs.filter((i) => i.complete && i.naturalWidth === 0).length;

  const nav = doc.querySelector("nav, header");
  const navLinks = nav ? [...nav.querySelectorAll("a")].filter(isVisible).length : 0;

  const trust = {
    testimonialWords: /\b(testimonial|review|rated|stars|trusted by|loved by|customers? say)\b/i.test(bodyText),
    guarantee: /\b(guarantee|money[- ]back|refund|risk[- ]free|cancel anytime|no credit card)\b/i.test(bodyText),
    socialProofNumbers: /\b\d{1,3}(,\d{3})*\+?\s*(customers|users|companies|teams|reviews|clients|downloads|members)\b/i.test(bodyText),
    securityWords: /\b(ssl|secure checkout|encrypted|gdpr|soc ?2|iso ?27001|pci)\b/i.test(bodyText),
    logosSection: !!doc.querySelector('[class*="logo" i] img, [class*="clients" i] img, [class*="brands" i] img, [class*="trusted" i] img'),
  };

  const footer = doc.querySelector("footer");
  const footerText = footer ? footer.innerText : "";
  const hasPrivacy = /privacy/i.test(footerText) || !!doc.querySelector('a[href*="privacy" i]');
  const hasContact =
    /\b(contact|support|help)\b/i.test(footerText) ||
    !!doc.querySelector('a[href^="mailto:"],a[href^="tel:"],a[href*="contact" i]');
  const phoneVisible = /(\+?\d[\d\s().-]{8,}\d)/.test(bodyText.slice(0, 4000));

  const ps = [...doc.querySelectorAll("p")].filter(isVisible).slice(0, 20);
  const fontSizes = ps.map((p) => parseFloat(getComputedStyle(p).fontSize)).filter(Boolean);
  const medianFont = fontSizes.length ? fontSizes.sort((a, b) => a - b)[Math.floor(fontSizes.length / 2)] : null;

  const smallTapTargets = ctas.filter((c) => c.height > 0 && c.height < 40).length;

  const overlays = [...doc.querySelectorAll("body *")].filter(isVisible).filter((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
      (s.position === "fixed" || s.position === "sticky") &&
      parseInt(s.zIndex || "0", 10) > 100 &&
      r.width > window.innerWidth * 0.5 && r.height > vh * 0.4
    );
  }).length;

  const carousels = doc.querySelectorAll('[class*="carousel" i],[class*="slider" i],[class*="swiper" i],[data-slick]').length;
  const videos = doc.querySelectorAll("video, iframe[src*='youtube'], iframe[src*='vimeo']").length;
  const autoplayVideos = [...doc.querySelectorAll("video[autoplay]")].length;

  // ---- page-type signals ----
  const priceMatches = (bodyText.match(/[$€£]\s?\d[\d,]*(\.\d{2})?|\d[\d,]*(\.\d{2})?\s?(USD|EUR|GBP|kr)\b/g) || []).length;
  const addToCartCTA = ctas.some((c) => /add to (cart|bag|basket)|buy now|purchase/i.test(c.text));
  const reviewsWidget =
    !!doc.querySelector('[class*="review" i],[class*="rating" i],[itemprop="aggregateRating"],[class*="stars" i]') ||
    /★|⭐/.test(bodyText) || /\b\d(\.\d)?\s*(out of|\/)\s*5\b/i.test(bodyText);
  const shippingWords = /\b(free shipping|shipping|delivery|dispatch|arrives)\b/i.test(bodyText);
  const returnsWords = /\b(returns?|exchange|refund policy|\d+[- ]day returns?)\b/i.test(bodyText);
  const paymentBadges =
    !!doc.querySelector('img[src*="visa" i],img[src*="mastercard" i],img[src*="paypal" i],img[src*="amex" i],img[src*="klarna" i],img[src*="apple-pay" i],img[alt*="visa" i],img[alt*="paypal" i],img[alt*="mastercard" i],[class*="payment-icons" i]') ||
    /\b(visa|mastercard|paypal|apple pay|google pay|klarna|afterpay)\b/i.test(bodyText);
  const breadcrumbs = !!doc.querySelector('[class*="breadcrumb" i],nav[aria-label*="breadcrumb" i],[itemtype*="BreadcrumbList"]');
  const urgencyWords = /\b(only \d+ left|low stock|selling fast|limited (time|stock|spots)|ends (today|tonight|soon)|last chance|order (by|within)|hurry|almost gone|closes|deadline)\b/i.test(bodyText);
  const countdown = !!doc.querySelector('[class*="countdown" i],[class*="timer" i],[data-countdown]');
  const pricingLink =
    !!doc.querySelector('a[href*="pricing" i],a[href*="plans" i]') ||
    /\bpricing\b/i.test([...doc.querySelectorAll("nav a, header a")].map((a) => a.innerText).join(" "));
  const trialWords = /\b(free trial|start (for )?free|try (it )?free|no credit card|get a demo|book a demo|request a demo|freemium|14[- ]day|30[- ]day trial)\b/i.test(bodyText);
  const faqPresent =
    doc.querySelectorAll("details").length > 1 ||
    /\b(faq|frequently asked questions)\b/i.test(bodyText) ||
    !!doc.querySelector('[class*="faq" i],[class*="accordion" i]');
  const variantSelector = !!doc.querySelector('select[name*="variant" i],[class*="variant" i],[class*="swatch" i],form[action*="/cart" i] select');
  const exitLinks = [...doc.querySelectorAll("a[href]")].filter((a) => {
    const h = a.getAttribute("href") || "";
    return h && !h.startsWith("#") && !h.startsWith("javascript");
  }).length;
  const footerLinks = footer ? [...footer.querySelectorAll("a")].filter(isVisible).length : 0;
  const stickyCta = [...doc.querySelectorAll('a,button,[role="button"]')].some((el) => {
    if (!isVisible(el)) return false;
    let node = el;
    while (node && node !== doc.body) {
      const pos = getComputedStyle(node).position;
      if (pos === "fixed" || pos === "sticky") return ACTION_WORDS.test(el.innerText || "");
      node = node.parentElement;
    }
    return false;
  });

  return {
    priceMatches, addToCartCTA, reviewsWidget, shippingWords, returnsWords,
    paymentBadges, breadcrumbs, urgencyWords, countdown, pricingLink, trialWords,
    faqPresent, variantSelector, exitLinks, footerLinks, stickyCta,
    bodySample: bodyText.slice(0, 6000),
    viewport: viewportLabel,
    title: doc.title || "",
    metaDescription: doc.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    hasViewportMeta: !!doc.querySelector('meta[name="viewport"]'),
    favicon: !!doc.querySelector('link[rel*="icon"]'),
    lang: doc.documentElement.getAttribute("lang") || "",
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    h1Count: h1Texts.length,
    h1Text: h1Texts[0] || "",
    h1AboveFold,
    h2Count: doc.querySelectorAll("h2").length,
    ctas,
    ctasAboveFold: ctas.filter((c) => c.aboveFold && c.isButtonLike).length,
    distinctCtaTexts: [...new Set(ctas.filter((c) => c.isButtonLike).map((c) => c.text.toLowerCase()))].length,
    forms,
    imgCount: imgs.length,
    imgsMissingAlt,
    brokenImgs,
    navLinks,
    trust,
    hasPrivacy,
    hasContact,
    phoneVisible,
    medianFontPx: medianFont,
    smallTapTargets,
    overlays,
    carousels,
    videos,
    autoplayVideos,
    horizontalOverflow: doc.documentElement.scrollWidth > window.innerWidth + 5,
  };
}

async function scanViewport(browser, url, viewport, label, ua) {
  const page = await browser.newPage();
  try {
    await page.setViewport(viewport);
    if (ua) await page.setUserAgent(ua);

    const requests = { count: 0, bytes: 0 };
    page.on("response", (res) => {
      requests.count++;
      requests.bytes += Number(res.headers()["content-length"] || 0);
    });

    const started = Date.now();
    // Some pages (chat widgets, live tickers, analytics beacons) never go fully
    // idle. Give networkidle2 a shorter, hard ceiling — if it times out but we
    // still landed on a real page, keep going with what rendered instead of
    // treating it as a fatal error.
    let response;
    try {
      response = await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
    } catch (navErr) {
      if (!page.url() || page.url() === "about:blank") throw navErr;
    }
    const loadMs = Date.now() - started;
    await new Promise((r) => setTimeout(r, 800));

    const perf = await withTimeout(
      page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const lcp = performance.getEntriesByType("largest-contentful-paint").pop();
        return {
          domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
          transferSize: nav ? nav.transferSize : null,
          lcp: lcp ? Math.round(lcp.renderTime || lcp.loadTime) : null,
        };
      }),
      STEP_TIMEOUT,
      `${label} perf read`
    ).catch(() => ({ domContentLoaded: null, transferSize: null, lcp: null }));

    const data = await withTimeout(page.evaluate(extractInPage, label), STEP_TIMEOUT, `${label} content extraction`);

    // Cap capture height to protect Lambda memory
    const fullHeight = await withTimeout(
      page.evaluate(() => document.documentElement.scrollHeight),
      STEP_TIMEOUT,
      `${label} height read`
    ).catch(() => viewport.height);
    const shotHeight = Math.min(fullHeight, MAX_SHOT_HEIGHT);
    const screenshot = await withTimeout(
      page.screenshot({
        type: "jpeg",
        quality: 60,
        clip: { x: 0, y: 0, width: viewport.width, height: shotHeight },
        captureBeyondViewport: true,
      }),
      STEP_TIMEOUT,
      `${label} full screenshot`
    ).catch(() => null);
    // Small above-the-fold capture (base64) for the optional AI review
    const foldShot = await withTimeout(page.screenshot({ type: "jpeg", quality: 70 }), STEP_TIMEOUT, `${label} fold screenshot`).catch(
      () => null
    );

    return {
      ...data,
      status: response ? response.status() : null,
      finalUrl: page.url(),
      https: page.url().startsWith("https://"),
      loadMs,
      requestCount: requests.count,
      pageBytes: requests.bytes,
      perf,
      screenshotFull: screenshot, // Buffer — uploaded to storage by the function (null if capture failed)
      screenshotFold: foldShot ? foldShot.toString("base64") : null,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function scanWithBrowser(url) {
  const browser = await withTimeout(
    puppeteer.launch({
      args: [...chromium.args, "--disable-dev-shm-usage"],
      defaultViewport: null,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    }),
    30000,
    "Browser launch"
  );
  try {
    // Desktop and mobile passes are independent — run them side by side so a
    // heavy page costs one wait instead of two, and give the pair a hard
    // ceiling so a stuck viewport can't consume the whole function budget.
    const [desktop, mobile] = await withTimeout(
      Promise.all([
        withTimeout(scanViewport(browser, url, DESKTOP, "desktop"), VIEWPORT_TIMEOUT, "Desktop scan"),
        withTimeout(scanViewport(browser, url, MOBILE, "mobile", MOBILE_UA), VIEWPORT_TIMEOUT, "Mobile scan"),
      ]),
      SCAN_TIMEOUT,
      "Browser scan"
    );
    return { mode: "browser", desktop, mobile };
  } finally {
    await browser.close().catch(() => {});
  }
}

export { MAX_SHOT_HEIGHT };
