// ── PAYSTACK CLIENT HELPER ────────────────────────────────────────────────
// Calls our serverless /api/paystack-create endpoint to initialize a
// Paystack transaction, stashes a note of what we're paying for in
// sessionStorage (so the return screen can show a friendly amount), then
// redirects the browser straight to Paystack's hosted checkout URL.
//
// Simpler than payfast.js's submitPayfastForm — Paystack's Initialize
// Transaction API hands back a ready-made checkout URL, so there's no
// hidden form to build and POST, just a redirect.
//
// The real confirmation of payment happens server-side via the Paystack
// webhook in /api/paystack-webhook.js — this file only handles the redirect.

async function initAndRedirect(payload, sessionKey) {
  try {
    sessionStorage.setItem("sendme_pending_donation", JSON.stringify(sessionKey));
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing) — non-fatal
  }

  const res = await fetch("/api/paystack-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Could not start Paystack payment";
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }

  const { authorization_url } = await res.json();
  window.location.href = authorization_url;
}

export async function startPaystackDonation({ mission, amount, user, type = "once", guestInfo = null }) {
  if (!mission) throw new Error("No mission selected");
  const email = guestInfo?.email || user?.email;
  if (!email) throw new Error("An email address is required to give via Paystack");

  await initAndRedirect({
    mission_id: mission.id,
    mission_title: mission.protected ? mission.role : (mission.title || mission.name),
    amount,
    name: guestInfo?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "SendMe Donor",
    email,
    user_id: user?.id || null,
    type,
  }, { mission_id: mission.id, amount });
}

export async function startPaystackEmergencyDonation({ emergency, amount, user }) {
  if (!emergency) throw new Error("No emergency request selected");
  const email = user?.email;
  if (!email) throw new Error("An email address is required to give via Paystack");

  await initAndRedirect({
    emergency_id: emergency.id,
    emergency_title: emergency.title,
    amount,
    name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "SendMe Donor",
    email,
    user_id: user?.id || null,
    kind: "emergency",
  }, { mission_id: emergency.id, amount });
}

export async function startPaystackFamilyNeedDonation({ need, amount, user, guestInfo = null }) {
  if (!need) throw new Error("No family need selected");
  const email = guestInfo?.email || user?.email;
  if (!email) throw new Error("An email address is required to give via Paystack");

  await initAndRedirect({
    family_need_id: need.id,
    family_need_title: `${need.category || "Family"} need — ${need.city || need.country || ""}`.trim(),
    amount,
    name: guestInfo?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "SendMe Donor",
    email,
    user_id: user?.id || null,
    kind: "family_need",
  }, { mission_id: need.id, amount });
}

export async function startPaystackGeneralFundDonation({ amount, user, guestInfo = null }) {
  const email = guestInfo?.email || user?.email;
  if (!email) throw new Error("An email address is required to give via Paystack");

  await initAndRedirect({
    amount,
    name: guestInfo?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "SendMe Donor",
    email,
    user_id: user?.id || null,
    kind: "general_fund",
  }, { mission_id: null, amount, general_fund: true });
}
