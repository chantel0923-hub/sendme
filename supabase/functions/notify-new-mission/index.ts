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
const SITE_URL                     = "https://sendme-nine.vercel.app";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { missionTitle, missionId, country } = await req.json();

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