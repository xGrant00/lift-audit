// Optional AI review. If ANTHROPIC_API_KEY is set, sends the above-the-fold
// screenshot plus the rule-engine findings to Claude and asks for a short,
// prioritized set of expert recommendations. Fails soft: any error returns null.

export async function aiReview({ url, scan, report }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const shot = scan.desktop?.screenshotFold;
  const summary = {
    url,
    pageType: report.pageType,
    score: report.score,
    h1: scan.desktop?.h1Text,
    title: scan.desktop?.title,
    topIssues: report.findings
      .filter((f) => f.status !== "pass")
      .slice(0, 12)
      .map((f) => `${f.severity.toUpperCase()} ${f.title}: ${f.detail}`),
  };

  const content = [];
  if (shot) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: shot },
    });
  }
  content.push({
    type: "text",
    text:
      `You are a senior conversion-rate-optimization consultant reviewing a landing page.` +
      (shot ? ` The image is the above-the-fold screenshot.` : ``) +
      `\n\nAutomated audit data:\n${JSON.stringify(summary, null, 2)}\n\n` +
      `Respond ONLY with JSON (no markdown fences) in this shape:\n` +
      `{"verdict": "one-sentence overall impression", "recommendations": [{"priority": 1, "title": "...", "note": "2-3 sentences: what to change and the expected effect"}]}\n` +
      `Give exactly 5 recommendations ordered by expected conversion impact. ` +
      `Base them on what you can SEE in the screenshot (visual hierarchy, hero clarity, ` +
      `whether the offer is obvious, color/contrast of the CTA) combined with the audit data. ` +
      `Be specific to this page, not generic.`,
  });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}
