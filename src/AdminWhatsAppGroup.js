// AdminWhatsAppGroup.js
// Admin screen listing everyone who opted in to the "SendMe Global Mission
// Fund Notification" WhatsApp group during the Welcome screen. WhatsApp has
// no API for programmatically adding members to a group, so this screen's
// job is simply to make it fast for admin to add each number manually —
// a name/number list plus a one-tap "Copy all numbers" button.
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export default function AdminWhatsAppGroup({ onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, whatsapp_number, whatsapp_added_to_group, created_at")
        .eq("whatsapp_group_optin", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error("AdminWhatsAppGroup fetch error:", e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Marks whether admin has actually added this person to the real WhatsApp
  // group yet. This is manual by necessity — the app has no way to know
  // what happens inside WhatsApp itself, so it only reflects what admin
  // tells it here. Nothing auto-updates or disappears; the list is a
  // checklist, not a live sync with WhatsApp.
  const toggleAdded = async (row) => {
    const next = !row.whatsapp_added_to_group;
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, whatsapp_added_to_group: next } : r));
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ whatsapp_added_to_group: next })
        .eq("id", row.id);
      if (error) {
        console.error("AdminWhatsAppGroup: failed to update added status", error);
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, whatsapp_added_to_group: !next } : r)); // revert on failure
      }
    } catch (e) {
      console.error("AdminWhatsAppGroup: toggle threw", e);
    }
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !q || (r.full_name || "").toLowerCase().includes(q) || (r.whatsapp_number || "").includes(q);
  });
  const pending = filtered.filter(r => !r.whatsapp_added_to_group);
  const added   = filtered.filter(r => r.whatsapp_added_to_group);

  const copyAll = () => {
    const text = pending.map(r => `${r.full_name || "Unnamed"} — ${r.whatsapp_number || "no number"}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>📲 WhatsApp Notification Group</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>{pending.length} NOT YET ADDED · {added.length} ALREADY ADDED</div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 60px" }}>

        <div style={{ background: "rgba(37,211,102,0.06)", borderRadius: 14, border: "1px solid rgba(37,211,102,0.2)", padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          <strong style={{ color: "#25d366" }}>📲 Reminder:</strong> WhatsApp doesn't let any app add members to a group automatically — you'll need to add each number below to your "SendMe Global Mission Fund Notification" group yourself. Once someone's in, approved missions/emergencies/helper requests can be posted with one tap from the approval screens.
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input
            placeholder="Search by name or number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none" }}
          />
          <button onClick={copyAll} disabled={pending.length === 0}
            style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid rgba(37,211,102,0.35)", background: "rgba(37,211,102,0.1)", color: copied ? "#3ecf8e" : "#25d366", fontWeight: 700, cursor: pending.length === 0 ? "default" : "pointer", fontSize: 13, fontFamily: "Georgia, serif", whiteSpace: "nowrap" }}>
            {copied ? "✓ Copied!" : `Copy ${pending.length} New Number${pending.length !== 1 ? "s" : ""}`}
          </button>
        </div>

        {loading && <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)" }}>Loading...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            {rows.length === 0 ? "Nobody has opted in yet." : "No matches."}
          </div>
        )}

        {!loading && pending.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e8b34b", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>Not Yet Added ({pending.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {pending.map(r => (
                <div key={r.id} style={{ background: "#0c1628", borderRadius: 12, border: "1px solid rgba(232,179,75,0.25)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#eef1ff" }}>{r.full_name || "Unnamed"}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{r.email}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: 14, color: "#e8b34b", fontWeight: 700, whiteSpace: "nowrap" }}>{r.whatsapp_number || "—"}</div>
                    <button onClick={() => toggleAdded(r)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(37,211,102,0.35)", background: "rgba(37,211,102,0.08)", color: "#25d366", fontWeight: 700, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif", whiteSpace: "nowrap" }}>
                      ✓ Mark Added
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && added.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>Already Added ({added.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {added.map(r => (
                <div key={r.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{r.full_name || "Unnamed"}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{r.email}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: 700, whiteSpace: "nowrap" }}>{r.whatsapp_number || "—"}</div>
                    <button onClick={() => toggleAdded(r)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", fontWeight: 700, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif", whiteSpace: "nowrap" }}>
                      ✓ Added
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
