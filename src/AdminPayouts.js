// AdminPayouts.js — Br Donald's private payout management dashboard
import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Same admin check used to gate this screen — only Br Donald sees it
export const ADMIN_EMAIL = "sendmemissionfund@gmail.com"; // ← Br Donald's SendMe login email

const MILESTONE_LABELS = ["Milestone 1", "Milestone 2", "Milestone 3"];

export default function AdminPayouts({ onBack }) {
  const [missions, setMissions] = useState([]);
  const [payoutDetails, setPayoutDetails] = useState({});
  const [payoutRecords, setPayoutRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("due"); // due | all | paid

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

        const detailsMap = {};
        (detailsData || []).forEach(d => { detailsMap[d.mission_id] = d; });

        const recordsMap = {};
        (recordsData || []).forEach(r => {
          if (!recordsMap[r.mission_id]) recordsMap[r.mission_id] = {};
          recordsMap[r.mission_id][r.milestone_number] = r;
        });

        setMissions(missionsData || []);
        setPayoutDetails(detailsMap);
        setPayoutRecords(recordsMap);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Calculate milestone amounts: equal thirds of the goal, last absorbs remainder
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

  // Build a flat list of payout rows: one per mission per reached milestone
  const rows = [];
  missions.forEach(m => {
    const currentMilestone = m.milestone || 0; // how many milestones reached so far
    const details = payoutDetails[m.id];
    const records = payoutRecords[m.id] || {};
    for (let i = 1; i <= currentMilestone; i++) {
      const amount = milestoneAmount(m.goal, i);
      const record = records[i];
      const isPaid = record?.status === "paid";
      rows.push({
        missionId: m.id,
        missionTitle: m.title || "Untitled Mission",
        recipient: details?.recipient_name || "— Not set —",
        country: m.country || m.region || "",
        milestoneNum: i,
        amount,
        isPaid,
        paidAt: record?.paid_at,
        details,
      });
    }
  });

  const filtered = rows.filter(r => {
    if (filter === "due") return !r.isPaid;
    if (filter === "paid") return r.isPaid;
    return true;
  });

  const totalDue = rows.filter(r => !r.isPaid).reduce((acc, r) => acc + r.amount, 0);
  const totalPaid = rows.filter(r => r.isPaid).reduce((acc, r) => acc + r.amount, 0);
  const missingBanking = missions.filter(m => (m.milestone || 0) > 0 && !payoutDetails[m.id]);

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14 }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Payout Dashboard</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>ADMIN ONLY — SENDME</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "rgba(232,91,91,0.08)", borderRadius: 14, border: "1px solid rgba(232,91,91,0.25)", padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#e85b5b" }}>${fmt(totalDue)}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Total Outstanding</div>
          </div>
          <div style={{ background: "rgba(62,207,142,0.08)", borderRadius: 14, border: "1px solid rgba(62,207,142,0.25)", padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#3ecf8e" }}>${fmt(totalPaid)}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Total Paid Out</div>
          </div>
          <div style={{ background: "rgba(232,179,75,0.08)", borderRadius: 14, border: "1px solid rgba(232,179,75,0.25)", padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#e8b34b" }}>{rows.filter(r => !r.isPaid).length}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Payments Due</div>
          </div>
        </div>

        {/* Missing banking details warning */}
        {missingBanking.length > 0 && (
          <div style={{ background: "rgba(232,179,75,0.07)", border: "1px solid rgba(232,179,75,0.25)", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#e8b34b", fontWeight: 700, marginBottom: 6 }}>
              ⚠️ {missingBanking.length} mission{missingBanking.length > 1 ? "s" : ""} reached a milestone but haven't submitted banking details yet:
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
              {missingBanking.map(m => (
                <div key={m.id}>• {m.title || "Untitled"} ({m.country || m.region})</div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[["due", "Payments Due"], ["paid", "Paid"], ["all", "All"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: "8px 18px", borderRadius: 999, border: `1px solid ${filter === key ? "#e8b34b" : "rgba(255,255,255,0.1)"}`, background: filter === key ? "rgba(232,179,75,0.15)" : "rgba(255,255,255,0.03)", color: filter === key ? "#e8b34b" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {label}
            </button>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)" }}>Loading payout data...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            {filter === "due" ? "🙏 Nothing outstanding — all caught up!" : "No records to show."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((r, i) => (
              <div key={i} style={{ background: "#0c1628", borderRadius: 14, border: `1px solid ${r.isPaid ? "rgba(62,207,142,0.2)" : "rgba(232,179,75,0.2)"}`, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#eef1ff" }}>{r.missionTitle}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>📍 {r.country}</div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 999, background: "rgba(91,156,246,0.12)", color: "#5b9cf6", border: "1px solid rgba(91,156,246,0.25)" }}>
                        {MILESTONE_LABELS[r.milestoneNum - 1] || `Milestone ${r.milestoneNum}`}
                      </span>
                      {r.isPaid && (
                        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 999, background: "rgba(62,207,142,0.12)", color: "#3ecf8e", border: "1px solid rgba(62,207,142,0.25)" }}>
                          ✓ Paid {r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: r.isPaid ? "#3ecf8e" : "#e8b34b" }}>${fmt(r.amount)}</div>
                  </div>
                </div>

                {/* Banking details */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {r.details ? (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "4px 16px" }}>
                      <div><strong style={{ color: "rgba(255,255,255,0.7)" }}>Recipient:</strong> {r.details.recipient_name}</div>
                      <div><strong style={{ color: "rgba(255,255,255,0.7)" }}>Bank:</strong> {r.details.bank_name}</div>
                      <div><strong style={{ color: "rgba(255,255,255,0.7)" }}>Account Holder:</strong> {r.details.account_holder}</div>
                      <div><strong style={{ color: "rgba(255,255,255,0.7)" }}>Account No:</strong> {r.details.account_number}</div>
                      <div><strong style={{ color: "rgba(255,255,255,0.7)" }}>Branch Code:</strong> {r.details.branch_code || "—"}</div>
                      <div><strong style={{ color: "rgba(255,255,255,0.7)" }}>Type:</strong> {r.details.account_type} · {r.details.country}</div>
                      {r.details.swift_code && <div><strong style={{ color: "rgba(255,255,255,0.7)" }}>SWIFT/IBAN:</strong> {r.details.swift_code}</div>}
                      {r.details.notes && <div style={{ gridColumn: "1 / -1" }}><strong style={{ color: "rgba(255,255,255,0.7)" }}>Notes:</strong> {r.details.notes}</div>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#e85b5b" }}>⚠️ No banking details submitted yet for this mission.</div>
                  )}
                </div>

                {/* Mark as paid button */}
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => markPaid(r.missionId, r.milestoneNum, r.amount, r.isPaid)}
                    style={{ padding: "9px 20px", borderRadius: 10, border: "none",
                      background: r.isPaid ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#3ecf8e,#2aaf74)",
                      color: r.isPaid ? "rgba(255,255,255,0.5)" : "#000", fontWeight: 700,
                      cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif" }}>
                    {r.isPaid ? "Mark as Unpaid" : "✓ Mark as Paid"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: "center", padding: "32px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 32 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
            Each mission's goal is split into 3 milestone payments. A row appears here once a
            mission reaches that milestone (tracked via the "milestone" field in Supabase).
            Click "Mark as Paid" once you've completed the EFT — this updates the Transparency Ledger.
          </div>
        </div>
      </div>
    </div>
  );
}
