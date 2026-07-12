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

// Converts a USD amount to its ZAR equivalent using the fawazahmed0 currency
// API (free, no API key, same source used for mission funding-goal conversion
// on the client). PayFast's standard checkout only ever settles in ZAR — it
// has no currency parameter — so any USD amount MUST be converted before it
// reaches PayFast, or donors are silently charged the raw USD number as if
// it were Rand (e.g. a $25 gift becomes an R25.00 charge, about 1/18th of
// the intended amount).
async function convertUSDtoZAR(usdAmount) {
  const toDateString = (d) => d.toISOString().split("T")[0];
  const today = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86400000));

  const fetchRate = async (dateStr) => {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/usd.json`
    );
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    const rate = data?.usd?.zar;
    if (!rate) throw new Error("ZAR rate not found");
    return rate;
  };

  let rate;
  try { rate = await fetchRate(today); }
  catch { rate = await fetchRate(yesterday); }
  return usdAmount * rate;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { mission_id, mission_title, emergency_id, emergency_title, amount, name, email, type, kind, user_id } = req.body || {};

    const isEmergency = kind === "emergency";
    const targetId    = isEmergency ? emergency_id : mission_id;
    const targetTitle = isEmergency ? emergency_title : mission_title;

    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: "Invalid donation amount" });
    if (!targetId) return res.status(400).json({ error: isEmergency ? "No emergency request selected" : "No mission selected" });

    // The amount coming from the client is always USD (the donation screen
    // has no currency picker — every amount shown to the donor is a $ figure).
    // PayFast only settles in ZAR, so convert before building the payload.
    let zarAmount;
    try {
      zarAmount = await convertUSDtoZAR(amt);
    } catch (convErr) {
      console.error("payfast-create: currency conversion failed", convErr);
      return res.status(502).json({ error: "Could not fetch a live exchange rate to convert your donation. Please try again in a moment." });
    }

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

    const missionIdStr = String(targetId ?? "");

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
      ["amount",            zarAmount.toFixed(2)],
      ["item_name",         String(targetTitle || (isEmergency ? "SendMe Emergency Request" : "SendMe Mission Donation")).slice(0, 100)],
      ["item_description",  isEmergency ? "Emergency relief gift via SendMe Global Mission Fund" : "Missionary love offering via SendMe Global Mission Fund"],
      ["custom_str1",       missionIdStr],
      ["custom_str2",       type || "once"],
      ["custom_str3",       user_id ? String(user_id) : ""],
      ["custom_str4",       isEmergency ? "emergency" : "mission"],
    ];

    // Recurring billing fields — MUST be appended last, after the custom_str*
    // fields, per PayFast's documented signature field order
    // (https://developers.payfast.co.za: Merchant → Buyer → Transaction →
    // Custom → Recurring Billing). Only added for monthly/subscription
    // donations; once-off and emergency gifts are unaffected.
    if (type === "monthly") {
      pairs.push(
        ["subscription_type", "1"],          // 1 = subscription (2 = ad-hoc tokenization, not used here)
        ["recurring_amount",  zarAmount.toFixed(2)], // same as 'amount' — charged every cycle going forward
        ["frequency",         "3"],          // PayFast cycle code: 1=Daily 2=Weekly 3=Monthly 4=Quarterly 5=Biannually 6=Annual
        ["cycles",            "0"],          // 0 = bill indefinitely until the donor cancels
      );
    }

    const signature = pfSignature(pairs, passphrase);

    // Build the fields object for the client to POST (same order, + signature at end)
    const fields = Object.fromEntries([...pairs, ["signature", signature]]);

    // Record pending donation in Supabase
    try {
      const supabase = createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      // #87 fix: donations.mission_id is a uuid column (built for real
      // missions, which use Supabase uuid primary keys). emergency_requests
      // uses a bigint id instead — inserting that into mission_id has been
      // failing on EVERY emergency donation, type-mismatch, silently caught
      // below. The dedicated emergency_id column (bigint) is where an
      // emergency's target id belongs instead.
      const { error: pendingInsertError } = await supabase.from("donations").insert({
        m_payment_id,
        mission_id:    isEmergency ? null : (targetId || null),
        emergency_id:  isEmergency ? (targetId || null) : null,
        mission_title: targetTitle || null,
        amount:        amt,
        donor_name:    name || null,
        donor_email:   email || null,
        user_id:       user_id || null,
        type:          type || "once",
        kind:          isEmergency ? "emergency" : "mission",
        status:        "pending",
      });
      // Supabase's JS client does NOT throw on a failed insert — it returns
      // { error }. This MUST be checked explicitly or a blocked/mismatched
      // insert (like the uuid/bigint mismatch that caused #87) fails
      // completely silently.
      if (pendingInsertError) {
        console.error("payfast-create: pending donation insert failed", pendingInsertError);
      }
    } catch (dbErr) {
      console.error("payfast-create: pending donation insert threw", dbErr);
      // Non-fatal — donor still goes to PayFast
    }

    return res.status(200).json({
      action,
      fields,
      amount_usd: amt,
      amount_zar: Number(zarAmount.toFixed(2)),
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
