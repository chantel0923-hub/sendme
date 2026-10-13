// supabase/functions/notify-admin/index.ts
// SendMe — Admin WhatsApp notification via CallMeBot
//
// Sends a WhatsApp message to the SendMe admin whenever a church registers,
// a missionary applies, a worker request is posted or answered, or any other
// event needing admin attention occurs.
//
// Deploy: supabase functions deploy notify-admin
//
// Required secrets (set once):
//   supabase secrets set CALLMEBOT_PHONE=+27XXXXXXXXXX
//   supabase secrets set CALLMEBOT_APIKEY=XXXXXXXX
//
// How to get your CallMeBot API key (takes 2 minutes):
//   1. Save +34 684 72 39 62 to your WhatsApp contacts as "CallMeBot"
//   2. Send this exact message to that contact: I allow callmebot to send me messages
//   3. Within 60 seconds it replies with your API key
//   4. Set the two secrets above and deploy this function
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const CALLMEBOT_PHONE  = Deno.env.get("CALLMEBOT_PHONE");
const CALLMEBOT_APIKEY = Deno.env.get("CALLMEBOT_APIKEY");
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

// Who may trigger which WhatsApp ping to the admin:
//  - donation_received: ONLY the server (the Paystack webhook). A fake "donation received"
//    ping could make the admin believe money arrived, so no browser may send it.
//  - support_contact: the FAQ contact form, which guests can use.
//  - everything else: a signed-in SendMe user (or the server).
const SERVICE_ONLY_TYPES = new Set<string>(["donation_received"]);
const GUEST_ALLOWED_TYPES = new Set<string>(["support_contact"]);
const LIMIT_PER_CALLER_PER_MIN = 15;
const LIMIT_ALL_BROWSER_PER_HOUR = 120; // protects the CallMeBot quota from a flood

// Keep caller text short and free of control characters before it goes into a WhatsApp message.
function cleanData(v: unknown, depth = 0): unknown {
  if (depth > 3) return undefined;
  if (typeof v === "string") return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 400);
  if (typeof v === "number" || typeof v === "boolean" || v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => cleanData(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 60)) out[k] = cleanData(val, depth + 1);
    return out;
  }
  return undefined;
}

const TEMPLATES: Record<string, (d: any) => string> = {
  church_registered: (d) => 
    `✝ SendMe — New Church Registration\n\n` +
    `⛪ *${d.churchName}*\n` +
    `📍 ${d.city}, ${d.country}\n` +
    `👤 Pastor: ${d.pastorName}\n` +
    `✉ ${d.pastorEmail || "no email"}\n\n` +
    `⚠ Awaiting your verification in Admin → Churches`,
  mission_applied: (d) =>
    `✝ SendMe — New Mission Application\n\n` +
    `📋 *${d.missionTitle}*\n` +
    `👤 ${d.missionaryName}\n` +
    `📍 ${d.country}\n` +
    `⛪ Church: ${d.churchName || "unregistered"}\n\n` +
    `⚠ Awaiting your approval in Admin → Approvals`,
  emergency_submitted: (d) =>
    `🚨 SendMe — Emergency Request\n\n` +
    `*${d.title}*\n` +
    `📍 ${d.country} | Urgency: ${d.urgency || "unspecified"}\n` +
    `💰 Goal: USD ${d.goal || "unset"}\n\n` +
    `⚠ Review in Admin → Payouts → Emergency`,
  donation_received: (d) =>
    `💝 SendMe — New Donation Received\n\n` +
    `💰 USD ${d.amount || 0} — *${d.missionTitle || "a mission"}*\n` +
    `👤 ${d.donorName || "Anonymous"}${d.isGuest ? " (guest checkout)" : ""}\n` +
    `✉ ${d.donorEmail || "no email given"}\n\n` +
    `📊 Now at USD ${d.totalRaised || 0} of USD ${d.goal || "?"}\n\n` +
    `View: ${d.missionUrl || "Admin → Payouts"}`,
  proof_submitted: (d) =>
    `📋 SendMe — Milestone Proof Submitted\n\n` +
    `*${d.missionTitle}* — Milestone ${d.milestoneNumber}\n` +
    `👤 ${d.missionaryName || "A missionary"}\n` +
    `⛪ For review by: ${d.pastorName ? "Pastor " + d.pastorName : "their pastor"}\n\n` +
    `For your visibility — approval happens on the pastor's side.`,
  banking_missing: (d) =>
    `⚠ SendMe — Banking Details Missing\n\n` +
    `Mission *${d.missionTitle}* has reached a payout milestone but has no banking details on file.\n\n` +
    `📧 Pastor: ${d.pastorEmail || "unknown"}\n\n` +
    `Action: Admin → Payouts → request banking from pastor`,
  payout_processed: (d) =>
    `💸 SendMe — Payout Processed\n\n` +
    `📋 *${d.missionTitle}*\n` +
    `💰 USD ${d.amount || 0} — milestone ${d.milestone || "?"}\n` +
    `👤 To: ${d.recipientName || "pastor/church"}\n\n` +
    `✅ Marked as paid in Admin → Payouts`,
  support_contact: (d) =>
    `💬 SendMe — FAQ Contact Message\n\n` +
    `👤 ${d.name || "Anonymous"}\n` +
    `✉ ${d.email || "no email given"}\n\n` +
    `"${(d.message || "").slice(0, 200)}"\n\n` +
    `Full message sent to your email — reply there.`,
  worker_request: (d) =>
    `🤝 SendMe — New Worker Request Posted\n\n` +
    `📋 *${d.title}*\n` +
    `⛪ ${d.church}\n` +
    `📍 ${d.city ? d.city + ", " : ""}${d.country}\n\n` +
    `View in Admin → Worker Requests`,
  worker_response_received: (d) =>
    `🙌 SendMe — Someone Can Help!\n\n` +
    `📋 Request: *${d.requestTitle}*\n` +
    `⛪ From: ${d.requestChurch}\n\n` +
    `✋ ${d.commitment || "Offered to help"}\n` +
    `✉ ${d.responderEmail || "no email"}\n` +
    (d.note ? `📝 "${d.note}"\n\n` : `\n`) +
    `Review + notify the church in Admin → Worker Requests`,
  // ── Family In Need ──────────────────────────────────────────────────────
  // Deliberately no applicant name/phone/email here — a WhatsApp message is
  // less controlled than the admin email/dashboard, so this stays anonymised
  // (category + city only) same as the public listing itself.
  family_need_submitted: (d) =>
    `🤝 SendMe — New Family In Need Submission\n\n` +
    `Category: ${d.category || "unspecified"}\n` +
    `📍 ${d.city || "unspecified"}, ${d.country || "unspecified"}\n` +
    `💰 Amount needed: USD ${d.goal ?? "unset"}\n\n` +
    `⚠ Awaiting pastor endorsement before it reaches your queue.`,
  family_need_funded: (d) =>
    `🙏 SendMe — Family Need Fully Funded\n\n` +
    `Category: ${d.category || "unspecified"}\n` +
    `📍 ${d.city || "unspecified"}, ${d.country || "unspecified"}\n` +
    `💰 USD ${d.amount || 0} raised\n\n` +
    `Action: Admin → Family Needs → mark as paid to church`,
};
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  try {
    if (!CALLMEBOT_PHONE || !CALLMEBOT_APIKEY) {
      console.error("notify-admin: CALLMEBOT_PHONE or CALLMEBOT_APIKEY secret not set");
      return new Response(JSON.stringify({ sent: false, error: "CallMeBot secrets not configured" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    let body: any;
    try { body = await req.json(); } catch (_e) { return jsonRes(400, { sent: false, error: "Invalid request body" }); }
    const type = typeof body?.type === "string" ? body.type : "";
    const data = (body?.data && typeof body.data === "object" && !Array.isArray(body.data)) ? body.data : {};
    const templateFn = Object.prototype.hasOwnProperty.call(TEMPLATES, type) ? TEMPLATES[type] : undefined;
    if (!templateFn) {
      return new Response(JSON.stringify({ sent: false, error: `Unknown type: ${type}` }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── Who is calling? ──
    const caller = await getCaller(req);
    if (SERVICE_ONLY_TYPES.has(type)) {
      if (caller.kind !== "service") return jsonRes(403, { sent: false, error: "Not allowed" });
    } else if (caller.kind === "anon" && !GUEST_ALLOWED_TYPES.has(type)) {
      return jsonRes(401, { sent: false, error: "Not signed in" });
    }
    if (caller.kind !== "service") {
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown-ip";
      const key = `c:${caller.kind === "user" ? caller.id : ip}`;
      if (overLimit(key, LIMIT_PER_CALLER_PER_MIN, 60_000) || overLimit("all-browser", LIMIT_ALL_BROWSER_PER_HOUR, 3_600_000)) {
        return jsonRes(429, { sent: false, error: "Too many requests — please wait a bit." });
      }
    }

    const message = templateFn(cleanData(data) as any);
    const encoded = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}&text=${encoded}&apikey=${CALLMEBOT_APIKEY}`;
    const res = await fetch(url);
    const text = await res.text();
    console.log("notify-admin CallMeBot response:", text);
    return new Response(JSON.stringify({ sent: true, response: text }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-admin error:", err);
    return new Response(JSON.stringify({ sent: false, error: String(err) }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
