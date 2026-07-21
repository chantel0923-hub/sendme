// AdminPipeline.js — Mission Pipeline Dashboard
//
// Answers "where is everything stuck, and what do I need to do next?" by
// walking every mission through its real lifecycle stage in one place,
// instead of Admin having to check Approvals, Church Verification, and
// Payouts separately to piece the same picture together.
//
// Stage logic is intentionally a single computed value per mission (not a
// checklist) so nothing shows up in two places at once — each mission has
// exactly one "next thing that needs to happen" at any time.

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  return diff;
};

const milestoneAmount = (goal, milestoneNum) => {
  const goalNum = Number(goal) || 0;
  const third = Math.floor(goalNum / 3);
  if (milestoneNum < 3) return third;
  return goalNum - third * 2;
};

// Stages Admin can actually act on right now — these get a colored card and
// a "Go to X" button.
const ACTIONABLE_STAGES = {
  church_verification: { label: "⛪ Awaiting Church Verification", color: "#5b9cf6", action: "Go to Church Verification", nav: "onAdminChurchVerification" },
  application_approval:{ label: "📋 Awaiting Application Approval", color: "#e8b34b", action: "Go to Approvals", nav: "onAdminApprovals" },
  banking_missing:     { label: "🏦 Approved — Banking Details Missing", color: "#e85b5b", action: "Go to Payouts", nav: "onAdminPayouts" },
  awaiting_payout:      { label: "💰 Approved — Awaiting Payout", color: "#e8b34b", action: "Go to Payouts", nav: "onAdminPayouts" },
  ready_to_complete:   { label: "🏆 Ready to Mark Complete", color: "#3ecf8e", action: "Go to Approvals", nav: "onAdminApprovals" },
};

// Stages that are genuinely waiting on someone else (pastor, missionary, or
// donors) — shown for full visibility, but without an action button, so
// it's clear at a glance these aren't sitting on Admin's desk.
const WAITING_STAGES = {
  pastor_review:    { label: "⏳ Awaiting Pastor Review", color: "#b06cf5" },
  missionary_proof: { label: "📸 Awaiting Missionary Proof Submission", color: "#5b9cf6" },
  donor_funding:    { label: "💸 Awaiting Donor Funding", color: "rgba(255,255,255,0.35)" },
};

const STUCK_THRESHOLD_DAYS = 3;

export default function AdminPipeline({ onBack, onAdminChurchVerification, onAdminApprovals, onAdminPayouts }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [staged, setStaged]   = useState({}); // { stageKey: [mission, ...] }

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [missionsRes, churchesRes, payoutDetailsRes, proofsRes, recordsRes] = await Promise.all([
        supabase.from("missions").select("*").order("created_at", { ascending: false }),
        supabase.from("churches").select("id, name, verified, pastor_name"),
        supabase.from("payout_details").select("mission_id, church_id"),
        supabase.from("milestone_proofs").select("mission_id, milestone_number, status, submitted_at, reviewed_at").order("submitted_at", { ascending: false }),
        supabase.from("payout_records").select("mission_id, milestone_number, status"),
      ]);
      if (missionsRes.error) throw missionsRes.error;

      const churchById = {};
      (churchesRes.data || []).forEach(c => { churchById[c.id] = c; });

      const bankingByChurch  = new Set((payoutDetailsRes.data || []).filter(d => d.church_id).map(d => d.church_id));
      const bankingByMission = new Set((payoutDetailsRes.data || []).filter(d => d.mission_id).map(d => d.mission_id));

      // #new-bug — this was the actual gap: previously nothing here ever
      // checked payout_records, so an approved milestone stayed in "Awaiting
      // Payout" forever, even after Admin marked it paid on the Payouts
      // screen. Build a lookup of which (mission, milestone) pairs are
      // already paid, same table AdminPayouts.js itself uses for this.
      const paidSet = new Set(
        (recordsRes.data || [])
          .filter(r => r.status === "paid")
          .map(r => `${r.mission_id}:${r.milestone_number}`)
      );

      // Latest proof per (mission_id, milestone_number) — proofsRes is
      // already ordered newest-first, so the first match wins.
      const latestProofFor = {};
      (proofsRes.data || []).forEach(p => {
        const key = `${p.mission_id}:${p.milestone_number}`;
        if (!latestProofFor[key]) latestProofFor[key] = p;
      });

      // All approved proofs that do NOT yet have a matching paid record —
      // grouped by mission, oldest first, so we always surface the
      // longest-outstanding unpaid milestone.
      const unpaidApprovedByMission = {};
      (proofsRes.data || [])
        .filter(p => p.status === "approved" && !paidSet.has(`${p.mission_id}:${p.milestone_number}`))
        .sort((a, b) => new Date(a.reviewed_at || 0) - new Date(b.reviewed_at || 0))
        .forEach(p => {
          if (!unpaidApprovedByMission[p.mission_id]) unpaidApprovedByMission[p.mission_id] = p;
        });

      const buckets = {};
      const pushTo = (key, mission, extra) => {
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push({ ...mission, _extra: extra });
      };

      (missionsRes.data || []).forEach(m => {
        if (m.status === "rejected" || m.status === "complete") return; // not actionable, not shown here

        if (m.status === "pending_church") {
          pushTo("church_verification", m, { since: m.created_at });
          return;
        }
        if (m.status === "pending") {
          const church = m.church_id ? churchById[m.church_id] : null;
          if (m.church_id && church && !church.verified) {
            pushTo("church_verification", m, { since: m.created_at });
          } else {
            pushTo("application_approval", m, { since: m.created_at });
          }
          return;
        }
        if (m.status !== "active") return;

        const currentMilestone = m.current_milestone || 1;
        const milestonesApproved = Math.min(currentMilestone - 1, 3);

        // Check for any approved-but-unpaid milestone FIRST, regardless of
        // current_milestone — this is the actual highest-priority admin
        // action, and current_milestone alone isn't a reliable signal of
        // payout status (it advances on approval, not on payment).
        const unpaid = unpaidApprovedByMission[m.id];
        if (unpaid) {
          const hasBanking = (m.church_id && bankingByChurch.has(m.church_id)) || bankingByMission.has(m.id);
          if (!hasBanking) {
            pushTo("banking_missing", m, { since: unpaid.reviewed_at });
          } else {
            pushTo("awaiting_payout", m, { since: unpaid.reviewed_at });
          }
          return;
        }

        if (milestonesApproved >= 3) {
          pushTo("ready_to_complete", m, { since: m.updated_at || m.created_at });
          return;
        }

        const proofKey = `${m.id}:${currentMilestone}`;
        const latestProof = latestProofFor[proofKey];

        if (latestProof && latestProof.status === "pending") {
          pushTo("pastor_review", m, { since: latestProof.submitted_at });
          return;
        }

        // No proof in yet for the current milestone — waiting on either
        // funding or the missionary, not on Admin.
        const threshold = milestoneAmount(m.goal, currentMilestone);
        const raisedSoFar = m.raised || 0;
        if (raisedSoFar >= threshold) {
          pushTo("missionary_proof", m, { since: m.updated_at || m.created_at });
        } else {
          pushTo("donor_funding", m, { since: m.created_at });
        }
      });

      setStaged(buckets);
    } catch (e) {
      setError("Could not load pipeline. (" + (e.message || "") + ")");
    }
    setLoading(false);
  };

  const navCallbacks = { onAdminChurchVerification, onAdminApprovals, onAdminPayouts };

  const renderSection = (key, meta, isActionable) => {
    const items = staged[key] || [];
    if (items.length === 0) return null;
    return (
      <div key={key} style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.label}</span>
          <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, background: `${meta.color}18`, color: meta.color, fontWeight: 700 }}>{items.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(m => {
            const days = daysSince(m._extra?.since);
            const stuck = days !== null && days >= STUCK_THRESHOLD_DAYS;
            return (
              <div key={m.id} style={{ background: "#0c1628", borderRadius: 14, border: `1px solid ${meta.color}33`, borderLeft: `3px solid ${meta.color}`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#eef1ff" }}>{m.title || "Untitled Mission"}</span>
                    {days !== null && (
                      <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: stuck ? "rgba(232,91,91,0.15)" : "rgba(255,255,255,0.06)", color: stuck ? "#e85b5b" : "rgba(255,255,255,0.35)", fontWeight: 700 }}>
                        {stuck ? "⚠ " : ""}{days === 0 ? "today" : `${days}d`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    📍 {m.city ? `${m.city}, ` : ""}{m.country || "Unknown"} · {m.church_name || "No church linked"}
                  </div>
                </div>
                {isActionable && meta.nav && navCallbacks[meta.nav] && (
                  <button onClick={navCallbacks[meta.nav]} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${meta.color}44`, background: `${meta.color}18`, color: meta.color, fontWeight: 700, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif", whiteSpace: "nowrap" }}>
                    {meta.action} →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const actionableCount = Object.keys(ACTIONABLE_STAGES).reduce((sum, k) => sum + (staged[k]?.length || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🗺 Mission Pipeline</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>SENDME ADMIN — WHERE IS EVERYTHING STUCK</div>
        </div>
        <button onClick={load} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif" }}>↻ Refresh</button>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 20px 60px" }}>

        {error && (
          <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#f05252" }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.3)" }}>Loading pipeline...</div>
        ) : (
          <>
            <div style={{ background: "rgba(232,179,75,0.06)", border: "1px solid rgba(232,179,75,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
              <strong style={{ color: "#e8b34b" }}>{actionableCount}</strong> mission{actionableCount === 1 ? "" : "s"} need{actionableCount === 1 ? "s" : ""} your action right now. Items marked <span style={{ color: "#e85b5b" }}>⚠</span> have been waiting {STUCK_THRESHOLD_DAYS}+ days in the same stage.
            </div>

            {/* Actionable — needs Admin to do something */}
            {renderSection("church_verification", ACTIONABLE_STAGES.church_verification, true)}
            {renderSection("application_approval", ACTIONABLE_STAGES.application_approval, true)}
            {renderSection("banking_missing", ACTIONABLE_STAGES.banking_missing, true)}
            {renderSection("awaiting_payout", ACTIONABLE_STAGES.awaiting_payout, true)}
            {renderSection("ready_to_complete", ACTIONABLE_STAGES.ready_to_complete, true)}

            {actionableCount === 0 && (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#3ecf8e", fontSize: 14, marginBottom: 10 }}>
                ✓ Nothing needs your action right now.
              </div>
            )}

            {/* Waiting on someone else — shown for visibility only */}
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: 1, textTransform: "uppercase", margin: "28px 0 14px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
              Waiting on someone else — no action needed from you
            </div>
            {renderSection("pastor_review", WAITING_STAGES.pastor_review, false)}
            {renderSection("missionary_proof", WAITING_STAGES.missionary_proof, false)}
            {renderSection("donor_funding", WAITING_STAGES.donor_funding, false)}
          </>
        )}
      </div>
    </div>
  );
}
