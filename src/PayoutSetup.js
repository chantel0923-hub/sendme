// PayoutSetup.js — Banking details form for approved missionaries/churches
import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";

const inputStyle = {
  width: "100%", padding: "13px 15px", borderRadius: 12,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#eef1ff", fontSize: 14, fontFamily: "Georgia, serif", outline: "none",
  boxSizing: "border-box", marginBottom: 14,
};
const labelStyle = {
  fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6, display: "block",
};

export default function PayoutSetup({ onBack }) {
  const [missions, setMissions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({
    recipient_name: "",
    recipient_type: "missionary",
    bank_name: "",
    account_holder: "",
    account_number: "",
    branch_code: "",
    account_type: "cheque",
    country: "South Africa",
    swift_code: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("missions")
        .select("id, title, missionary_role, city, country")
        .order("created_at", { ascending: false });
      setMissions(data || []);
    };
    load();
  }, []);

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const submit = async () => {
    setError("");
    if (!selectedId) { setError("Please select your mission first."); return; }
    if (!form.recipient_name || !form.bank_name || !form.account_holder || !form.account_number) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const { error: dbError } = await supabase
        .from("payout_details")
        .upsert({ mission_id: selectedId, ...form, updated_at: new Date().toISOString() },
                { onConflict: "mission_id" });
      if (dbError) throw dbError;
      setDone(true);
    } catch (e) {
      setError("Something went wrong saving your details. Please try again or contact SendMe support.");
    }
    setSaving(false);
  };

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Banking Details Saved</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 24 }}>
            Thank you, brother/sister. Your payout details have been securely recorded.
            When your mission reaches a funding milestone, SendMe will transfer the
            released funds to this account.
          </div>
          <button onClick={onBack} style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 15, fontFamily: "Georgia, serif" }}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14 }}>Back</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Payout / Banking Details</span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ background: "rgba(232,179,75,0.07)", borderRadius: 14, border: "1px solid rgba(232,179,75,0.2)", padding: "16px 18px", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
          🔐 This information is used only to send your mission's released funds to you.
          It is kept private and is never shown publicly on SendMe.
        </div>

        <label style={labelStyle}>Select Your Mission *</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={inputStyle}>
          <option value="">— Select your mission —</option>
          {missions.map(m => (
            <option key={m.id} value={m.id}>
              {m.title || "Untitled"} — {m.missionary_role || "Missionary"} ({m.city || m.country || "Unknown"})
            </option>
          ))}
        </select>

        <label style={labelStyle}>Full Name (Account Holder Name as on bank account) *</label>
        <input style={inputStyle} value={form.recipient_name} onChange={e => update("recipient_name", e.target.value)} placeholder="e.g. Samuel Osei" />

        <label style={labelStyle}>I am receiving funds as a *</label>
        <select value={form.recipient_type} onChange={e => update("recipient_type", e.target.value)} style={inputStyle}>
          <option value="missionary">Missionary / Individual</option>
          <option value="church">Church / Organisation</option>
        </select>

        <label style={labelStyle}>Bank Name *</label>
        <input style={inputStyle} value={form.bank_name} onChange={e => update("bank_name", e.target.value)} placeholder="e.g. Standard Bank, Capitec, FNB" />

        <label style={labelStyle}>Account Holder Name (as registered with bank) *</label>
        <input style={inputStyle} value={form.account_holder} onChange={e => update("account_holder", e.target.value)} placeholder="Exact name on the bank account" />

        <label style={labelStyle}>Account Number *</label>
        <input style={inputStyle} value={form.account_number} onChange={e => update("account_number", e.target.value)} placeholder="Account number" />

        <label style={labelStyle}>Branch Code (if applicable)</label>
        <input style={inputStyle} value={form.branch_code} onChange={e => update("branch_code", e.target.value)} placeholder="e.g. 051001" />

        <label style={labelStyle}>Account Type</label>
        <select value={form.account_type} onChange={e => update("account_type", e.target.value)} style={inputStyle}>
          <option value="cheque">Cheque / Current</option>
          <option value="savings">Savings</option>
        </select>

        <label style={labelStyle}>Country</label>
        <input style={inputStyle} value={form.country} onChange={e => update("country", e.target.value)} placeholder="Country of bank account" />

        <label style={labelStyle}>SWIFT / IBAN (for international transfers, if applicable)</label>
        <input style={inputStyle} value={form.swift_code} onChange={e => update("swift_code", e.target.value)} placeholder="Only needed for international payouts" />

        <label style={labelStyle}>Additional Notes (optional)</label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Anything else SendMe should know about receiving your payout" />

        {error && (
          <div style={{ background: "rgba(232,91,91,0.1)", border: "1px solid rgba(232,91,91,0.3)", borderRadius: 10, padding: "10px 14px", color: "#e85b5b", fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={saving}
          style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none",
            background: saving ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#e8b34b,#c8942b)",
            color: saving ? "rgba(255,255,255,0.3)" : "#000", fontWeight: 700,
            cursor: saving ? "default" : "pointer", fontSize: 16, fontFamily: "Georgia, serif" }}>
          {saving ? "Saving..." : "Save Banking Details"}
        </button>
      </div>
    </div>
  );
}
