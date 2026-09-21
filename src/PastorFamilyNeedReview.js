// PastorFamilyNeedReview.js
// Pastor-facing endorsement screen for Family In Need requests linked to
// their church. Kept as its own standalone component rather than an
// internal tab inside PastorReview.js — same "no internal rewrite, lower
// risk" philosophy behind ProofCenter wrapping MilestoneProof/PastorReview
// as separate components instead of merging their internals.
//
// A pastor here can only ever move a request from submitted -> admin_review
// (endorse) or submitted -> pastor_declined (decline). Publishing, payout,
// and proof review all happen later in AdminFamilyNeeds.js.

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { sendNotification } from "./notifications";

// ── Photo upload helpers ─────────────────────────────────────────────────────
// Same compress-then-upload approach as MilestoneProof.js — kept duplicated
// here rather than shared, matching this codebase's existing convention of
// small helpers copied per-file (see CURRENCIES/convertToUSD across
// EmergencyRequests.js/FamilyNeeds.js) rather than a shared module system.
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
      for (const file of files) uploaded.push(await uploadProofPhoto(file, folder));
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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        {photos.map((url, i) => (
          <div key={i} style={{ position: "relative", width: 70, height: 70 }}>
            <img src={url} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)" }} />
            <button onClick={() => removeAt(i)} type="button"
              style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#e85b5b", color: "#fff", cursor: "pointer", fontSize: 11, lineHeight: "20px", padding: 0 }}>✕</button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ width: 70, height: 70, borderRadius: 10, border: "1px dashed rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", cursor: uploading ? "default" : "pointer", fontSize: 20, fontFamily: "Georgia, serif" }}>
            {uploading ? "…" : "+"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
      {error && <div style={{ fontSize: 12, color: "#e85b5b" }}>{error}</div>}
    </div>
  );
}

const fmt = (n) => String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const timeAgo = (d) => {
  if (!d) return "";
  const diff = Math.floor((new Date() - new Date(d)) / 1000);
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

const CATEGORY_META = {
  food:        { label: "🍲 Food",        color: "#e8b34b" },
  clothing:    { label: "👕 Clothing",     color: "#5b9cf6" },
  electricity: { label: "💡 Electricity",  color: "#f5a44a" },
  school:      { label: "🎒 School",       color: "#b06cf5" },
  medical:     { label: "🏥 Medical",      color: "#e85b5b" },
  other:       { label: "🤝 Other",        color: "#3ecf8e" },
};

export default function PastorFamilyNeedReview({ onBack, user, isAdmin }) {
  const [needs, setNeeds]       = useState([]);
  const [proofs, setProofs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("pending");
  const [acting, setActing]     = useState(null);
  const [error, setError]       = useState("");
  // Per-need accountability checkbox — must be ticked before Endorse enables.
  const [attested, setAttested] = useState({});
  // Per-need proof-submission draft — { [needId]: { description, photos: [], videoUrl } }
  const [proofDraft, setProofDraft] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: churchData } = await supabase
        .from("churches")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      // Same rule as PastorReview.js (#60 fix): admins see everything,
      // pastors see ONLY their own church's requests. Never fall back to
      // showing every church's requests if none is linked to this pastor.
      let query = supabase
        .from("family_needs")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        if (!churchData?.id) { setNeeds([]); setProofs([]); setLoading(false); return; }
        query = query.eq("church_id", churchData.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNeeds(data || []);

      const ids = (data || []).map(n => n.id);
      if (ids.length > 0) {
        const { data: proofData } = await supabase
          .from("family_need_proofs")
          .select("*")
          .in("need_id", ids)
          .order("submitted_at", { ascending: false });
        setProofs(proofData || []);
      } else {
        setProofs([]);
      }
    } catch (e) {
      setError("Could not load family needs. (" + (e.message || "") + ")");
      setNeeds([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const submitProof = async (n) => {
    const draft = proofDraft[n.id] || {};
    if (!draft.description || !draft.description.trim()) return;
    setActing(n.id);
    setError("");
    try {
      const { error } = await supabase.from("family_need_proofs").insert({
        need_id: n.id,
        description: draft.description.trim(),
        media_urls: (draft.photos && draft.photos.length > 0) ? draft.photos : null,
        media_url: draft.videoUrl || null,
        submitted_by: user?.id || null,
        status: "pending",
      });
      if (error) throw error;
      const { data: freshProofs } = await supabase
        .from("family_need_proofs")
        .select("*")
        .eq("need_id", n.id)
        .order("submitted_at", { ascending: false });
      setProofs(prev => [...(freshProofs || []), ...prev.filter(p => p.need_id !== n.id)]);
      setProofDraft(d => ({ ...d, [n.id]: { description: "", photos: [], videoUrl: "" } }));
    } catch (e) {
      setError("Could not submit proof. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  const endorse = async (n) => {
    if (!attested[n.id]) return;
    setActing(n.id);
    setError("");
    try {
      // App-layer column restriction: RLS only guards which ROWS a pastor
      // can touch (their own church's), not which columns — so this update
      // is deliberately scoped to ONLY the endorsement fields. Never add
      // other fields (goal, description, etc.) to this payload.
      const { error } = await supabase
        .from("family_needs")
        .update({
          status: "admin_review",
          pastor_endorsed_at: new Date().toISOString(),
          pastor_accountability_accepted: true,
        })
        .eq("id", n.id);
      if (error) throw error;
      setNeeds(prev => prev.map(x => x.id === n.id ? { ...x, status: "admin_review", pastor_endorsed_at: new Date().toISOString(), pastor_accountability_accepted: true } : x));

      // Confirmation email to the endorsing pastor — fire-and-forget, same
      // pattern as every other submission flow: a slow/failed email must
      // never block the endorsement from completing.
      const pastorEmail = user?.email;
      if (pastorEmail) {
        sendNotification("family_need_endorsed", pastorEmail, {
          pastorName: user?.user_metadata?.full_name || "",
          category: n.category,
          city: n.city,
        }).catch(err => console.error("family_need_endorsed email threw", err));
      }
    } catch (e) {
      setError("Could not endorse this request. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  const decline = async (n) => {
    const reason = window.prompt("Reason for declining this family's request (kept on file, not shown publicly):");
    if (reason === null) return; // cancelled
    if (!reason.trim()) { window.alert("A reason is required to decline."); return; }
    setActing(n.id);
    setError("");
    try {
      const { error } = await supabase
        .from("family_needs")
        .update({ status: "pastor_declined", pastor_decline_reason: reason.trim() })
        .eq("id", n.id);
      if (error) throw error;
      setNeeds(prev => prev.map(x => x.id === n.id ? { ...x, status: "pastor_declined", pastor_decline_reason: reason.trim() } : x));
    } catch (e) {
      setError("Could not decline this request. (" + (e.message || "") + ")");
    }
    setActing(null);
  };

  // A "paid" need still needs a proof (this is the whole point of the
  // pastor-submits-proof step); a need that already has a pending or
  // approved proof drops out of this list.
  const needsAwaitingProof = needs.filter(n =>
    n.status === "paid" &&
    !proofs.some(p => p.need_id === n.id && (p.status === "pending" || p.status === "approved"))
  );

  const counts = {
    pending:  needs.filter(n => n.status === "submitted").length,
    reviewed: needs.filter(n => ["admin_review","published","funded","paid","complete","pastor_declined"].includes(n.status)).length,
    proof:    needsAwaitingProof.length,
  };
  const filtered = filter === "pending"
    ? needs.filter(n => n.status === "submitted")
    : filter === "reviewed"
    ? needs.filter(n => ["admin_review","published","funded","paid","complete","pastor_declined"].includes(n.status))
    : [];

  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ maxWidth:700, margin:"0 auto", padding:"24px 20px 60px" }}>

        <div style={{ background:"rgba(62,207,142,0.06)", borderRadius:14, border:"1px solid rgba(62,207,142,0.2)", padding:"14px 18px", marginBottom:20, fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7 }}>
          <strong style={{ color:"#3ecf8e" }}>Your endorsement is an accountability attestation</strong> — by endorsing, you are personally vouching that this family is known to your church and this need is genuine. Funds will be paid to your church, not directly to the family, and you'll be asked for proof of how the funds were used afterward.
        </div>

        {error && <div style={{ background:"rgba(232,91,91,0.08)", border:"1px solid rgba(232,91,91,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:16, color:"#e85b5b", fontSize:13 }}>{error}</div>}

        <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:10, padding:3, gap:3, marginBottom:20, width:"fit-content", flexWrap:"wrap" }}>
          {[["pending",`Awaiting You (${counts.pending})`],["proof",`Submit Proof (${counts.proof})`],["reviewed",`Reviewed (${counts.reviewed})`]].map(([key,label]) => (
            <button key={key} onClick={()=>setFilter(key)} style={{ padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif", fontWeight:600,
              background: filter===key ? "linear-gradient(135deg,#3ecf8e,#2aaf74)" : "transparent",
              color: filter===key ? "#000" : "rgba(255,255,255,0.4)",
            }}>{label}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading...</div>}

        {/* ── Submit Proof tab ─────────────────────────────────────────── */}
        {!loading && filter === "proof" && (
          needsAwaitingProof.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>No family needs awaiting proof right now.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {needsAwaitingProof.map(n => {
                const meta = CATEGORY_META[n.category] || CATEGORY_META.other;
                const draft = proofDraft[n.id] || { description:"", photos:[], videoUrl:"" };
                const setDraft = (k,v) => setProofDraft(d => ({ ...d, [n.id]: { ...draft, [k]: v } }));
                const priorRejected = proofs.find(p => p.need_id === n.id && p.status === "rejected");
                return (
                  <div key={n.id} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${meta.color}33`, borderLeft:`4px solid ${meta.color}`, padding:20 }}>
                    <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap", alignItems:"center" }}>
                      <span style={{ fontSize:12, padding:"3px 10px", borderRadius:999, background:`${meta.color}18`, color:meta.color, border:`1px solid ${meta.color}33`, fontWeight:600 }}>{meta.label}</span>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {n.city}, {n.country} · Paid ${fmt(n.goal)}</span>
                    </div>
                    {priorRejected && (
                      <div style={{ background:"rgba(232,91,91,0.08)", border:"1px solid rgba(232,91,91,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:"rgba(255,255,255,0.6)" }}>
                        <strong style={{ color:"#e85b5b" }}>Your last proof needed revision.</strong> Please submit an updated one below.
                      </div>
                    )}
                    <textarea
                      placeholder="How were the funds used? e.g. 'Paid the family's electricity reconnection fee and purchased a week of groceries.'"
                      value={draft.description}
                      onChange={e=>setDraft("description", e.target.value)}
                      style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"#eef1ff", fontSize:13, fontFamily:"Georgia, serif", outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box", marginBottom:14 }}
                    />
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>Photos <span style={{ color:"rgba(255,255,255,0.2)" }}>(optional but recommended — up to 3)</span></div>
                    <div style={{ marginBottom:14 }}>
                      <PhotoUploader photos={draft.photos} onChange={(photos)=>setDraft("photos", photos)} folder={`family-needs/${n.id}`} max={3} />
                    </div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>Video Link <span style={{ color:"rgba(255,255,255,0.2)" }}>(optional)</span></div>
                    <input placeholder="Paste a YouTube link here once you have one" value={draft.videoUrl}
                      onChange={e=>setDraft("videoUrl", e.target.value)}
                      style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"#eef1ff", fontSize:13, fontFamily:"Georgia, serif", outline:"none", boxSizing:"border-box", marginBottom:6 }}/>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginBottom:14, lineHeight:1.6 }}>
                      📹 Have a video and no YouTube link yet? WhatsApp the video to SendMe admin directly — they'll upload it and can add the link here for you.
                    </div>
                    <button onClick={()=>submitProof(n)} disabled={acting===n.id||!draft.description.trim()}
                      style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"none",
                        background:draft.description.trim()?"linear-gradient(135deg,#3ecf8e,#2aaf74)":"rgba(255,255,255,0.06)",
                        color:draft.description.trim()?"#000":"rgba(255,255,255,0.25)",
                        fontWeight:700, cursor:draft.description.trim()?"pointer":"default", fontSize:13, fontFamily:"Georgia, serif" }}>
                      {acting===n.id?"Submitting...":"Submit Proof"}
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {!loading && filter !== "proof" && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            {filter === "pending" ? "No family needs awaiting your endorsement." : "No reviewed family needs yet."}
          </div>
        )}

        {filter !== "proof" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {filtered.map(n => {
            const meta = CATEGORY_META[n.category] || CATEGORY_META.other;
            const isPending = n.status === "submitted";
            return (
              <div key={n.id} style={{ background:"#0c1628", borderRadius:16, border:`1px solid ${meta.color}33`, borderLeft:`4px solid ${meta.color}`, padding:20 }}>
                <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ fontSize:12, padding:"3px 10px", borderRadius:999, background:`${meta.color}18`, color:meta.color, border:`1px solid ${meta.color}33`, fontWeight:600 }}>{meta.label}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {n.city}, {n.country} · {timeAgo(n.created_at)}</span>
                </div>

                <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:4 }}>Family: {n.applicant_name} {n.household_size ? `· ${n.household_size} in household` : ""}</div>
                {(n.applicant_phone || n.applicant_email) && (
                  <div style={{ fontSize:12, color:"rgba(232,179,75,0.7)", marginBottom:8 }}>✉ {n.applicant_email || ""}{n.applicant_phone ? " · " + n.applicant_phone : ""}</div>
                )}
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom:12 }}>{n.description}</div>
                <div style={{ fontSize:13, fontWeight:700, color:meta.color }}>Amount needed: ${fmt(n.goal)}</div>

                {n.status === "pastor_declined" && n.pastor_decline_reason && (
                  <div style={{ background:"rgba(232,91,91,0.08)", border:"1px solid rgba(232,91,91,0.2)", borderRadius:10, padding:"10px 14px", marginTop:10, fontSize:12, color:"rgba(255,255,255,0.6)" }}>
                    <strong style={{ color:"#e85b5b" }}>You declined:</strong> {n.pastor_decline_reason}
                  </div>
                )}
                {n.status !== "submitted" && n.status !== "pastor_declined" && (
                  <div style={{ fontSize:12, color:"#3ecf8e", marginTop:10 }}>✓ Endorsed {timeAgo(n.pastor_endorsed_at)} — now with SendMe admin ({n.status.replace("_"," ")})</div>
                )}

                {isPending && (
                  <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:16, paddingTop:16 }}>
                    <div onClick={()=>setAttested(a => ({ ...a, [n.id]: !a[n.id] }))}
                      style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", padding:"12px 14px", borderRadius:10,
                        background:attested[n.id]?"rgba(62,207,142,0.08)":"rgba(255,255,255,0.02)",
                        border:`1px solid ${attested[n.id]?"rgba(62,207,142,0.35)":"rgba(255,255,255,0.07)"}`, marginBottom:12 }}>
                      <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13,
                        background:attested[n.id]?"linear-gradient(135deg,#3ecf8e,#2aaf74)":"rgba(255,255,255,0.05)",
                        border:attested[n.id]?"none":"1px solid rgba(255,255,255,0.15)" }}>
                        {attested[n.id]?"✓":""}
                      </div>
                      <span style={{ fontSize:13, color:attested[n.id]?"#eef1ff":"rgba(255,255,255,0.45)", lineHeight:1.65 }}>
                        I personally know this family, I vouch that this need is genuine, and I accept responsibility for how any funds released to my church are used for this family.
                      </span>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      <button onClick={()=>endorse(n)} disabled={acting===n.id||!attested[n.id]}
                        style={{ padding:"12px 0", borderRadius:12, border:"none",
                          background:attested[n.id]?"linear-gradient(135deg,#3ecf8e,#2aaf74)":"rgba(255,255,255,0.06)",
                          color:attested[n.id]?"#000":"rgba(255,255,255,0.25)",
                          fontWeight:700, cursor:attested[n.id]?"pointer":"default", fontSize:13, fontFamily:"Georgia, serif" }}>
                        {acting===n.id?"Saving...":"✓ Endorse"}
                      </button>
                      <button onClick={()=>decline(n)} disabled={acting===n.id}
                        style={{ padding:"12px 0", borderRadius:12, border:"1px solid rgba(232,91,91,0.35)", background:"rgba(232,91,91,0.08)", color:"#e85b5b", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                        ✗ Decline
                      </button>
                    </div>
                    {!attested[n.id] && <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:8, textAlign:"center" }}>Tick the attestation above to enable Endorse.</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
