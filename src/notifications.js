// notifications.js — thin client wrappers around Supabase Edge Functions
import { supabase } from "./supabase";

// ── Email notifications via send-notification Edge Function ──────────────────
// Fire-and-forget by design: a failed email should never block or break
// the user-facing action that triggered it (approving a proof, etc).
export async function sendNotification(type, to, data = {}) {
  if (!to) {
    console.warn(`sendNotification('${type}') skipped — no recipient email provided.`);
    return { sent: false, error: "no recipient" };
  }
  try {
    const { data: result, error } = await supabase.functions.invoke("send-notification", {
      body: { type, to, data },
    });
    if (error) {
      console.error(`sendNotification('${type}') failed:`, error);
      return { sent: false, error };
    }
    return result;
  } catch (e) {
    console.error(`sendNotification('${type}') threw:`, e);
    return { sent: false, error: e.message };
  }
}

// ── WhatsApp admin notifications via notify-admin Edge Function ──────────────
// Sends a WhatsApp message to Br Donald's phone via CallMeBot.
// Used for events requiring admin attention: church registrations,
// mission applications, emergencies, missing banking details.
// Fire-and-forget — never blocks the user action that triggered it.
export async function notifyAdmin(type, data = {}) {
  try {
    const { data: result, error } = await supabase.functions.invoke("notify-admin", {
      body: { type, data },
    });
    if (error) {
      console.error(`notifyAdmin('${type}') failed:`, error);
      return { sent: false, error };
    }
    return result;
  } catch (e) {
    console.error(`notifyAdmin('${type}') threw:`, e);
    return { sent: false, error: e.message };
  }
}
