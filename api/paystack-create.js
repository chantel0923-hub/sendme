// /api/paystack-create.js
// Vercel serverless function — initializes a Paystack transaction and
// returns the hosted checkout URL to redirect the donor to.
// Required Vercel env vars:
//   SUPABASE_SERVICE_ROLE_KEY, REACT_APP_SUPABASE_URL
//   PAYSTACK_SECRET_KEY, SITE_URL

import { createClient } from "@supabase/supabase-js";

const PAYSTACK_BASE = "https://api.paystack.co";

// Same conversion source used by payfast-create.js — kept identical so a
// donor sees the same ZAR amount regardless of which processor ends up
// live. See that file's own comment for why this conversion is mandatory
// (Paystack, like PayFast, settles South African merchants in ZAR only —
// there is no currency parameter to pass a USD amount through untouched).
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

async function paystackFetch(path, options = {}) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok || json.status === false) {
    throw new Error(json.message || `Paystack request failed (${res.status})`);
  }
  return json;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      mission_id, mission_title,
      emergency_id, emergency_title,
      family_need_id, family_need_title,
      amount, name, email, type, kind, user_id,
    } = req.body || {};

    // Same four donation kinds as payfast-create.js: "mission" (default),
    // "emergency", "family_need", "general_fund". general_fund has no
    // target at all — the fund never closes and isn't earmarked for
    // anything specific, same reasoning as that file.
    const isEmergency   = kind === "emergency";
    const isFamilyNeed  = kind === "family_need";
    const isGeneralFund = kind === "general_fund";
    const targetId    = isFamilyNeed ? family_need_id : isEmergency ? emergency_id : mission_id;
    const targetTitle = isFamilyNeed ? family_need_title : isEmergency ? emergency_title : mission_title;

    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: "Invalid donation amount" });
    if (!isGeneralFund && !targetId) {
      const label = isFamilyNeed ? "No family need selected" : isEmergency ? "No emergency request selected" : "No mission selected";
      return res.status(400).json({ error: label });
    }
    if (!email) return res.status(400).json({ error: "An email address is required to give via Paystack" });

    let zarAmount;
    try {
      zarAmount = await convertUSDtoZAR(amt);
    } catch (convErr) {
      console.error("paystack-create: currency conversion failed", convErr);
      return res.status(502).json({ error: "Could not fetch a live exchange rate to convert your donation. Please try again in a moment." });
    }

    // Paystack amounts are always in the currency's smallest unit — cents
    // for ZAR, same idea as PayFast's own rand-and-cents but Paystack wants
    // it as a single integer (e.g. R163.11 -> 16311) rather than a decimal
    // string. Rounding here, not truncating, to avoid ever under-charging
    // by a cent.
    const zarAmountCents = Math.round(zarAmount * 100);

    const site = (process.env.SITE_URL || "https://sendmeglobalmission.org").replace(/\/$/, "");
    const targetIdStr = String(targetId ?? "");

    const itemLabel = isGeneralFund
      ? "SendMe General Fund Gift"
      : isFamilyNeed
      ? (targetTitle || "SendMe Family In Need Gift")
      : isEmergency
      ? (targetTitle || "SendMe Emergency Request")
      : (targetTitle || "SendMe Mission Donation");

    const kindStr = isGeneralFund ? "general_fund" : isFamilyNeed ? "family_need" : isEmergency ? "emergency" : "mission";

    // Metadata is stored on the Paystack transaction and echoed back
    // verbatim in the charge.success webhook event — this is how
    // paystack-webhook.js knows what this specific charge is for, same
    // job PayFast's custom_str1-4 fields do.
    const metadata = {
      target_id: targetIdStr,
      target_title: itemLabel,
      kind: kindStr,
      donation_type: type || "once",
      user_id: user_id || "",
    };

    let planCode = null;
    if (type === "monthly") {
      // Paystack Plans expect a fixed amount — since donors choose their
      // own amount rather than picking from fixed tiers, a new Plan is
      // created per unique amount+kind combination rather than reusing a
      // shared one. This is a normal, supported use of the Plans API, just
      // less common than a handful of fixed pricing tiers.
      const plan = await paystackFetch("/plan", {
        method: "POST",
        body: JSON.stringify({
          name: `SendMe Monthly — ${itemLabel} (R${(zarAmountCents/100).toFixed(2)})`,
          interval: "monthly",
          amount: zarAmountCents,
        }),
      });
      planCode = plan.data.plan_code;
    }

    const fullName = (name || "SendMe Donor").trim();

    const initPayload = {
      email,
      amount: zarAmountCents,
      currency: "ZAR",
      callback_url: `${site}/?paystack=success&m=${targetIdStr}`,
      metadata: { ...metadata, custom_fields: [
        { display_name: "Donor Name", variable_name: "donor_name", value: fullName },
      ] },
    };
    if (planCode) initPayload.plan = planCode;

    const init = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify(initPayload),
    });

    const { authorization_url, reference } = init.data;

    // Record pending donation in Supabase — same fields as payfast-create.js
    // populates, plus paystack_reference/paystack_plan_code instead of
    // m_payment_id/payfast_token.
    try {
      const supabase = createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { error: pendingInsertError } = await supabase.from("donations").insert({
        paystack_reference: reference,
        paystack_plan_code: planCode,
        mission_id:      (!isEmergency && !isFamilyNeed && !isGeneralFund) ? (targetId || null) : null,
        emergency_id:    isEmergency ? (targetId || null) : null,
        family_need_id:  isFamilyNeed ? (targetId || null) : null,
        is_general_fund: isGeneralFund,
        mission_title:   targetTitle || (isGeneralFund ? "SendMe General Fund" : null),
        amount:          amt,
        donor_name:      name || null,
        donor_email:     email || null,
        user_id:         user_id || null,
        type:            type || "once",
        kind:            kindStr,
        status:          "pending",
      });
      if (pendingInsertError) {
        console.error("paystack-create: pending donation insert failed", pendingInsertError);
      }
    } catch (dbErr) {
      console.error("paystack-create: pending donation insert threw", dbErr);
      // Non-fatal — donor still goes to Paystack
    }

    return res.status(200).json({
      authorization_url,
      reference,
      amount_usd: amt,
      amount_zar: Number((zarAmountCents/100).toFixed(2)),
    });
  } catch (err) {
    console.error("paystack-create error", err);
    return res.status(500).json({ error: "Could not start Paystack payment" });
  }
}
