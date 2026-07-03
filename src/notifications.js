// notifications.js — thin client wrapper around the send-notification Edge Function
import { supabase } from "./supabase";

// Fire-and-forget by design: a failed email should never block or break
// the user-facing action that triggered it (approving a proof, etc).
// Errors are logged to the console but swallowed.
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

// Fire-and-forget WhatsApp ping to the admin via the notify-admin Edge Function
// (CallMeBot). `type` must match one of the templates defined server-side in
// supabase/functions/notify-admin/index.ts — currently: church_registered,
// mission_applied, emergency_submitted, banking_missing.
// Never blocks or throws into the caller; failures are logged only.
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
