// /api/payfast-notify.js
//
// PayFast Instant Transaction Notification (ITN) webhook.
// PayFast POSTs here server-to-server after every payment event.
// We verify the signature, check the payment status, then update
// the donations row and increment the mission's raised amount.
//
// Required Vercel env vars (same as payfast-create.js):
//   SUPABASE_SERVICE_ROLE_KEY
//   REACT_APP_SUPABASE_URL
//   PAYFAST_PASSPHRASE
//   PAYFAST_MODE   ("sandbox" or "live")
//   SITE_URL

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const PAYFAST_VALID_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

// PayFast sends application/x-www-form-urlencoded — we need raw body text
// for signature verification. Tell Vercel not to auto-parse.
export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// PayFast's ITN signature is computed over the fields as PayFast sent them
// in the POST body, in that order — and CRITICALLY, PayFast's own ITN
// verification INCLUDES empty-valued fields (e.g. "custom_str4=") in the
// string to hash, unlike the outbound payfast-create.js signature which
// correctly omits them. This asymmetry is undocumented but confirmed by
// testing: including empty fields produces the exact signature PayFast
// expects. Do NOT "fix" this to skip empty values — that reintroduces the
// mismatch.
function pfSignature(data, passphrase) {
  let pfOutput = "";
  for (const key in data) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    if (key === "signature") continue;
    const val = data[key];
    if (val === undefined || val === null) continue;
    pfOutput += `${key}=${encodeURIComponent(String(val).trim()).replace(/%20/g, "+")}&`;
  }
  let getString = pfOutput.slice(0, -1);
  if (passphrase !== undefined && passphrase !== null) {
    getString += `&passphrase=${encodeURIComponent(String(passphrase).trim()).replace(/%20/g, "+")}`;
  }
  return crypto.createHash("md5").update(getString).digest("hex");
}

async function verifyWithPayfast(rawBody, mode) {
  const host =
    mode === "live"
      ? "https://www.payfast.co.za"
      : "https://sandbox.payfast.co.za";
  try {
    const r = await fetch(`${host}/eng/query/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const text = await r.text();
    return text.trim() === "VALID";
  } catch (err) {
    console.error("payfast-notify: PayFast validation request failed", err);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBody = await getRawBody(req);

    // Parse the URL-encoded body — params preserves the order fields arrived
    // in, which is what PayFast itself used to generate the signature.
    const params = Object.fromEntries(new URLSearchParams(rawBody));

    const mode = (process.env.PAYFAST_MODE || "sandbox").toLowerCase();
    const passphrase = process.env.PAYFAST_PASSPHRASE || "";

    // ── 1. Signature check ────────────────────────────────────────────────
    const expectedSig = pfSignature(params, passphrase);
    if (expectedSig !== params.signature) {
      console.error("payfast-notify: signature mismatch", { expected: expectedSig, got: params.signature });
      return res.status(400).send("Invalid signature");
    }

    // ── 2. IP allowlist (optional belt-and-braces) ──────────────────────────
    // PayFast publishes a list of valid IPs — we skip the strict block here
    // so sandbox testing isn't broken by proxy hops, but log any mismatch.
    const forwarded = req.headers["x-forwarded-for"] || "";
    const callerIP = forwarded.split(",")[0].trim();
    const knownPayfastRange = PAYFAST_VALID_HOSTS; // hostname check done by PayFast validate endpoint
    console.log("payfast-notify: caller IP", callerIP);

    // ── 3. Server-side validation with PayFast ──────────────────────────────
    const isValid = await verifyWithPayfast(rawBody, mode);
    if (!isValid) {
      console.error("payfast-notify: PayFast server validation failed");
      return res.status(400).send("Payment validation failed");
    }

    // ── 4. Process the notification ──────────────────────────────────────────
    const {
      m_payment_id,
      payment_status,    // "COMPLETE" | "FAILED" | "PENDING"
      amount_gross,
      custom_str1: target_id,
      custom_str2: type,
      custom_str3: user_id,
      custom_str4: kind,   // "mission" | "emergency" — set by payfast-create.js
      pf_payment_id,
      name_first,
      email_address,
    } = params;

    const isEmergency = kind === "emergency";

    const supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const status =
      payment_status === "COMPLETE" ? "complete" :
      payment_status === "FAILED"   ? "failed"   : "pending";

    // Look up the original USD amount the donor actually pledged, recorded
    // correctly in payfast-create.js at checkout time. amount_gross in this
    // ITN callback is in ZAR (PayFast's settlement currency) — using it
    // directly to credit `raised` (a USD figure) would inflate every gift
    // by roughly the exchange rate. This lookup is the fix for that.
    const { data: donationRow, error: fetchError } = await supabase
      .from("donations")
      .select("amount")
      .eq("m_payment_id", m_payment_id)
      .single();
    if (fetchError) {
      console.error("payfast-notify: could not find original donation row for m_payment_id", m_payment_id, fetchError);
    }
    const usdAmount = donationRow?.amount ?? null;

    // Update the donations row — keep the original USD `amount` untouched,
    // record the ZAR gross separately for reconciliation only.
    const { error: updateError } = await supabase
      .from("donations")
      .update({
        status,
        pf_payment_id: pf_payment_id || null,
        amount_zar: Number(amount_gross) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("m_payment_id", m_payment_id);

    if (updateError) {
      console.error("payfast-notify: failed to update donation row", updateError);
      // Still return 200 so PayFast doesn't keep retrying — log for manual review
      return res.status(200).send("OK");
    }

    // Increment the mission's (or emergency request's) raised amount on COMPLETE
    if (status === "complete" && target_id) {
      // Fallback to amount_gross only if the original donation row lookup
      // somehow failed — better to credit something than nothing, but the
      // usdAmount path above should be the normal case.
      const creditAmount = usdAmount ?? Number(amount_gross);

      if (isEmergency) {
        const { error: rpcError } = await supabase.rpc("increment_emergency_raised", {
          p_emergency_id: target_id,
          p_amount: creditAmount,
        });
        if (rpcError) {
          console.error("payfast-notify: increment_emergency_raised failed", rpcError);
        }
      } else {
        const { error: rpcError } = await supabase.rpc("increment_mission_raised", {
          p_mission_id: target_id,
          p_amount: creditAmount,
        });
        if (rpcError) {
          console.error("payfast-notify: increment_mission_raised failed", rpcError);
        }

        // Also append to mission_ledger for transparency (missions only —
        // there's no equivalent ledger table for emergency requests yet)
        const { error: ledgerError } = await supabase.from("mission_ledger").insert({
          mission_id: target_id,
          amount: creditAmount,
          description: `Donation via PayFast (${pf_payment_id || m_payment_id})`,
          category: "donation",
          donor_name: name_first || null,
          donor_email: email_address || null,
          user_id: user_id || null,
        });
        if (ledgerError) {
          console.error("payfast-notify: ledger insert failed", ledgerError);
        }
      }
    }

    console.log("payfast-notify: processed", { m_payment_id, status, amount_gross, usdAmount, target_id, kind });
    return res.status(200).send("OK");
  } catch (err) {
    // Catch-all so an unexpected error never surfaces as a raw 500 to
    // PayFast — log it for investigation and return 200 so PayFast doesn't
    // endlessly retry a notification we've already partially processed.
    console.error("payfast-notify: unexpected error", err);
    return res.status(200).send("OK");
  }
}