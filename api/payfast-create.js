// /api/payfast-create.js
//
// Vercel serverless function. Builds a signed PayFast "Onsite/Redirect"
// payment payload for a one-time love offering, records a "pending"
// donation row keyed by m_payment_id, and returns the action URL + fields
// for the browser to POST to PayFast.
//
// Required Vercel env vars (Settings → Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  - Supabase Settings → API → service_role key
//   REACT_APP_SUPABASE_URL     - already set (https://pidlanyedgieiyxuipwf.supabase.co)
//   PAYFAST_MERCHANT_ID        - from PayFast merchant dashboard (sandbox default below)
//   PAYFAST_MERCHANT_KEY       - from PayFast merchant dashboard (sandbox default below)
//   PAYFAST_PASSPHRASE         - set on PayFast dashboard under Settings → Integration
//   PAYFAST_MODE               - "sandbox" or "live"
//   SITE_URL                   - https://sendme-nine.vercel.app

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const PAYFAST_HOSTS = {
  sandbox: "https://sandbox.payfast.co.za/eng/process",
  live: "https://www.payfast.co.za/eng/process",
};

// PayFast's published sandbox test credentials — safe public defaults so this
// endpoint works in sandbox mode out of the box before real credentials exist.
const SANDBOX_MERCHANT_ID = "10000100";
const SANDBOX_MERCHANT_KEY = "46f0cd694581a";

// PayFast REQUIRES the signature string fields to be in this exact order —
// the order published in their API docs, NOT JS object insertion order.
// Relying on `for...in` order is fragile: adding/reordering a field in the
// data object silently breaks the signature. This explicit list fixes that.
const PAYFAST_FIELD_ORDER = [
  "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
  "name_first", "name_last", "email_address", "m_payment_id", "amount",
  "item_name", "item_description",
  "custom_int1", "custom_int2", "custom_int3", "custom_int4", "custom_int5",
  "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
  "email_confirmation", "confirmation_address", "payment_method",
];

function pfSignature(data, passphrase) {
  let pfOutput = "";
  for (const key of PAYFAST_FIELD_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    const val = data[key];
    if (val === "" || val === undefined || val === null) continue;
    pfOutput += `${key}=${encodeURIComponent(String(val).trim()).replace(/%20/g, "+")}&`;
  }
  let getString = pfOutput.slice(0, -1);
  // PayFast's own reference implementation appends &passphrase=... whenever
  // passphrase is not null/undefined — even if it's an empty string. Using
  // `if (passphrase)` (truthy check) skips this for "" and breaks the
  // signature to match PayFast's expectation when no passphrase is set.
  if (passphrase !== undefined && passphrase !== null) {
    getString += `&passphrase=${encodeURIComponent(String(passphrase).trim()).replace(/%20/g, "+")}`;
  }
  return crypto.createHash("md5").update(getString).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { mission_id, mission_title, amount, name, email, type, user_id } = req.body || {};

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ error: "Invalid donation amount" });
    }

    const site = process.env.SITE_URL || "https://sendme-nine.vercel.app";
    const mode = (process.env.PAYFAST_MODE || "sandbox").toLowerCase();
    const action = PAYFAST_HOSTS[mode] || PAYFAST_HOSTS.sandbox;

    const m_payment_id = crypto.randomUUID();

    const fullName = (name || "SendMe Donor").trim();
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ") || "Donor";

    const pfData = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID || SANDBOX_MERCHANT_ID,
      merchant_key: process.env.PAYFAST_MERCHANT_KEY || SANDBOX_MERCHANT_KEY,
      return_url: `${site}/payfast-success`,
      cancel_url: `${site}/payfast-cancel`,
      notify_url: `${site}/api/payfast-notify`,
      name_first: firstName,
      name_last: lastName,
      email_address: email || "",
      m_payment_id,
      amount: amt.toFixed(2),
      item_name: String(mission_title || "SendMe Mission Donation").slice(0, 100),
      item_description: "Missionary love offering via SendMe Global Mission Fund",
      custom_str1: String(mission_id ?? ""),
      custom_str2: type || "once",
      custom_str3: user_id ? String(user_id) : "",
    };

    // PayFast's sandbox default credentials have no passphrase configured —
    // pass an explicit empty string (not undefined) so pfSignature() still
    // appends "&passphrase=" per PayFast's reference implementation.
    const passphrase = process.env.PAYFAST_PASSPHRASE !== undefined
      ? process.env.PAYFAST_PASSPHRASE
      : "";

    pfData.signature = pfSignature(pfData, passphrase);

    // Record a pending donation so the ITN webhook can match it up later
    const supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error: insertError } = await supabase.from("donations").insert({
      m_payment_id,
      mission_id: mission_id || null,
      mission_title: mission_title || null,
      amount: amt,
      donor_name: name || null,
      donor_email: email || null,
      user_id: user_id || null,
      type: type || "once",
      status: "pending",
    });

    if (insertError) {
      console.error("payfast-create: failed to record pending donation", insertError);
      // Continue anyway — the donor shouldn't be blocked because of a
      // logging issue, but flag it for investigation.
    }

    // IMPORTANT: the fields object sent to the browser must ALSO be built in
    // PAYFAST_FIELD_ORDER so the hidden form posts inputs in that order.
    const orderedFields = {};
    for (const key of PAYFAST_FIELD_ORDER) {
      if (Object.prototype.hasOwnProperty.call(pfData, key)) {
        orderedFields[key] = pfData[key];
      }
    }
    orderedFields.signature = pfData.signature;

    return res.status(200).json({ action, fields: orderedFields });
  } catch (err) {
    console.error("payfast-create error", err);
    return res.status(500).json({ error: "Could not start PayFast payment" });
  }
}
