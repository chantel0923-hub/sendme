// /api/payfast-create.js
// Vercel serverless function — builds a signed PayFast payment payload.
// Required Vercel env vars:
//   SUPABASE_SERVICE_ROLE_KEY, REACT_APP_SUPABASE_URL
//   PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE
//   PAYFAST_MODE ("sandbox" | "live"), SITE_URL

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const PAYFAST_HOSTS = {
  sandbox: "https://sandbox.payfast.co.za/eng/process",
  live:    "https://www.payfast.co.za/eng/process",
};

// Matches PHP urlencode() exactly — PayFast signatures require this
function phpUrlencode(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g,  "%21")
    .replace(/'/g,  "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/~/g,  "%7E")
    .replace(/%20/g, "+");
}

// Build PayFast signature from an ORDERED array of [key, value] pairs
function pfSignature(pairs, passphrase) {
  const parts = pairs
    .filter(([, v]) => v !== "" && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${phpUrlencode(String(v).trim())}`);

  let str = parts.join("&");
  if (passphrase) str += `&passphrase=${phpUrlencode(String(passphrase).trim())}`;

  console.log("pfSignature string:", str); // visible in Vercel function logs
  return crypto.createHash("md5").update(str).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { mission_id, mission_title, amount, name, email, type, user_id } = req.body || {};

    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: "Invalid donation amount" });

    const site       = (process.env.SITE_URL        || "https://sendme-nine.vercel.app").replace(/\/$/, "");
    const mode       = (process.env.PAYFAST_MODE    || "sandbox").toLowerCase();
    const merchantId = process.env.PAYFAST_MERCHANT_ID  || "10000100";
    const merchantKey= process.env.PAYFAST_MERCHANT_KEY || "46f0cd694581a";
    const passphrase = process.env.PAYFAST_PASSPHRASE   || "";
    const action     = PAYFAST_HOSTS[mode] || PAYFAST_HOSTS.sandbox;

    const m_payment_id = crypto.randomUUID();

    const fullName  = (name || "SendMe Donor").trim();
    const [firstName, ...rest] = fullName.split(" ");
    const lastName  = rest.join(" ") || "Donor";

    const missionIdStr = String(mission_id ?? "");

    // IMPORTANT: field order must match exactly what's sent in the form POST
    const pairs = [
      ["merchant_id",       merchantId],
      ["merchant_key",      merchantKey],
      ["return_url",        `${site}/?payfast=success&m=${missionIdStr}`],
      ["cancel_url",        `${site}/?payfast=cancel&m=${missionIdStr}`],
      ["notify_url",        `${site}/api/payfast-notify`],
      ["name_first",        firstName],
      ["name_last",         lastName],
      ["email_address",     email || ""],
      ["m_payment_id",      m_payment_id],
      ["amount",            amt.toFixed(2)],
      ["item_name",         String(mission_title || "SendMe Mission Donation").slice(0, 100)],
      ["item_description",  "Missionary love offering via SendMe Global Mission Fund"],
      ["custom_str1",       missionIdStr],
      ["custom_str2",       type || "once"],
      ["custom_str3",       user_id ? String(user_id) : ""],
    ];

    const signature = pfSignature(pairs, passphrase);

    // Build the fields object for the client to POST (same order, + signature at end)
    const fields = Object.fromEntries([...pairs, ["signature", signature]]);

    // Record pending donation in Supabase
    try {
      const supabase = createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      await supabase.from("donations").insert({
        m_payment_id,
        mission_id:    mission_id || null,
        mission_title: mission_title || null,
        amount:        amt,
        donor_name:    name || null,
        donor_email:   email || null,
        user_id:       user_id || null,
        type:          type || "once",
        status:        "pending",
      });
    } catch (dbErr) {
      console.error("payfast-create: pending donation insert failed", dbErr);
      // Non-fatal — donor still goes to PayFast
    }

    return res.status(200).json({
      action,
      fields,
      _debug_signature_string: (() => {
        const parts = pairs
          .filter(([, v]) => v !== "" && v !== undefined && v !== null)
          .map(([k, v]) => `${k}=${phpUrlencode(String(v).trim())}`);
        let str = parts.join("&");
        if (passphrase) str += `&passphrase=${phpUrlencode(String(passphrase).trim())}`;
        return str;
      })(),
      _debug_passphrase_set: passphrase ? `YES (length ${passphrase.length})` : "NO (empty)",
    });
  } catch (err) {
    console.error("payfast-create error", err);
    return res.status(500).json({ error: "Could not start PayFast payment" });
  }
}
