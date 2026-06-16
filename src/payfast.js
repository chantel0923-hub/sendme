// ── PAYFAST CLIENT HELPER (TEMPORARY DEBUG VERSION) ────────────────────────
// This version pauses before redirecting and shows an alert with the
// signature debug info, so it can be read without racing the page redirect.
// Once the signature issue is fixed, restore the original payfast.js.

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

  const result = await res.json();
  const { action, fields, _debug_signature_string, _debug_passphrase_set } = result;

  // TEMPORARY DEBUG — pause and show the signature info before redirecting
  console.log("=== PAYFAST DEBUG ===");
  console.log("Signature string:", _debug_signature_string);
  console.log("Passphrase set:", _debug_passphrase_set);
  console.log("Fields:", fields);

  window.alert(
    "DEBUG INFO (copy this):\n\n" +
    "Signature string:\n" + _debug_signature_string + "\n\n" +
    "Passphrase set: " + _debug_passphrase_set + "\n\n" +
    "Signature hash: " + fields.signature
  );
  // Remove the line below (or comment it out) to stop the redirect entirely
  // while you copy the debug info, then refresh and try again without it.
  // return;

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
