// "Give by bank transfer (EFT / SWIFT)" — a second way to give that sits right under the card button on
// every donate screen (no card needed; works from anywhere, and for donors whose card is declined — for
// example an international card that the bank blocks). The donor registers the gift, gets a unique
// reference to put on the transfer, and the admin is told. Nothing is credited until the admin confirms the money
// has arrived (Admin → EFT Donations). See eft-donations.sql.
import { useState } from "react";
import { supabase } from "./supabase";
import { sendNotification, notifyAdmin } from "./notifications";
import { EFT_DETAILS, eftConfigured } from "./eftDetails";

const ADMIN_INBOX = "sendmemissionfund@gmail.com";
const field = { width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", outline: "none", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, display: "block" };

export default function EftGiving({ kind = "mission", targetId = null, targetTitle = "", user = null, defaultAmount = "", defaultName = "", defaultEmail = "", accent = "#e8b34b" }) {
  const [open, setOpen]       = useState(false);
  // The name, email and amount follow what the donor has already typed on the donate page above,
  // until they edit them here (then what they typed here wins).
  const [nameEdit, setNameEdit]     = useState(null);
  const [emailEdit, setEmailEdit]   = useState(null);
  const [amountEdit, setAmountEdit] = useState(null);
  const name   = nameEdit   ?? (user?.user_metadata?.full_name || defaultName || "");
  const email  = emailEdit  ?? (user?.email || defaultEmail || "");
  const amount = amountEdit ?? (defaultAmount ? String(defaultAmount) : "");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");
  const [result, setResult]   = useState(null);   // { reference, amount, currency } once registered
  const [copied, setCopied]   = useState("");

  const copy = async (key, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1800); }
    catch { window.prompt("Copy this:", text); }
  };

  const submit = async () => {
    setError("");
    const amt = Number(amount);
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (!(amt >= 1)) return setError("Please enter the amount you plan to give, in US dollars.");
    setBusy(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("submit_eft_donation", {
        p_kind: kind,
        p_target_id: kind === "general_fund" ? null : targetId,
        p_target_title: targetTitle || null,
        p_name: name.trim(),
        p_email: email.trim(),
        p_country: country.trim() || null,
        p_amount: amt,
        p_currency: currency,
      });
      if (rpcError) throw rpcError;
      setResult({ reference: data.reference, amount: amt, currency });
      const info = {
        reference: data.reference, donorName: name.trim(), donorEmail: email.trim(), donorCountry: country.trim() || null,
        amount: amt, currency, target: data.target_title || targetTitle || "SendMe", adminUrl: window.location.origin + "/",
      };
      sendNotification("eft_donation_reported", ADMIN_INBOX, info);   // fire and forget
      notifyAdmin("eft_reported", info);
    } catch (e) {
      const msg = e?.message || "";
      setError(/could not find the function|does not exist|schema cache/i.test(msg)
        ? "Bank transfer isn't available just yet — please tap the green WhatsApp button and we'll help you."
        : (msg || "Something went wrong — please try again."));
    }
    setBusy(false);
  };

  const D = EFT_DETAILS;
  const detailRows = [
    ["Account holder", D.accountHolder], ["Bank", D.bankName], ["Account number", D.accountNumber, true],
    ["Account type", D.accountType], ["Branch code", D.branchCode], ["Branch name", D.branchName], ["SWIFT / BIC", D.swiftCode, true], ["Bank country", D.bankCountry], ["Bank address", D.bankAddress],
  ].filter(([, v]) => v && String(v).trim());

  return (
    <div>
      {/* "or" divider: this sits directly under the card button as the second way to give */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 14px" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
      </div>
    <div style={{ borderRadius: 14, border: `1px solid ${accent}66`, background: open ? "rgba(255,255,255,0.02)" : `${accent}0d` }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", color: "rgba(255,255,255,0.75)", fontFamily: "Georgia, serif", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#eef1ff" }}>🏦 Give by bank transfer (EFT / SWIFT)</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>No card needed — works from anywhere in the world</span>
        </span>
        <span style={{ color: accent }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
            Send your gift straight from your bank — no card needed, and it works from anywhere in the world. (Card payments are charged in South African Rand, which some banks block as an international payment.)
          </div>

          {!eftConfigured() ? (
            <div style={{ fontSize: 13, color: "#e8b34b", lineHeight: 1.7, background: "rgba(232,179,75,0.07)", border: "1px solid rgba(232,179,75,0.25)", borderRadius: 10, padding: "12px 14px" }}>
              To give by bank transfer, tap the green WhatsApp button on this page and we'll send you our bank details.
            </div>
          ) : !result ? (
            <>
              <div><label style={lbl}>Your name</label><input value={name} onChange={e => setNameEdit(e.target.value)} placeholder="Full name" style={field} /></div>
              <div><label style={lbl}>Email (we'll confirm here when your gift arrives)</label><input type="email" value={email} onChange={e => setEmailEdit(e.target.value)} placeholder="you@example.com" style={field} /></div>
              <div><label style={lbl}>Country (optional)</label><input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. United States" style={field} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Amount (USD)</label><input type="number" min="1" inputMode="decimal" value={amount} onChange={e => setAmountEdit(e.target.value)} placeholder="100" style={field} /></div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>I will send in</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...field, colorScheme: "dark" }}>
                    {["USD", "ZAR", "EUR", "GBP", "Other"].map(c => <option key={c} value={c} style={{ background: "#0c1628" }}>{c}</option>)}
                  </select>
                </div>
              </div>
              {error && <div style={{ fontSize: 13, color: "#e85b5b" }}>{error}</div>}
              <button onClick={submit} disabled={busy}
                style={{ padding: "13px 0", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${accent},${accent}cc)`, color: "#000", fontWeight: 700, fontSize: 15, cursor: busy ? "default" : "pointer", fontFamily: "Georgia, serif", opacity: busy ? 0.7 : 1 }}>
                {busy ? "Please wait…" : "Get my transfer reference"}
              </button>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
                You'll get a reference to put on your transfer. Your gift is added to the mission once we confirm the money has arrived in our bank account.
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: "center", background: `${accent}14`, border: `1px solid ${accent}55`, borderRadius: 12, padding: "14px 12px" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase" }}>Your transfer reference</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: accent, letterSpacing: 2, margin: "4px 0" }}>{result.reference}</div>
                <button onClick={() => copy("ref", result.reference)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" }}>
                  {copied === "ref" ? "✓ Copied" : "Copy reference"}
                </button>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
                <strong style={{ color: "#eef1ff" }}>1.</strong> Send <strong style={{ color: accent }}>{result.currency === "Other" ? "" : result.currency + " "}{result.amount}{result.currency === "USD" ? " (USD)" : ""}</strong> to the account below.<br />
                <strong style={{ color: "#eef1ff" }}>2.</strong> Put the reference <strong style={{ color: accent }}>{result.reference}</strong> in the payment description, exactly as shown.<br />
                <strong style={{ color: "#eef1ff" }}>3.</strong> Keep your bank's proof of payment. When your gift arrives we'll confirm it by email.
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "6px 14px" }}>
                {detailRows.map(([label, value, copyable]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                    <span style={{ color: "#eef1ff", fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>
                      {value}
                      {copyable && (
                        <button onClick={() => copy(label, value)} style={{ marginLeft: 8, background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11, fontFamily: "Georgia, serif" }}>
                          {copied === label ? "✓" : "Copy"}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
                Your bank may charge a transfer fee — we credit the amount that actually arrives. {D.note}
                <br />Take a screenshot of this page so you have the reference and details.
              </div>
            </>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
