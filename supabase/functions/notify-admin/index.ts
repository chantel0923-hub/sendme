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
    const { type, data } = await req.json();
    const templateFn = TEMPLATES[type];
    if (!templateFn) {
      return new Response(JSON.stringify({ sent: false, error: `Unknown type: ${type}` }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const message = templateFn(data || {});
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