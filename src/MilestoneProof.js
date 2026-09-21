import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { sendNotification, notifyAdmin } from "./notifications";
import { ADMIN_EMAIL } from "./AdminPayouts";

// ── Photo upload helpers ─────────────────────────────────────────────────────
// Resizes/compresses an image in-browser before upload (max 1600px on the
// longest side, JPEG quality 0.8) so storage and bandwidth stay cheap even
// as submissions grow — a full-resolution phone photo can be 8-12MB; this
// brings it down to a few hundred KB with no visible quality loss at the
// sizes these are ever viewed at (admin/pastor review screens, not print).
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => { img.src = e.target.result; };
    img.onerror = reject;
    img.onload = () => {
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not process image")), "image/jpeg", 0.8);
    };
    reader.readAsDataURL(file);
  });
}

async function uploadProofPhoto(file, folder) {
  const compressed = await compressImage(file);
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("proof-media").upload(fileName, compressed, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("proof-media").getPublicUrl(fileName);
  return data.publicUrl;
}

// Reusable photo picker — up to `max` photos, each compressed and uploaded
// immediately on selection so by the time Submit is pressed the URLs are
// already sitting in state, ready to insert.
function PhotoUploader({ photos, onChange, folder, max = 3 }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, max - photos.length);
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadProofPhoto(file, folder));
      }
      onChange([...photos, ...uploaded]);
    } catch (err) {
      setError("Could not upload photo. Please check your connection and try again. (" + (err.message || "") + ")");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (i) => onChange(photos.filter((_, idx) => idx !== i));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        {photos.map((url, i) => (
          <div key={i} style={{ position: "relative", width: 80, height: 80 }}>
            <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)" }} />
            <button onClick={() => removeAt(i)} type="button"
              style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "#e85b5b", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "22px", padding: 0 }}>✕</button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ width: 80, height: 80, borderRadius: 10, border: "1px dashed rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", cursor: uploading ? "default" : "pointer", fontSize: 22, fontFamily: "Georgia, serif" }}>
            {uploading ? "…" : "+"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
      {error && <div style={{ fontSize: 12, color: "#e85b5b" }}>{error}</div>}
    </div>
  );
}

export default function MilestoneProof({ onBack, user }) {
  const [missions, setMissions]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos]         = useState([]);
  const [mediaUrl, setMediaUrl]     = useState("");
  // #97 — optional impact numbers reported alongside the field report. Only
  // added to the mission's running totals once the pastor approves this
  // proof (see PastorReview.js), same trust model as fund release.
  const [soulsReached, setSoulsReached]         = useState("");
  const [biblesDistributed, setBiblesDistributed] = useState("");
  const [churchesStarted, setChurchesStarted]   = useState("");
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
        .select("id, description, media_url, media_urls, status, submitted_at")
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
        media_urls: photos.length > 0 ? photos : null,
        souls_reached: soulsReached ? Number(soulsReached) : null,
        bibles_distributed: biblesDistributed ? Number(biblesDistributed) : null,
        churches_started: churchesStarted ? Number(churchesStarted) : null,
        status: "pending",
        submitted_at: new Date().toISOString(),
      });
      if (error) throw error;
      sendNotification("proof_submitted", selected.pastor_email, {
        pastorName: selected.pastor_name,
        missionaryName: user?.user_metadata?.full_name,
        missionTitle: selected.title,
        milestoneNumber: selected.current_milestone || 1,
        // #101 — previously not passed at all, so the email's "Review Proof
        // Now" button always fell back to the bare homepage instead of
        // taking the pastor anywhere useful.
        reviewUrl: `${window.location.origin}/pastor-review`,
      });

      // Admin previously received NO notification at all when a proof was
      // submitted — only the pastor did. Fire-and-forget, same pattern as
      // donation notifications: never blocks or fails the actual submission
      // above if either of these fail.
      const adminNotifyData = {
        missionaryName: user?.user_metadata?.full_name,
        missionTitle: selected.title,
        milestoneNumber: selected.current_milestone || 1,
        pastorName: selected.pastor_name,
        adminUrl: `${window.location.origin}/pastor-review`,
      };
      sendNotification("admin_proof_submitted", ADMIN_EMAIL, adminNotifyData);
      notifyAdmin("proof_submitted", adminNotifyData);
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
            Upload evidence of your completed milestone — up to 3 photos, and a written report. Your pastor will review and approve it. Once approved, SendMe will release the next milestone's funds to your church.
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
              {missions.map(m => {
                // SendMe missions are a fixed 3-milestone structure
                // everywhere else in the app (Admin Approvals, Mark
                // Complete, etc). current_milestone advances to 4 once
                // Milestone 3 is approved — that's the signal for Admin to
                // mark the mission complete, NOT an invitation to submit a
                // 4th milestone. This was previously unbounded, so a
                // missionary could keep submitting proofs indefinitely.
                const allMilestonesDone = (m.current_milestone || 1) > 3;
                return (
                  <div key={m.id} onClick={() => { if (!allMilestonesDone) setSelected(m); }}
                    style={{ background: selected?.id === m.id ? "rgba(232,179,75,0.1)" : "rgba(255,255,255,0.03)", borderRadius: 14, border: `1px solid ${selected?.id === m.id ? "rgba(232,179,75,0.5)" : "rgba(255,255,255,0.08)"}`, padding: "16px 18px", cursor: allMilestonesDone ? "default" : "pointer", transition: "all .15s", opacity: allMilestonesDone ? 0.7 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#eef1ff" }}>{m.title}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>📍 {m.city ? `${m.city}, ` : ""}{m.country}</div>
                      </div>
                      {allMilestonesDone ? (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: "#3ecf8e", fontWeight: 700 }}>✓ All 3 Done</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Awaiting completion</div>
                        </div>
                      ) : (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: "#e8b34b", fontWeight: 700 }}>Milestone</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: "#e8b34b" }}>{m.current_milestone || 1}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selected && (selected.current_milestone || 1) > 3 && (
          <div style={{ background: "rgba(62,207,142,0.08)", borderRadius: 16, border: "1px solid rgba(62,207,142,0.25)", padding: "20px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏆</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#3ecf8e", marginBottom: 6 }}>All 3 Milestones Complete!</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
              Every milestone for this mission has been submitted and approved. SendMe Admin will mark this mission complete and it will appear as a testimony. There's nothing more to submit here.
            </div>
          </div>
        )}

        {selected && (selected.current_milestone || 1) <= 3 && (
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
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.75, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", marginBottom: (existingProof.media_urls?.length || existingProof.media_url) ? 12 : 0 }}>
                  {existingProof.description}
                </div>
                {existingProof.media_urls?.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: existingProof.media_url ? 12 : 0 }}>
                    {existingProof.media_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)" }} />
                      </a>
                    ))}
                  </div>
                )}
                {existingProof.media_url && (
                  <a href={existingProof.media_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(91,156,246,0.1)", border: "1px solid rgba(91,156,246,0.25)", color: "#5b9cf6", fontSize: 13, textDecoration: "none", fontFamily: "Georgia, serif", fontWeight: 600 }}>
                    📎 View Your Submitted Video/Link ↗
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

                {/* Photos — real upload, up to 3 */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Photos <span style={{ color: "rgba(255,255,255,0.2)" }}>(optional but recommended — up to 3)</span></div>
                  <PhotoUploader photos={photos} onChange={setPhotos} folder={`missions/${selected.id}`} max={3} />
                </div>

                {/* Video link — WhatsApp workflow, not an upload */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Video Link <span style={{ color: "rgba(255,255,255,0.2)" }}>(optional)</span></div>
                  <input
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="Paste a YouTube link here once you have one"
                    style={inp}
                  />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginBottom: 14, lineHeight: 1.6 }}>
                    📹 Have a video and no YouTube link yet? WhatsApp the video to SendMe admin directly — they'll upload it and can add the link to this proof for you.
                  </div>
                </div>

                {/* #97 — impact numbers. Optional, and only added to the
                    mission's public totals once your pastor approves this
                    proof — so the numbers on Mission Detail are always
                    pastor-verified, not self-reported. */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Impact This Milestone <span style={{ color: "rgba(255,255,255,0.2)" }}>(optional — counted toward the mission's public totals once approved)</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>🙏 Souls Reached</div>
                      <input type="number" min="0" value={soulsReached} onChange={e => setSoulsReached(e.target.value)} placeholder="0" style={{ ...inp, marginBottom: 0 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>📖 Bibles Given</div>
                      <input type="number" min="0" value={biblesDistributed} onChange={e => setBiblesDistributed(e.target.value)} placeholder="0" style={{ ...inp, marginBottom: 0 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>⛪ Churches Started</div>
                      <input type="number" min="0" value={churchesStarted} onChange={e => setChurchesStarted(e.target.value)} placeholder="0" style={{ ...inp, marginBottom: 0 }} />
                    </div>
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
