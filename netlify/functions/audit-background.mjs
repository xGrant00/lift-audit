// Netlify background function (name ends in -background → 15-minute budget,
// responds 202 immediately; the client polls the reports row in Supabase).
//
// Flow:
//   1. Client inserts a `pending` report row (RLS enforces ownership)
//   2. Client POSTs { reportId } here with its Supabase access token
//   3. We verify the token, confirm the row belongs to that user,
//      run the scan, upload screenshots to Storage, update the row
//
// Required env vars (Netlify → Site settings → Environment variables):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Optional: ANTHROPIC_API_KEY, ANTHROPIC_MODEL

import { createClient } from "@supabase/supabase-js";
import { runRules, PAGE_TYPES } from "./lib/rules.js";
import { aiReview } from "./lib/ai.js";
import { scanLite } from "./lib/scan-lite.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeUrl(input) {
  let u = String(input || "").trim();
  if (!u) throw new Error("Please provide a URL.");
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const parsed = new URL(u);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http(s) URLs are supported.");
  return parsed.href;
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let reportId = null;
  try {
    // ---- authenticate the caller ----
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const authClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
    const user = userData.user;

    // ---- load + claim the report row ----
    const body = await req.json().catch(() => ({}));
    reportId = body.reportId;
    if (!reportId) return new Response("Missing reportId", { status: 400 });

    const { data: row, error: rowErr } = await admin
      .from("reports").select("*").eq("id", reportId).single();
    if (rowErr || !row || row.user_id !== user.id) return new Response("Report not found", { status: 404 });
    if (row.status !== "pending") return new Response("Already processed", { status: 409 });

    await admin.from("reports").update({ status: "running" }).eq("id", reportId);

    const url = normalizeUrl(row.url);
    const pageType = Object.keys(PAGE_TYPES).includes(row.page_type) ? row.page_type : "auto";

    // ---- scan (browser, falling back to HTML-only) ----
    let scan, liteReason = null;
    try {
      const { scanWithBrowser } = await import("./lib/scan-serverless.js");
      scan = await scanWithBrowser(url);
    } catch (browserErr) {
      liteReason = browserErr.message?.split("\n")[0] || "Browser unavailable";
      scan = await scanLite(url); // throws to outer catch if unreachable
    }

    // ---- grade + optional AI notes ----
    const report = runRules(scan, pageType);
    const ai = await aiReview({ url, scan, report });

    // ---- upload screenshots ----
    let desktopPath = null, mobilePath = null;
    if (scan.desktop.screenshotFull) {
      desktopPath = `${user.id}/${reportId}-desktop.jpg`;
      await admin.storage.from("screenshots").upload(desktopPath, scan.desktop.screenshotFull, {
        contentType: "image/jpeg", upsert: true,
      });
    }
    if (scan.mobile?.screenshotFull) {
      mobilePath = `${user.id}/${reportId}-mobile.jpg`;
      await admin.storage.from("screenshots").upload(mobilePath, scan.mobile.screenshotFull, {
        contentType: "image/jpeg", upsert: true,
      });
    }

    // ---- persist ----
    const data = {
      url,
      finalUrl: scan.desktop.finalUrl,
      mode: scan.mode,
      liteReason,
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

    await admin.from("reports").update({
      status: "complete",
      score: report.score,
      detected_type: report.pageType,
      data,
      desktop_shot: desktopPath,
      mobile_shot: mobilePath,
    }).eq("id", reportId);

    return new Response(null, { status: 200 });
  } catch (err) {
    if (reportId) {
      await admin.from("reports").update({
        status: "error",
        error: `Couldn't complete the audit: ${err.message}`,
      }).eq("id", reportId).then(() => {}, () => {});
    }
    return new Response("Error", { status: 500 });
  }
};
