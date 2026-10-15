// supabase/functions/send-newsletter/index.ts
// SendMe — Monthly Newsletter sender
//
// Takes a subject + finished HTML (built and reviewed by admin in
// AdminMonthlyReport.js — this function does NOT generate content, only
// sends it) and emails it to every profile with newsletter_optin = true.
//
// Deploy: supabase functions deploy send-newsletter --use-api
// Requires the same RESEND_API_KEY secret already set for send-notification.
//
// IMPORTANT — Resend's free tier caps at 100 emails/DAY (3,000/month total).
// This function sends up to that many per call and reports the rest as
// "not sent this run" rather than silently dropping them, so admin knows to
// run it again the next day for the remainder. If SendMe's list ever grows
// past ~100 opted-in donors, either upgrade the Resend plan (removes the
// daily cap) or expect to run this on 2+ consecutive days for one newsletter.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = "SendMe Global Mission <notifications@sendmeglobalmission.org>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Resend's free-tier daily send cap. Kept as a named constant so it's the
// one place to change if/when the account moves to a paid plan.
const DAILY_SEND_CAP = 100;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// ── Who is calling? (hardening) ─────────────────────────────────────────────
// These functions are reachable from the internet with the app's public key, so each one
// checks the caller itself: the SendMe admin (signed in), any signed-in user, a server
// holding the service-role key, or nobody.
const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") ?? "sendmemissionfund@gmail.com").trim().toLowerCase();
type Caller = { kind: "service" | "user" | "anon"; email: string; id: string };
async function getCaller(req: Request): Promise<Caller> {
  const anon: Caller = { kind: "anon", email: "", id: "" };
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return anon;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return { kind: "service", email: "", id: "service" };
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return anon;
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: anonKey } });
    if (!res.ok) return anon;
    const user = await res.json();
    if (!user?.id) return anon;
    return { kind: "user", email: String(user.email ?? "").trim().toLowerCase(), id: String(user.id) };
  } catch (_e) {
    return anon;
  }
}
function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}
// Best-effort limiter (in memory, per function instance — a speed bump, not a wall).
const hits = new Map<string, number[]>();
function overLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now); hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}

// A newsletter goes to every opted-in member, so only the signed-in SendMe admin may send one.
const MAX_HTML_CHARS = 500_000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY secret is not set");

    // ── Admin only ──
    const caller = await getCaller(req);
    if (caller.kind === "anon") return jsonRes(401, { error: "Not signed in" });
    if (!(caller.kind === "user" && caller.email === ADMIN_EMAIL)) return jsonRes(403, { error: "Admins only" });
    if (overLimit(`nl:${caller.id}`, 5, 3_600_000)) return jsonRes(429, { error: "Too many newsletter sends this hour." });

    let body: any;
    try { body = await req.json(); } catch (_e) { return jsonRes(400, { error: "Invalid request body" }); }
    const subject = String(body?.subject ?? "").replace(/[\r\n\u2028\u2029]+/g, " ").trim().slice(0, 200);
    const html = typeof body?.html === "string" ? body.html : "";
    // Who sent it comes from the login, not from what the browser claims. The app has always
    // logged the sender's user id here (AdminMonthlyReport.js sends user.id), so keep it an id.
    const sentBy = caller.id;
    if (html.length > MAX_HTML_CHARS) {
      return jsonRes(400, { error: "Newsletter is too large." });
    }
    if (!subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: subject, html" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Who's opted in
    const { data: optedIn, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("newsletter_optin", true);
    if (profilesError) throw profilesError;

    const optedInIds = new Set((optedIn || []).map((p) => p.id));
    if (optedInIds.size === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, skipped: 0, recipientCount: 0, message: "No one is opted in yet." }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 2. Resolve real, confirmed email addresses via the admin API rather
    // than trusting a possibly-stale/duplicated email column on profiles —
    // auth.users is the source of truth for what address a login actually
    // uses. Paginated in case the list ever exceeds 1000.
    const emails: string[] = [];
    let page = 1;
    while (true) {
      const { data: userPage, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) throw usersError;
      for (const u of userPage.users) {
        if (optedInIds.has(u.id) && u.email) emails.push(u.email);
      }
      if (userPage.users.length < 1000) break;
      page++;
    }

    const recipientCount = emails.length;
    const toSendNow = emails.slice(0, DAILY_SEND_CAP);
    const deferredCount = recipientCount - toSendNow.length;

    let sent = 0, failed = 0;
    for (const email of toSendNow) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM_ADDRESS, to: [email], reply_to: "sendmemissionfund@gmail.com", subject, html }),
        });
        if (resendRes.ok) sent++; else failed++;
      } catch {
        failed++;
      }
    }

    // 3. Log the send — accountability, not a queue. If deferredCount > 0,
    // the log makes that visible so it isn't quietly forgotten.
    const { error: logError } = await supabase.from("newsletter_log").insert({
      subject,
      sent_by: sentBy || null,
      recipient_count: recipientCount,
      sent_count: sent,
      failed_count: failed,
    });
    if (logError) console.error("send-newsletter: failed to write log row", logError);

    return new Response(JSON.stringify({
      sent, failed, recipientCount, deferredCount,
      message: deferredCount > 0
        ? `Sent to ${sent} of ${recipientCount} (Resend's free-tier daily cap is ${DAILY_SEND_CAP}). ${deferredCount} remain — run this again tomorrow to reach them.`
        : `Sent to ${sent} of ${recipientCount}.`,
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("send-newsletter error:", err);
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
