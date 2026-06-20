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
