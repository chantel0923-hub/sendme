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
                      background: m.status === "active" ? "rgba(62,207,142,0.12)" : m.status === "rejected" ? "rgba(232,91,91,0.12)" : "rgba(232,179,75,0.12)",
                      color: m.status === "active" ? "#3ecf8e" : m.status === "rejected" ? "#e85b5b" : "#e8b34b",
                      border: `1px solid ${m.status === "active" ? "rgba(62,207,142,0.3)" : m.status === "rejected" ? "rgba(232,91,91,0.3)" : "rgba(232,179,75,0.3)"}` }}>
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

                  {/* Milestone payout breakdown — same 3-way split AdminPayouts.js
                      uses once this mission starts receiving proofs, shown here
                      up front so admin can review the actual payout schedule
                      before approving, not just the total goal. */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                    {[1,2,3].map(n => {
                      const goalNum = Number(m.goal) || 0;
                      const third = Math.floor(goalNum / 3);
                      const amount = n < 3 ? third : goalNum - third * 2;
                      const desc = m[`milestone${n}_desc`];
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