// Synchronous fallback audit (regular Netlify function — works on every plan).
//
// The main audit runs in `audit-background`, which needs Netlify background
// functions (a paid-plan feature) and a working Chromium bundle. When that
// path never picks the job up — the row sits in `pending` — the frontend
// calls this function instead. It runs the HTML-only scan (no screenshots),
// grades the page, and writes the result directly.
//
// Because this is synchronous, real error messages reach the browser,
// which makes misconfiguration (missing env vars, bad service key)
// visible instead of an endless spinner.

import { createClient } from "@supabase/supabase-js";
import { runRules, PAGE_TYPES } from "./lib/rules.js";
import { aiReview } from "./lib/ai.js";
import { scanLite } from "./lib/scan-lite.js";

const DB_CALL_TIMEOUT = 8000; // ms — this whole function must fit in a sync budget

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took too long (>${Math.round(ms / 1000)}s)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function fail(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizeUrl(input) {
  let u = String(input || "").trim();
  if (!u) throw new Error("Please provide a URL.");
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const parsed = new URL(u);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http(s) URLs are supported.");
  return parsed.href;
}

export default async (req) => {
  if (req.method !== "POST") return fail(405, "Method not allowed");

  // ---- env validation: say exactly what's missing ----
  const missing = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    return fail(500, `Server is missing environment variable(s): ${missing.join(", ")}. Add them in Netlify → Site settings → Environment variables, then redeploy.`);
  }

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let reportId = null;
  try {
    // ---- authenticate the caller ----
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await withTimeout(authClient.auth.getUser(token), DB_CALL_TIMEOUT, "Auth check");
    if (userErr || !userData?.user) return fail(401, "Your session expired — sign in again.");
    const user = userData.user;

    // ---- load the report row ----
    const body = await req.json().catch(() => ({}));
    reportId = body.reportId;
    if (!reportId) return fail(400, "Missing reportId");

    const { data: row, error: rowErr } = await withTimeout(
      admin.from("reports").select("*").eq("id", reportId).single(),
      DB_CALL_TIMEOUT,
      "Report lookup"
    );
    if (rowErr) return fail(500, `Couldn't read the report row (check SUPABASE_SERVICE_ROLE_KEY): ${rowErr.message}`);
    if (!row || row.user_id !== user.id) return fail(404, "Report not found");
    // Accept `pending` (background function never started) and `running`
    // (background function started but stalled/was killed) — this is a rescue path.
    if (!["pending", "running"].includes(row.status)) return fail(409, "Already processed");

    const url = normalizeUrl(row.url);
    const pageType = Object.keys(PAGE_TYPES).includes(row.page_type) ? row.page_type : "auto";

    // ---- HTML-only scan + grade ----
    const scan = await scanLite(url);
    const report = runRules(scan, pageType);
    const ai = await aiReview({ url, scan, report }); // no-op without ANTHROPIC_API_KEY

    const data = {
      url,
      finalUrl: scan.desktop.finalUrl,
      mode: scan.mode,
      liteReason: "Quick scan (screenshots unavailable in this deployment)",
      scannedAt: new Date().toISOString(),
      score: report.score,
      pageType: report.pageType,
      requestedType: report.requestedType,
      categories: report.categories,
      findings: report.findings,
      ai,
      page: {
        title: scan.desktop.title,
        h1: scan.desktop.h1Text,
        loadMs: scan.desktop.loadMs,
        pageBytes: scan.desktop.pageBytes,
        requestCount: scan.desktop.requestCount,
        wordCount: scan.desktop.wordCount,
      },
    };

    const { error: writeErr } = await withTimeout(
      admin
        .from("reports")
        .update({
          status: "complete",
          score: report.score,
          detected_type: report.pageType,
          data,
          desktop_shot: null,
          mobile_shot: null,
        })
        .eq("id", reportId),
      DB_CALL_TIMEOUT,
      "Result write-back"
    );
    if (writeErr) return fail(500, `Audit finished but couldn't save (check SUPABASE_SERVICE_ROLE_KEY): ${writeErr.message}`);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err) {
    if (reportId) {
      await admin
        .from("reports")
        .update({ status: "error", error: `Couldn't complete the audit: ${err.message}` })
        .eq("id", reportId)
        .then(() => {}, () => {});
    }
    return fail(500, `Couldn't complete the audit: ${err.message}`);
  }
};
