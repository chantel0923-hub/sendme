// AdminPayouts.js — Br Donald's private payout management dashboard
import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const ADMIN_EMAIL = "sendmemissionfund@gmail.com";

const MILESTONE_LABELS = ["Milestone 1", "Milestone 2", "Milestone 3"];

export default function AdminPayouts({ onBack }) {
  const [missions, setMissions]           = useState([]);
  const [payoutDetails, setPayoutDetails] = useState({});  // keyed by mission_id
  const [churchDetails, setChurchDetails] = useState({});  // keyed by church_id
  const [payoutRecords, setPayoutRecords] = useState({});
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState("due");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: missionsData } = await supabase
          .from("missions")
          .select("*")
          .order("created_at", { ascending: false });

        const { data: detailsData } = await supabase
          .from("payout_details")
          .select("*");

        const { data: recordsData } = await supabase
          .from("payout_records")
          .select("*");

        // Map payout_details by mission_id (for missionaries without a church link)
        const missionDetailsMap = {};
        const churchDetailsMap  = {};
        (detailsData || []).forEach(d => {
          if (d.mission_id) missionDetailsMap[d.mission_id] = d;
          if (d.church_id)  churchDetailsMap[d.church_id]   = d;
        });

        const recordsMap = {};
        (recordsData || []).forEach(r => {
          if (!recordsMap[r.mission_id]) recordsMap[r.mission_id] = {};
          recordsMap[r.mission_id][r.milestone_number] = r;
        });

        setMissions(missionsData || []);
        setPayoutDetails(missionDetailsMap);
        setChurchDetails(churchDetailsMap);
        setPayoutRecords(recordsMap);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, []);

  // For a given mission, find the right banking details:
  // 1. If mission has a church_id → use the church's payout_details (preferred)
  // 2. Fall back to mission's own payout_details (for unlinked/independent missionaries)
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

  const markPaid = async (missionId, milestoneNum, amount, isPaid) => {
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
    } catch (e) {
      alert("Could not update payment status. Please try again.");
    }
  };

  // Build payout rows
  const rows = [];
  missions.forEach(m => {
    const currentMilestone = m.milestone || 0;
    const { details, source } = getBankingDetails(m);
    const records = payoutRecords[m.id] || {};
    for (let i = 1; i <= currentMilestone; i++) {
      const amount  = milestoneAmount(m.goal, i);
      const record  = records[i];
      const isPaid  = record?.status === "paid";
      rows.push({
        missionId:    m.id,
        missionTitle: m.title || "Untitled Mission",
        churchName:   m.church_name || "",
        churchId:     m.church_id   || null,
        churchVerified: m.church_verified || false,
        country:      m.country || m.region || "",
        status:       m.status || "pending",
        milestoneNum: i,
        amount,
        isPaid,
        paidAt:       record?.paid_at,
        details,
        bankingSource: source,  // "church" | "missionary" | null
      });
    }
  });

  const filtered = rows.filter(r => {
    if (filter === "due")     return !r.isPaid;
    if (filter === "paid")    return r.isPaid;
    if (filter === "pending") return r.status === "pending_church";
    return true;
  });

  const totalDue  = rows.filter(r => !r.isPaid).reduce((acc, r) => acc + r.amount, 0);
  const totalPaid = rows.filter(r =>  r.isPaid).reduce((acc, r) => acc + r.amount, 0);

  // Missions that have hit a milestone but have NO banking details at all
  const missingBanking = missions.filter(m => {
    if ((m.milestone || 0) === 0) return false;
    const { details } = getBankingDetails(m);
    return !details;
  });

  // Missions waiting for their church to register on SendMe
  const pendingChurch = missions.filter(m => m.status === "pending_church");

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14 }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Payout Dashboard</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>ADMIN ONLY — SENDME</div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"24px 20px 60px" }}>

        {/* Summary cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
          <div style={{ background:"rgba(232,91,91,0.08)", borderRadius:14, border:"1px solid rgba(232,91,91,0.25)", padding:16, textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:"#e85b5b" }}>${fmt(totalDue)}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>Outstanding</div>
          </div>
          <div style={{ background:"rgba(62,207,142,0.08)", borderRadius:14, border:"1px solid rgba(62,207,142,0.25)", padding:16, textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:"#3ecf8e" }}>${fmt(totalPaid)}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>Paid Out</div>
          </div>
          <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:14, border:"1px solid rgba(232,179,75,0.25)", padding:16, textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:"#e8b34b" }}>{rows.filter(r=>!r.isPaid).length}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>Payments Due</div>
          </div>
          <div style={{ background:"rgba(176,108,245,0.08)", borderRadius:14, border:"1px solid rgba(176,108,245,0.25)", padding:16, textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:"#b06cf5" }}>{pendingChurch.length}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>Pending Church</div>
          </div>
        </div>

        {/* Pending church registration banner */}
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

        {/* Missing banking details banner */}
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
        <div style={{ display:"flex", gap:8, marginBottom:18 }}>
          {[["due","Payments Due"],["paid","Paid"],["pending","Pending Church"],["all","All"]].map(([key,lbl]) => (
            <button key={key} onClick={()=>setFilter(key)}
              style={{ padding:"8px 18px", borderRadius:999,
                border:`1px solid ${filter===key?"#e8b34b":"rgba(255,255,255,0.1)"}`,
                background:filter===key?"rgba(232,179,75,0.15)":"rgba(255,255,255,0.03)",
                color:filter===key?"#e8b34b":"rgba(255,255,255,0.5)",
                cursor:"pointer", fontSize:13, fontWeight:600 }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Payout rows */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading payout data...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            {filter==="due" ? "🙏 Nothing outstanding — all caught up!" : "No records to show."}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {filtered.map((r, i) => (
              <div key={i} style={{ background:"#0c1628", borderRadius:14,
                border:`1px solid ${r.isPaid?"rgba(62,207,142,0.2)":"rgba(232,179,75,0.2)"}`,
                padding:"16px 18px" }}>

                {/* Header row */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:220 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff" }}>{r.missionTitle}</div>
                    {r.churchName && (
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:2 }}>
                        ⛪ {r.churchName}
                        {r.churchVerified
                          ? <span style={{ marginLeft:6, color:"#3ecf8e", fontSize:11 }}>✓ verified</span>
                          : <span style={{ marginLeft:6, color:"#e8b34b", fontSize:11 }}>⚠️ pending registration</span>
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
                      {/* Badge showing who gets paid */}
                      {r.bankingSource === "church" && (
                        <span style={{ fontSize:11, padding:"2px 10px", borderRadius:999,
                          background:"rgba(176,108,245,0.12)", color:"#b06cf5",
                          border:"1px solid rgba(176,108,245,0.25)" }}>
                          🏦 Pay to church account
                        </span>
                      )}
                      {r.bankingSource === "missionary" && (
                        <span style={{ fontSize:11, padding:"2px 10px", borderRadius:999,
                          background:"rgba(232,179,75,0.12)", color:"#e8b34b",
                          border:"1px solid rgba(232,179,75,0.25)" }}>
                          👤 Pay to missionary account
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

                {/* Banking details section */}
                <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  {r.details ? (
                    <>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>
                        {r.bankingSource === "church" ? "Church Banking Details" : "Missionary Banking Details"}
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
                      {r.churchId ? " The church has not submitted their banking details yet." : " No banking details submitted for this mission."}
                    </div>
                  )}
                </div>

                {/* Mark as paid */}
                <div style={{ marginTop:14 }}>
                  <button onClick={()=>markPaid(r.missionId, r.milestoneNum, r.amount, r.isPaid)}
                    style={{ padding:"9px 20px", borderRadius:10, border:"none",
                      background:r.isPaid?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#3ecf8e,#2aaf74)",
                      color:r.isPaid?"rgba(255,255,255,0.5)":"#000", fontWeight:700,
                      cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                    {r.isPaid ? "Mark as Unpaid" : "✓ Mark as Paid"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign:"center", padding:"32px 0 0", borderTop:"1px solid rgba(255,255,255,0.05)", marginTop:32 }}>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", lineHeight:1.7 }}>
            Each mission's goal is split into 3 milestone payments. Banking details are pulled from
            the church's registered account first, falling back to the missionary's own details.
            Click "Mark as Paid" once the EFT is complete — this updates the Transparency Ledger.
          </div>
        </div>
      </div>
    </div>
  );
}
