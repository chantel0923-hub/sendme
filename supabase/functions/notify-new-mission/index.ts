// supabase/functions/notify-new-mission/index.ts
// Broadcasts a push notification to every subscribed device when admin approves a mission.
// Deploy with: supabase functions deploy notify-new-mission --use-api
//
// Required secrets (set once via `supabase secrets set` or the Dashboard > Edge Functions > Secrets):
//   FIREBASE_PROJECT_ID          — from Firebase Console > Project Settings > General
//   FIREBASE_SERVICE_ACCOUNT_B64 — the service account JSON key file, base64-encoded as ONE line
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already auto-provided to every Edge Function.

import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9";

const FIREBASE_PROJECT_ID          = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_SERVICE_ACCOUNT_B64 = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64")!;
const SUPABASE_URL                 = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL                     = "https://sendmeglobalmission.org";

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

// A push goes to every subscribed device, so only the signed-in SendMe admin may trigger one.
Deno.serve(async (req) => {
  const cors = CORS_HEADERS;
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // ── Admin only ──
    const caller = await getCaller(req);
    if (caller.kind === "anon") return jsonRes(401, { error: "Not signed in" });
    if (!(caller.kind === "user" && caller.email === ADMIN_EMAIL) && caller.kind !== "service") {
      return jsonRes(403, { error: "Admins only" });
    }
    if (overLimit(`push:${caller.id}`, 10, 3_600_000)) return jsonRes(429, { error: "Too many broadcasts this hour." });

    let body: any;
    try { body = await req.json(); } catch (_e) { return jsonRes(400, { error: "Invalid request body" }); }
    const missionTitle = String(body?.missionTitle ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 120);
    const country = String(body?.country ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 60);
    const missionId = String(body?.missionId ?? "").trim();
    if (!missionTitle) return jsonRes(400, { error: "missionTitle is required" });
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(missionId)) return jsonRes(400, { error: "Invalid missionId" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: subs, error } = await supabase.from("push_subscriptions").select("token");
    if (error) throw error;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0 }), { status: 200, headers: cors });
    }

    const credentials = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(FIREBASE_SERVICE_ACCOUNT_B64), c => c.charCodeAt(0))
    ));
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    const endpoint = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;
    const link = `${SITE_URL}/mission/${missionId}`;

    let sent = 0, failed = 0;
    const deadTokens: string[] = [];

    for (const { token } of subs) {
      const body = {
        message: {
          token,
          notification: {
            title: "New Mission Needs Support 🙏",
            body: `${missionTitle}${country ? " — " + country : ""}. Tap to see how you can help.`,
          },
          webpush: {
            fcm_options: { link },
            notification: { icon: `${SITE_URL}/logo192.png` },
          },
        },
      };

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        sent++;
      } else {
        failed++;
        const errText = await resp.text();
        if (errText.includes("UNREGISTERED") || errText.includes("NOT_FOUND") || errText.includes("INVALID_ARGUMENT")) {
          deadTokens.push(token);
        }
      }
    }

    if (deadTokens.length > 0) {
      await supabase.from("push_subscriptions").delete().in("token", deadTokens);
    }

    return new Response(JSON.stringify({ sent, failed, cleaned: deadTokens.length }), { status: 200, headers: cors });
  } catch (e) {
    console.error("notify-new-mission error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});