// /api/paystack-webhook.js
//
// Paystack webhook — Paystack POSTs here server-to-server after every
// payment event. We verify the HMAC signature, check the event type, then
// update the donations row and increment the mission's (or emergency
// request's, or family need's) raised amount — or log a General Fund
// donation. Reuses the exact same crediting RPCs payfast-notify.js already
// calls (increment_mission_raised, increment_emergency_raised,
// increment_family_need_raised, log_general_fund_donation) — those RPCs
// are payment-provider-agnostic, so nothing about them needed to change.
//
// Required Vercel env vars (same as paystack-create.js):
//   SUPABASE_SERVICE_ROLE_KEY
//   REACT_APP_SUPABASE_URL
//   PAYSTACK_SECRET_KEY
//   SITE_URL
//   ADMIN_NOTIFICATION_EMAIL (optional — falls back to the same address
//     hardcoded as ADMIN_EMAIL in src/AdminPayouts.js)

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "sendmemissionfund@gmail.com";
const SITE_URL     = (process.env.SITE_URL || "https://sendmeglobalmission.org").replace(/\/$/, "");

// Paystack signs the raw request body — need it un-parsed for verification,
// same reasoning as payfast-notify.js's bodyParser:false.
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

// Paystack's signature is HMAC-SHA512 of the raw JSON body, keyed with your
// secret key, sent in the x-paystack-signature header. Simpler than
// PayFast's field-by-field string-building — just hash the raw bytes as-is.
function verifySignature(rawBody, signature) {
  const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  return hash === signature;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["x-paystack-signature"];

    if (!verifySignature(rawBody, signature)) {
      console.error("paystack-webhook: signature mismatch");
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(rawBody);

    // Paystack sends many event types (subscription.create, invoice.create,
    // etc) — only charge.success ever needs to credit anything. Everything
    // else gets acknowledged with 200 and ignored, same "don't block or
    // retry-storm the sender" reasoning as payfast-notify.js's catch-all.
    if (event.event !== "charge.success") {
      return res.status(200).send("OK");
    }

    const { reference, amount: amountCents, metadata, customer, plan, authorization } = event.data;
    const planCode = plan?.plan_code || null;

    const supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Look up the original USD amount and target info recorded at checkout
    // time in paystack-create.js. amountCents here is Paystack's confirmed
    // ZAR amount (in cents) — using it directly to credit `raised` (a USD
    // figure) would inflate every gift by roughly the exchange rate, same
    // reasoning as payfast-notify.js's own donationRow lookup.
    let { data: donationRow, error: fetchError } = await supabase
      .from("donations")
      .select("amount, mission_id, emergency_id, family_need_id, is_general_fund, mission_title, donor_name, donor_email, user_id, type, kind")
      .eq("paystack_reference", reference)
      .maybeSingle();
    if (fetchError) {
      console.error("paystack-webhook: donation lookup by reference failed", reference, fetchError);
    }

    // RENEWAL HANDLING — mirrors payfast-notify.js's token-based renewal
    // logic exactly. The row above is inserted by paystack-create.js at
    // checkout, so it only ever matches the FIRST charge of a subscription.
    // Every renewal (month 2 onward) arrives with a brand-new `reference`
    // that was never in our table, but Paystack always resends the SAME
    // plan_code for every charge on that subscription. So if the reference
    // lookup comes up empty and a plan_code is present, find the original
    // pledge by plan_code instead and record this cycle as a new donation
    // row (one row per month, not one row silently overwritten).
    if (!donationRow && planCode) {
      const { data: subRow, error: subErr } = await supabase
        .from("donations")
        .select("amount, mission_id, emergency_id, family_need_id, is_general_fund, mission_title, donor_name, donor_email, user_id, type, kind")
        .eq("paystack_plan_code", planCode)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (subErr) {
        console.error("paystack-webhook: subscription lookup by plan_code failed", planCode, subErr);
      }
      if (subRow) {
        const { data: renewalRow, error: insertErr } = await supabase
          .from("donations")
          .insert({
            paystack_reference: reference,
            paystack_plan_code: planCode,
            mission_id:      subRow.mission_id,
            emergency_id:    subRow.emergency_id,
            family_need_id:  subRow.family_need_id,
            is_general_fund: subRow.is_general_fund,
            mission_title: subRow.mission_title,
            amount:        subRow.amount,
            donor_name:    subRow.donor_name,
            donor_email:   subRow.donor_email,
            user_id:       subRow.user_id,
            type:          subRow.type,
            kind:          subRow.kind,
            status:        "pending",
          })
          .select("amount, mission_id, emergency_id, family_need_id, is_general_fund, mission_title, donor_name, donor_email, user_id, type, kind")
          .single();
        if (insertErr) {
          console.error("paystack-webhook: renewal donation insert failed", insertErr);
        }
        donationRow = renewalRow;
      } else {
        console.error("paystack-webhook: no subscription found for plan_code — cannot attribute renewal charge", planCode, reference);
      }
    }

    const usdAmount = donationRow?.amount ?? null;
    const creditAmount = usdAmount ?? Number(amountCents) / 100;

    // Update the donations row — keep the original USD `amount` untouched.
    const { error: updateError } = await supabase
      .from("donations")
      .update({
        status: "complete",
        paystack_authorization_code: authorization?.authorization_code || null,
        updated_at: new Date().toISOString(),
      })
      .eq("paystack_reference", reference);
    if (updateError) {
      console.error("paystack-webhook: failed to update donation row", updateError);
      return res.status(200).send("OK");
    }

    const kind = donationRow?.kind || metadata?.kind || "mission";
    const isFamilyNeed  = kind === "family_need";
    const isEmergency   = kind === "emergency";
    const isGeneralFund = kind === "general_fund";
    const targetId = donationRow
      ? (isFamilyNeed ? donationRow.family_need_id : isEmergency ? donationRow.emergency_id : donationRow.mission_id)
      : metadata?.target_id;

    let notifyTitle = null, notifyRaised = null, notifyGoal = null, notifyPath = "/";

    if (isGeneralFund) {
      const { error: rpcError } = await supabase.rpc("log_general_fund_donation", {
        p_amount: creditAmount,
        p_donor_name: donationRow?.donor_name || customer?.first_name || null,
        p_donor_email: donationRow?.donor_email || customer?.email || null,
      });
      if (rpcError) console.error("paystack-webhook: log_general_fund_donation failed", rpcError);
      notifyTitle = "the SendMe General Fund";
      notifyPath  = "/general-fund";
    } else if (isFamilyNeed && targetId) {
      const { error: rpcError } = await supabase.rpc("increment_family_need_raised", { p_need_id: targetId, p_amount: creditAmount });
      if (rpcError) console.error("paystack-webhook: increment_family_need_raised failed", rpcError);

      const { data: needRow } = await supabase.from("family_needs").select("category, city, country, raised, goal").eq("id", targetId).maybeSingle();
      notifyTitle  = needRow ? `${needRow.category || "Family"} need — ${needRow.city || needRow.country || ""}`.trim() : null;
      notifyRaised = needRow?.raised ?? null;
      notifyGoal   = needRow?.goal   ?? null;
      notifyPath   = "/family-in-need";
    } else if (isEmergency && targetId) {
      const { error: rpcError } = await supabase.rpc("increment_emergency_raised", { p_emergency_id: targetId, p_amount: creditAmount });
      if (rpcError) console.error("paystack-webhook: increment_emergency_raised failed", rpcError);

      const { data: emRow } = await supabase.from("emergency_requests").select("title, raised, goal").eq("id", targetId).maybeSingle();
      notifyTitle  = emRow?.title  ?? null;
      notifyRaised = emRow?.raised ?? null;
      notifyGoal   = emRow?.goal   ?? null;
      notifyPath   = "/emergency";
    } else if (targetId) {
      const { error: rpcError } = await supabase.rpc("increment_mission_raised", { p_mission_id: targetId, p_amount: creditAmount });
      if (rpcError) console.error("paystack-webhook: increment_mission_raised failed", rpcError);

      const { error: ledgerError } = await supabase.from("mission_ledger").insert({
        mission_id: targetId,
        amount: creditAmount,
        description: `Donation via Paystack (${reference})`,
        category: "donation",
        donor_name: donationRow?.donor_name || customer?.first_name || null,
        donor_email: donationRow?.donor_email || customer?.email || null,
        user_id: donationRow?.user_id || null,
      });
      if (ledgerError) console.error("paystack-webhook: ledger insert failed", ledgerError);

      const { data: missionRow } = await supabase.from("missions").select("title, raised, goal").eq("id", targetId).maybeSingle();
      notifyTitle  = missionRow?.title  ?? null;
      notifyRaised = missionRow?.raised ?? null;
      notifyGoal   = missionRow?.goal   ?? null;
      notifyPath   = `/mission/${targetId}`;
    }

    const notifyData = {
      amount:      creditAmount,
      missionTitle: notifyTitle || (isGeneralFund ? "a General Fund gift" : isFamilyNeed ? "a Family In Need gift" : isEmergency ? "an emergency request" : "a mission"),
      donorName:   donationRow?.donor_name  || customer?.first_name || null,
      donorEmail:  donationRow?.donor_email || customer?.email      || null,
      isGuest:     !(donationRow?.user_id),
      totalRaised: notifyRaised,
      goal:        notifyGoal,
      missionUrl:  `${SITE_URL}${notifyPath}`,
    };

    try {
      const { error: notifyError } = await supabase.functions.invoke("send-notification", {
        body: { type: "donation_received", to: ADMIN_EMAIL, data: notifyData },
      });
      if (notifyError) console.error("paystack-webhook: admin donation-received email failed", notifyError);
    } catch (notifyErr) {
      console.error("paystack-webhook: admin donation-received email threw", notifyErr);
    }

    try {
      const { error: waError } = await supabase.functions.invoke("notify-admin", {
        body: { type: "donation_received", data: notifyData },
      });
      if (waError) console.error("paystack-webhook: admin donation-received WhatsApp failed", waError);
    } catch (waErr) {
      console.error("paystack-webhook: admin donation-received WhatsApp threw", waErr);
    }

    console.log("paystack-webhook: processed", { reference, kind, targetId, creditAmount, planCode: planCode || null });
    return res.status(200).send("OK");
  } catch (err) {
    // Catch-all so an unexpected error never surfaces as a raw 500 to
    // Paystack — log it for investigation and return 200 so Paystack
    // doesn't endlessly retry a notification we've already partially
    // processed.
    console.error("paystack-webhook: unexpected error", err);
    return res.status(200).send("OK");
  }
}
