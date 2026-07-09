// AdminEmergencyRequests.js
// Admin screen to review, approve, and reject Emergency Mission Requests
// before they appear publicly. Mirrors AdminApprovals.js's pending/active/
// rejected pattern, adapted for the emergency_requests table.

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const timeAgo = (d) => {
  const diff = Math.floor((new Date() - new Date(d)) / 1000);
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

const URGENCY = {
  critical: { label:"🔴 Critical", color:"#e85b5b" },
  urgent:   { label:"🟠 Urgent",   color:"#f5a44a" },
  needed:   { label:"🟡 Needed",   color:"#e8b34b" },
};

export default function AdminEmergencyRequests({ onBack, adminEmail }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("pending"); // pending | active | rejected | all
  const [reasonById, setReasonById] = useState({});
  const [busyId, setBusyId]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("emergency_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (e) {
      console.log("AdminEmergencyRequests fetch error:", e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (r) => {
    setBusyId(r.id);
    try {
      const { error } = await supabase
        .from("emergency_requests")
        .update({ status: "active", reviewed_at: new Date().toISOString(), reviewed_by: adminEmail || null })
        .eq("id", r.id);
      if (error) throw error;
      setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: "active" } : x));
    } catch (e) {
      console.log("approve error:", e);
      window.alert("Approval failed — check console for details.");
    }
    setBusyId(null);
  };

  const reject = async (r) => {
    const reason = reasonById[r.id] || "";
    setBusyId(r.id);
    try {
      const { error } = await supabase
        .from("emergency_requests")
        .update({ status: "rejected", rejection_reason: reason || null, reviewed_at: new Date().toISOString(), reviewed_by: adminEmail || null })
        .eq("id", r.id);
      if (error) throw error;
      setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: "rejected", rejection_reason: reason } : x));
    } catch (e) {
      console.log("reject error:", e);
      window.alert("Rejection failed — check console for details.");
    }
    setBusyId(null);
  };

  const reopen = async (r) => {
    setBusyId(r.id);
    try {
      const { error } = await supabase
        .from("emergency_requests")
        .update({ status: "pending", rejection_reason: null })
        .eq("id", r.id);
      if (error) throw error;
      setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: "pending" } : x));
    } catch (e) {
      console.log("reopen error:", e);
    }
    setBusyId(null);
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const counts = {
    pending:  requests.filter(r => r.status === "pending").length,
    active:   requests.filter(r => r.status === "active").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>🚨 Emergency Requests</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>ADMIN — REVIEW BEFORE PUBLISHING</div>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 20px 60px" }}>

        <div style={{ background:"rgba(232,91,91,0.06)", borderRadius:14, border:"1px solid rgba(232,91,91,0.2)", padding:"14px 18px", marginBottom:24, fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7 }}>
          <strong style={{ color:"#e85b5b" }}>🚨 Reviewing Emergency Requests:</strong> Approve to make a request live and visible to donors. Requests stay hidden from the public list until approved.
        </div>

        <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:10, padding:3, gap:3, marginBottom:20, width:"fit-content", flexWrap:"wrap" }}>
          {[["pending",`Pending (${counts.pending})`],["active",`Active (${counts.active})`],["rejected",`Rejected (${counts.rejected})`],["all","All"]].map(([key,label]) => (
            <button key={key} onClick={()=>setFilter(key)} style={{ padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:600,
              background: filter===key ? "linear-gradient(135deg,#e85b5b,#c44040)" : "transparent",
              color: filter===key ? "#fff" : "rgba(255,255,255,0.4)",
            }}>{label}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading requests...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            No {filter !== "all" ? filter : ""} emergency requests.
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {filtered.map(r => {
            const u = URGENCY[r.urgency] || URGENCY.urgent;
            const isBusy = busyId === r.id;
            return (
              <div key={r.id} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${u.color}33`, borderLeft:`4px solid ${u.color}`, padding:20 }}>
                <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ fontSize:12, padding:"3px 10px", borderRadius:999, background:`${u.color}18`, color:u.color, border:`1px solid ${u.color}33`, fontWeight:600 }}>{u.label}</span>
                  <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.4)" }}>{r.status}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {r.country} · {timeAgo(r.created_at)}</span>
                </div>

                <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>{r.title}</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:12 }}>{r.description}</div>

                <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:4 }}>Submitted by: {r.submittedBy}</div>
                {r.contact_email && <div style={{ fontSize:12, color:"rgba(232,179,75,0.7)", marginBottom:4 }}>✉ {r.contact_email}{r.contact_phone ? " · " + r.contact_phone : ""}</div>}
                {r.church_id && <div style={{ fontSize:12, color:"#3ecf8e", marginBottom:4 }}>⛪ Linked to verified church</div>}
                <div style={{ fontSize:13, fontWeight:700, color:u.color, marginTop:8 }}>Goal: ${(r.goal||0).toLocaleString ? r.goal : r.goal}</div>

                {r.status === "rejected" && r.rejection_reason && (
                  <div style={{ background:"rgba(232,91,91,0.08)", border:"1px solid rgba(232,91,91,0.2)", borderRadius:10, padding:"10px 14px", marginTop:10, fontSize:12, color:"rgba(255,255,255,0.6)" }}>
                    <strong style={{ color:"#e85b5b" }}>Rejection reason:</strong> {r.rejection_reason}
                  </div>
                )}

                {r.status === "pending" && (
                  <>
                    <textarea
                      placeholder="Rejection reason (only needed if rejecting)"
                      value={reasonById[r.id] || ""}
                      onChange={e=>setReasonById(prev => ({ ...prev, [r.id]: e.target.value }))}
                      style={{ width:"100%", marginTop:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 12px", color:"#eef1ff", fontSize:13, fontFamily:"Georgia, serif", resize:"vertical", minHeight:50, boxSizing:"border-box" }}
                    />
                    <div style={{ display:"flex", gap:8, marginTop:10 }}>
                      <button disabled={isBusy} onClick={()=>approve(r)}
                        style={{ flex:1, padding:"10px 0", borderRadius:12, border:"none", background:"linear-gradient(135deg,#3ecf8e,#2eab73)", color:"#000", cursor:isBusy?"default":"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:700, opacity:isBusy?0.6:1 }}>
                        ✓ Approve
                      </button>
                      <button disabled={isBusy} onClick={()=>reject(r)}
                        style={{ flex:1, padding:"10px 0", borderRadius:12, border:"1px solid rgba(232,91,91,0.35)", background:"rgba(232,91,91,0.08)", color:"#e85b5b", cursor:isBusy?"default":"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:700, opacity:isBusy?0.6:1 }}>
                        ✗ Reject
                      </button>
                    </div>
                  </>
                )}

                {r.status === "active" && (
                  <button disabled={isBusy} onClick={()=>reject(r)}
                    style={{ marginTop:14, width:"100%", padding:"10px 0", borderRadius:12, border:"1px solid rgba(232,91,91,0.25)", background:"rgba(232,91,91,0.06)", color:"#e85b5b", cursor:isBusy?"default":"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:600, opacity:isBusy?0.6:1 }}>
                    Take Down / Reject
                  </button>
                )}

                {r.status === "rejected" && (
                  <button disabled={isBusy} onClick={()=>reopen(r)}
                    style={{ marginTop:14, width:"100%", padding:"10px 0", borderRadius:12, border:"1px solid rgba(232,179,75,0.3)", background:"rgba(232,179,75,0.06)", color:"#e8b34b", cursor:isBusy?"default":"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:600, opacity:isBusy?0.6:1 }}>
                    ↩ Reopen for Review
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
