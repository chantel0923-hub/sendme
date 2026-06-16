// ── PAYFAST CLIENT HELPER ─────────────────────────────────────────────────────
// Calls our serverless /api/payfast-create endpoint to get a signed PayFast
// payment payload, stashes a note of what we're paying for in sessionStorage
// (so the return screen can show a friendly amount), then builds and submits
// a hidden form that redirects the browser to PayFast's hosted checkout.
//
// The real confirmation of payment happens server-side via the PayFast ITN
// webhook in /api/payfast-notify.js — this file only handles the redirect.

export async function startPayfastDonation({ mission, amount, user, type = "once" }) {
  if (!mission) throw new Error("No mission selected");

  const payload = {
    mission_id: mission.id,
    mission_title: mission.protected ? mission.role : (mission.title || mission.name),
    amount,
    name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "SendMe Donor",
    email: user?.email || "",
    user_id: user?.id || null,
    type,
  };

  try {
    sessionStorage.setItem(
      "sendme_pending_donation",
      JSON.stringify({ mission_id: mission.id, amount })
    );
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing) — non-fatal
  }

  const res = await fetch("/api/payfast-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Could not start PayFast payment";
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }

  const { action, fields } = await res.json();

  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";

  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
