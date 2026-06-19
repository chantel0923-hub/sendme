import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const pct = (r, g) => Math.min(100, Math.round((r / (g || 1)) * 100));

const statusColor = { pending: "#e8b34b", approved: "#3ecf8e", rejected: "#e85b5b" };
const statusIcon  = { pending: "⏳", approved: "✅", rejected: "❌" };

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr), now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function MissionaryDashboard({ onBack, user, onSubmitProof }) {
  const [missions, setMissions]     = useState([]);
  const [proofsByMission, setProofsByMission] = useState({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  useEffect(() => {
    loadMyMissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadMyMissions = async () => {
    setLoading(true);
    setError("");
    try {
      if (!user) { setMissions([]); setLoading(false); return; }

      // Try the three ways a mission could be linked to this missionary,
      // in order of correctness. Older applications may only be linked
      // by email, so we fall back gracefully rather than show a blank screen.
      let found = [];

      const byMissionaryId = await supabase
        .from("missions")
        .select("*")
        .eq("missionary_id", user.id)
        .order("created_at", { ascending: false });
      if (byMissionaryId.data && byMissionaryId.data.length > 0) {
        found = byMissionaryId.data;
      }

      if (found.length === 0 && user.email) {
        const byEmail = await supabase
          .from("missions")
          .select("*")
          .eq("missionary_email", user.email)
          .order("created_at", { ascending: false });
        if (byEmail.data && byEmail.data.length > 0) found = byEmail.data;
      }

      if (found.length === 0) {
        // Legacy fallback — some early test rows may have been written
        // to a user_id column before missionary_id existed.
        try {
          const byUserId = await supabase
            .from("missions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
          if (byUserId.data && byUserId.data.length > 0) found = byUserId.data;
        } catch {
          // user_id column may not exist at all — safe to ignore
        }
      }

      setMissions(found);

      // Load this missionary's submitted proofs for each mission found
      if (found.length > 0) {
        const ids = found.map(m => m.id);
        const { data: proofData } = await supabase
          .from("milestone_proofs")
          .select("*")
          .in("mission_id", ids)
          .order("submitted_at", { ascending: false });

        const grouped = {};
        (proofData || []).forEach(p => {
          if (!grouped[p.mission_id]) grouped[p.mission_id] = [];
          grouped[p.mission_id].push(p);
        });
        setProofsByMission(grouped);
      }
    } catch (e) {
      setError("Could not load your missions. (" + (e.message || "") + ")");
      setMissions([]);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>✝</div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Please sign in to view your missionary dashboard.</div>
          <button onClick={onBack} style={{ padding: "12px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>

      {/* Header */}
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>My Missionary Dashboard</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>YOUR MISSION, AT A GLANCE</div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* Welcome */}
        <div style={{ background: "rgba(232,179,75,0.08)", borderRadius: 16, border: "1px solid rgba(232,179,75,0.2)", padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e8b34b", marginBottom: 6 }}>✝ Welcome, {user.user_metadata?.full_name || user.email?.split("@")[0]}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
            Here you can see your mission's progress, your current milestone, and the status of every proof you've submitted to your pastor.
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#f05252" }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading your mission...</div>
        ) : missions.length === 0 ? (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", padding: "44px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 38, marginBottom: 14 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#eef1ff", marginBottom: 8 }}>No mission linked to your account yet</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, maxWidth: 420, margin: "0 auto" }}>
              If you've already applied, your application may still be pending review,
              or it may have been submitted under a different email. If this doesn't
              look right, please reach out to SendMe support so we can link your account.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {missions.map(m => {
              const proofs = proofsByMission[m.id] || [];
              const currentMilestone = m.current_milestone || m.milestone || 1;
              const raised = m.raised || 0;
              const goal = m.goal || m.collection_target || 1;
              return (
                <div key={m.id} style={{ background: "#0c1628", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>

                  {/* Mission header */}
                  <div style={{ padding: "20px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#e8b34b", letterSpacing: 2, marginBottom: 4 }}>
                          {(m.missionary_role || "MISSIONARY").toUpperCase()}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#eef1ff" }}>{m.title || "Untitled Mission"}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>📍 {m.city ? `${m.city}, ` : ""}{m.country || "Unknown"}</div>
                      </div>
                      <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                        background: m.status === "active" ? "rgba(62,207,142,0.12)" : "rgba(255,255,255,0.06)",
                        color: m.status === "active" ? "#3ecf8e" : "rgba(255,255,255,0.4)",
                        border: `1px solid ${m.status === "active" ? "rgba(62,207,142,0.3)" : "rgba(255,255,255,0.1)"}` }}>
                        {(m.status || "pending").replace("_", " ")}
                      </span>
                    </div>

                    {/* Funding progress */}
                    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, height: 6, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ width: `${pct(raised, goal)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#e8b34b,#c8942b)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "#e8b34b", fontWeight: 700 }}>${fmt(raised)} raised</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{pct(raised, goal)}% of ${fmt(goal)}</span>
                    </div>
                  </div>

                  {/* Milestone status */}
                  <div style={{ padding: "16px 22px", display: "flex", alignItems: "center", gap: 14, background: "rgba(91,156,246,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 26 }}>📋</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#5b9cf6" }}>Current Milestone: {currentMilestone}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                        {proofs.some(p => p.milestone_number === currentMilestone && p.status === "pending")
                          ? "Your proof is waiting for pastor review."
                          : "Submit proof of your work to release the next milestone's funds."}
                      </div>
                    </div>
                    {onSubmitProof && (
                      <button onClick={onSubmitProof} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif", whiteSpace: "nowrap" }}>
                        Submit Proof
                      </button>
                    )}
                  </div>

                  {/* Submitted proofs history */}
                  <div style={{ padding: "16px 22px" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: proofs.length > 0 ? 12 : 0 }}>
                      {proofs.length === 0 ? "No proofs submitted yet for this mission." : `Your Submitted Proofs (${proofs.length})`}
                    </div>
                    {proofs.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {proofs.map(p => {
                          const sc = statusColor[p.status] || "#e8b34b";
                          return (
                            <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, border: `1px solid ${sc}33`, padding: "12px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>Milestone {p.milestone_number}</span>
                                <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, background: `${sc}18`, color: sc, border: `1px solid ${sc}44`, fontWeight: 700, whiteSpace: "nowrap" }}>
                                  {statusIcon[p.status]} {(p.status || "pending").charAt(0).toUpperCase() + (p.status || "pending").slice(1)}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>{p.description}</div>
                              {p.pastor_notes && (
                                <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.35)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                                  <span style={{ color: "rgba(255,255,255,0.25)" }}>Pastor's notes: </span>{p.pastor_notes}
                                </div>
                              )}
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>Submitted {timeAgo(p.submitted_at)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", padding: "32px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 32 }}>
          <div style={{ fontSize: 13, color: "#e8b34b", fontStyle: "italic" }}>"Here am I Lord, send me." — Isaiah 6:8</div>
        </div>
      </div>
    </div>
  );
}
