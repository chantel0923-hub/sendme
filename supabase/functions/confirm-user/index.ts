// supabase/functions/confirm-user/index.ts
//
// Admin-only helper so Br Donald can activate a member who never got (or could
// not use) their confirmation email — without writing SQL.
//
// Two actions, both POST with a JSON body:
//   { "action": "list_unverified" }                 -> { users: [...] }
//   { "action": "confirm", "user_id": "<uuid>" }    -> { ok: true, email }
//
// Security: the caller must be signed in AND their login email must equal the
// admin email. Everyone else gets 401/403 before anything is read or changed.
// The service-role key stays on the server; the browser never sees it.
//
// Deploy:  supabase functions deploy confirm-user --use-api
// Optional secret:  ADMIN_EMAIL (defaults to the SendMe organisation Gmail).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// to every Edge Function automatically.
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") ?? "sendmemissionfund@gmail.com").trim().toLowerCase();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20; // safety stop: 20,000 users

Deno.serve(async (req: Request) => {
  // Browser pre-flight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // 1) Must be signed in
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not signed in" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Server is not configured" }, 500);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  const user = callerData?.user;
  if (callerError || !user) return json({ error: "Not signed in" }, 401);

  // 2) Must be the admin
  if ((user.email ?? "").trim().toLowerCase() !== ADMIN_EMAIL) return json({ error: "Admins only" }, 403);

  // 3) Do the work with the service-role client
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Invalid request" }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (body.action === "list_unverified") {
    const out: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (error) return json({ error: error.message }, 500);
      const users = data?.users ?? [];
      for (const u of users) {
        if (!u.email_confirmed_at) {
          out.push({
            id: u.id,
            email: u.email ?? "",
            full_name: u.user_metadata?.full_name ?? "",
            role: u.user_metadata?.role ?? "",
            whatsapp_number: u.user_metadata?.whatsapp_number ?? "",
            created_at: u.created_at,
          });
        }
      }
      if (users.length < PAGE_SIZE) break;
    }
    out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return json({ users: out });
  }

  if (body.action === "confirm") {
    const id = String(body.user_id ?? "");
    if (!UUID_RE.test(id)) return json({ error: "Invalid user" }, 400);
    const { data, error } = await admin.auth.admin.updateUserById(id, { email_confirm: true });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, email: data?.user?.email ?? "" });
  }

  return json({ error: "Unknown action" }, 400);
});
