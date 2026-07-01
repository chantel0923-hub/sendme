// AdminPayouts.js — Br Donald's private payout management dashboard
import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { sendNotification } from "./notifications";

const fmt = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const ADMIN_EMAIL = "sendmemissionfund@gmail.com"; // kept for legacy checks
export const isAdminEmail = (email) => {
  // Primary check: hardcoded founder email always has access
  if (email === "sendmemissionfund@gmail.com") return true;
  // Secondary check: is_admin flag in profiles table (checked via checkIsAdmin helper)
  return false;
};

const MILESTONE_LABELS = ["Milestone 1", "Milestone 2", "Milestone 3"];

export default function AdminPayouts({ onBack }) {
  const [missions, setMissions]           = useState([]);
  const [payoutDetails, setPayoutDetails] = useState({});
  const [churchDetails, setChurchDetails] = useState({});
  const [payoutRecords, setPayoutRecords] = useState({});
  const [approvedProofs, setApprovedProofs] = useState([]);  // ← NEW: pastor-approved proofs
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState("approved"); // ← default to approved queue
  const [emergencies, setEmergencies]       = useState([]);
  const [markingEmPaid, setMarkingEmPaid]   = useState(null);
  const [markingPaid, setMarkingPaid]     = useState(null);
  const [error, setError]                 = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [missionsRes, detailsRes, recordsRes, proofsRes] = await Promise.all([
        supabase.from("missions").select("*").order("created_at", { ascending: false }),
        supabase.from("payout_details").select("*"),
        supabase.from("payout_records").select("*"),
        // ── NEW: fetch pastor-approved proofs joined with mission info ──
        supabase.from("milestone_proofs")
          .select(`
            id, mission_id, milestone_number, description, media_url,
            submitted_at, reviewed_at, pastor_notes, status,
            missions ( id, title, country, city, church_id, church_name, goal, current_milestone, missionary_role, missionary_email )
          `)
          .eq("status", "approved")
          .order("reviewed_at", { ascending: false }),
      ]);

      const missionDetailsMap = {};
      const churchDetailsMap  = {};
      (detailsRes.data || []).forEach(d => {
        if (d.mission_id) missionDetailsMap[d.mission_id] = d;
        if (d.church_id)  churchDetailsMap[d.church_id]   = d;
      });

      const recordsMap = {};
      (recordsRes.data || []).forEach(r => {
        if (!recordsMap[r.mission_id]) recordsMap[r.mission_id] = {};
        recordsMap[r.mission_id][r.milestone_number] = r;
      });

      setMissions(missionsRes.data || []);
      setPayoutDetails(missionDetailsMap);
      setChurchDetails(churchDetailsMap);
      setPayoutRecords(recordsMap);
      setApprovedProofs(proofsRes.data || []);
    } catch (e) {
      setError("Could not load payout data: " + (e.message || ""));
    }
    // Load emergencies separately
    try {
      const { data: emData } = await supabase
        .from("emergency_requests")
        .select("*, churches(name, city, country)")
        .order("created_at", { ascending: false });
      if (emData) setEmergencies(emData);
    } catch (e) { console.log("Emergency fetch error:", e); }
    setLoading(false);
  };

  const getBankingDetails = (mission) => {
    if (mission.church_id && churchDetails[mission.church_id]) {
      return { details: churchDetails[mission.church_id], source: "church" };
    }
    if (payoutDetails[mission.id]) {
      return { details: payoutDetails[mission.id], source: "missionary" };
    }
    return { details: null, source: null };
  };

  const milestoneAmount = (goal, milestoneNum) => {
    const goalNum = Number(goal) || 0;
    const third = Math.floor(goalNum / 3);
    if (milestoneNum < 3) return third;
    return goalNum - third * 2;
  };

  const markPaid = async (missionId, milestoneNum, amount, isPaid, missionTitle, missionaryEmail, recipientName) => {
    setMarkingPaid(`${missionId}-${milestoneNum}`);
    setError("");
    const newStatus = isPaid ? "pending" : "paid";
    const payload = {
      mission_id: missionId,
      milestone_number: milestoneNum,
      amount,
      status: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      paid_via: "EFT",
    };
    try {
      const { error } = await supabase
        .from("payout_records")
        .upsert(payload, { onConflict: "mission_id,milestone_number" });
      if (error) throw error;
      setPayoutRecords(prev => ({
        ...prev,
        [missionId]: { ...(prev[missionId] || {}), [milestoneNum]: payload },
      }));
      // Only notify when transitioning TO paid, not when undoing a mistaken click
      if (newStatus === "paid") {
        sendNotification("payout_sent", missionaryEmail, {
          missionTitle,
          amount,
          recipientName,
        });
      }
    } catch (e) {
      setError("Could not update payment status: " + (e.message || ""));
    }
    setMarkingPaid(null);
  };

  // ── Build approved-proof rows (the new "Ready to Pay" queue) ──────────────
  const approvedRows = approvedProofs.map(proof => {
    const m = proof.missions || {};
    const records = payoutRecords[proof.mission_id] || {};
    const record  = records[proof.milestone_number];
    const isPaid  = record?.status === "paid";
    const { details, source } = m.id
      ? getBankingDetails(m)
      : { details: null, source: null };
    return {
      proofId:      proof.id,
      missionId:    proof.mission_id,
      missionTitle: m.title || "Untitled Mission",
      missionaryEmail: m.missionary_email || null,
      churchName:   m.church_name || "",
      churchId:     m.church_id || null,
      country:      m.country || m.city || "",
      milestoneNum: proof.milestone_number,
      amount:       milestoneAmount(m.goal, proof.milestone_number),
      isPaid,
      paidAt:       record?.paid_at,
      details,
      bankingSource: source,
      reviewedAt:   proof.reviewed_at,
      pastorNotes:  proof.pastor_notes,
      description:  proof.description,
      mediaUrl:     proof.media_url,
    };
  });

  // ── Build legacy milestone rows (from missions.current_milestone) ─────────
  const legacyRows = [];
  missions.forEach(m => {
    // Use current_milestone (new column); fall back to old milestone field
    const currentMilestone = m.current_milestone || m.milestone || 0;
    const { details, source } = getBankingDetails(m);
    const records = payoutRecords[m.id] || {};
    for (let i = 1; i <= currentMilestone; i++) {
      const amount  = milestoneAmount(m.goal, i);
      const record  = records[i];
      const isPaid  = record?.status === "paid";
      legacyRows.push({
        missionId:    m.id,
        missionTitle: m.title || "Untitled Mission",
        missionaryEmail: m.missionary_email || null,
        churchName:   m.church_name || "",
        churchId:     m.church_id || null,
        churchVerified: m.church_verified || false,
        country:      m.country || m.region || "",
        status:       m.status || "pending",
        milestoneNum: i,
        amount,
        isPaid,
        paidAt:       record?.paid_at,
        details,
        bankingSource: source,
      });
    }
  });

  const markEmPaid = async (em) => {
    setMarkingEmPaid(em.id);
    const newStatus = em.paid ? "unpaid" : "paid";
    const { error } = await supabase
      .from("emergency_requests")
      .update({ paid: newStatus === "paid", paid_at: newStatus === "paid" ? new Date().toISOString() : null })
      .eq("id", em.id);
    if (!error) setEmergencies(prev => prev.map(e => e.id === em.id ? { ...e, paid: newStatus === "paid" } : e));
    else console.log("markEmPaid error:", error);
    setMarkingEmPaid(null);
  };

  // Filter tabs
  const filteredRows = filter === "approved"
    ? approvedRows
    : filter === "due"
    ? legacyRows.filter(r => !r.isPaid)
    : filter === "paid"
    ? legacyRows.filter(r => r.isPaid)
    : legacyRows;

  const totalDue      = legacyRows.filter(r => !r.isPaid).reduce((acc, r) => acc + r.amount, 0);
  const totalPaid     = legacyRows.filter(r =>  r.isPaid).reduce((acc, r) => acc + r.amount, 0);
  const approvedUnpaid = approvedRows.filter(r => !r.isPaid).length;

  const missingBanking = missions.filter(m => {
    if ((m.current_milestone || m.milestone || 0) === 0) return false;
    const { details } = getBankingDetails(m);
    return !details;
  });

  const pendingChurch = missions.filter(m => m.status === "pending_church");

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  const generateCSV = () => {
    let rows = [];
    const dateStr = new Date().toISOString().slice(0,10);

    if (filter === "emergency") {
      rows.push(["Date","Title","Country","Urgency","Church","Goal","Raised","Status","Contact Email","Contact Phone"]);
      emergencies.forEach(em => {
        rows.push([
          em.created_at ? new Date(em.created_at).toLocaleDateString("en-GB") : "",
          em.title || "",
          em.country || "",
          em.urgency || "",
          em.churches ? `${em.churches.name} — ${em.churches.city}` : "",
          em.goal || 0,
          em.raised || 0,
          em.paid ? "Paid" : "Unpaid",
          em.contact_email || "",
          em.contact_phone || "",
        ]);
      });
    } else {
      const sourceRows = filter === "approved"
        ? approvedRows
        : filter === "due"   ? legacyRows.filter(r => !r.isPaid)
        : filter === "paid"  ? legacyRows.filter(r =>  r.isPaid)
        : legacyRows;

      rows.push(["Date Approved","Mission Title","Church","Country","Milestone","Amount (USD)","Status","Paid At","Recipient","Bank","Account No","Branch Code","SWIFT","Banking Source"]);
      sourceRows.forEach(r => {
        rows.push([
          r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString("en-GB") : "",
          r.missionTitle || "",
          r.churchName || "",
          r.country || "",
          `Milestone ${r.milestoneNum}`,
          r.amount || 0,
          r.isPaid ? "Paid" : "Due",
          r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-GB") : "",
          r.details?.recipient_name || "",
          r.details?.bank_name || "",
          r.details?.account_number || "",
          r.details?.branch_code || "",
          r.details?.swift_code || "",
          r.bankingSource || "",
        ]);
      });
    }

    const csvContent = rows.map(row =>
      row.map(cell => {
        const str = String(cell ?? "").replace(/"/g, '""');
        return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
      }).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `sendme-payouts-${filter}-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>Payout Dashboard</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>SENDME ADMIN · CONFIDENTIAL</div>
        </div>
        {approvedUnpaid > 0 && (
          <div style={{ background:"rgba(62,207,142,0.15)", border:"1px solid rgba(62,207,142,0.4)", borderRadius:999, padding:"4px 14px", fontSize:13, color:"#3ecf8e", fontWeight:700 }}>
            {approvedUnpaid} ready to pay
          </div>
        )}
        <button onClick={generateCSV} style={{ background:"rgba(232,179,75,0.1)", border:"1px solid rgba(232,179,75,0.3)", borderRadius:10, padding:"8px 14px", color:"#e8b34b", cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif", fontWeight:600 }}>⬇ Download Report</button>
        <button onClick={load} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 14px", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif" }}>↻ Refresh</button>
      </div>

      <div style={{ maxWidth:800, margin:"0 auto", padding:"28px 20px 60px" }}>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
          {[
            ["✅", approvedRows.filter(r=>!r.isPaid).length, "Pastor Approved", "#3ecf8e"],
            ["⏳", legacyRows.filter(r=>!r.isPaid).length,  "Due (legacy)",    "#e8b34b"],
            ["💝", "$"+fmt(totalDue),                        "Amount Due",      "#5b9cf6"],
            ["✓",  "$"+fmt(totalPaid),                       "Total Paid Out",  "#b06cf5"],
          ].map(([icon,val,label,c]) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"14px 10px", textAlign:"center" }}>
              <div style={{ fontSize:18 }}>{icon}</div>
              <div style={{ fontSize:18, fontWeight:700, color:c, marginTop:4 }}>{val}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:"rgba(240,82,82,0.1)", border:"1px solid rgba(240,82,82,0.3)", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#f05252" }}>
            ⚠ {error}
          </div>
        )}

        {/* Pending church banner */}
        {pendingChurch.length > 0 && (
          <div style={{ background:"rgba(176,108,245,0.07)", border:"1px solid rgba(176,108,245,0.25)", borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
            <div style={{ fontSize:13, color:"#b06cf5", fontWeight:700, marginBottom:6 }}>
              ⏳ {pendingChurch.length} mission{pendingChurch.length>1?"s":""} waiting for church registration:
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.8 }}>
              {pendingChurch.map(m => (
                <div key={m.id}>• <strong>{m.title||"Untitled"}</strong> — {m.church_name} (pastor: {m.pastor_email})</div>
              ))}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:8 }}>
              Contact each pastor to register their church on SendMe before approving these missions.
            </div>
          </div>
        )}

        {/* Missing banking banner */}
        {missingBanking.length > 0 && (
          <div style={{ background:"rgba(232,179,75,0.07)", border:"1px solid rgba(232,179,75,0.25)", borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
            <div style={{ fontSize:13, color:"#e8b34b", fontWeight:700, marginBottom:6 }}>
              ⚠️ {missingBanking.length} mission{missingBanking.length>1?"s":""} reached a milestone but have no banking details:
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.8 }}>
              {missingBanking.map(m => (
                <div key={m.id}>• {m.title||"Untitled"} ({m.country||m.region}) — {m.church_id ? "church not set up banking yet" : "no banking details submitted"}</div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap" }}>
          {[
            ["approved", `✅ Pastor Approved${approvedUnpaid > 0 ? ` (${approvedUnpaid})` : ""}`],
            ["emergency", `🚨 Emergency${emergencies.filter(e=>!e.paid).length > 0 ? ` (${emergencies.filter(e=>!e.paid).length})` : ""}`],
            ["due",      "Payments Due"],
            ["paid",     "Paid"],
            ["all",      "All (legacy)"],
          ].map(([key,lbl]) => (
            <button key={key} onClick={()=>setFilter(key)}
              style={{ padding:"8px 18px", borderRadius:999,
                border:`1px solid ${filter===key?(key==="approved"?"#3ecf8e":key==="emergency"?"#e85b5b":"#e8b34b"):"rgba(255,255,255,0.1)"}`,
                background:filter===key?(key==="approved"?"rgba(62,207,142,0.15)":key==="emergency"?"rgba(232,91,91,0.15)":"rgba(232,179,75,0.15)"):"rgba(255,255,255,0.03)",
                color:filter===key?(key==="approved"?"#3ecf8e":key==="emergency"?"#e85b5b":"#e8b34b"):"rgba(255,255,255,0.5)",
                cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"Georgia, serif" }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ── APPROVED PROOFS (new pastor-approved queue) ── */}
        {filter === "approved" && (
          loading ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading...</div>
          ) : approvedRows.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
              🙏 No pastor-approved milestones yet. Once a pastor approves a missionary's proof, it will appear here for payout.
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {approvedRows.map((r, i) => {
                const isActing = markingPaid === `${r.missionId}-${r.milestoneNum}`;
                return (
                  <div key={r.proofId || i} style={{ background:"#0c1628", borderRadius:16,
                    border:`1px solid ${r.isPaid ? "rgba(62,207,142,0.2)" : "rgba(62,207,142,0.4)"}`,
                    borderLeft:`3px solid ${r.isPaid ? "rgba(62,207,142,0.3)" : "#3ecf8e"}`,
                    padding:"18px 20px" }}>

                    {/* Status badge */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:14 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                          <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999,
                            background: r.isPaid ? "rgba(62,207,142,0.1)" : "rgba(62,207,142,0.2)",
                            color:"#3ecf8e", border:"1px solid rgba(62,207,142,0.4)", fontWeight:700 }}>
                            {r.isPaid ? "✓ Paid" : "✅ Pastor Approved — Ready to Pay"}
                          </span>
                          <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999,
                            background:"rgba(91,156,246,0.1)", color:"#5b9cf6",
                            border:"1px solid rgba(91,156,246,0.25)" }}>
                            {MILESTONE_LABELS[r.milestoneNum-1]||`Milestone ${r.milestoneNum}`}
                          </span>
                          {r.reviewedAt && (
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
                              Approved {timeAgo(r.reviewedAt)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff" }}>{r.missionTitle}</div>
                        {r.churchName && (
                          <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:3 }}>⛪ {r.churchName}</div>
                        )}
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2 }}>📍 {r.country}</div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:26, fontWeight:700, color: r.isPaid ? "#3ecf8e" : "#e8b34b" }}>${fmt(r.amount)}</div>
                        {r.bankingSource && (
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:4 }}>
                            {r.bankingSource === "church" ? "🏦 to church" : "🏦 to pastor/church"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Proof summary */}
                    {r.description && (
                      <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid rgba(255,255,255,0.06)", padding:"10px 14px", marginBottom:12 }}>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginBottom:4 }}>Missionary's field report (payout goes to pastor)</div>
                        <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>{r.description}</div>
                        {r.mediaUrl && (
                          <a href={r.mediaUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display:"inline-block", marginTop:8, fontSize:12, color:"#5b9cf6", textDecoration:"none" }}>
                            📎 View evidence ↗
                          </a>
                        )}
                      </div>
                    )}

                    {/* Pastor notes */}
                    {r.pastorNotes && (
                      <div style={{ background:"rgba(62,207,142,0.05)", borderRadius:10, border:"1px solid rgba(62,207,142,0.15)", padding:"8px 12px", marginBottom:12, fontSize:12, color:"rgba(255,255,255,0.5)" }}>
                        <span style={{ color:"#3ecf8e", fontWeight:700 }}>Pastor's notes: </span>{r.pastorNotes}
                      </div>
                    )}

                    {/* Banking details */}
                    <div style={{ paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.06)", marginBottom:14 }}>
                      {r.details ? (
                        <>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>
                            {r.bankingSource === "church" ? "Church Banking Details" : "Pastor Banking Details"}
                          </div>
                          <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", lineHeight:1.8,
                            display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"4px 16px" }}>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Recipient:</strong> {r.details.recipient_name}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Bank:</strong> {r.details.bank_name}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Account Holder:</strong> {r.details.account_holder}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Account No:</strong> {r.details.account_number}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Branch Code:</strong> {r.details.branch_code||"—"}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Type:</strong> {r.details.account_type} · {r.details.country}</div>
                            {r.details.swift_code && <div><strong style={{color:"rgba(255,255,255,0.7)"}}>SWIFT/IBAN:</strong> {r.details.swift_code}</div>}
                            {r.details.notes && <div style={{gridColumn:"1 / -1"}}><strong style={{color:"rgba(255,255,255,0.7)"}}>Notes:</strong> {r.details.notes}</div>}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:12, color:"#e85b5b" }}>
                          ⚠️ No banking details found. {r.churchId ? "The church has not submitted their banking details yet." : "No banking details submitted for this mission."}
                        </div>
                      )}
                    </div>

                    {/* Mark paid button */}
                    <button onClick={()=>markPaid(r.missionId, r.milestoneNum, r.amount, r.isPaid, r.missionTitle, r.missionaryEmail, r.details?.recipient_name)}
                      disabled={isActing}
                      style={{ padding:"10px 24px", borderRadius:10, border:"none",
                        background: r.isPaid ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#3ecf8e,#2aaf74)",
                        color: r.isPaid ? "rgba(255,255,255,0.5)" : "#000",
                        fontWeight:700, cursor: isActing ? "default" : "pointer",
                        fontSize:13, fontFamily:"Georgia, serif",
                        opacity: isActing ? 0.7 : 1 }}>
                      {isActing ? "Saving..." : r.isPaid ? "↩ Mark as Unpaid" : "✓ Mark as Paid (EFT Done)"}
                    </button>
                    {r.isPaid && r.paidAt && (
                      <span style={{ marginLeft:12, fontSize:12, color:"rgba(255,255,255,0.3)" }}>
                        Paid {new Date(r.paidAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── EMERGENCY PAYOUTS ── */}
        {filter === "emergency" && (
          emergencies.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>No emergency requests found.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {emergencies.map((em, i) => {
                const isPaid   = !!em.paid;
                const isActing = markingEmPaid === em.id;
                const urgColor = em.urgency === "critical" ? "#e85b5b" : em.urgency === "urgent" ? "#f5a44a" : "#e8b34b";
                return (
                  <div key={em.id||i} style={{ background:"#0c1628", borderRadius:14, border:`1px solid ${isPaid?"rgba(62,207,142,0.2)":"rgba(232,91,91,0.25)"}`, padding:"16px 18px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap", marginBottom:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff", marginBottom:4 }}>{em.title}</div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:2 }}>📍 {em.country} · {em.urgency?.toUpperCase()}</div>
                        {em.churches && (
                          <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginBottom:2 }}>⛪ {em.churches.name} — {em.churches.city}, {em.churches.country}</div>
                        )}
                        {!em.churches && (
                          <div style={{ fontSize:12, color:"#e8b34b" }}>⚠ No church linked — add church_id before paying out.</div>
                        )}
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>Submitted by: {em.submittedBy}</div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:18, fontWeight:700, color:urgColor }}>${fmt(em.raised||0)}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>of ${fmt(em.goal||0)} goal</div>
                        {isPaid && <div style={{ fontSize:11, color:"#3ecf8e", marginTop:4 }}>✓ Paid out</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => markEmPaid(em)}
                      disabled={isActing}
                      style={{ width:"100%", padding:"11px 0", borderRadius:12, border:"none", fontWeight:700, cursor:isActing?"default":"pointer", fontSize:13, fontFamily:"Georgia, serif", opacity:isActing?0.6:1,
                        background: isPaid ? "rgba(62,207,142,0.1)" : "linear-gradient(135deg,#e85b5b,#c44040)",
                        color: isPaid ? "#3ecf8e" : "#fff",
                        border: isPaid ? "1px solid rgba(62,207,142,0.3)" : "none",
                      }}>
                      {isActing ? "Updating..." : isPaid ? "✓ Mark as Unpaid" : "💸 Mark as Paid Out"}
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── LEGACY ROWS (due / paid / all) ── */}
        {filter !== "approved" && filter !== "emergency" && (
          loading ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading payout data...</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
              {filter==="due" ? "🙏 Nothing outstanding — all caught up!" : "No records to show."}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {filteredRows.map((r, i) => {
                const isActing = markingPaid === `${r.missionId}-${r.milestoneNum}`;
                return (
                  <div key={i} style={{ background:"#0c1628", borderRadius:14,
                    border:`1px solid ${r.isPaid?"rgba(62,207,142,0.2)":"rgba(232,179,75,0.2)"}`,
                    padding:"16px 18px" }}>

                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                      <div style={{ flex:1, minWidth:220 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff" }}>{r.missionTitle}</div>
                        {r.churchName && (
                          <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:2 }}>
                            ⛪ {r.churchName}
                            {r.churchVerified
                              ? <span style={{ marginLeft:6, color:"#3ecf8e", fontSize:11 }}>✓ verified</span>
                              : <span style={{ marginLeft:6, color:"#e8b34b", fontSize:11 }}>⚠️ pending</span>
                            }
                          </div>
                        )}
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2 }}>📍 {r.country}</div>
                        <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                          <span style={{ fontSize:11, padding:"2px 10px", borderRadius:999,
                            background:"rgba(91,156,246,0.12)", color:"#5b9cf6",
                            border:"1px solid rgba(91,156,246,0.25)" }}>
                            {MILESTONE_LABELS[r.milestoneNum-1]||`Milestone ${r.milestoneNum}`}
                          </span>
                          {r.bankingSource === "church" && (
                            <span style={{ fontSize:11, padding:"2px 10px", borderRadius:999,
                              background:"rgba(176,108,245,0.12)", color:"#b06cf5",
                              border:"1px solid rgba(176,108,245,0.25)" }}>
                              🏦 Pay to church
                            </span>
                          )}
                          {r.bankingSource === "missionary" && (
                            <span style={{ fontSize:11, padding:"2px 10px", borderRadius:999,
                              background:"rgba(232,179,75,0.12)", color:"#e8b34b",
                              border:"1px solid rgba(232,179,75,0.25)" }}>
                              🏦 Pay to pastor/church
                            </span>
                          )}
                          {r.isPaid && (
                            <span style={{ fontSize:11, padding:"2px 10px", borderRadius:999,
                              background:"rgba(62,207,142,0.12)", color:"#3ecf8e",
                              border:"1px solid rgba(62,207,142,0.25)" }}>
                              ✓ Paid {r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:22, fontWeight:700, color:r.isPaid?"#3ecf8e":"#e8b34b" }}>${fmt(r.amount)}</div>
                      </div>
                    </div>

                    <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                      {r.details ? (
                        <>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>
                            {r.bankingSource === "church" ? "Church Banking Details" : "Pastor Banking Details"}
                          </div>
                          <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", lineHeight:1.8,
                            display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"4px 16px" }}>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Recipient:</strong> {r.details.recipient_name}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Bank:</strong> {r.details.bank_name}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Account Holder:</strong> {r.details.account_holder}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Account No:</strong> {r.details.account_number}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Branch Code:</strong> {r.details.branch_code||"—"}</div>
                            <div><strong style={{color:"rgba(255,255,255,0.7)"}}>Type:</strong> {r.details.account_type} · {r.details.country}</div>
                            {r.details.swift_code && <div><strong style={{color:"rgba(255,255,255,0.7)"}}>SWIFT/IBAN:</strong> {r.details.swift_code}</div>}
                            {r.details.notes && <div style={{gridColumn:"1 / -1"}}><strong style={{color:"rgba(255,255,255,0.7)"}}>Notes:</strong> {r.details.notes}</div>}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:12, color:"#e85b5b" }}>
                          ⚠️ No banking details found.
                          {r.churchId ? " Church not set up banking yet." : " No banking details submitted."}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop:14 }}>
                      <button onClick={()=>markPaid(r.missionId, r.milestoneNum, r.amount, r.isPaid, r.missionTitle, r.missionaryEmail, r.details?.recipient_name)}
                        disabled={isActing}
                        style={{ padding:"9px 20px", borderRadius:10, border:"none",
                          background:r.isPaid?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#3ecf8e,#2aaf74)",
                          color:r.isPaid?"rgba(255,255,255,0.5)":"#000", fontWeight:700,
                          cursor: isActing ? "default" : "pointer",
                          fontSize:13, fontFamily:"Georgia, serif",
                          opacity: isActing ? 0.7 : 1 }}>
                        {isActing ? "Saving..." : r.isPaid ? "Mark as Unpaid" : "✓ Mark as Paid"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        <div style={{ textAlign:"center", padding:"32px 0 0", borderTop:"1px solid rgba(255,255,255,0.05)", marginTop:32 }}>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", lineHeight:1.7 }}>
            Each mission's goal is split into 3 milestone payments. Pastor-approved proofs appear in the
            "Pastor Approved" tab. Banking details are pulled from the church account first, falling back
            to the pastor's church account. Funds flow: SendMe → Church → Missionary. Click "Mark as Paid" once the EFT is complete.
          </div>
        </div>
      </div>
    </div>
  );
}
