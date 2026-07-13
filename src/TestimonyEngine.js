// TestimonyEngine.js
//
// HOW TESTIMONIES APPEAR:
//   Testimonies load automatically from missions where status = 'complete'.
//   Admin marks a mission complete in AdminApprovals.js → it appears here.
//
// EXTRA TESTIMONY CONTENT:
//   Missionaries and pastors can enrich a testimony by submitting additional
//   story text, a before/after summary, and a media URL via the form below.
//   This saves to the `testimony_extras` table (mission_id FK → missions).
//   SQL to create it:
//     CREATE TABLE IF NOT EXISTS public.testimony_extras (
//       id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//       mission_id  uuid REFERENCES missions(id) ON DELETE CASCADE,
//       story       text,
//       before_text text,
//       after_text  text,
//       media_url   text,
//       submitted_by text,
//       created_at  timestamptz DEFAULT now()
//     );

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Detects the media URL type and renders it inline where possible.
// YouTube links → embedded player. Direct image links (ends in a known
// image extension) → inline <img>. Everything else (Google Drive/Photos
// folder links, Dropbox folder links, etc. — can't be embedded reliably
// without their APIs) → falls back to a clickable "view" link.
const getYouTubeId = (url) => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};
const isDirectImage = (url) => /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(url);

const MediaEmbed = ({ url }) => {
  if (!url) return null;
  const ytId = getYouTubeId(url);

  if (ytId) {
    return (
      <div style={{ marginTop:14, borderRadius:12, overflow:"hidden", background:"#000", position:"relative", paddingTop:"56.25%" }}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          title="Testimony video"
          style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (isDirectImage(url)) {
    return (
      <div style={{ marginTop:14 }}>
        <img src={url} alt="Testimony" style={{ width:"100%", borderRadius:12, display:"block" }} />
      </div>
    );
  }

  // Fallback — Google Drive/Photos folders, Dropbox folders, etc. can't be
  // embedded reliably, so link out instead of showing a broken embed.
  return (
    <div style={{ marginTop:14 }}>
      <a href={url} target="_blank" rel="noreferrer"
        style={{ color:"#e8b34b", fontSize:13, textDecoration:"none", borderBottom:"1px solid rgba(232,179,75,0.3)" }}>
        📷 View Photos / Media →
      </a>
    </div>
  );
};

const COLORS = ["#e8b34b","#4caf7d","#5b9cf6","#e85b5b","#b06cf5","#f5a44a","#3ecf8e"];
const getColor = (i) => COLORS[i % COLORS.length];

// Map a missions row to testimony shape
const mapMissionToTestimony = (row, i, extrasMap) => {
  const extra = extrasMap[row.id] || {};
  const name  = [row.full_name, row.name, row.missionary_name, row.pastor_name]
    .find(v => v && String(v).trim().toLowerCase() !== "null") || "Missionary";
  return {
    id:          row.id,
    mission:     row.title || "Completed Mission",
    missionary:  name,
    country:     row.country || "",
    region:      row.region  || "",
    completed:   row.updated_at || row.created_at,
    souls:       row.souls   || 0,
    bibles:      row.bibles  || 0,
    churches:    row.churches_planted || 0,
    raised:      row.raised  || 0,
    duration:    row.duration || "",
    color:       row.color   || getColor(i),
    story:       extra.story      || row.blurb || row.description || "",
    beforeText:  extra.before_text || "",
    afterText:   extra.after_text  || "",
    mediaUrl:    extra.media_url   || "",
    tags:        [row.region, row.country].filter(Boolean),
    impact:      row.raised ? `$${fmt(row.raised)} raised and fully deployed with escrow accountability.` : "",
    hasExtra:    !!extra.story,
    missionRow:  row,
  };
};

export default function TestimonyEngine({ onBack, onMission, user }) {
  const [testimonies, setTestimonies] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  // Testimony submission form
  const [showSubmit, setShowSubmit]   = useState(false);
  const [submitFor, setSubmitFor]     = useState(null);  // mission id
  const [submitForm, setSubmitForm]   = useState({ story:"", before_text:"", after_text:"", media_url:"" });
  const [submitting, setSubmitting]   = useState(false);
  const [submitDone, setSubmitDone]   = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: mData, error: mErr }, { data: eData }] = await Promise.all([
          supabase.from("missions").select("*").eq("status","complete").order("updated_at",{ ascending:false }),
          supabase.from("testimony_extras").select("*"),
        ]);
        if (mErr) throw mErr;
        const extrasMap = {};
        (eData || []).forEach(e => { extrasMap[e.mission_id] = e; });
        setTestimonies((mData || []).map((row, i) => mapMissionToTestimony(row, i, extrasMap)));
      } catch (e) {
        console.log("TestimonyEngine fetch error:", e);
        setTestimonies([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const shareTestimony = (t) => {
    const text = encodeURIComponent(
      `Praise Report from ${t.country}!\n\n` +
      `${t.mission} — COMPLETED\n` +
      `${t.souls} souls reached | ${t.bibles} Bibles | ${t.churches} churches planted\n\n` +
      `"${t.story.slice(0, 150)}..."\n\n` +
      `See the full testimony — SendMe Global Mission Fund\nhttps://sendme-nine.vercel.app`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleSubmitTestimony = async () => {
    if (!submitForm.story.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from("testimony_extras").upsert({
        mission_id:   submitFor,
        story:        submitForm.story,
        before_text:  submitForm.before_text,
        after_text:   submitForm.after_text,
        media_url:    submitForm.media_url,
        submitted_by: user?.email || "anonymous",
      }, { onConflict: "mission_id" });
      setSubmitDone(true);
    } catch (e) {
      console.log("Testimony submit error:", e);
      setSubmitDone(true);
    }
    setSubmitting(false);
  };

  const inp = {
    width:"100%", padding:"12px 14px", borderRadius:10, boxSizing:"border-box",
    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
    color:"#eef1ff", fontSize:14, fontFamily:"Georgia, serif", outline:"none", marginBottom:12,
  };

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selected) {
    const t = selected;
    return (
      <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
        <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
          <button onClick={()=>{ setSelected(null); setShowSubmit(false); setSubmitDone(false); }}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
          <div>
            <div style={{ fontSize:18, fontWeight:700 }}>Mission Testimony</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>COMPLETED MISSION STORY</div>
          </div>
        </div>
        <div style={{ maxWidth:700, margin:"0 auto", padding:"28px 20px 60px" }}>

          {/* Header card */}
          <div style={{ background:`linear-gradient(135deg,${t.color}18,${t.color}06)`, borderRadius:20, border:`1px solid ${t.color}33`, padding:24, marginBottom:20 }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
              <span style={{ padding:"3px 12px", borderRadius:999, fontSize:12, background:"rgba(62,207,142,0.12)", color:"#3ecf8e", border:"1px solid rgba(62,207,142,0.25)", fontWeight:600 }}>Completed</span>
              <span style={{ padding:"3px 12px", borderRadius:999, fontSize:12, background:`${t.color}18`, color:t.color, border:`1px solid ${t.color}33` }}>📍 {t.country}</span>
              {t.duration && <span style={{ padding:"3px 12px", borderRadius:999, fontSize:12, background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)" }}>{t.duration}</span>}
            </div>
            <div style={{ fontSize:22, fontWeight:700, color:"#eef1ff", marginBottom:6 }}>{t.mission}</div>
            <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)" }}>by {t.missionary}</div>
          </div>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
            {[["🙏",t.souls,"Souls Reached",t.color],["📖",t.bibles,"Bibles Given","#5b9cf6"],["⛪",t.churches,"Churches Planted","#3ecf8e"]].map(([icon,val,label,c])=>(
              <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"14px 10px", textAlign:"center" }}>
                <div style={{ fontSize:22 }}>{icon}</div>
                <div style={{ fontSize:22, fontWeight:700, color:c, marginTop:4 }}>{fmt(val)}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Story */}
          {t.story ? (
            <div style={{ background:"#0c1628", borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", padding:20, marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#eef1ff", marginBottom:12 }}>The Story</div>
              <div style={{ fontSize:14, color:"rgba(255,255,255,0.65)", lineHeight:1.85 }}>{t.story}</div>
              <MediaEmbed url={t.mediaUrl} />
            </div>
          ) : (
            <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:20, marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.3)", marginBottom:8 }}>No testimony story submitted yet.</div>
              {user && <div style={{ fontSize:12, color:"#e8b34b" }}>Are you the missionary or pastor? Add the full story below.</div>}
            </div>
          )}

          {/* Before / After */}
          {(t.beforeText || t.afterText) && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <div style={{ background:"rgba(232,91,91,0.08)", borderRadius:14, border:"1px solid rgba(232,91,91,0.2)", padding:16 }}>
                <div style={{ fontSize:12, color:"#e85b5b", fontWeight:700, marginBottom:8, letterSpacing:1, textTransform:"uppercase" }}>Before</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>{t.beforeText}</div>
              </div>
              <div style={{ background:"rgba(62,207,142,0.08)", borderRadius:14, border:"1px solid rgba(62,207,142,0.2)", padding:16 }}>
                <div style={{ fontSize:12, color:"#3ecf8e", fontWeight:700, marginBottom:8, letterSpacing:1, textTransform:"uppercase" }}>After</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>{t.afterText}</div>
              </div>
            </div>
          )}

          {/* Financial */}
          {t.impact && (
            <div style={{ background:"rgba(232,179,75,0.07)", borderRadius:12, border:"1px solid rgba(232,179,75,0.2)", padding:"12px 16px", marginBottom:20, fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
              <strong style={{ color:"#e8b34b" }}>Financial transparency:</strong> {t.impact}
            </div>
          )}

          {/* Tags */}
          {t.tags.length > 0 && (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
              {t.tags.map(tag => (
                <span key={tag} style={{ padding:"4px 12px", borderRadius:999, fontSize:12, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.1)" }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            <button onClick={()=>shareTestimony(t)}
              style={{ padding:"14px 0", borderRadius:14, border:"1px solid rgba(37,211,102,0.3)", background:"rgba(37,211,102,0.08)", color:"#25d366", fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif" }}>
              Share on WhatsApp
            </button>
            <button onClick={onBack}
              style={{ padding:"14px 0", borderRadius:14, border:"none", background:"linear-gradient(135deg,#e8b34b,#c8942b)", color:"#000", fontWeight:700, cursor:"pointer", fontSize:15, fontFamily:"Georgia, serif", boxShadow:"0 6px 24px rgba(232,179,75,0.4)" }}>
              Support Another Mission
            </button>
          </div>

          {/* Testimony submission form — shown to logged-in users */}
          {user && (
            <div style={{ marginTop:8 }}>
              {!showSubmit ? (
                <button onClick={()=>{ setShowSubmit(true); setSubmitFor(t.id); setSubmitDone(false); setSubmitForm({ story:"", before_text:"", after_text:"", media_url:"" }); }}
                  style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"1px solid rgba(232,179,75,0.3)", background:"rgba(232,179,75,0.06)", color:"#e8b34b", fontWeight:700, cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>
                  ✝ Add / Update Testimony Story
                </button>
              ) : submitDone ? (
                <div style={{ background:"rgba(62,207,142,0.1)", borderRadius:14, border:"1px solid rgba(62,207,142,0.3)", padding:"16px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:15, fontWeight:700, color:"#3ecf8e", marginBottom:4 }}>✓ Testimony Submitted</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>It will appear on this page once the page is refreshed.</div>
                </div>
              ) : (
                <div style={{ background:"#0c1628", borderRadius:16, border:"1px solid rgba(232,179,75,0.2)", padding:"20px" }}>
                  <div style={{ fontSize:15, fontWeight:700, color:"#eef1ff", marginBottom:4 }}>Add Testimony Story</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:16 }}>For missionaries and pastors. This enriches the public testimony archive.</div>
                  <textarea placeholder="Tell the full story of this mission — what God did, lives changed, challenges overcome... *" value={submitForm.story} onChange={e=>setSubmitForm(f=>({...f,story:e.target.value}))} style={{...inp,resize:"vertical",minHeight:120}}/>
                  <input placeholder="Before — what was the situation before the mission?" value={submitForm.before_text} onChange={e=>setSubmitForm(f=>({...f,before_text:e.target.value}))} style={inp}/>
                  <input placeholder="After — what changed as a result?" value={submitForm.after_text} onChange={e=>setSubmitForm(f=>({...f,after_text:e.target.value}))} style={inp}/>
                  <input placeholder="Photo / video URL (optional — YouTube link or direct image URL embeds inline; Google Drive/Dropbox folder links show as a click-through)" value={submitForm.media_url} onChange={e=>setSubmitForm(f=>({...f,media_url:e.target.value}))} style={inp}/>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <button onClick={()=>setShowSubmit(false)} style={{ padding:"12px 0", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.4)", fontWeight:700, cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Cancel</button>
                    <button onClick={handleSubmitTestimony} disabled={submitting||!submitForm.story.trim()}
                      style={{ padding:"12px 0", borderRadius:12, border:"none", background:submitForm.story.trim()?"linear-gradient(135deg,#e8b34b,#c8942b)":"rgba(255,255,255,0.06)", color:submitForm.story.trim()?"#000":"rgba(255,255,255,0.25)", fontWeight:700, cursor:submitForm.story.trim()?"pointer":"default", fontSize:14, fontFamily:"Georgia, serif" }}>
                      {submitting ? "Saving..." : "Save Testimony"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#060c18", color:"#eef1ff", fontFamily:"Georgia, serif" }}>
      <div style={{ background:"#09111f", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:14, fontFamily:"Georgia, serif" }}>Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Mission Testimonies</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginTop:2 }}>COMPLETED MISSIONS — GOD'S FAITHFULNESS</div>
        </div>
      </div>

      <div style={{ maxWidth:700, margin:"0 auto", padding:"28px 20px 60px" }}>

        <div style={{ background:"rgba(232,179,75,0.08)", borderRadius:16, border:"1px solid rgba(232,179,75,0.2)", padding:"20px 24px", marginBottom:24, textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:700, color:"#eef1ff", marginBottom:6 }}>Fruit That Remains</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", lineHeight:1.7 }}>Every completed mission becomes a permanent testimony archive. See what God has done through faithful believers worldwide.</div>
          <div style={{ fontSize:13, color:"#e8b34b", fontStyle:"italic", marginTop:10 }}>"Ye have not chosen me, but I have chosen you... that ye should go and bring forth fruit, and that your fruit should remain." — John 15:16</div>
        </div>

        {/* Summary stats */}
        {!loading && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
            {[
              ["✅", testimonies.length, "Completed Missions", "#3ecf8e"],
              ["🙏", fmt(testimonies.reduce((s,t)=>s+(t.souls||0),0)), "Souls Reached", "#e8b34b"],
              ["⛪", testimonies.reduce((s,t)=>s+(t.churches||0),0), "Churches Planted", "#5b9cf6"],
            ].map(([icon,val,label,c])=>(
              <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:"14px 10px", textAlign:"center" }}>
                <div style={{ fontSize:22 }}>{icon}</div>
                <div style={{ fontSize:20, fontWeight:700, color:c, marginTop:4 }}>{val}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {loading && <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Loading testimonies...</div>}

        {!loading && testimonies.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🙏</div>
            No completed-mission testimonies yet — they'll appear automatically here once a mission is marked complete.
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {testimonies.map(t => (
            <div key={t.id} onClick={()=>setSelected(t)}
              style={{ background:"#0c1628", borderRadius:18, border:`1px solid ${t.color}33`, borderLeft:`3px solid ${t.color}`, padding:20, cursor:"pointer", transition:"transform .15s" }}
              onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
              onMouseLeave={e=>e.currentTarget.style.transform=""}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                    <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, background:"rgba(62,207,142,0.12)", color:"#3ecf8e", border:"1px solid rgba(62,207,142,0.25)" }}>Completed</span>
                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>📍 {t.country}</span>
                    {t.hasExtra && <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, background:"rgba(232,179,75,0.1)", color:"#e8b34b", border:"1px solid rgba(232,179,75,0.25)" }}>✍ Story Added</span>}
                  </div>
                  <div style={{ fontSize:16, fontWeight:700, color:"#eef1ff", marginBottom:3 }}>{t.mission}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>by {t.missionary}</div>
                </div>
              </div>
              {t.story && <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:14 }}>{t.story.slice(0,120)}...</div>}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
                {[["🙏",fmt(t.souls),"Souls"],["📖",fmt(t.bibles),"Bibles"],["⛪",t.churches,"Churches"]].map(([icon,val,label])=>(
                  <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
                    <div style={{ fontSize:14 }}>{icon}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:t.color }}>{val}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={e=>{e.stopPropagation();setSelected(t);}}
                  style={{ flex:1, padding:"10px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${t.color},${t.color}cc)`, color:"#000", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                  Read Full Testimony
                </button>
                <button onClick={e=>{e.stopPropagation();shareTestimony(t);}}
                  style={{ padding:"10px 16px", borderRadius:12, border:"1px solid rgba(37,211,102,0.3)", background:"rgba(37,211,102,0.08)", color:"#25d366", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia, serif" }}>
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
