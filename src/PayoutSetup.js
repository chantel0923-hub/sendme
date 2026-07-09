// PayoutSetup.js — Banking details form for missionaries AND churches/pastors
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

export default function PayoutSetup({ onBack, user }) {
  const [missions, setMissions]   = useState([]);
  const [myChurch, setMyChurch]   = useState(null);
  const [churchList, setChurchList] = useState([]); // #68: verified churches a missionary can route payout through
  const [selectedChurchId, setSelectedChurchId] = useState("");
  const [mode, setMode]           = useState(""); // "missionary" | "church"
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
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState("");

  // #68: true only when a missionary (not a pastor on their own church's flow)
  // has chosen to receive funds via a church's own registered banking.
  const receivingViaChurch = mode !== "church" && form.recipient_type === "church";

  useEffect(() => {
    const load = async () => {
      const { data: missionData } = await supabase
        .from("missions")
        .select("id, title, missionary_role, city, country")
        .order("created_at", { ascending: false });
      setMissions(missionData || []);

      // #68: real list of verified churches, for the missionary "receiving as a church" flow
      const { data: verifiedChurches } = await supabase
        .from("churches")
        .select("id, name, city, country")
        .eq("verified", true)
        .order("name", { ascending: true });
      setChurchList(verifiedChurches || []);

      // Check if logged-in user is a pastor with a church
      if (user?.id) {
        const { data: churchData } = await supabase
          .from("churches")
          .select("id, name, city, country")
          .eq("user_id", user.id)
          .single();
        if (churchData) {
          setMyChurch(churchData);
          // Check if banking already saved for this church
          const { data: existing } = await supabase
            .from("payout_details")
            .select("id, recipient_name, bank_name, account_number")
            .eq("church_id", churchData.id)
            .single();
          if (existing) {
            setForm(f => ({
              ...f,
              recipient_name: existing.recipient_name || "",
              bank_name: existing.bank_name || "",
              account_holder: existing.account_holder || "",
              account_number: existing.account_number || "",
              branch_code: existing.branch_code || "",
              account_type: existing.account_type || "cheque",
              country: existing.country || "South Africa",
              swift_code: existing.swift_code || "",
              notes: existing.notes || "",
              recipient_type: "church",
            }));
          }
        }
      }
    };
    load();
  }, [user]);

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const submit = async () => {
    setError("");

    if (mode === "missionary" && !selectedId) {
      setError("Please select your mission first."); return;
    }

    if (receivingViaChurch) {
      if (!selectedChurchId) { setError("Please select the church that will receive your funds."); return; }
    } else {
      if (!form.recipient_name.trim()) { setError("Please enter the full name of the account holder."); return; }
      if (!form.bank_name.trim())      { setError("Please enter your bank name."); return; }
      if (!form.account_holder.trim()) { setError("Please enter the account holder name."); return; }
      if (!form.account_number.trim()) { setError("Please enter your account number."); return; }
    }

    setSaving(true);
    try {
      let dbError;
      if (mode === "church" && myChurch) {
        ({ error: dbError } = await supabase
          .from("payout_details")
          .upsert({
            church_id:      myChurch.id,
            mission_id:     null,
            recipient_type: "church",
            ...form,
            updated_at: new Date().toISOString(),
          }, { onConflict: "church_id" }));
      } else if (receivingViaChurch) {
        // #68: link the MISSION itself to the chosen church. AdminPayouts'
        // getBankingDetails() resolves banking via mission.church_id first,
        // falling back to churchDetails[mission.church_id] (the church's own
        // payout_details row) — same mechanism already used when a missionary
        // links to a church at application time. No payout_details row is
        // written here; the church's own banking (set up via the "church"
        // mode above) is what actually gets used.
        ({ error: dbError } = await supabase
          .from("missions")
          .update({ church_id: selectedChurchId })
          .eq("id", selectedId));
      } else {
        ({ error: dbError } = await supabase
          .from("payout_details")
          .upsert({
            mission_id: selectedId,
            ...form,
            updated_at: new Date().toISOString(),
          }, { onConflict: "mission_id" }));
      }
      if (dbError) throw dbError;
      setDone(true);
    } catch (e) {
      const msg = e?.message || e?.details || "Please try again or contact SendMe support.";
      setError("Could not save banking details: " + msg);
      console.error("PayoutSetup error:", e);
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

  // Mode selection screen — shown if user has a church AND missions
  if (!mode && myChurch) return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14 }}>Back</button>
        <span style={{ fontSize:18, fontWeight:700 }}>Payout / Banking Details</span>
      </div>
      <div style={{ maxWidth:520, margin:"0 auto", padding:"48px 20px" }}>
        <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:8 }}>Who are you setting up banking for?</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:28 }}>Select the account you want to receive SendMe payouts.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div onClick={() => setMode("church")} style={{ background:"rgba(232,179,75,0.07)", borderRadius:16, border:"1px solid rgba(232,179,75,0.3)", padding:"20px 22px", cursor:"pointer" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#e8b34b", marginBottom:4 }}>⛪ {myChurch.name}</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Set up banking for my church — {myChurch.city}, {myChurch.country}</div>
          </div>
          <div onClick={() => setMode("missionary")} style={{ background:"rgba(255,255,255,0.03)", borderRadius:16, border:"1px solid rgba(255,255,255,0.1)", padding:"20px 22px", cursor:"pointer" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:4 }}>✝ Missionary Mission</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Set up banking for one of my missionary missions</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={mode ? () => setMode("") : onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14 }}>Back</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>
          {mode === "church" ? `⛪ ${myChurch?.name} — Banking` : "Payout / Banking Details"}
        </span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ background: "rgba(232,179,75,0.07)", borderRadius: 14, border: "1px solid rgba(232,179,75,0.2)", padding: "16px 18px", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
          🔐 This information is used only to send released funds to you.
          It is kept strictly private and never shown publicly on SendMe.
        </div>

        {mode !== "church" && (<>
        <label style={labelStyle}>Select Your Mission *</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={inputStyle}>
          <option value="">— Select your mission —</option>
          {missions.map(m => (
            <option key={m.id} value={m.id}>
              {m.title || "Untitled"} — {m.missionary_role || "Missionary"} ({m.city || m.country || "Unknown"})
            </option>
          ))}
        </select>
        </>)}

        <label style={labelStyle}>Full Name (Account Holder Name as on bank account) *</label>
        <input style={inputStyle} value={form.recipient_name} onChange={e => update("recipient_name", e.target.value)} placeholder="e.g. Samuel Osei" />

        <label style={labelStyle}>I am receiving funds as a *</label>
        <select value={form.recipient_type} onChange={e => update("recipient_type", e.target.value)} style={inputStyle}>
          <option value="missionary">Missionary / Individual</option>
          <option value="church">Church / Organisation</option>
        </select>

        {receivingViaChurch ? (
          <>
            <label style={labelStyle}>Select the Church *</label>
            <select value={selectedChurchId} onChange={e => setSelectedChurchId(e.target.value)} style={inputStyle}>
              <option value="">— Select a verified church —</option>
              {churchList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city || c.country || "Unknown"})
                </option>
              ))}
            </select>
            <div style={{ background: "rgba(232,179,75,0.07)", borderRadius: 12, border: "1px solid rgba(232,179,75,0.2)", padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              Your mission will be linked to this church. Funds will be sent to the church's own registered banking details — you don't need to enter separate bank details. If the church hasn't set up its banking yet, payouts will show as pending until they do.
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        <label style={labelStyle}>Additional Notes (optional)</label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Anything else SendMe should know about receiving your payout" />

        {mode !== "church" && <div style={{ height: 4 }} />}

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
