// AdminApprovals.js — Br Donald's admin screen for approving/rejecting missionary applications
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { ADMIN_EMAIL } from "./AdminPayouts";
import { sendNotification } from "./notifications";

const fmt = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr), now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function AdminApprovals({ onBack, user }) {
  const [missions, setMissions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("pending");
  const [acting, setActing]       = useState(null);   // mission id being acted on
  const [reasons, setReasons]     = useState({});      // { [missionId]: string }
  const [error, setError]         = useState("");
  const [blockedNotice, setBlockedNotice] = useState(null); // mission id flashing a "church not verified" warning
  // Cancel & Reallocate — for a mission that isn't working out (won't get
  // fully funded, minister unavailable, etc). Lets admin move whatever's
  // already been raised to the General Fund or to another active mission,
  // rather than leaving it stranded on a mission going nowhere.
  const [cancelling, setCancelling]   = useState(null);   // mission id showing the cancel UI
  const [reallocTarget, setReallocTarget] = useState({});  // { [missionId]: "general_fund" | otherMissionId }
  const [cancelReason, setCancelReason]   = useState({});  // { [missionId]: string }
  // Flag Missionary — admin's case-by-case call that someone who got full
  // upfront funding never submitted proof. Blocks new applications until
  // admin manually unblocks (no automated deadline — pure judgment call).
  const [flagging, setFlagging]     = useState(null);   // mission id showing the flag UI
  const [flagReason, setFlagReason] = useState({});       // { [missionId]: string }
  const [blockedProfiles, setBlockedProfiles] = useState([]);
  const loadBlockedProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, blocked_reason, blocked_at")
      .eq("blocked_from_applying", true)
      .order("blocked_at", { ascending: false });
    setBlockedProfiles(data || []);
  };
  useEffect(() => { loadBlockedProfiles(); }, []);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMissions(data || []);
    } catch (e) {
      setError("Could not load applications. (" + (e.message || "") + ")");
      setMissions([]);
    }
    setLoading(false);
  };

  const approve = async (m) => {
    // Hard gate: cannot approve unless the church was selected from the
    // verified SendMe directory. Otherwise there's nowhere for milestone
    // payouts to go once the missionary submits proof down the line.
    if (!m.church_verified) {
      setBlockedNotice(m.id);
      setTimeout(() => setBlockedNotice(null), 4000);
      return;
    }
    setActing(m.id);
    setError("");
    try {
      const { error } = await supabase
        .from("missions")
        .update({
          status: "active",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.email,
          rejection_reason: null,
        })
        .eq("id", m.id);
      if (error) throw error;
      sendNotification("application_approved", m.missionary_email, {
        missionaryName: m.missionary_name,
        missionTitle: m.title,
      });
      // Push notification to every subscribed device — new mission is live and needs support.
      supabase.functions.invoke("notify-new-mission", {
        body: { missionTitle: m.title, missionId: m.id, country: m.country },
      }).catch(e => console.log("notify-new-mission error:", e));
      await load();
    } catch (e) {
      setError("Could not approve application. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  // Mission Journey Step 5 ("Mission Completed") and the entire Testimonies
  // screen both depend on missions.status === 'complete' — but nothing
  // anywhere ever set it. TestimonyEngine.js's own header comment already
  // documented the intended design ("Admin marks a mission complete in
  // AdminApprovals.js"); this is that missing control, finally built.
  // Guarded to only apply once all 3 milestones have actually been
  // pastor-approved (current_milestone increments past 3 only then).
  const markComplete = async (m) => {
    setActing(m.id);
    setError("");
    try {
      const { error } = await supabase
        .from("missions")
        .update({ status: "complete" })
        .eq("id", m.id);
      if (error) throw error;
      sendNotification("mission_completed", m.missionary_email, {
        missionaryName: m.missionary_name,
        missionTitle: m.title,
        testimonyUrl: `${window.location.origin}/`,
      });
      await load();
    } catch (e) {
      setError("Could not mark mission complete. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  // Cancel a mission that isn't working out and move whatever's already
  // been raised elsewhere — General Fund, or another active mission —
  // rather than leaving real donor money stranded on a mission going
  // nowhere. This is a records-level reallocation only: no money actually
  // moves between bank accounts here, since it was never paid out to begin
  // with (payouts already require full/milestone funding first — see
  // AdminPayouts.js's own safeguard). This just changes which mission's
  // ledger that raised total belongs to.
  const cancelAndReallocate = async (m) => {
    const target = reallocTarget[m.id];
    const reason = (cancelReason[m.id] || "").trim();
    if (!reason) { window.alert("Please give a reason for cancelling — this is sent to the missionary."); return; }
    if (m.raised > 0 && !target) { window.alert("Choose where the raised funds should go before confirming."); return; }

    const destinationLabel = !target ? null
      : target === "general_fund" ? "the General Fund"
      : missions.find(x => x.id === target)?.title || "another mission";

    const ok = window.confirm(
      `Cancel "${m.title}"?\n\n` +
      (m.raised > 0
        ? `$${fmt(m.raised)} already raised will be moved to ${destinationLabel}.\n\n`
        : `No funds have been raised yet, so nothing needs to move.\n\n`) +
      `This cannot be undone. The missionary will be notified with your reason.`
    );
    if (!ok) return;

    setActing(m.id);
    setError("");
    try {
      if (m.raised > 0) {
        if (target === "general_fund") {
          const { error: gfError } = await supabase.from("general_fund_log").insert({
            type: "donation",
            amount: m.raised,
            donor_name: `Reallocated from cancelled mission: ${m.title}`,
          });
          if (gfError) throw gfError;
        } else {
          const { error: rpcError } = await supabase.rpc("increment_mission_raised", { p_mission_id: target, p_amount: m.raised });
          if (rpcError) throw rpcError;
        }
      }

      const { error: cancelError } = await supabase
        .from("missions")
        .update({ status: "cancelled", raised: 0, cancellation_reason: reason, cancelled_at: new Date().toISOString() })
        .eq("id", m.id);
      if (cancelError) throw cancelError;

      sendNotification("mission_cancelled", m.missionary_email, {
        missionaryName: m.missionary_name,
        missionTitle: m.title,
        reason,
        raised: m.raised,
        destination: destinationLabel,
      });

      setCancelling(null);
      await load();
    } catch (e) {
      setError("Could not cancel this mission. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  // Flag a missionary as currently ineligible for new applications — a
  // judgment call, not an automated rule, so no deadline logic lives here.
  // Lives on the missionary's profile (not the mission) since it's about
  // their eligibility going forward, independent of which specific mission
  // this was about.
  const flagMissionary = async (m) => {
    const reason = (flagReason[m.id] || "").trim();
    if (!reason) { window.alert("Please give a reason — this is recorded and can be shown if the missionary asks why."); return; }
    if (!m.missionary_id) { window.alert("This mission has no linked missionary account to flag."); return; }

    const ok = window.confirm(`Block ${m.missionary_name || "this missionary"} from submitting new applications?\n\nYou can unblock them later from the Blocked Missionaries list on this page.`);
    if (!ok) return;

    setActing(m.id);
    setError("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ blocked_from_applying: true, blocked_reason: reason, blocked_at: new Date().toISOString() })
        .eq("id", m.missionary_id);
      if (error) throw error;
      setFlagging(null);
      await loadBlockedProfiles();
    } catch (e) {
      setError("Could not flag this missionary. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  const unblockMissionary = async (profileId) => {
    const ok = window.confirm("Allow this person to submit new mission applications again?");
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ blocked_from_applying: false, blocked_reason: null, blocked_at: null })
        .eq("id", profileId);
      if (error) throw error;
      await loadBlockedProfiles();
    } catch (e) {
      window.alert("Could not unblock this person. (" + (e.message || "") + ")");
    }
  };

  const reject = async (m) => {
    setActing(m.id);
    setError("");
    try {
      const { error } = await supabase
        .from("missions")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.email,
          rejection_reason: reasons[m.id]?.trim() || null,
        })
        .eq("id", m.id);
      if (error) throw error;
      sendNotification("application_rejected", m.missionary_email, {
        missionaryName: m.missionary_name,
        missionTitle: m.title,
        reason: reasons[m.id]?.trim() || null,
      });
      await load();
    } catch (e) {
      setError("Could not reject application. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>This screen is for SendMe admin only.</div>
          <button onClick={onBack} style={{ padding: "12px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        </div>
      </div>
    );
  }

  const pendingStatuses = ["pending", "pending_church"];
  const filtered = missions.filter(m => {
    if (filter === "pending") return pendingStatuses.includes(m.status);
    if (filter === "active")  return m.status === "active";
    if (filter === "rejected") return m.status === "rejected";
    return true; // all
  });
  const pendingCount = missions.filter(m => pendingStatuses.includes(m.status)).length;

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>

      {/* Header */}
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Mission Approvals</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>ADMIN — MISSIONARY APPLICATIONS</div>
        </div>
        {pendingCount > 0 && (
          <div style={{ background: "rgba(232,179,75,0.15)", border: "1px solid rgba(232,179,75,0.4)", borderRadius: 999, padding: "4px 14px", fontSize: 13, color: "#e8b34b", fontWeight: 700 }}>
            {pendingCount} pending
          </div>
        )}
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* Explainer */}
        <div style={{ background: "rgba(232,179,75,0.06)", borderRadius: 16, border: "1px solid rgba(232,179,75,0.15)", padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e8b34b", marginBottom: 6 }}>✝ Reviewing Applications</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.8 }}>
            Approve to make a mission live and visible to donors. Applications with an unverified church
            (manually typed, not selected from the SendMe directory) cannot be approved until the church
            is sorted — otherwise milestone payouts will have nowhere to go.
          </div>
        </div>

        {/* Blocked Missionaries — the only place to see and reverse a
            flag set via "🚫 Flag Missionary" below. Only shown when
            non-empty, so it doesn't clutter the common case. */}
        {blockedProfiles.length > 0 && (
          <div style={{ background: "rgba(232,91,91,0.05)", borderRadius: 16, border: "1px solid rgba(232,91,91,0.2)", padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e85b5b", marginBottom: 12 }}>🚫 Blocked Missionaries ({blockedProfiles.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {blockedProfiles.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#eef1ff" }}>{p.full_name || p.email}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{p.blocked_reason}</div>
                  </div>
                  <button onClick={() => unblockMissionary(p.id)}
                    style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(62,207,142,0.3)", background: "rgba(62,207,142,0.08)", color: "#3ecf8e", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "Georgia, serif" }}>
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[["pending", "Pending"], ["active", "Active"], ["rejected", "Rejected"], ["all", "All"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: "7px 18px", borderRadius: 999, border: `1px solid ${filter === key ? "#e8b34b" : "rgba(255,255,255,0.1)"}`, background: filter === key ? "rgba(232,179,75,0.15)" : "rgba(255,255,255,0.03)", color: filter === key ? "#e8b34b" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif" }}>
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#f05252" }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading applications...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", padding: "44px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>
              {filter === "pending" ? "No pending applications. 🙏" : `No ${filter} applications.`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {filtered.map(m => {
              const isPending = pendingStatuses.includes(m.status);
              const isActing = acting === m.id;
              const churchOk = !!m.church_verified;
              return (
                <div key={m.id} style={{ background: "#0c1628", borderRadius: 18, border: `1px solid ${isPending ? "rgba(232,179,75,0.25)" : "rgba(255,255,255,0.07)"}`, padding: "20px 22px" }}>

                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#e8b34b", letterSpacing: 2, marginBottom: 4 }}>
                        {(m.missionary_role || "MISSIONARY").toUpperCase()}{m.protected ? " · 🕊️ SHADOW MODE REQUESTED" : ""}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#eef1ff", marginBottom: 3 }}>{m.title || "Untitled Mission"}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>📍 {m.city ? `${m.city}, ` : ""}{m.country || m.region || "Unknown"}</div>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                      background: m.status === "active" ? "rgba(62,207,142,0.12)" : m.status === "rejected" ? "rgba(232,91,91,0.12)" : m.status === "cancelled" ? "rgba(255,255,255,0.08)" : "rgba(232,179,75,0.12)",
                      color: m.status === "active" ? "#3ecf8e" : m.status === "rejected" ? "#e85b5b" : m.status === "cancelled" ? "rgba(255,255,255,0.5)" : "#e8b34b",
                      border: `1px solid ${m.status === "active" ? "rgba(62,207,142,0.3)" : m.status === "rejected" ? "rgba(232,91,91,0.3)" : m.status === "cancelled" ? "rgba(255,255,255,0.15)" : "rgba(232,179,75,0.3)"}` }}>
                      {m.status === "pending_church" ? "pending (church)" : (m.status || "pending")}
                    </span>
                  </div>

                  {/* Applicant info */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px", marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.9 }}>
                    <div><strong style={{ color: "rgba(255,255,255,0.8)" }}>Applicant:</strong> {m.missionary_name || "(shadow mode — name hidden)"} · {m.missionary_email || "no email on file"}</div>
                    <div><strong style={{ color: "rgba(255,255,255,0.8)" }}>Mission:</strong> {m.blurb || m.description || "No description provided."}</div>
                  </div>

                  {/* Church status */}
                  <div style={{ background: churchOk ? "rgba(62,207,142,0.07)" : "rgba(232,91,91,0.08)", borderRadius: 12, border: `1px solid ${churchOk ? "rgba(62,207,142,0.2)" : "rgba(232,91,91,0.25)"}`, padding: "12px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: churchOk ? "#3ecf8e" : "#e85b5b", marginBottom: 2 }}>
                      {churchOk ? "✓ Verified SendMe Church" : "⚠️ Church Not Verified"}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                      {m.church_name || "(no church name given)"}
                      {m.pastor_name ? ` · Pastor ${m.pastor_name}` : ""}
                      {!churchOk && " — typed manually, not selected from the directory. Cannot approve until this church registers or the missionary selects a verified one."}
                    </div>
                  </div>

                  {/* Funding info */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#e8b34b" }}>${fmt(m.goal)}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Goal (USD)</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#5b9cf6" }}>${fmt(m.platform_surcharge)}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Surcharge (10%)</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#eef1ff" }}>{m.local_currency || "USD"}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{m.local_amount ? fmt(m.local_amount) + " local" : "Currency"}</div>
                    </div>
                  </div>

                  {m.requires_full_funding && (
                    <div style={{ background:"rgba(232,179,75,0.08)", border:"1px solid rgba(232,179,75,0.25)", borderRadius:10, padding:"8px 12px", marginBottom:14, fontSize:12, color:"#e8b34b" }}>
                      ⚠️ This missionary indicated the full amount is needed upfront before travel/work can begin — Milestone 1 payout will require the full goal raised, not just a third.
                    </div>
                  )}

                  {/* Milestone payout breakdown — same 3-way split AdminPayouts.js
                      uses once this mission starts receiving proofs, shown here
                      up front so admin can review the actual payout schedule
                      before approving, not just the total goal. */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                    {[1,2,3].map(n => {
                      const goalNum = Number(m.goal) || 0;
                      const third = Math.floor(goalNum / 3);
                      const amount = n < 3 ? third : goalNum - third * 2;
                      const desc = m[`milestone_${n}_detail`];
                      return (
                        <div key={n} style={{ background: "rgba(232,179,75,0.05)", borderRadius: 10, border: "1px solid rgba(232,179,75,0.15)", padding: "10px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e8b34b" }}>${fmt(amount)}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Milestone {n}</div>
                          <div style={{ fontSize: 11, color: desc ? "rgba(255,255,255,0.55)" : "rgba(232,91,91,0.6)", marginTop: 6, lineHeight: 1.4, fontStyle: desc ? "normal" : "italic" }}>
                            {desc || "No milestone description given"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Blocked-approval flash notice */}
                  {blockedNotice === m.id && (
                    <div style={{ background: "rgba(232,91,91,0.12)", border: "1px solid rgba(232,91,91,0.4)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#e85b5b" }}>
                      ⚠️ Cannot approve — this mission's church is not verified yet. Ask the missionary to select a registered church, or wait for their church to complete registration.
                    </div>
                  )}

                  {/* Existing rejection reason (if already rejected) */}
                  {m.status === "rejected" && m.rejection_reason && (
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>Reason given: </span>{m.rejection_reason}
                    </div>
                  )}

                  {/* Reviewed timestamp */}
                  {m.reviewed_at && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: isPending ? 14 : 0 }}>
                      Reviewed {timeAgo(m.reviewed_at)}{m.reviewed_by ? ` by ${m.reviewed_by}` : ""}
                    </div>
                  )}

                  {/* One-tap WhatsApp group post — opens WhatsApp with the
                      message pre-filled; admin picks the group and hits
                      send. WhatsApp has no free API for posting to a group
                      automatically (CallMeBot's free tier explicitly
                      excludes groups), so this keeps it to one tap instead
                      of a fully hands-off send. */}
                  {m.status === "active" && (
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `✝ NEW MISSION APPROVED\n\n*${m.title || "Untitled Mission"}*\n📍 ${m.country || "Unknown"}\n💰 Goal: $${fmt(m.goal)}\n\n${(m.blurb || "").slice(0, 150)}${(m.blurb || "").length > 150 ? "..." : ""}\n\nGive or pray for this mission on SendMe:\nhttps://sendmeglobalmission.org`
                      )}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", textAlign: "center", marginTop: 12, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(37,211,102,0.35)", background: "rgba(37,211,102,0.08)", color: "#25d366", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif", textDecoration: "none" }}>
                      📲 Post to WhatsApp Group
                    </a>
                  )}

                  {/* Cancel & Reallocate — for a mission that isn't working
                      out (time period passed, minister unavailable, etc).
                      Moves whatever's already raised to the General Fund or
                      another active mission, rather than leaving it
                      stranded. */}
                  {m.status === "active" && (
                    cancelling === m.id ? (
                      <div style={{ marginTop: 12, background: "rgba(232,91,91,0.05)", border: "1px solid rgba(232,91,91,0.25)", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, color: "#e85b5b", fontWeight: 700, marginBottom: 10 }}>Cancel This Mission</div>
                        <textarea
                          value={cancelReason[m.id] || ""}
                          onChange={e => setCancelReason(r => ({ ...r, [m.id]: e.target.value }))}
                          placeholder="Reason for cancelling — sent to the missionary, e.g. 'Time period for this mission has passed without full funding.'"
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none", resize: "vertical", minHeight: 50, boxSizing: "border-box", marginBottom: 10 }}
                        />
                        {m.raised > 0 && (
                          <>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Move ${fmt(m.raised)} already raised to:</div>
                            <select
                              value={reallocTarget[m.id] || ""}
                              onChange={e => setReallocTarget(t => ({ ...t, [m.id]: e.target.value }))}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none", marginBottom: 10 }}>
                              <option value="" style={{ background: "#0c1628" }}>Choose a destination...</option>
                              <option value="general_fund" style={{ background: "#0c1628" }}>🌐 SendMe General Fund</option>
                              {missions.filter(x => x.status === "active" && x.id !== m.id).map(x => (
                                <option key={x.id} value={x.id} style={{ background: "#0c1628" }}>{x.title}</option>
                              ))}
                            </select>
                          </>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button disabled={acting === m.id} onClick={() => cancelAndReallocate(m)}
                            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#e85b5b,#c44040)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" }}>
                            Confirm Cancellation
                          </button>
                          <button onClick={() => setCancelling(null)}
                            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" }}>
                            Never Mind
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setCancelling(m.id)}
                        style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 10, border: "1px solid rgba(232,91,91,0.25)", background: "rgba(232,91,91,0.05)", color: "#e85b5b", cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif", fontWeight: 600 }}>
                        🚫 Cancel Mission & Reallocate Funds
                      </button>
                    )
                  )}

                  {/* Flag Missionary — shown regardless of mission status
                      (active, complete, or cancelled), since admin may
                      judge this well after the mission itself is resolved.
                      Not shown if already blocked, to avoid a confusing
                      double-flag. */}
                  {m.missionary_id && !blockedProfiles.some(p => p.id === m.missionary_id) && (
                    flagging === m.id ? (
                      <div style={{ marginTop: 10, background: "rgba(232,91,91,0.05)", border: "1px solid rgba(232,91,91,0.25)", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, color: "#e85b5b", fontWeight: 700, marginBottom: 10 }}>Flag This Missionary</div>
                        <textarea
                          value={flagReason[m.id] || ""}
                          onChange={e => setFlagReason(r => ({ ...r, [m.id]: e.target.value }))}
                          placeholder="Reason — e.g. 'Received full upfront funding for this mission, never submitted proof.'"
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none", resize: "vertical", minHeight: 50, boxSizing: "border-box", marginBottom: 10 }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button disabled={acting === m.id} onClick={() => flagMissionary(m)}
                            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#e85b5b,#c44040)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" }}>
                            Confirm Block
                          </button>
                          <button onClick={() => setFlagging(null)}
                            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif" }}>
                            Never Mind
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setFlagging(m.id)}
                        style={{ marginTop: 8, width: "100%", padding: "8px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 11, fontFamily: "Georgia, serif" }}>
                        🚫 Flag Missionary — No Proof Submitted
                      </button>
                    )
                  )}

                  {/* Email Applicant — lets admin ask questions before deciding.
                      A prefilled mailto: opens in admin's own mail app, so
                      the applicant's reply lands directly in admin's inbox. */}
                  {isPending && m.missionary_email && (
                    <a
                      href={`mailto:${m.missionary_email}?subject=${encodeURIComponent("SendMe — a few questions about your mission application")}&body=${encodeURIComponent(`Dear ${m.missionary_name || "Brother/Sister"},\n\nThank you for applying through SendMe Global Mission Fund with "${m.title || "your mission"}". Before we can make a decision, we have a few questions:\n\n1. \n\nPlease reply to this email with your answers.\n\nGod bless,\nSendMe Global Mission Fund`)}`}
                      style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 12, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(91,156,246,0.35)", background: "rgba(91,156,246,0.08)", color: "#5b9cf6", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif" }}>
                      ✉️ Email Applicant — Ask a Question
                    </a>
                  )}

                  {/* Action area — only for pending */}
                  {isPending && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Rejection reason (only needed if rejecting)</div>
                      <textarea
                        value={reasons[m.id] || ""}
                        onChange={e => setReasons(r => ({ ...r, [m.id]: e.target.value }))}
                        placeholder="e.g. 'Please provide more detail on your mission plan' or 'Church endorsement could not be confirmed.'"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none", resize: "vertical", minHeight: 60, boxSizing: "border-box", marginBottom: 12 }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <button
                          onClick={() => approve(m)}
                          disabled={isActing}
                          style={{ padding: "13px 0", borderRadius: 12, border: "none",
                            background: !churchOk ? "rgba(62,207,142,0.08)" : isActing ? "rgba(62,207,142,0.1)" : "linear-gradient(135deg,#3ecf8e,#2aaf74)",
                            color: !churchOk ? "rgba(62,207,142,0.5)" : isActing ? "#3ecf8e" : "#000",
                            fontWeight: 700, cursor: isActing ? "default" : "pointer", fontSize: 14, fontFamily: "Georgia, serif",
                            boxShadow: (!churchOk || isActing) ? "none" : "0 4px 18px rgba(62,207,142,0.35)", transition: "all .2s" }}>
                          {isActing ? "Saving..." : !churchOk ? "✅ Approve (church unverified)" : "✅ Approve"}
                        </button>
                        <button
                          onClick={() => reject(m)}
                          disabled={isActing}
                          style={{ padding: "13px 0", borderRadius: 12, border: "1px solid rgba(232,91,91,0.4)", background: "rgba(232,91,91,0.08)", color: "#e85b5b", fontWeight: 700, cursor: isActing ? "default" : "pointer", fontSize: 14, fontFamily: "Georgia, serif", transition: "all .2s" }}>
                          {isActing ? "Saving..." : "❌ Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Mark Mission Complete — only for active missions. Guarded
                      until all 3 milestones are pastor-approved, since
                      current_milestone only passes 3 once milestone 3 itself
                      has been approved (see PastorReview.js). */}
                  {m.status === "active" && (() => {
                    const milestonesApproved = Math.min((m.current_milestone || 1) - 1, 3);
                    const allDone = milestonesApproved >= 3;
                    return (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                        {allDone ? (
                          <button onClick={() => markComplete(m)} disabled={isActing}
                            style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
                              background: isActing ? "rgba(232,179,75,0.15)" : "linear-gradient(135deg,#e8b34b,#c8942b)",
                              color: isActing ? "#e8b34b" : "#000", fontWeight: 700, cursor: isActing ? "default" : "pointer",
                              fontSize: 14, fontFamily: "Georgia, serif", boxShadow: isActing ? "none" : "0 4px 18px rgba(232,179,75,0.35)" }}>
                            {isActing ? "Saving..." : "🏆 Mark Mission Complete"}
                          </button>
                        ) : (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                            {milestonesApproved} of 3 milestones approved — mission can be marked complete once all three are done.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", padding: "32px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 32 }}>
          <div style={{ fontSize: 13, color: "#e8b34b", fontStyle: "italic" }}>"Try the spirits whether they are of God." — 1 John 4:1</div>
        </div>
      </div>
    </div>
  );
}