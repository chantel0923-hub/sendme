import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { sendNotification } from "./notifications";

export default function PastorReview({ onBack, user, isAdmin }) {
  const [proofs, setProofs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(null); // proof id being acted on
  const [notes, setNotes]       = useState({});   // { [proofId]: string }
  const [error, setError]       = useState("");
  const [filter, setFilter]     = useState("pending");

  useEffect(() => {
    loadProofs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProofs = async () => {
    setLoading(true);
    setError("");
    try {
      // Load all proofs joined with mission info.
      // We join missions so the pastor can see which mission each proof belongs to.
      const { data, error } = await supabase
        .from("milestone_proofs")
        .select(`
          id, mission_id, milestone_number, description, media_url,
          submitted_at, status, reviewed_at, pastor_notes,
          missions ( id, title, country, city, church_id, church_name, current_milestone, missionary_role, missionary_email )
        `)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      // If pastor has a church linked via churches.user_id, filter to their church's missions.
      // For now we load all proofs — the pastor sees everything pending for their church.
      // We filter client-side by their church_id from their profile if available.
      let filtered = data || [];

      if (user) {
        // Try to find the pastor's church
        const { data: churchData } = await supabase
          .from("churches")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        // Admins see everything; pastors see ONLY their own church's proofs.
        // NEVER fall back to showing every church's proofs if none is linked —
        // that was bug #60, and let a pastor with no linked church see (and
        // approve/reject) proofs belonging to churches that aren't theirs.
        if (!isAdmin) {
          filtered = churchData?.id
            ? filtered.filter(p => p.missions?.church_id === churchData.id)
            : [];
        }
      }

      setProofs(filtered);
    } catch (e) {
      setError("Could not load proofs. (" + (e.message || "") + ")");
      setProofs([]);
    }
    setLoading(false);
  };

  const handleDecision = async (proof, decision) => {
    setActing(proof.id);
    setError("");
    try {
      const { error } = await supabase
        .from("milestone_proofs")
        .update({
          status: decision,
          reviewed_at: new Date().toISOString(),
          pastor_notes: notes[proof.id]?.trim() || null,
        })
        .eq("id", proof.id);

      if (error) throw error;

      // If approved, advance the mission's current_milestone
      if (decision === "approved" && proof.missions?.id) {
        const nextMilestone = (proof.missions.current_milestone || 1) + 1;
        await supabase
          .from("missions")
          .update({ current_milestone: nextMilestone })
          .eq("id", proof.missions.id);
      }

      sendNotification(
        decision === "approved" ? "proof_approved" : "proof_rejected",
        proof.missions?.missionary_email,
        {
          missionTitle: proof.missions?.title,
          milestoneNumber: proof.milestone_number,
          reason: notes[proof.id]?.trim() || null,
        }
      );

      // Refresh list
      await loadProofs();
    } catch (e) {
      setError("Could not save decision. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr), now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const displayed = proofs.filter(p => filter === "all" ? true : p.status === filter);
  const pendingCount = proofs.filter(p => p.status === "pending").length;

  const statusColor = { pending: "#e8b34b", approved: "#3ecf8e", rejected: "#e85b5b" };
  const statusIcon  = { pending: "⏳", approved: "✅", rejected: "❌" };

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>

      {/* Header */}
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Pastor Review Panel</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>MILESTONE PROOF APPROVAL</div>
        </div>
        {pendingCount > 0 && (
          <div style={{ background: "rgba(232,179,75,0.15)", border: "1px solid rgba(232,179,75,0.4)", borderRadius: 999, padding: "4px 14px", fontSize: 13, color: "#e8b34b", fontWeight: 700 }}>
            {pendingCount} pending
          </div>
        )}
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* Explainer */}
        <div style={{ background: "rgba(232,179,75,0.06)", borderRadius: 16, border: "1px solid rgba(232,179,75,0.15)", padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e8b34b", marginBottom: 6 }}>⛪ Your Role as Pastor</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.8 }}>
            Review proof submitted by missionaries from your church. Approve to release the next milestone's funds to your church account. Reject if the evidence is insufficient — add notes to guide the missionary.
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
          {[
            ["⏳", proofs.filter(p => p.status === "pending").length,  "Pending Review", "#e8b34b"],
            ["✅", proofs.filter(p => p.status === "approved").length, "Approved",       "#3ecf8e"],
            ["❌", proofs.filter(p => p.status === "rejected").length, "Rejected",       "#e85b5b"],
          ].map(([icon, val, label, c]) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 20 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c, marginTop: 4 }}>{val}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["all","All"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: "7px 18px", borderRadius: 999, border: `1px solid ${filter === key ? "#e8b34b" : "rgba(255,255,255,0.1)"}`, background: filter === key ? "rgba(232,179,75,0.15)" : "rgba(255,255,255,0.03)", color: filter === key ? "#e8b34b" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f05252" }}>
            ⚠ {error}
          </div>
        )}

        {/* Proof list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading proofs...</div>
        ) : displayed.length === 0 ? (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>
              {filter === "pending" ? "No pending proofs to review." : `No ${filter} proofs.`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {displayed.map(proof => {
              const m = proof.missions || {};
              const isPending = proof.status === "pending";
              const sc = statusColor[proof.status] || "#e8b34b";
              return (
                <div key={proof.id} style={{ background: "#0c1628", borderRadius: 18, border: `1px solid ${isPending ? "rgba(232,179,75,0.25)" : "rgba(255,255,255,0.07)"}`, borderLeft: `3px solid ${sc}`, padding: "20px 22px" }}>

                  {/* Mission info */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 4 }}>
                        {m.missionary_role || "MISSIONARY"} · MILESTONE {proof.milestone_number}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#eef1ff", marginBottom: 3 }}>{m.title || "Unknown Mission"}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>📍 {m.city ? `${m.city}, ` : ""}{m.country || ""}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, background: `${sc}18`, color: sc, border: `1px solid ${sc}44`, fontWeight: 700 }}>
                        {statusIcon[proof.status]} {proof.status.charAt(0).toUpperCase() + proof.status.slice(1)}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{timeAgo(proof.submitted_at)}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Field Report</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.75 }}>{proof.description}</div>
                  </div>

                  {/* Media URL */}
                  {proof.media_url && (
                    <div style={{ marginBottom: 14 }}>
                      <a href={proof.media_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(91,156,246,0.1)", border: "1px solid rgba(91,156,246,0.25)", color: "#5b9cf6", fontSize: 13, textDecoration: "none", fontFamily: "Georgia, serif", fontWeight: 600 }}>
                        📎 View Photo / Video Evidence ↗
                      </a>
                    </div>
                  )}

                  {/* Previous pastor notes (if rejected/approved already) */}
                  {proof.pastor_notes && !isPending && (
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>Your notes: </span>
                      {proof.pastor_notes}
                    </div>
                  )}

                  {/* Action area — only for pending */}
                  {isPending && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Add notes (optional — required if rejecting)</div>
                      <textarea
                        value={notes[proof.id] || ""}
                        onChange={e => setNotes(n => ({ ...n, [proof.id]: e.target.value }))}
                        placeholder="e.g. 'Approved — evidence is clear and sufficient.' or 'Please upload photos from the crusade before I can approve.'"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#eef1ff", fontSize: 13, fontFamily: "Georgia, serif", outline: "none", resize: "vertical", minHeight: 70, boxSizing: "border-box", marginBottom: 12 }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <button
                          onClick={() => handleDecision(proof, "approved")}
                          disabled={acting === proof.id}
                          style={{ padding: "13px 0", borderRadius: 12, border: "none", background: acting === proof.id ? "rgba(62,207,142,0.1)" : "linear-gradient(135deg,#3ecf8e,#2aaf74)", color: acting === proof.id ? "#3ecf8e" : "#000", fontWeight: 700, cursor: acting === proof.id ? "default" : "pointer", fontSize: 14, fontFamily: "Georgia, serif", boxShadow: acting === proof.id ? "none" : "0 4px 18px rgba(62,207,142,0.35)", transition: "all .2s" }}>
                          {acting === proof.id ? "Saving..." : "✅  Approve"}
                        </button>
                        <button
                          onClick={() => handleDecision(proof, "rejected")}
                          disabled={acting === proof.id}
                          style={{ padding: "13px 0", borderRadius: 12, border: "1px solid rgba(232,91,91,0.4)", background: "rgba(232,91,91,0.08)", color: "#e85b5b", fontWeight: 700, cursor: acting === proof.id ? "default" : "pointer", fontSize: 14, fontFamily: "Georgia, serif", transition: "all .2s" }}>
                          {acting === proof.id ? "Saving..." : "❌  Reject"}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 10, textAlign: "center" }}>
                        Approving will advance this mission to Milestone {(m.current_milestone || 1) + 1} and notify admin to release funds.
                      </div>
                    </div>
                  )}

                  {/* Reviewed timestamp */}
                  {!isPending && proof.reviewed_at && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
                      Reviewed {timeAgo(proof.reviewed_at)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", padding: "32px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 32 }}>
          <div style={{ fontSize: 13, color: "#e8b34b", fontStyle: "italic" }}>"Moreover it is required in stewards, that a man be found faithful." — 1 Corinthians 4:2</div>
        </div>
      </div>
    </div>
  );
}
