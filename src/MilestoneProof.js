import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { sendNotification } from "./notifications";

export default function MilestoneProof({ onBack, user }) {
  const [missions, setMissions]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(true);
  // #102 — if the missionary already has a pending proof in for this
  // mission's current milestone, we show it instead of a blank editable
  // form. Previously re-entering this screen after submitting always
  // showed a fresh blank form, which looked like the submission had been
  // lost even though it was safely sitting in the database the whole time.
  const [existingProof, setExistingProof] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("missions")
          .select("id, title, country, city, current_milestone, status, missionary_id, pastor_email, pastor_name, milestone_1_detail, milestone_2_detail, milestone_3_detail")
          .eq("status", "active");
        if (error) throw error;
        // Only ever show missions belonging to the logged-in missionary.
        // NEVER fall back to showing everyone's missions if none match —
        // that was bug #59, and let users submit proof for any mission.
        setMissions(user ? (data || []).filter(m => m.missionary_id === user.id) : []);
      } catch {
        setMissions([]);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // #102 — check for an existing pending proof whenever the selected
  // mission (or its current milestone) changes.
  useEffect(() => {
    if (!selected) { setExistingProof(null); return; }
    let cancelled = false;
    setCheckingExisting(true);
    (async () => {
      const { data } = await supabase
        .from("milestone_proofs")
        .select("id, description, media_url, status, submitted_at")
        .eq("mission_id", selected.id)
        .eq("milestone_number", selected.current_milestone || 1)
        .eq("status", "pending")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setExistingProof(data || null);
        setCheckingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  // #98/#99 — resolve the right milestone_N_detail column for whichever
  // milestone number a mission is currently on.
  const getMilestoneDetail = (mission) => {
    if (!mission) return null;
    const n = mission.current_milestone || 1;
    return mission[`milestone_${n}_detail`] || null;
  };

  const handleSubmit = async () => {
    if (!selected || !description.trim()) {
      setError("Please select a mission and add a description.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { error } = await supabase.from("milestone_proofs").insert({
        mission_id: selected.id,
        milestone_number: selected.current_milestone || 1,
        description: description.trim(),
        media_url: mediaUrl.trim() || null,
        status: "pending",
        submitted_at: new Date().toISOString(),
      });
      if (error) throw error;
      sendNotification("proof_submitted", selected.pastor_email, {
        pastorName: selected.pastor_name,
        missionaryName: user?.user_metadata?.full_name,
        missionTitle: selected.title,
        milestoneNumber: selected.current_milestone || 1,
      });
      setSuccess(true);
    } catch (e) {
      setError("Could not submit proof. Please try again. (" + (e.message || "") + ")");
    }
    setSubmitting(false);
  };

  const inp = {
    width: "100%", padding: "13px 16px", borderRadius: 12,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#eef1ff", fontSize: 15, fontFamily: "Georgia, serif", outline: "none",
    marginBottom: 14, boxSizing: "border-box",
  };

  if (success) return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🙏</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#eef1ff", marginBottom: 10 }}>Proof Submitted!</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: 24 }}>
          Your milestone proof has been sent to your pastor for review. Funds for the next milestone will be released once they approve it.
        </div>
        <div style={{ background: "rgba(232,179,75,0.08)", borderRadius: 16, border: "1px solid rgba(232,179,75,0.2)", padding: "16px 24px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: "#e8b34b", fontStyle: "italic" }}>"The harvest is plentiful but the workers are few." — Matthew 9:37</div>
        </div>
        <button onClick={onBack} style={{ padding: "14px 40px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#e8b34b,#c8942b)", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 15, fontFamily: "Georgia, serif" }}>
          Back to Home
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", color: "#eef1ff", fontFamily: "Georgia, serif" }}>
      {/* Header */}
      <div style={{ background: "#09111f", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, fontFamily: "Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Submit Milestone Proof</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>MISSIONARY ACCOUNTABILITY</div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* Explainer */}
        <div style={{ background: "rgba(232,179,75,0.08)", borderRadius: 16, border: "1px solid rgba(232,179,75,0.2)", padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e8b34b", marginBottom: 8 }}>✝ How Milestone Proof Works</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
            Upload evidence of your completed milestone — a photo URL, video link, or written report. Your pastor will review and approve it. Once approved, SendMe will release the next milestone's funds to your church.
          </div>
        </div>

        {/* Mission selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Select Your Mission</div>
          {loading ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading your missions...</div>
          ) : missions.length === 0 ? (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              No active missions are linked to your account yet.<br />
              If you believe this is a mistake, please contact support via the FAQ page.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {missions.map(m => (
                <div key={m.id} onClick={() => setSelected(m)}
                  style={{ background: selected?.id === m.id ? "rgba(232,179,75,0.1)" : "rgba(255,255,255,0.03)", borderRadius: 14, border: `1px solid ${selected?.id === m.id ? "rgba(232,179,75,0.5)" : "rgba(255,255,255,0.08)"}`, padding: "16px 18px", cursor: "pointer", transition: "all .15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#eef1ff" }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>📍 {m.city ? `${m.city}, ` : ""}{m.country}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#e8b34b", fontWeight: 700 }}>Milestone</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#e8b34b" }}>{m.current_milestone || 1}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <>
            {/* Current milestone badge */}
            <div style={{ background: "rgba(91,156,246,0.08)", borderRadius: 12, border: "1px solid rgba(91,156,246,0.2)", padding: "12px 16px", marginBottom: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 24 }}>📋</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#5b9cf6" }}>Submitting proof for Milestone {selected.current_milestone || 1}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{selected.title}</div>
              </div>
            </div>

            {/* #99 — what's actually required for this milestone, set by the
                pastor. Falls back to a plain note if nothing's been defined
                yet, rather than showing nothing at all. */}
            <div style={{ background: "rgba(232,179,75,0.06)", borderRadius: 12, border: "1px solid rgba(232,179,75,0.18)", padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e8b34b", marginBottom: 6 }}>What's required for this milestone</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
                {getMilestoneDetail(selected) || "Your pastor hasn't written specific requirements for this milestone yet. Describe your work as thoroughly as you can — souls reached, activities completed, and any challenges."}
              </div>
            </div>

            {checkingExisting ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Checking for an existing submission...</div>
            ) : existingProof ? (
              /* #102 — a pending proof already exists for this milestone.
                 Show what was actually submitted instead of an empty form,
                 so returning here never looks like the submission vanished. */
              <div style={{ background: "rgba(232,179,75,0.06)", borderRadius: 14, border: "1px solid rgba(232,179,75,0.25)", padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>⏳</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e8b34b" }}>Already submitted — waiting on your pastor's review</span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Your Field Report / Description:</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.75, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", marginBottom: existingProof.media_url ? 12 : 0 }}>
                  {existingProof.description}
                </div>
                {existingProof.media_url && (
                  <a href={existingProof.media_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(91,156,246,0.1)", border: "1px solid rgba(91,156,246,0.25)", color: "#5b9cf6", fontSize: 13, textDecoration: "none", fontFamily: "Georgia, serif", fontWeight: 600 }}>
                    📎 View Your Submitted Evidence ↗
                  </a>
                )}
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 14 }}>
                  You'll be notified once your pastor approves or asks for changes. There's nothing more to do here right now.
                </div>
              </div>
            ) : (
              <>
                {/* Description */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Field Report / Description <span style={{ color: "#e85b5b" }}>*</span></div>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what was accomplished during this milestone. Include souls reached, activities completed, and any challenges. Be specific — your pastor will use this to verify the work."
                    style={{ ...inp, minHeight: 140, resize: "vertical", marginBottom: 0 }}
                  />
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>{description.length} characters</div>
                </div>

                {/* Media URL */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Photo / Video URL <span style={{ color: "rgba(255,255,255,0.2)" }}>(optional but recommended)</span></div>
                  <input
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="e.g. https://photos.google.com/... or YouTube link"
                    style={inp}
                  />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginBottom: 14, lineHeight: 1.6 }}>
                    Upload your photo/video to Google Photos, YouTube, or Dropbox and paste the link here. This evidence is key to your pastor's review.
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ background: "rgba(240,82,82,0.1)", border: "1px solid rgba(240,82,82,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#f05252" }}>
                    ⚠ {error}
                  </div>
                )}

                {/* Submit */}
                <button onClick={handleSubmit} disabled={submitting || !description.trim()}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none",
                    background: description.trim() ? "linear-gradient(135deg,#e8b34b,#c8942b)" : "rgba(255,255,255,0.06)",
                    color: description.trim() ? "#000" : "rgba(255,255,255,0.25)",
                    fontWeight: 700, cursor: description.trim() && !submitting ? "pointer" : "default",
                    fontSize: 15, fontFamily: "Georgia, serif",
                    boxShadow: description.trim() ? "0 6px 24px rgba(232,179,75,0.4)" : "none",
                    opacity: submitting ? 0.7 : 1, transition: "all .2s" }}>
                  {submitting ? "Submitting..." : "✝  Submit Milestone Proof to Pastor"}
                </button>

                <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 14 }}>
                  Your pastor will be notified to review this proof. Funds are only released after their approval.
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
