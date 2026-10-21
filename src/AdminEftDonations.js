// Admin → EFT Donations: bank-transfer gifts that donors registered. Nothing is credited until you
// confirm the money has actually arrived in the bank account (see eft-donations.sql).
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { sendNotification } from "./notifications";

const money2 = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KIND = { mission: "Mission", emergency: "Emergency request", family_need: "Family in need", general_fund: "General Fund" };
const ago = (iso) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function AdminEftDonations({ onBack }) {
  const [rows, setRows]       = useState(null);   // null = loading
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter]   = useState("awaiting");
  const [amounts, setAmounts] = useState({});     // { [id]: string } — the amount that actually arrived
  const [notes, setNotes]     = useState({});     // { [id]: string }
  const [busyId, setBusyId]   = useState(null);
  const [error, setError]     = useState("");
  const [notice, setNotice]   = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const { data, error: err } = await supabase.from("eft_donations").select("*").order("created_at", { ascending: false }).limit(500);
    if (err) {
      setRows([]);
      setLoadError("Could not load bank-transfer gifts. " + (err.message || "") + "  If this says the table does not exist, run eft-donations.sql in Supabase first.");
      return;
    }
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const confirm = async (r) => {
    const amt = Number(amounts[r.id] ?? r.amount_usd);
    if (!(amt > 0)) { setError("Enter the amount that actually arrived (in USD)."); return; }
    const ok = window.confirm(
      `Confirm that the money has ARRIVED in the bank account?\\n\\n` +
      `Reference: ${r.reference}\\nFrom: ${r.donor_name}\\nFor: ${r.target_title || KIND[r.kind]}\\nAmount to credit: $${money2(amt)} (promised: $${money2(r.amount_usd)})\\n\\n` +
      `The gift is credited immediately and the donor is emailed. This cannot be undone.`
    );
    if (!ok) return;
    setBusyId(r.id); setError(""); setNotice("");
    try {
      const { data, error: rpcError } = await supabase.rpc("confirm_eft_donation", { p_id: r.id, p_amount_usd: amt, p_notes: (notes[r.id] || "").trim() || null });
      if (rpcError) throw rpcError;
      sendNotification("eft_donation_confirmed", r.donor_email, {
        donorName: r.donor_name, reference: r.reference, amount: data.amount_usd,
        target: r.target_title || KIND[r.kind], siteUrl: window.location.origin + "/",
      });
      setNotice(`✓ $${money2(data.amount_usd)} credited to "${r.target_title || KIND[r.kind]}" and ${r.donor_name} was emailed.`);
      await load();
    } catch (e) {
      setError("Could not confirm this gift. (" + (e.message || "") + ")");
    }
    setBusyId(null);
  };

  const cancel = async (r) => {
    if (!window.confirm(`Mark ${r.reference} (${r.donor_name}, $${money2(r.amount_usd)}) as NOT received / cancelled?\\n\\nNothing is credited. This cannot be undone.`)) return;
    setBusyId(r.id); setError(""); setNotice("");
    try {
      const { error: rpcError } = await supabase.rpc("cancel_eft_donation", { p_id: r.id, p_notes: (notes[r.id] || "").trim() || null });
      if (rpcError) throw rpcError;
      setNotice(`${r.reference} was marked as cancelled.`);
      await load();
    } catch (e) {
      setError("Could not cancel this gift. (" + (e.message || "") + ")");
    }
    setBusyId(null);
  };

  const list = (rows || []);
  const awaiting = list.filter(r => r.status === "awaiting");
  const shown = filter === "all" ? list : list.filter(r => r.status === filter);
  const totalConfirmed = list.filter(r => r.status === "confirmed").reduce((a, r) => a + Number(r.confirmed_amount_usd || 0), 0);
  const badge = (s) => s === "confirmed" ? ["✓ Confirmed", "#3ecf8e"] : s === "cancelled" ? ["Cancelled", "rgba(255,255,255,0.4)"] : ["⏳ Awaiting transfer", "#e8b34b"];

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🏦 EFT Donations</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>BANK-TRANSFER GIFTS · CONFIRM WHEN THE MONEY ARRIVES</div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 16 }}>
          A donor registers a bank-transfer gift and gets a reference (like SM-4F9A2C). Look for that reference in your bank statement. Only when the money has arrived, press <strong style={{ color: "#eef1ff" }}>Money arrived</strong>: the gift is then credited, once, and the donor is emailed. Enter the amount that actually arrived — it can differ from what they promised.
        </div>

        {error && <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f05252" }}>⚠ {error}</div>}
        {notice && <div style={{ background: "rgba(62,207,142,0.1)", border: "1px solid rgba(62,207,142,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#3ecf8e" }}>{notice}</div>}
        {loadError && <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f05252" }}>⚠ {loadError}</div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {[["awaiting", `⏳ Awaiting (${awaiting.length})`], ["confirmed", "✓ Confirmed"], ["cancelled", "Cancelled"], ["all", "All"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${filter === key ? "#e8b34b" : "rgba(255,255,255,0.12)"}`, background: filter === key ? "rgba(232,179,75,0.12)" : "transparent", color: filter === key ? "#e8b34b" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif" }}>
              {label}
            </button>
          ))}
        </div>
        {totalConfirmed > 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Total confirmed by bank transfer: <strong style={{ color: "#3ecf8e" }}>${money2(totalConfirmed)}</strong></div>}

        {rows === null ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)" }}>Loading...</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14, lineHeight: 1.7 }}>
            {filter === "awaiting" ? "🏦 No bank transfers are waiting right now." : "Nothing here yet."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {shown.map(r => {
              const [badgeText, badgeColor] = badge(r.status);
              const busy = busyId === r.id;
              return (
                <div key={r.id} style={{ background: "#0c1628", borderRadius: 14, border: `1px solid ${r.status === "awaiting" ? "rgba(232,179,75,0.35)" : "rgba(255,255,255,0.08)"}`, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 1.5, color: "#e8b34b" }}>{r.reference}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>registered {ago(r.created_at)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: badgeColor }}>{badgeText}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>${money2(r.status === "confirmed" ? r.confirmed_amount_usd : r.amount_usd)}</div>
                      {r.status === "confirmed" && Number(r.confirmed_amount_usd) !== Number(r.amount_usd) && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>promised ${money2(r.amount_usd)}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
                    <strong style={{ color: "#eef1ff" }}>{r.donor_name}</strong>{r.donor_country ? ` · ${r.donor_country}` : ""}<br />
                    <span style={{ color: "rgba(255,255,255,0.45)", wordBreak: "break-all" }}>{r.donor_email}</span><br />
                    For: {KIND[r.kind] || r.kind}{r.target_title ? ` — ${r.target_title}` : ""}{r.sending_currency ? ` · sending in ${r.sending_currency}` : ""}
                  </div>
                  {r.status !== "awaiting" && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8, lineHeight: 1.6 }}>
                      {r.status === "confirmed" ? "Confirmed" : "Cancelled"} {r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}{r.confirmed_by ? ` by ${r.confirmed_by}` : ""}
                      {r.admin_notes ? <><br />Note: {r.admin_notes}</> : null}
                    </div>
                  )}
                  {r.status === "awaiting" && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                        <div style={{ flex: "1 1 150px" }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Amount that arrived (USD)</div>
                          <input type="number" min="0" step="0.01" value={amounts[r.id] ?? String(r.amount_usd)} onChange={e => setAmounts(a => ({ ...a, [r.id]: e.target.value }))}
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: "2 1 220px" }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Note (optional)</div>
                          <input value={notes[r.id] || ""} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} placeholder="e.g. arrived 20 Oct, bank fee taken"
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", outline: "none", boxSizing: "border-box" }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => confirm(r)} disabled={busy}
                          style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#3ecf8e,#2aaf74)", color: "#000", fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer", fontFamily: "Georgia, serif", opacity: busy ? 0.6 : 1 }}>
                          {busy ? "Saving..." : "✓ Money arrived — credit it"}
                        </button>
                        <button onClick={() => cancel(r)} disabled={busy}
                          style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(255,255,255,0.55)", cursor: busy ? "default" : "pointer", fontSize: 13, fontFamily: "Georgia, serif" }}>
                          Never arrived / cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
